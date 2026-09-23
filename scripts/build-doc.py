#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build-doc.py — 把 pages/cloudflare-pages/*.md 渲染成 dist/*.html。

零依赖（仅标准库，python3.8+）。页面的 CSS / JS 都在 _template.html 里（全部生成页共用），
本脚本只负责：解析 md（标准子集 + 指令块）→ 生成正文与 TOC → 填入模版。

用法（在仓库根目录）：
    python3 scripts/build-doc.py                  # 生成全部页（*.md，下划线开头除外）
    python3 scripts/build-doc.py --check          # 仅校验：逐页重生成并与已提交 dist 字节比对
    python3 scripts/build-doc.py --page <name>    # 只构建单页（如 --page index）

指令词汇（标准语法优先；仅无 markdown 等价物者用 :: 指令块）：
    标准：> 文本 → 普通引用 · > [!note|warn|danger|ok] → 提示块 · > [!aside] → 灰小字
          ## 1. 标题（自动编 SECTION 01；## OVERVIEW · 主线 标题 为自定义标签）
          ### 3.1 标题（前导 token 即 h3-tag） · ```lang · 标签（双段代码块） · - ~项（dash）
    指令：::hero | ::stat | ::timeline | ::cmp | ::grid2 | ::acc | ::quote 标签（带 q-label）
