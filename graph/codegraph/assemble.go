// 本文件实现查询结果的输出装配：在 Neighborhood 的 raw BFS 之后投影、折叠、附源码与预算截断。
// 边界：不改图、不重跑 BFS、不写 baseline；CLI 与 context 共用这里的 wire 形状。
package codegraph

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"sort"
)

const (
	// DefaultUtilSharedByDomains is the minimum number of caller domains for a shared node.
	DefaultUtilSharedByDomains = 3
	// DefaultExternalRepresentatives bounds representatives in one folded domain item.
	DefaultExternalRepresentatives = 3
	// DefaultContextDepth is the fixed main-chain depth used by context.
	DefaultContextDepth = 3
	// DefaultContextFocusQuota bounds context's main-chain focus set.
	DefaultContextFocusQuota = 5
	// DefaultSourceSpan is the default source window size when source is requested.
	DefaultSourceSpan = 40
	// MaxSourceSpan is the largest source window accepted by the wire API.
	MaxSourceSpan = 200
	// DefaultMaxTokens is the CLI's approximate output budget.
	DefaultMaxTokens = 30000
)

// QueryOptions controls projection, folding, source attachment, and approximate budget.
type QueryOptions struct {
	Full         bool
	FoldExternal bool
	CollapseUtil bool
	WithSource   bool
	SourceSpan   int
	MaxTokens    int
}

// SourceWindow is a 1-based source excerpt returned for a graph node.
type SourceWindow struct {
	From  int      `json:"from"`
	Lines []string `json:"lines"`
}

// TokenEstimate describes the byte-based token approximation used for truncation.
type TokenEstimate struct {
	Value       int    `json:"value"`
	Approximate bool   `json:"approximate"`
	Method      string `json:"method"`
}

// Truncation explains where and why a result stopped adding items.
type Truncation struct {
	AtDepth      int    `json:"atDepth"`
	DroppedNodes int    `json:"droppedNodes"`
	Reason       string `json:"reason"`
}

// AssembledNode is the compact or full projection of one raw graph node.
type AssembledNode struct {
	ID           string        `json:"id"`
	Dist         int           `json:"dist"`
	Kind         string        `json:"kind"`
	Name         string        `json:"name"`
	File         string        `json:"file"`
	Line         int           `json:"line"`
	Signature    string        `json:"signature,omitempty"`
	Summary      string        `json:"summary,omitempty"`
	Status       string        `json:"status,omitempty"`
	Domain       string        `json:"domain"`
	Container    string        `json:"container,omitempty"`
	Order        int           `json:"order,omitempty"`
	SignatureOld string        `json:"signatureOld,omitempty"`
	Params       [][]string    `json:"params,omitempty"`
	Returns      string        `json:"returns,omitempty"`
	Tests        []TestRef     `json:"tests,omitempty"`
	Fields       [][]string    `json:"fields,omitempty"`
	Unscanned    bool          `json:"unscanned,omitempty"`
	ProjScanned  bool          `json:"projScanned,omitempty"`
	ModelKind    string        `json:"modelKind,omitempty"`
	Source       *SourceWindow `json:"source,omitempty"`
	SharedBy     int           `json:"sharedBy,omitempty"`
}

// ExternalDomain is one folded item representing live nodes from another domain.
type ExternalDomain struct {
	Domain          string          `json:"domain"`
	Count           int             `json:"count"`
	Representatives []AssembledNode `json:"representatives"`
}

// AssembledItem is the JSON union of a normal node and an external-domain item.
type AssembledItem struct {
	Node     *AssembledNode
	External *ExternalDomain
}

// AssembledResult is the stable JSON result shared by chain, who-calls, and context.
type AssembledResult struct {
	View             string          `json:"view"`
	Foci             []string        `json:"foci"`
	Nodes            []AssembledItem `json:"nodes"`
	Edges            []ViewEdge      `json:"edges"`
	UnscannedEntries int             `json:"unscannedEntries"`
	Warning          string          `json:"warning,omitempty"`
	TokenEstimate    TokenEstimate   `json:"tokenEstimate"`
	Truncated        *Truncation     `json:"truncated,omitempty"`
}

