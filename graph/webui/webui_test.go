// Package webui tests the committed static-resource boundary, not HTTP routing.
package webui

import (
	"errors"
	"io/fs"
	"testing"
)

func TestEmbeddedFSHasRealAssets(t *testing.T) {
	assets := FS()
	info, err := fs.Stat(assets, "index.html")
	if err != nil {
		t.Fatalf("FS 根缺少 index.html: %v", err)
	}
	if info.IsDir() {
		t.Fatal("FS 根的 index.html 不能是目录")
	}

	files := 0
	if err := fs.WalkDir(assets, ".", func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if !entry.IsDir() {
			files++
		}
		return nil
	}); err != nil {
		t.Fatalf("遍历嵌入资源失败: %v", err)
	}
	if files < 3 {
		t.Fatalf("嵌入资源文件数=%d，期望至少 index.html、JS、CSS 三个文件", files)
	}

	if _, err := fs.Stat(assets, "dist"); !errors.Is(err, fs.ErrNotExist) {
		t.Fatalf("FS 根不应暴露外层 dist 目录，stat error=%v", err)
	}
}