"""

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE_DIR = ROOT / "pages" / "cloudflare-pages"


def esc(s):
    """HTML 转义文本内容（保留引号原样，仅转义 & < >）。"""
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def esc_attr(s):
    return s.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;").replace(">", "&gt;")


# ───────────────────────── 行内渲染 ─────────────────────────

INLINE_RE = re.compile(
    r"`([^`]+)`"                                    # 1 code
    r"|\[([^\]]+)\]\(([^)\s]+)\)"                   # 2 label  3 href
    r"|\*\*([^*]+)\*\*"                             # 4 strong
    r"|(?<!\*)\*([^*]+)\*(?!\*)"                    # 5 em
)


def render_inline(s):
    """行内 markdown：`code`、[link](url)、**strong**、*em*；文本叶子统一转义。"""
    out = []
    last = 0
    for m in INLINE_RE.finditer(s):
        out.append(esc(s[last:m.start()]))
        if m.group(1) is not None:      # code
            out.append("<code>" + esc(m.group(1)) + "</code>")
        elif m.group(2) is not None:    # link
            out.append('<a href="%s" target="_blank" rel="noopener">%s</a>'
                       % (esc_attr(m.group(3)), render_inline(m.group(2))))
        elif m.group(4) is not None:    # strong
            out.append("<strong>" + render_inline(m.group(4)) + "</strong>")
        else:                           # em
            out.append("<em>" + render_inline(m.group(5)) + "</em>")
        last = m.end()
    out.append(esc(s[last:]))
    return "".join(out)


# ───────────────────────── 块级渲染 ─────────────────────────

BLOCK_START = re.compile(r"^(::|```|\||> |## |### |#### |- |\d+\. )")


def is_block_start(s):
    return bool(BLOCK_START.match(s))


def dedent_lines(buf):
    indents = [len(l) - len(l.lstrip()) for l in buf if l.strip()]
    if not indents:
        return []
    m = min(indents)
    return [l[m:] if len(l) >= m else l for l in buf]


def render_blocks(lines, parent=None, headings=None, pclass=None):
    """渲染一组块级行。parent = 所在 section 信息（h3 分组用）；headings = 可变 TOC 收集器。"""
    if headings is None:
        headings = []
    out = []
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        s = line.strip()
        if not s:
            i += 1
            continue
        if s.startswith("<!--"):
            i += 1
            while i < n and not lines[i].rstrip().endswith("-->"):
                i += 1
            i += 1
        elif s.startswith("::"):
            i = parse_directive(lines, i, out, parent)
        elif s.startswith("```"):
            i = parse_fence(lines, i, out)
        elif s.startswith("|"):
            i = parse_table(lines, i, out)
        elif s.startswith("## "):
            i = parse_section(lines, i, out, headings)
        elif s.startswith("### "):
            i = parse_h3(lines, i, out, parent, headings)
        elif s.startswith("#### "):
            i += 1
            out.append("<h4>" + render_inline(s[5:]) + "</h4>")
        elif s.startswith("> "):
            i = parse_quote(lines, i, out)
        elif re.match(r"^\s*[-*] ", line):
            i = parse_ul(lines, i, out)
        elif re.match(r"^\s*\d+\. ", line):
            i = parse_ol(lines, i, out)
        else:  # 段落
            buf = [line]
            i += 1
            while i < n:
                l2 = lines[i]
                s2 = l2.strip()
                if not s2 or is_block_start(s2):
                    break
                buf.append(l2)
                i += 1
            p = " ".join(x.strip() for x in buf)
            if pclass:
                out.append('<p class="%s">%s</p>' % (pclass, render_inline(p)))
            else:
                out.append("<p>%s</p>" % render_inline(p))
    return "".join(out), headings


def parse_fence(lines, i, out):
    info = lines[i][3:].strip()
    i += 1
    buf = []
    n = len(lines)
    while i < n and not lines[i].strip().startswith("```"):
        buf.append(lines[i])
        i += 1
    if i >= n:
        raise ValueError("未闭合的代码块（第 %d 行附近）" % (i + 1))
    i += 1
    # .lang 元素承载完整 info 串（如 `sh · 场景 1`）——运行时 Prism 映射脚本自取「·」前段，
    # 生成器不做二次拆分。
    out.append('<div class="code-block">\n'
               '<div class="code-head"><span class="dots"><i></i><i></i><i></i></span>'
               '<span class="lang">%s</span></div>\n'
               '<pre><code>%s</code></pre>\n'
               "</div>" % (esc(info), esc("\n".join(buf))))
    return i


def split_row(s):
    """表格行按未转义的 | 切分；单元格内的 \\| 还原为 |。"""
    parts = re.split(r"(?<!\\)\|", s.strip())
    if parts and parts[0].strip() == "":
        parts = parts[1:]
    if parts and parts[-1].strip() == "":
        parts = parts[:-1]
    return [p.strip().replace("\\|", "|") for p in parts]


def parse_table(lines, i, out):
    rows = []
    while i < len(lines) and lines[i].strip().startswith("|"):
        rows.append(split_row(lines[i]))
        i += 1
    if len(rows) >= 2:
        header, body = rows[0], rows[2:]
        thead = "<thead><tr>" + "".join("<th>%s</th>" % render_inline(c) for c in header) + "</tr></thead>"
        tbody = "<tbody>" + "".join(
            "<tr>" + "".join("<td>%s</td>" % render_inline(c) for c in r) + "</tr>" for r in body
        ) + "</tbody>"
        out.append('<div class="table-wrap">\n<table>\n%s\n%s\n</table>\n</div>' % (thead, tbody))
    return i


CALLOUT_RE = re.compile(r"^\[!(aside|note|warn|danger|ok)\]\s*(.*)$")


def parse_quote(lines, i, out):
    buf = []
    while i < len(lines) and lines[i].strip().startswith("> "):
        buf.append(lines[i].strip()[2:])
        i += 1
    # GFM callout 风格标记：> [!warn] / > [!note] / > [!danger] / > [!ok] / > [!aside]
    kind = None
    if buf:
        m = CALLOUT_RE.match(buf[0])
        if m:
            kind, rest = m.group(1), m.group(2).strip()
            buf = ([rest] if rest else []) + buf[1:]
    if kind == "aside":
        text = " ".join(x.strip() for x in buf if x.strip())
        out.append('<p class="aside">%s</p>' % render_inline(text))
    elif kind:
        cls = "note" + (" " + kind if kind != "note" else "")
        inner, _ = render_blocks(buf)
        out.append('<div class="%s">\n%s\n</div>' % (cls, inner))
    else:
        inner, _ = render_blocks(buf)
        out.append('<div class="quote">\n%s\n</div>' % inner)
    return i


def parse_ul(lines, i, out, dash=False):
    items = []
    while i < len(lines):
        m = re.match(r"^\s*[-*]\s+(.*)$", lines[i])
        if not m:
            break
        content = m.group(1)
        item_dash = content.startswith("~")
        if item_dash:
            content = content[1:].lstrip()
        items.append((item_dash, content))
        i += 1
    cls = ' class="dash"' if dash else ""
    lis = "".join('<li%s>%s</li>\n' % (' class="dash"' if d else "", render_inline(x)) for d, x in items)
    out.append("<ul%s>\n%s</ul>" % (cls, lis))
    return i


def parse_ol(lines, i, out):
    items = []
    while i < len(lines):
        m = re.match(r"^\s*\d+\.\s+(.*)$", lines[i])
        if not m:
            break
        items.append(m.group(1))
        i += 1
    out.append("<ol>\n%s</ol>" % "".join("<li>%s</li>\n" % render_inline(x) for x in items))
    return i


def parse_h2(rest):
    m = re.match(r"^(\d+)\.\s*(.+)$", rest)
    if m:
        num = int(m.group(1))
        return {"secnum": "SECTION %02d" % num, "title": rest, "num": num, "label": None}
    parts = rest.split(" ", 1)
    label = parts[0]
    tail = parts[1].strip() if len(parts) > 1 else ""
    m2 = re.match(r"^·\s*(\S+)\s+(.+)$", tail)
    if m2:
        return {"secnum": label + " · " + m2.group(1), "title": m2.group(2), "num": None, "label": label}
    if tail:
        return {"secnum": label, "title": tail, "num": None, "label": label}
    return {"secnum": label, "title": label, "num": None, "label": label}


def parse_section(lines, i, out, headings):
    sec = parse_h2(lines[i][3:].strip())
    i += 1
    buf = []
    n = len(lines)
    while i < n and not lines[i].strip().startswith("## "):
        buf.append(lines[i])
        i += 1
    # 首段 = .desc
    j = 0
    while j < len(buf) and not buf[j].strip():
        j += 1
    desc = None
    if j < len(buf) and not is_block_start(buf[j].strip()):
        dbuf = []
        while j < len(buf) and buf[j].strip() and not is_block_start(buf[j].strip()):
            dbuf.append(buf[j].strip())
            j += 1
        desc = render_inline(" ".join(dbuf))
    body = buf[j:]
    # section id / TOC 条目
    base = sec["num"] if sec["num"] is not None else (sec["label"] or "").lower()
    sid = "sec-%s" % base
    sec["id"] = sid
    toc_no = "%02d" % sec["num"] if sec["num"] is not None else (sec["label"] or "")
    # toc-txt 不重复编号：h2 的 `1. ` 前缀只属于正文标题，目录里由 toc-no 承担
    toc_label = re.sub(r"^\d+\.\s*", "", sec["title"]) if sec["num"] is not None else sec["title"]
    subs = []
    headings.append({"level": 2, "no": toc_no, "label": toc_label, "id": sid, "subs": subs})
    inner = []
    if desc:
        inner.append('<p class="desc">%s</p>' % desc)
    body_html, _ = render_blocks(body, parent=sec, headings=subs)
    inner.append(body_html)
    out.append('<section id="%s" class="sec reveal">\n<div class="sec-head">\n'
               '<span class="sec-num">%s</span>\n<h2>%s</h2>\n%s</div>\n%s\n</section>'
               % (sid, esc(sec["secnum"]), esc(sec["title"]), inner[0] if desc else "", inner[1] if desc else inner[0]))
    return i


def parse_h3(lines, i, out, parent, headings):
    rest = lines[i][4:].strip()
    parts = rest.split(" ", 1)
    if len(parts) == 1:
        tag, text = None, rest
    else:
        tag, text = parts[0], re.sub(r"^·\s*", "", parts[1].strip())
    i += 1
    hid = None
    if tag is not None and parent is not None:
        idx = len(headings) + 1
        base = parent["num"] if parent["num"] is not None else (parent["label"] or "").lower()
        hid = "sec-%s-%d" % (base, idx)
        headings.append({"level": 3, "no": tag, "label": text, "id": hid})
    tag_html = '<span class="h3-tag">%s</span>' % esc(tag) if tag else ""
    id_attr = ' id="%s"' % hid if hid else ""
    out.append("<h3%s>%s%s</h3>" % (id_attr, tag_html, render_inline(text)))
    return i


# ───────────────────────── 指令块 ─────────────────────────

def parse_directive(lines, i, out, parent):
    s = lines[i].strip()
    parts = s[2:].strip().split(None, 1)
    name = parts[0]
    arg = parts[1] if len(parts) > 1 else ""
    i += 1
    buf = []
    while i < len(lines) and lines[i].strip() != "::":
        buf.append(lines[i])
        i += 1
    if i >= len(lines):
        raise ValueError("未闭合的指令块 ::%s（缺少单独的 :: 行）" % name)
    i += 1
    handler = DIRECTIVES.get(name)
    if handler is None:
        raise ValueError("未知指令块 ::%s" % name)
    handler(buf, arg, out, parent)
    return i


def dir_hero(buf, arg, out, parent):
    eyebrow = None
    title = None
    chips = []
    cards = []
    sub = []
    for raw in buf:
        s = raw.strip()
        if not s:
            continue
        m = re.match(r"^eyebrow:\s*(.+)$", s)
        if m:
            eyebrow = render_inline(m.group(1))
            continue
        m = re.match(r"^chips:\s*(.+)$", s)
        if m:
            chips = [render_inline(x) for x in re.split(r"\s*·\s*", m.group(1))]
            continue
        m = re.match(r"^card\s+(.+?)\s*\|\s*(.+)$", s)
        if m:
            cards.append((m.group(1).strip(), render_inline(m.group(2))))
            continue
        if s.startswith("# "):
            title = s[2:].strip()
            continue
        sub.append(s)
    left = ['<span class="eyebrow"><span class="dot"></span>%s</span>' % (eyebrow or "")]
    left.append('<h1><span class="grad">%s</span></h1>' % (title or ""))
    if sub:
        left.append('<p class="hero-sub">%s</p>' % render_inline(" ".join(sub)))
    if chips:
        left.append('<ul class="hero-meta">%s</ul>' % "".join('<li class="chip">%s</li>' % c for c in chips))
    minis = "".join('<div class="mini"><span class="k">%s</span><span class="v">%s</span></div>' % (esc(k), v)
                    for k, v in cards)
    out.append('<header class="doc-hero">\n<div>\n%s\n</div>\n<div class="hero-side">\n%s\n</div>\n</header>'
               % ("\n".join(left), minis))


def dir_stat(buf, arg, out, parent):
    items = []
    for raw in buf:
        s = raw.strip()
        if not s:
            continue
        m = re.match(r"^(.+?)\s*\|\s*(.+)$", s)
        if m:
            items.append((m.group(1).strip(), render_inline(m.group(2))))
        else:
            items.append((s, ""))
    stats = "".join('<div class="stat"><span class="n">%s</span><p class="d">%s</p></div>' % (esc(n), d)
                    for n, d in items)
    out.append('<section aria-label="关键数字" class="stat-band reveal">\n%s\n</section>' % stats)


def dir_quote(buf, arg, out, parent):
    label = arg.strip()
    inner, _ = render_blocks(buf)
    lab = '<span class="q-label">%s</span>' % esc(label) if label else ""
    out.append('<div class="quote">\n%s\n%s\n</div>' % (lab, inner))


def dir_timeline(buf, arg, out, parent):
    items = []
    cur = None
    for raw in buf:
        m = re.match(r"^\s*(\d+)\.\s+(.*)$", raw)
        if m:
            if cur:
                items.append(cur)
            cur = {"title": m.group(2).strip(), "body": []}
        elif cur is not None:
            cur["body"].append(raw)
    if cur:
        items.append(cur)
    lis = []
    for it in items:
        # 标题尾部 ` | 标签` = step-tag 药丸（与 stat/tile/card 的「键 | 值」惯例一致）
        t = it["title"]
        tag = None
        m = re.match(r"^(.*?)\s*\|\s*(.+)$", t)
        if m:
            t, tag = m.group(1).strip(), m.group(2).strip()
        title_html = render_inline(t)
        if tag:
            title_html += '<span class="step-tag">%s</span>' % esc(tag)
        body_html, _ = render_blocks(dedent_lines(it["body"]), pclass="t-body")
        lis.append('<li>\n<p class="t-title">%s</p>\n%s\n</li>' % (title_html, body_html))
    out.append('<ol class="timeline">\n%s\n</ol>' % "\n".join(lis))


def dir_acc(buf, arg, out, parent):
    items = []
    cur = None
    for raw in buf:
        m = re.match(r"^\s*(\d+)\.\s+(.*)$", raw)
        if m:
            if cur:
                items.append(cur)
            cur = {"summary": m.group(2).strip(), "body": []}
        elif cur is not None:
            cur["body"].append(raw)
    if cur:
        items.append(cur)
    details = []
    for idx, it in enumerate(items):
        body_html, _ = render_blocks(dedent_lines(it["body"]))
        open_attr = " open" if idx == 0 else ""
        details.append('<details%s>\n<summary><span class="idx">%d</span>%s<span class="arrow">›</span></summary>\n'
                       '<div class="acc-body">\n%s\n</div>\n</details>'
                       % (open_attr, idx + 1, render_inline(it["summary"]), body_html))
    out.append('<div class="acc">\n%s\n</div>' % "\n".join(details))


def dir_cmp(buf, arg, out, parent):
    cols = []
    cur = None
    for raw in buf:
        s = raw.strip()
        if not s:
            continue
        m = re.match(r"^col\s+(.*)$", s)
        if m:
            if cur:
                cols.append(cur)
            cur = {"name": m.group(1).strip(), "kvs": [], "desc": []}
            continue
        if cur is None:
            continue
        m2 = re.match(r"^(\S+)\s*:\s*(.+)$", s)
        if m2 and not cur["desc"]:
            cur["kvs"].append((m2.group(1), render_inline(m2.group(2))))
        else:
            cur["desc"].append(s)
    if cur:
        cols.append(cur)
    col_htmls = []
    for c in cols:
        name = c["name"]
        pick = name.startswith("pick ")
        m = re.match(r"^(?:pick\s+)?\*\*(.+?)\*\*\s*(?:\[badge:\s*(.+?)\])?$", name)
        if m:
            cname = render_inline(m.group(1))
            badge = m.group(2)
        else:
            cname = render_inline(name)
            badge = None
        kvs = "".join('<div class="kv"><span class="k">%s</span><span class="v">%s</span></div>'
                      % (esc(k), v) for k, v in c["kvs"])
        badge_html = '<span class="badge">%s</span>' % esc(badge) if badge else ""
        desc = "".join("<p>%s</p>" % render_inline(x) for x in c["desc"])
        col_htmls.append('<div class="col%s">\n<p class="c-name">%s%s</p>\n%s\n%s\n</div>'
                         % (" pick" if pick else "", cname, badge_html, kvs, desc))
    out.append('<div class="cmp">\n%s\n</div>' % "\n".join(col_htmls))


def dir_grid2(buf, arg, out, parent):
    tiles = []
    for raw in buf:
        s = raw.strip()
        if not s:
            continue
        m = re.match(r"^tile\s+(.+?)\s*\|\s*(.+)$", s)
        if m:
            # t-k 走行内渲染：标题可直接写 md 链接（首页工具卡），纯文本时等价原样
            tiles.append((render_inline(m.group(1).strip()), render_inline(m.group(2))))
    html = "".join('<div class="tile"><span class="t-k">%s</span><p class="t-d">%s</p></div>'
                   % (k, v) for k, v in tiles)
    out.append('<div class="grid2">\n%s\n</div>' % html)


DIRECTIVES = {
    "hero": dir_hero,
    "stat": dir_stat,
    "quote": dir_quote,
    "timeline": dir_timeline,
    "acc": dir_acc,
    "cmp": dir_cmp,
    "grid2": dir_grid2,
}


# ───────────────────────── 装配 ─────────────────────────

def parse_frontmatter(md):
    if not md.startswith("---\n"):
        return {}, md
    end = md.find("\n---\n", 4)
    if end < 0:
        return {}, md
    fm = {}
    for line in md[4:end].split("\n"):
        if not line.strip():
            continue
        k, _, v = line.partition(":")
        v = v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in ('"', "'"):
            v = v[1:-1]
        fm[k.strip()] = v
    return fm, md[end + 5:]


def render_toc(headings):
    links = []
    for h in headings:
        links.append('<a class="toc-link" href="#%s"><span class="toc-no">%s</span><span class="toc-txt">%s</span></a>'
                     % (h["id"], esc(h["no"]), esc(h["label"])))
        for sub in h["subs"]:
            links.append('<a class="toc-link toc-sub" href="#%s"><span class="toc-no">%s</span>'
                         '<span class="toc-txt">%s</span></a>' % (sub["id"], esc(sub["no"]), esc(sub["label"])))
    return "\n".join(links)


def render_footer(fm):
    row = []
    if fm.get("footer_source"):
        row.append("<span>来源：%s</span>" % esc(fm["footer_source"]))
    if fm.get("footer_applies"):
        row.append("<span>适用：%s</span>" % esc(fm["footer_applies"]))
    if fm.get("updated"):
        row.append("<span>更新：%s</span>" % esc(fm["updated"]))
    note = '<p class="f-note">%s</p>' % esc(fm["footer_note"]) if fm.get("footer_note") else ""
    return ('<footer class="doc-footer">\n<div class="f-row">\n%s\n</div>\n%s\n</footer>'
            % ("\n".join(row), note))


def build():
    fm, body = parse_frontmatter(MD_PATH.read_text(encoding="utf-8"))
    html_body, toc = render_blocks(body.split("\n"))
    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    return (template.replace("{{TITLE}}", esc(fm.get("title", "")))
                    .replace("{{TOC}}", render_toc(toc))
                    .replace("{{BODY}}", html_body)
                    .replace("{{FOOTER}}", render_footer(fm)))


def self_check(result):
    ids = set(re.findall(r'\sid="([^"]+)"', result))
    hrefs = re.findall(r'href="#([^"]+)"', result)
    missing = [h for h in hrefs if h not in ids]
    if missing:
        print("✗ 目录链接缺少对应锚点：" + ", ".join(missing))
        sys.exit(1)


def build_page(page):
    global MD_PATH, TEMPLATE_PATH, OUT_PATH
    MD_PATH = PAGE_DIR / ("%s.md" % page)
    TEMPLATE_PATH = PAGE_DIR / "_template.html"
    OUT_PATH = PAGE_DIR / "dist" / ("%s.html" % page)
    if not MD_PATH.exists():
        raise FileNotFoundError("没有 %s" % MD_PATH.relative_to(ROOT))
    result = build()
    self_check(result)
    return result


def main():
    args = sys.argv[1:]
    only = args[args.index("--page") + 1] if "--page" in args else None
    if only:
        pages = [only]
    else:  # 默认：pages/cloudflare-pages/*.md 全部（下划线开头的忽略）
        pages = sorted(p.stem for p in PAGE_DIR.glob("*.md") if not p.stem.startswith("_"))
    if not pages:
        print("✗ pages/cloudflare-pages/ 下没有 .md 源"); sys.exit(1)
    bad = 0
    for page in pages:
        try:
            result = build_page(page)
        except Exception as e:
            print("✗ %s.md 生成失败：%s" % (page, e)); bad += 1; continue
        if "--check" in args:
            existing = OUT_PATH.read_text(encoding="utf-8") if OUT_PATH.exists() else ""
            if result != existing:
                print("✗ dist/%s.html 与 %s.md 不一致 —— 请先运行 python3 scripts/build-doc.py 重新生成再提交。" % (page, page))
                bad += 1
            else:
                print("✓ dist/%s.html 与 %s.md 一致（%d 字节）" % (page, page, len(result)))
        else:
            OUT_PATH.write_text(result, encoding="utf-8")
            print("✓ 已生成 %s" % OUT_PATH.relative_to(ROOT))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