// MarshalJSON emits exactly one member of the AssembledItem union.
func (i AssembledItem) MarshalJSON() ([]byte, error) {
	if (i.Node == nil) == (i.External == nil) {
		return nil, fmt.Errorf("assembled item must contain exactly one of node or external")
	}
	if i.Node != nil {
		return json.Marshal(i.Node)
	}
	return json.Marshal(i.External)
}

// AssembleResult projects one raw Neighborhood result without reloading or rerunning BFS.
func AssembleResult(v *View, raw *Result, repoRoot string, opts QueryOptions) (*AssembledResult, error) {
	if v == nil || raw == nil {
		slog.Default().Error("assemble result rejected nil input", "viewNil", v == nil, "resultNil", raw == nil)
		return nil, fmt.Errorf("assemble result requires non-nil view and raw result")
	}
	if opts.SourceSpan == 0 && opts.WithSource {
		opts.SourceSpan = DefaultSourceSpan
	}
	if opts.SourceSpan < 0 || opts.SourceSpan > MaxSourceSpan {
		slog.Default().Error("assemble result rejected source span", "span", opts.SourceSpan, "max", MaxSourceSpan)
		return nil, fmt.Errorf("source span %d out of range 1..%d", opts.SourceSpan, MaxSourceSpan)
	}
	if opts.WithSource && opts.SourceSpan == 0 {
		slog.Default().Error("assemble result rejected zero source span", "span", opts.SourceSpan)
		return nil, fmt.Errorf("source span must be in range 1..%d", MaxSourceSpan)
	}
	if opts.MaxTokens < 0 {
		slog.Default().Error("assemble result rejected token budget", "maxTokens", opts.MaxTokens)
		return nil, fmt.Errorf("max tokens %d must be non-negative", opts.MaxTokens)
	}
	slog.Default().Info("assemble result started", "view", raw.View, "foci", len(raw.Foci), "rawNodes", len(raw.Nodes), "full", opts.Full, "withSource", opts.WithSource, "maxTokens", opts.MaxTokens)

	// Full is the compatibility escape hatch: preserve every raw node while
	// keeping BFS and deleted-edge filtering unchanged.
	foldExternal := opts.FoldExternal && !opts.Full
	collapseUtil := opts.CollapseUtil && !opts.Full
	shared := map[string]int{}
	if collapseUtil {
		shared = sharedCallerDomains(v)
	}
	sharedTargets := map[string]bool{}
	if collapseUtil {
		for id, count := range shared {
			if count >= DefaultUtilSharedByDomains {
				sharedTargets[id] = true
			}
		}
	}
	collapsedDownstream := collapsedUtilityDownstream(v, sharedTargets)
	focusIDs := map[string]bool{}
	for _, id := range raw.Foci {
		focusIDs[id] = true
	}
	focusDomains := map[string]bool{}
	for _, id := range raw.Foci {
		if n, ok := v.Nodes[id]; ok && n.Status != "deleted" {
			if domain := nodeDomain(v, n.Node); domain != "" {
				focusDomains[domain] = true
			}
		}
	}

	byExternal := map[string][]ResultNode{}
	var candidates []assembledCandidate
	for _, rn := range raw.Nodes {
		vn, ok := v.Nodes[rn.ID]
		if !ok || vn.Status == "deleted" {
			continue
		}
		if collapsedDownstream[rn.ID] && !sharedTargets[rn.ID] && !focusIDs[rn.ID] {
			// A shared utility is the intentional collection point; its downstream
			// nodes are omitted from the compact view to keep the next hop legible.
			continue
		}
		domain := nodeDomain(v, vn.Node)
		if foldExternal && domain != "" && !focusDomains[domain] {
			byExternal[domain] = append(byExternal[domain], rn)
			continue
		}
		node, err := assembledNode(v, rn, opts, repoRoot, sharedValue(shared, rn.ID))
		if err != nil {
			return nil, err
		}
		candidates = append(candidates, assembledCandidate{key: "node:" + node.ID, dist: node.Dist, node: &node, rawCount: 1})
	}
	for domain, nodes := range byExternal {
		reps := append([]ResultNode(nil), nodes...)
		sort.SliceStable(reps, func(i, j int) bool {
			iCount := liveIncoming(v, reps[i].ID)
			jCount := liveIncoming(v, reps[j].ID)
			if iCount != jCount {
				return iCount > jCount
			}
			return reps[i].ID < reps[j].ID
		})
		if len(reps) > DefaultExternalRepresentatives {
			reps = reps[:DefaultExternalRepresentatives]
		}
		external := ExternalDomain{Domain: domain, Count: len(nodes), Representatives: make([]AssembledNode, 0, len(reps))}
		for _, rn := range reps {
			node, err := assembledNode(v, rn, opts, repoRoot, sharedValue(shared, rn.ID))
			if err != nil {
				return nil, err
			}
			external.Representatives = append(external.Representatives, node)
		}
		minDist := nodes[0].Dist
		for _, rn := range nodes[1:] {
			if rn.Dist < minDist {
				minDist = rn.Dist
			}
		}
		candidates = append(candidates, assembledCandidate{key: "external:" + domain, dist: minDist, external: &external, rawCount: len(nodes)})
	}
	sort.SliceStable(candidates, func(i, j int) bool {
		if candidates[i].dist != candidates[j].dist {
			return candidates[i].dist < candidates[j].dist
		}
		return candidates[i].key < candidates[j].key
	})

	out := &AssembledResult{
		View: raw.View, Foci: append([]string(nil), raw.Foci...), Edges: nil,
		UnscannedEntries: raw.UnscannedEntries, Warning: raw.Warning,
		TokenEstimate: TokenEstimate{Approximate: true, Method: "utf8-json-bytes/3"},
	}
	selected := map[string]bool{}
	usedRaw := 0
	for idx, candidate := range candidates {
		item := AssembledItem{Node: candidate.node, External: candidate.external}
		encoded, err := json.Marshal(item)
		if err != nil {
			return nil, fmt.Errorf("estimate %s: %w", candidate.key, err)
		}
		cost := (len(encoded) + 2) / 3
		if opts.MaxTokens > 0 && out.TokenEstimate.Value+cost > opts.MaxTokens {
			out.Truncated = &Truncation{AtDepth: candidate.dist, DroppedNodes: rawNodeCountAfter(candidates, idx), Reason: "max-tokens"}
			slog.Default().Info("assemble result truncated", "atDepth", candidate.dist, "droppedNodes", out.Truncated.DroppedNodes, "maxTokens", opts.MaxTokens)
			break
		}
		out.Nodes = append(out.Nodes, item)
		out.TokenEstimate.Value += cost
		usedRaw += candidate.rawCount
		if candidate.node != nil {
			selected[candidate.node.ID] = true
		}
	}
	if out.TokenEstimate.Value == 0 {
		out.TokenEstimate.Value = 1
	}
	if out.Truncated == nil {
		usedRaw = rawNodeCount(out.Nodes)
	}
	for _, edge := range raw.Edges {
		if edge.Status == "deleted" || v.Nodes[edge.From].Status == "deleted" || v.Nodes[edge.To].Status == "deleted" {
			continue
		}
		if selected[edge.From] && selected[edge.To] {
			out.Edges = append(out.Edges, edge)
		}
	}
	slog.Default().Info("assemble result completed", "view", out.View, "outputNodes", len(out.Nodes), "outputEdges", len(out.Edges), "rawNodesUsed", usedRaw, "truncated", out.Truncated != nil)
	return out, nil
}

