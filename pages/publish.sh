#!/usr/bin/env bash
#
# 发布 dsh-tui 站点到 Cloudflare Pages
#
#   用法：
#     ./publish.sh              # 发布前检查 + 上传 cloudflare-pages/dist
#     ./publish.sh --check      # 只做发布前检查，不上传
#     ./publish.sh --dry-run    # 只列出将被上传的文件，不上传
#     ./publish.sh --force      # 即使自检报警也继续发布
#     ./publish.sh --help       # 查看本说明
#
#   凭证（二选一）：
#     A) 命令行临时传入：
#        CLOUDFLARE_API_TOKEN=xxx CLOUDFLARE_ACCOUNT_ID=yyy ./publish.sh
#     B) 在本目录建 publish.env（格式见 publish.env.example），脚本自动加载：
#        CLOUDFLARE_API_TOKEN=xxx
#        CLOUDFLARE_ACCOUNT_ID=yyy
#        ⚠️ publish.env 含密钥，不要提交到仓库、不要外发
#
#   待发布内容 = cloudflare-pages/dist/（改了页面就把新文件放进 dist）
#   线上地址   = https://dsh-tui.pages.dev
#
set -euo pipefail

PROJECT_NAME="dsh-tui"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST="$ROOT/cloudflare-pages/dist"
P="[publish]"

MODE="deploy"; FORCE="0"
for arg in "$@"; do
  case "$arg" in
    --check)   MODE="check" ;;
    --dry-run) MODE="dry" ;;
    --force)   FORCE="1" ;;
    -h|--help) sed -n '2,22p' "$0"; exit 0 ;;
    *) echo "$P 未知参数：$arg（用 --help 查看用法）"; exit 2 ;;
  esac
done

echo "$P 项目 = $PROJECT_NAME"
echo "$P 内容 = $DIST"

# ---------- 0. 凭证 ----------
if [ -f "$ROOT/publish.env" ]; then
  # shellcheck disable=SC1091
  . "$ROOT/publish.env"
  echo "$P 已加载 publish.env"
fi
if [ "$MODE" = "deploy" ]; then
  : "${CLOUDFLARE_API_TOKEN:?未设置 CLOUDFLARE_API_TOKEN（见 --help）}"
  : "${CLOUDFLARE_ACCOUNT_ID:?未设置 CLOUDFLARE_ACCOUNT_ID（见 --help）}"
fi

# ---------- 1. 基本检查 ----------
[ -d "$DIST" ] || { echo "$P ✗ 找不到目录：$DIST"; exit 1; }
[ -f "$DIST/index.html" ] || { echo "$P ✗ dist 里没有 index.html"; exit 1; }

echo ""
echo "$P 待发布文件："
find "$DIST" -type f -not -path '*/.*' | sed "s|$DIST/|  |"

DOTS="$(find "$DIST" -name '.*' -not -name '.' -maxdepth 2 | head -20 || true)"
if [ -n "$DOTS" ]; then
  echo ""
  echo "$P ⚠ 检测到点文件（已自动排除、不会上传）："
  printf '%s\n' "$DOTS" | sed 's/^/    /'
fi

# ---------- 2. 污染自检 ----------
# 单文件 HTML 若被平台编辑器/预览保存过，可能被「渲染后的 DOM」整体回写：
# Prism 的 token span、运行时注入的按钮会变成静态标记，脚本再执行时提前 return，
# 表现为「按钮点不动」「体积虚增」。这里做个体检。
echo ""
echo "$P 源文件自检："
POLLUTED="0"
while IFS= read -r f; do
  BASENAME="$(basename "$f")"
  T="$(grep -c 'class="token'  "$f" || true)"
  B="$(grep -c '<button type="button" class="copy-btn"' "$f" || true)"
  L="$(grep -c 'class="language-'  "$f" || true)"
  if [ "$T" != "0" ] || [ "$B" != "0" ] || [ "$L" != "0" ]; then
    POLLUTED="1"
    echo "  ⚠ $BASENAME 疑似被渲染后的 DOM 回写（token=${T} 静态按钮=${B} language 类=${L}）"
  else
    echo "  ✓ $BASENAME 干净"
  fi
done < <(find "$DIST" -maxdepth 1 -name '*.html')

if [ "$POLLUTED" != "0" ]; then
  echo ""
  echo "$P ⚠ 上面文件含运行时产物，交互功能可能失效；建议先清理。"
  echo "$P   确认继续请加 --force"
  [ "$FORCE" = "1" ] || exit 3
fi

if [ "$MODE" = "check" ]; then
  echo ""
  echo "$P 检查完成（未上传）"
  exit 0
fi

# ---------- 3. 用排除点文件的暂存目录发布 ----------
# wrangler pages deploy 没有 --exclude 选项，且会把目录里的一切都当静态资源上传
# （曾因此把 dist/.claude/settings.local.json 公开出去）。所以先 rsync 出一个干净暂存目录。
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
rsync -a --include='/.well-known/***' --exclude='.*' "$DIST/" "$STAGE/"

if [ "$MODE" = "dry" ]; then
  echo ""
  echo "$P 试运行，实际会被上传的文件："
  (cd "$STAGE" && find . -type f | sed 's|^\./|  |')
  exit 0
fi

if command -v npx >/dev/null 2>&1; then
  NPX="npx"
else
  NPX="$HOME/.workbuddy/binaries/node/versions/22.22.2-3/bin/npx"
fi

echo ""
echo "$P 开始发布 …"
cd "$ROOT/cloudflare-pages"
CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN" \
CLOUDFLARE_ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID" \
CI=true WRANGLER_SEND_METRICS=false \
  "$NPX" --yes wrangler@latest pages deploy "$STAGE" --project-name="$PROJECT_NAME" 2>&1 | tail -6

# ---------- 4. 发布后抽查 ----------
# 注意：Pages 对不存在的路径会「回退返回 index.html 且状态码 200」，
# 所以除了状态码还要比对字节数，才能识别出"其实没这个页面"。
echo ""
echo "$P 线上抽查："
BASE="https://$PROJECT_NAME.pages.dev"
IDX_SIZE="$(curl -s --max-time 25 "$BASE/" | wc -c | tr -d ' ')"
for name in $(cd "$DIST" && find . -maxdepth 1 -name '*.html' -exec basename {} .html \; | sort); do
  if [ "$name" = "index" ]; then path="/"; else path="/$name"; fi
  INFO="$(curl -s -o /tmp/_pub_body -w '%{http_code} %{size_download}' --max-time 25 "$BASE$path" || echo 'ERR 0')"
  CODE="${INFO%% *}"; SIZE="${INFO##* }"
  NOTE=""
  if [ "$name" != "index" ] && [ "$SIZE" = "$IDX_SIZE" ]; then
    NOTE="  ⚠ 字节数与首页相同，疑似回退到首页（该页面可能没上传成功）"
  fi
  printf '  %-4s %-8s %s%s\n' "$CODE" "${SIZE}B" "$BASE$path" "$NOTE"
done
echo ""
echo "$P 完成 ✔  别忘了 Ctrl/⌘+Shift+R 硬刷新浏览器缓存"
