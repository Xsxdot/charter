package codegraph

import (
	"strings"
	"testing"
)

func TestExtractSourceWindow(t *testing.T) {
	n := Node{Kind: "func", Name: "runE", File: "cmd/run.go", Line: 5}
	for _, tc := range []struct {
		name string
		span int
		want int
	}{
		{"one", 1, 1},
		{"forty", 40, 5},
		{"max", 200, 5},
	} {
		window, err := ExtractSourceWindow("testdata/repo", n, 5, tc.span)
		if err != nil {
			t.Fatalf("%s: %v", tc.name, err)
		}
		if len(window.Lines) != tc.want || window.From < 1 {
			t.Fatalf("%s: window=%+v", tc.name, window)
		}
	}
	if _, err := ExtractSourceWindow("testdata/repo", n, 5, 0); err == nil || !strings.Contains(err.Error(), "span") {
		t.Fatalf("invalid span error=%v", err)
	}
	missing := n
	missing.File = "missing.go"
	if _, err := ExtractSourceWindow("testdata/repo", missing, 5, 40); err == nil {
		t.Fatal("missing source must fail")
	}
}