type assembledCandidate struct {
	key      string
	dist     int
	node     *AssembledNode
	external *ExternalDomain
	rawCount int
}

func nodeDomain(v *View, n Node) string {
	if c, ok := v.Containers[n.Container]; ok {
		return c.Domain
	}
	return ""
}

func assembledNode(v *View, rn ResultNode, opts QueryOptions, repoRoot string, sharedBy int) (AssembledNode, error) {
	n := rn.Node
	result := AssembledNode{ID: rn.ID, Dist: rn.Dist, Kind: n.Kind, Name: n.Name, File: n.File, Line: n.Line,
		Signature: n.Signature, Summary: n.Summary, Status: rn.Status, Domain: nodeDomain(v, n), SharedBy: sharedBy}
	if opts.Full {
		result.Container, result.Order, result.SignatureOld = n.Container, n.Order, n.SignatureOld
		result.Params, result.Returns, result.Tests, result.Fields = n.Params, n.Returns, n.Tests, n.Fields
		result.Unscanned, result.ProjScanned, result.ModelKind = n.Unscanned, n.ProjScanned, n.ModelKind
	}
	if opts.WithSource && !n.Unscanned && n.File != "" {
		line, status := ReAnchor(repoRoot, n)
		result.Line = line
		window, err := ExtractSourceWindow(repoRoot, n, line, opts.SourceSpan)
		if err != nil {
			slog.Default().Warn("source window unavailable", "file", n.File, "line", line, "status", status, "error", err)
		} else {
			result.Source = window
			slog.Default().Info("source window attached", "file", n.File, "line", line, "span", opts.SourceSpan, "lines", len(window.Lines))
		}
	}
	return result, nil
}

