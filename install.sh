#!/usr/bin/env bash
# codegraph 安装脚本（刀 0 · T2，骨架照抄 handoff install.sh 简化）。
# 职责：探测平台 → 取最新（或指定）graph/v* release → 下载资产 → sha256 校验 → 装入用户目录。
# 边界：只认 Darwin/Linux × amd64/arm64（Windows 用 zip 资产或 go install）；
#       不 sudo、不改任何 shell rc——装到 ~/.local/bin，PATH 缺失时只提示不动手；
#       darwin 二进制未签名：若被 Gatekeeper 拦截，按末尾提示 xattr 放行。
# 用法：curl -fsSL https://raw.githubusercontent.com/Xsxdot/charter/master/install.sh | bash
#       CODEGRAPH_VERSION=v0.1.0 指定版本；CODEGRAPH_INSTALL_DIR 覆盖安装目录。
set -euo pipefail

REPO="Xsxdot/charter"
INSTALL_DIR="${CODEGRAPH_INSTALL_DIR:-$HOME/.local/bin}"

die() {
  echo "错误: $*" >&2
  exit 1
}

# ---- 平台探测 ----
case "$(uname -s)" in
  Darwin) GOOS=darwin ;;
  Linux) GOOS=linux ;;
  *) die "不支持的系统 $(uname -s)：Windows 请用 release 页的 zip 资产，或 go install github.com/Xsxdot/charter/graph/cmd/codegraph@latest" ;;
esac
case "$(uname -m)" in
  x86_64 | amd64) GOARCH=amd64 ;;
  arm64 | aarch64) GOARCH=arm64 ;;
  *) die "不支持的架构 $(uname -m)" ;;
esac

command -v curl >/dev/null || die "需要 curl"
command -v tar >/dev/null || die "需要 tar"

# ---- 版本决议：显式指定优先，否则取最新 graph/v* release ----
VERSION="${CODEGRAPH_VERSION:-}"
if [ -z "$VERSION" ]; then
  VERSION=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases?per_page=100" |
    grep -o '"tag_name": *"graph/v[^"]*"' | head -1 | sed 's/.*"graph\/\(v[^"]*\)".*/\1/') ||
    die "查询最新版本失败（GitHub API 不可达或无 graph/v* release）"
  [ -n "$VERSION" ] || die "仓库 ${REPO} 尚无 graph/v* release"
fi

ASSET="codegraph_${VERSION}_${GOOS}_${GOARCH}.tar.gz"
BASE="https://github.com/${REPO}/releases/download/graph%2F${VERSION}"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "下载 ${ASSET}（${VERSION}）..."
curl -fsSL -o "$TMP/$ASSET" "$BASE/$ASSET" ||
  die "下载失败: $BASE/$ASSET（确认该版本已发布且资产命名符合契约）"
curl -fsSL -o "$TMP/checksums.txt" "$BASE/checksums.txt" ||
  die "下载校验和失败: $BASE/checksums.txt"

# ---- 校验（darwin 用 shasum，linux 用 sha256sum）----
expected=$(grep " $ASSET\$" "$TMP/checksums.txt" | awk '{print $1}')
[ -n "$expected" ] || die "checksums.txt 中找不到 $ASSET 的条目"
if command -v sha256sum >/dev/null; then
  actual=$(sha256sum "$TMP/$ASSET" | awk '{print $1}')
else
  actual=$(shasum -a 256 "$TMP/$ASSET" | awk '{print $1}')
fi
[ "$expected" = "$actual" ] || die "sha256 校验失败: 期望 $expected 实得 $actual（下载可能被篡改或截断）"

# ---- 安装（不 sudo、不改 rc）----
mkdir -p "$INSTALL_DIR"
tar -xzf "$TMP/$ASSET" -C "$TMP"
install -m 0755 "$TMP/codegraph" "$INSTALL_DIR/codegraph"

echo "已安装: $INSTALL_DIR/codegraph（$("$INSTALL_DIR/codegraph" version 2>/dev/null || echo "$VERSION")）"
case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *) echo "提示: $INSTALL_DIR 不在 PATH 中，请自行加入（本脚本不改 shell rc）" ;;
esac
if [ "$GOOS" = darwin ]; then
  echo "提示: darwin 二进制未签名，若被 Gatekeeper 拦截，执行: xattr -d com.apple.quarantine $INSTALL_DIR/codegraph"
fi
