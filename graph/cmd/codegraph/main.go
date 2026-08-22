// codegraph：入库代码图的本地只读查询 CLI（canonical 入口）。
// 命令树由 graph/cli 构造——handoff 的 graph 别名挂同一构造，行为一致。
// 边界：本文件只做挂载与退出码转换，不含任何子命令逻辑。
package main

import (
	"os"

	"github.com/Xsxdot/charter/graph/cli"
)

func main() {
	if err := cli.New("codegraph").Execute(); err != nil {
		// cobra 已把错误打到 stderr，这里只负责非零退出（agent 依赖退出码判失败）
		os.Exit(1)
	}
}
