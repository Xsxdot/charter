// Package webui is the static-asset boundary for the codegraph viewer.
//
// Ticket 0 only declares the package and its host-facing entry point. The
// implementation round wires the committed Vite dist tree through go:embed;
// this empty embed.FS keeps the new package compilable before that asset tree
// exists.
package webui

import (
	"embed"
	"io/fs"
)

var assets embed.FS

// FS returns the viewer's static asset filesystem.
func FS() fs.FS { return assets }
