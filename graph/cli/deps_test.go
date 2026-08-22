// 契约 §5-1/2 不变式的可执行锁（breakdown 附加拍板）：
// module 第三方依赖集恰为 cobra 及其传递依赖——「本包必须能原样搬进任何工具」
// 的承诺此前只有包注释，没有能变红的守护；后续任何「顺手加个依赖」在此转红。
package cli

import (
	"os"
	"strings"
	"testing"
)

func TestModuleDependencyAllowlist(t *testing.T) {
	raw, err := os.ReadFile("../go.mod")
	if err != nil {
		t.Fatalf("读 go.mod: %v", err)
	}
	allow := map[string]bool{
		"github.com/spf13/cobra":               true, // CLI 壳唯一直接依赖（契约 §5-2）
		"github.com/spf13/pflag":               true, // cobra 传递依赖
		"github.com/inconshreveable/mousetrap": true, // cobra 传递依赖（Windows）
	}
	inBlock := false
	for _, line := range strings.Split(string(raw), "\n") {
		line = strings.TrimSpace(line)
		var dep string
		switch {
		case strings.HasPrefix(line, "require ("):
			inBlock = true
			continue
		case inBlock && line == ")":
			inBlock = false
			continue
		case inBlock && line != "":
			dep = line
		case strings.HasPrefix(line, "require "):
			dep = strings.TrimPrefix(line, "require ")
		default:
			continue
		}
		path := strings.Fields(dep)[0]
		if !allow[path] {
			t.Errorf("go.mod 出现契约外依赖 %s——§5-1/2 冻结：codegraph 仅标准库，CLI 壳仅 cobra", path)
		}
	}
}
