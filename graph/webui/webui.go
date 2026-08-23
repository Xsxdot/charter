// Package webui embeds the codegraph viewer and exposes only an fs.FS boundary.
//
// 边界：不提供 HTTP handler、路由、鉴权或网络客户端；这些语义由宿主负责。
package webui

import (
	"embed"
	"io/fs"
)

// distFS holds the committed Vite output. The all: prefix preserves dot files.
//
//go:embed all:dist
var distFS embed.FS

// FS returns a read-only viewer filesystem whose root contains index.html.
// It never returns nil and panics only if the compile-time embedded tree is malformed.
func FS() fs.FS {
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		panic("webui: embedded dist missing: " + err.Error())
	}
	return sub
}