func sharedCallerDomains(v *View) map[string]int {
	callers := map[string]map[string]bool{}
	for _, e := range v.Edges {
		if e.Status == "deleted" || v.Nodes[e.From].Status == "deleted" || v.Nodes[e.To].Status == "deleted" {
			continue
		}
		domain := nodeDomain(v, v.Nodes[e.From].Node)
		if domain == "" {
			continue
		}
		if callers[e.To] == nil {
			callers[e.To] = map[string]bool{}
		}
		callers[e.To][domain] = true
	}
	out := map[string]int{}
	for id, domains := range callers {
		out[id] = len(domains)
	}
	return out
}

func collapsedUtilityDownstream(v *View, targets map[string]bool) map[string]bool {
	out := map[string]bool{}
	for target := range targets {
		frontier := []string{target}
		seen := map[string]bool{target: true}
		for len(frontier) > 0 {
			id := frontier[0]
			frontier = frontier[1:]
			for _, edge := range v.Edges {
				if edge.From != id || edge.Status == "deleted" || v.Nodes[edge.From].Status == "deleted" || v.Nodes[edge.To].Status == "deleted" {
					continue
				}
				if seen[edge.To] {
					continue
				}
				seen[edge.To] = true
				out[edge.To] = true
				frontier = append(frontier, edge.To)
			}
		}
	}
	return out
}

func sharedValue(shared map[string]int, id string) int {
	if shared[id] >= DefaultUtilSharedByDomains {
		return shared[id]
	}
	return 0
}

func liveIncoming(v *View, id string) int {
	count := 0
	for _, e := range v.Edges {
		if e.To == id && e.Status != "deleted" && v.Nodes[e.From].Status != "deleted" && v.Nodes[e.To].Status != "deleted" {
			count++
		}
	}
	return count
}

func rawNodeCountAfter(candidates []assembledCandidate, start int) int {
	count := 0
	for _, candidate := range candidates[start:] {
		count += candidate.rawCount
	}
	return count
}

func rawNodeCount(items []AssembledItem) int {
	count := 0
	for _, item := range items {
		if item.External != nil {
			count += item.External.Count
		} else if item.Node != nil {
			count++
		}
	}
	return count
}
