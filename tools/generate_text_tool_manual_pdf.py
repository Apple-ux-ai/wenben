from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any, Iterable
from xml.sax.saxutils import escape

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, StyleSheet1, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import Image as RLImage
from reportlab.platypus import ListFlowable, ListItem, PageBreak, Paragraph, SimpleDocTemplate, Spacer
from reportlab.platypus.tableofcontents import TableOfContents


@dataclass(frozen=True)
class ToolModuleInfo:
    id: str
    title: str
    description: str
    category: str


@dataclass(frozen=True)
class TutorialStep:
    title: str
    description: str


@dataclass(frozen=True)
class TutorialInfo:
    module_id: str
    title: str
    steps: list[TutorialStep]
    notes: list[str]


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _parse_modules(config_tsx: str) -> list[ToolModuleInfo]:
    pattern = re.compile(
        r"\{\s*"
        r"id:\s*['\"](?P<id>[^'\"]+)['\"]\s*,\s*"
        r"title:\s*['\"](?P<title>[^'\"]+)['\"]\s*,\s*"
        r"description:\s*['\"](?P<description>[^'\"]+)['\"]\s*,\s*"
        r"category:\s*['\"](?P<category>[^'\"]+)['\"]",
        re.S,
    )
    modules: list[ToolModuleInfo] = []
    for m in pattern.finditer(config_tsx):
        modules.append(
            ToolModuleInfo(
                id=m.group("id").strip(),
                title=m.group("title").strip(),
                description=m.group("description").strip(),
                category=m.group("category").strip(),
            )
        )
    return modules


def _find_object_block(source: str, key: str) -> str | None:
    candidates = [
        f"'{key}':",
        f'"{key}":',
    ]
    start = -1
    for c in candidates:
        start = source.find(c)
        if start != -1:
            break
    if start == -1:
        return None

    brace_start = source.find("{", start)
    if brace_start == -1:
        return None

    depth = 0
    i = brace_start
    in_single = False
    in_double = False
    escaped = False

    while i < len(source):
        ch = source[i]
        if escaped:
            escaped = False
            i += 1
            continue
        if ch == "\\":
            escaped = True
            i += 1
            continue

        if in_single:
            if ch == "'":
                in_single = False
            i += 1
            continue
        if in_double:
            if ch == '"':
                in_double = False
            i += 1
            continue

        if ch == "'":
            in_single = True
            i += 1
            continue
        if ch == '"':
            in_double = True
            i += 1
            continue

        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return source[brace_start : i + 1]
        i += 1
    return None


def _extract_quoted_array(block: str, prop_name: str) -> list[str]:
    m = re.search(rf"{re.escape(prop_name)}\s*:\s*\[([\s\S]*?)\]", block)
    if not m:
        return []
    inner = m.group(1)
    items = re.findall(r"['\"]([^'\"]+)['\"]", inner)
    return [s.strip() for s in items if s.strip()]


def _extract_steps(block: str) -> list[TutorialStep]:
    m = re.search(r"steps\s*:\s*\[([\s\S]*?)\]\s*,\s*notes\s*:", block)
    if not m:
        m = re.search(r"steps\s*:\s*\[([\s\S]*?)\]", block)
    if not m:
        return []
    steps_src = m.group(1)
    step_blocks = re.findall(r"\{\s*([\s\S]*?)\s*\}", steps_src)
    steps: list[TutorialStep] = []
    for sb in step_blocks:
        title_m = re.search(r"title\s*:\s*['\"]([^'\"]+)['\"]", sb)
        desc_m = re.search(r"description\s*:\s*['\"]([^'\"]+)['\"]", sb)
        if title_m and desc_m:
            steps.append(TutorialStep(title=title_m.group(1).strip(), description=desc_m.group(1).strip()))
    return steps


def _parse_tutorials(text_tools_page_tsx: str, module_ids: Iterable[str]) -> dict[str, TutorialInfo]:
    m = re.search(r"const\s+MODULE_TUTORIALS\s*:[^=]*=\s*\{([\s\S]*?)\n\};", text_tools_page_tsx)
    if not m:
        return {}
    block = m.group(0)

    tutorials: dict[str, TutorialInfo] = {}
    for module_id in module_ids:
        obj = _find_object_block(block, module_id)
        if not obj:
            continue
        title_m = re.search(r"title\s*:\s*['\"]([^'\"]+)['\"]", obj)
        title = title_m.group(1).strip() if title_m else module_id
        steps = _extract_steps(obj)
        notes = _extract_quoted_array(obj, "notes")
        tutorials[module_id] = TutorialInfo(module_id=module_id, title=title, steps=steps, notes=notes)
    return tutorials


def _styles() -> StyleSheet1:
    pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
    styles = getSampleStyleSheet()
    base_font = "STSong-Light"

    styles.add(
        ParagraphStyle(
            name="CoverTitle",
            parent=styles["Title"],
            fontName=base_font,
            fontSize=26,
            leading=34,
            spaceAfter=12,
            alignment=1,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CoverSubTitle",
            parent=styles["Normal"],
            fontName=base_font,
            fontSize=14,
            leading=20,
            spaceAfter=10,
            alignment=1,
        )
    )
    styles.add(
        ParagraphStyle(
            name="H1",
            parent=styles["Heading1"],
            fontName=base_font,
            fontSize=16,
            leading=22,
            spaceBefore=10,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="H2",
            parent=styles["Heading2"],
            fontName=base_font,
            fontSize=13,
            leading=18,
            spaceBefore=8,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Body",
            parent=styles["Normal"],
            fontName=base_font,
            fontSize=11,
            leading=17,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Small",
            parent=styles["Normal"],
            fontName=base_font,
            fontSize=10,
            leading=15,
            textColor="#595959",
            spaceAfter=2,
        )
    )
    styles.add(
        ParagraphStyle(
            name="TocTitle",
            parent=styles["Heading1"],
            fontName=base_font,
            fontSize=16,
            leading=22,
            spaceBefore=0,
            spaceAfter=10,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Toc1",
            parent=styles["Normal"],
            fontName=base_font,
            fontSize=11,
            leading=16,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Toc2",
            parent=styles["Normal"],
            fontName=base_font,
            fontSize=10,
            leading=15,
            leftIndent=10 * mm,
        )
    )
    return styles


def _p(text: str) -> str:
    return escape(text).replace("\n", "<br/>")


def _bullet_list(items: list[str], style: ParagraphStyle) -> ListFlowable:
    return ListFlowable(
        [ListItem(Paragraph(_p(it), style), leftIndent=14, value="•") for it in items],
        bulletType="bullet",
        leftIndent=12,
        bulletFontName=style.fontName,
        bulletFontSize=style.fontSize,
    )


def _page_decor(canvas, doc):
    canvas.saveState()
    canvas.setFont("STSong-Light", 9)
    canvas.setFillColorRGB(0.55, 0.55, 0.55)
    canvas.drawRightString(A4[0] - 18 * mm, 12 * mm, f"第 {doc.page} 页")
    canvas.restoreState()


def _load_screenshots(project_root: Path) -> dict[str, Path]:
    images_dir = project_root / "图片"
    if not images_dir.exists() or not images_dir.is_dir():
        return {}
    shots: dict[str, Path] = {}
    for ext in ("*.png", "*.jpg", "*.jpeg", "*.PNG", "*.JPG", "*.JPEG"):
        for p in images_dir.glob(ext):
            shots[p.name] = p
    return shots


def _add_screenshot(
    story: list[Any],
    img_path: Path,
    caption: str,
    max_width: float,
    max_height: float,
    styles: StyleSheet1,
) -> None:
    try:
        from PIL import Image as PILImage

        with PILImage.open(img_path) as im:
            w, h = im.size
    except Exception:
        w, h = 1920, 1080

    scale = min(max_width / float(w), max_height / float(h))
    if scale <= 0:
        return
    draw_w = float(w) * scale
    draw_h = float(h) * scale

    story.append(Spacer(1, 3 * mm))
    story.append(RLImage(str(img_path), width=draw_w, height=draw_h))
    story.append(Paragraph(_p(caption), styles["Small"]))


class ManualDocTemplate(SimpleDocTemplate):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._heading_count = 0

    def afterFlowable(self, flowable):
        if not isinstance(flowable, Paragraph):
            return
        style_name = getattr(getattr(flowable, "style", None), "name", "")
        if style_name not in {"H1", "H2"}:
            return
        text = re.sub(r"\s+", " ", flowable.getPlainText()).strip()
        if not text:
            return
        level = 0 if style_name == "H1" else 1
        self._heading_count += 1
        key = f"h{self._heading_count}"
        try:
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(text, key, level=level, closed=False)
        except Exception:
            pass
        self.notify("TOCEntry", (level, text, self.page))


def build_pdf(out_path: Path, project_root: Path) -> None:
    pkg = _load_json(project_root / "package.json")
    product_name = str(pkg.get("build", {}).get("productName") or pkg.get("description") or "文本文件处理工具")
    version = str(pkg.get("version") or "")
    author = str(pkg.get("author") or "")

    modules = _parse_modules(_read_text(project_root / "src/renderer/features/text-tools/config.tsx"))
    tutorials = _parse_tutorials(
        _read_text(project_root / "src/renderer/pages/TextToolsPage.tsx"),
        module_ids=[m.id for m in modules],
    )

    content_modules = [m for m in modules if m.category == "content"]
    convert_modules = [m for m in modules if m.category == "convert"]
    split_merge_modules = [m for m in modules if m.category == "split-merge"]

    styles = _styles()
    doc = ManualDocTemplate(
        str(out_path),
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=f"{product_name} 使用说明书",
        author=author,
    )

    story: list[Any] = []
    screenshots = _load_screenshots(project_root)
    usable_width = A4[0] - doc.leftMargin - doc.rightMargin
    screenshot_max_height = A4[1] - doc.topMargin - doc.bottomMargin - 35 * mm

    story.append(Spacer(1, 55 * mm))
    story.append(Paragraph(_p(product_name), styles["CoverTitle"]))
    story.append(Paragraph(_p("（使用说明书）"), styles["CoverSubTitle"]))
    meta_line = " | ".join([s for s in [f"版本：v{version}" if version else "", f"日期：{date.today().isoformat()}", f"作者：{author}" if author else ""] if s])
    if meta_line:
        story.append(Spacer(1, 10 * mm))
        story.append(Paragraph(_p(meta_line), styles["Small"]))
    story.append(PageBreak())

    toc = TableOfContents()
    toc.levelStyles = [styles["Toc1"], styles["Toc2"]]
    story.append(Paragraph(_p("目录"), styles["TocTitle"]))
    story.append(Spacer(1, 2 * mm))
    story.append(toc)
    story.append(PageBreak())

    story.append(Paragraph(_p("引言"), styles["H1"]))
    story.append(Paragraph(_p(f"本说明书为指导用户使用“{product_name}”而编写，旨在帮助用户快速了解软件功能与操作流程。"), styles["Body"]))
    story.append(Paragraph(_p("编写目的"), styles["H2"]))
    story.append(Paragraph(_p("通过规范化的操作说明与功能介绍，让用户能够在无需额外培训的情况下完成常见的批量文本处理任务。"), styles["Body"]))
    story.append(Paragraph(_p("背景"), styles["H2"]))
    story.append(Paragraph(_p("在日常办公场景中，文本替换、内容清洗、格式转换、批量命名等操作重复且易出错。本工具通过自动化与规则化能力，显著降低重复劳动成本。"), styles["Body"]))
    story.append(Paragraph(_p("用途"), styles["H2"]))
    story.append(Paragraph(_p("适用于批量处理 Word/Excel/PDF/TXT 等相关文本类文件的内容修改、转换与整理。"), styles["Body"]))
    story.append(Paragraph(_p("运行环境"), styles["H2"]))
    story.append(
        _bullet_list(
            [
                "操作系统：Windows 10 / Windows Server 2012 及以上",
                "建议硬件：i5 四核及以上；内存 8GB 及以上；硬盘可用空间 50GB 及以上",
                "部分功能可能需要进行软件授权验证（授权码验证有效期为 24 小时）",
                "可选：登录功能支持跳转外部浏览器完成登录",
            ],
            styles["Body"],
        )
    )

    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph(_p("一、软件介绍"), styles["H1"]))
    story.append(
        Paragraph(
            _p(
                f"《{product_name}》是一款桌面端批量文件处理软件，以“自动化解放生产力”为核心开发，汇聚文本替换、内容提取、格式转换、批量重命名、合并拆分等多项实用能力，支持对多种文本类文件进行批量规则化操作。"
            ),
            styles["Body"],
        )
    )
    if "01首页.png" in screenshots:
        _add_screenshot(
            story,
            screenshots["01首页.png"],
            "图 1 首页",
            max_width=usable_width,
            max_height=screenshot_max_height,
            styles=styles,
        )

    story.append(Paragraph(_p("二、主要功能介绍"), styles["H1"]))
    story.append(Paragraph(_p("1、主界面功能布局说明"), styles["H2"]))
    story.append(
        Paragraph(
            _p("启动软件后进入首页与工具列表。左侧为导航栏，可按分类浏览；顶部支持搜索关键词快速定位工具；在工具卡片中可查看简介并进入功能界面。"),
            styles["Body"],
        )
    )
    if "02导航栏.png" in screenshots:
        _add_screenshot(
            story,
            screenshots["02导航栏.png"],
            "图 2 左侧导航栏与分类入口",
            max_width=usable_width,
            max_height=screenshot_max_height,
            styles=styles,
        )
    story.append(Paragraph(_p("2、分类频道切换功能"), styles["H2"]))
    story.append(
        _bullet_list(
            [
                "全部功能：展示全部工具模块",
                "文件内容：文本编码、模板生成、去重/删空行、按规则批量修改、按行插入/删除/替换等",
                "格式转换：文本/HTML/JSON/Markdown 转换为 docx/pdf/xlsx/txt 等",
                "合并拆分：文本文件拆分、文本文件合并",
            ],
            styles["Body"],
        )
    )
    for name, caption in [
        ("03文件内容处理.png", "图 3 文件内容处理"),
        ("04格式转换.png", "图 4 格式转换"),
        ("05合并拆分.png", "图 5 合并拆分"),
    ]:
        p = screenshots.get(name)
        if p:
            _add_screenshot(
                story,
                p,
                caption,
                max_width=usable_width,
                max_height=screenshot_max_height,
                styles=styles,
            )

    story.append(PageBreak())
    story.append(Paragraph(_p("三、使用方法"), styles["H1"]))
    story.append(
        _bullet_list(
            [
                "添加文件：在工具界面中导入待处理文件（部分工具支持拖拽、支持批量导入）",
                "设置参数：根据工具要求配置规则、目标格式、输出目录等",
                "开始处理：点击“开始/转换/处理”等按钮执行任务",
                "查看结果：处理完成后可预览结果或打开输出目录",
            ],
            styles["Body"],
        )
    )

    key_tutorial_ids = ["rule-editor", "excel-rule-editor", "encoding-converter", "template-generator"]
    for tid in key_tutorial_ids:
        t = tutorials.get(tid)
        if not t:
            continue
        story.append(Spacer(1, 3 * mm))
        story.append(Paragraph(_p(t.title), styles["H2"]))
        for idx, step in enumerate(t.steps, 1):
            story.append(Paragraph(_p(f"{idx}. {step.title}"), styles["Body"]))
            story.append(Paragraph(_p(step.description), styles["Small"]))
        if t.notes:
            story.append(Paragraph(_p("提示："), styles["Body"]))
            story.append(_bullet_list(t.notes, styles["Small"]))

    for name, caption in [
        ("06导入excel规则修改界面.png", "图 6 导入 Excel 规则修改界面"),
        ("07文本转换界面.png", "图 7 文本文件转换界面"),
    ]:
        p = screenshots.get(name)
        if p:
            _add_screenshot(
                story,
                p,
                caption,
                max_width=usable_width,
                max_height=screenshot_max_height,
                styles=styles,
            )

    if ("10登录入口.png" in screenshots) or ("11授权码.png" in screenshots):
        story.append(Spacer(1, 6 * mm))
        story.append(Paragraph(_p("登录与授权"), styles["H2"]))
        story.append(Paragraph(_p("部分场景下，软件可能需要登录或进行授权验证以启用完整功能。"), styles["Body"]))
        for name, caption in [
            ("10登录入口.png", "图 8 登录入口"),
            ("11授权码.png", "图 9 授权码验证"),
        ]:
            p = screenshots.get(name)
            if p:
                _add_screenshot(
                    story,
                    p,
                    caption,
                    max_width=usable_width,
                    max_height=screenshot_max_height,
                    styles=styles,
                )

    story.append(PageBreak())
    story.append(Paragraph(_p("四、文件内容处理"), styles["H1"]))
    for m in content_modules:
        story.append(Paragraph(_p(m.title), styles["H2"]))
        story.append(Paragraph(_p(m.description), styles["Body"]))

    story.append(PageBreak())
    story.append(Paragraph(_p("五、格式转换"), styles["H1"]))
    for m in convert_modules:
        story.append(Paragraph(_p(m.title), styles["H2"]))
        story.append(Paragraph(_p(m.description), styles["Body"]))

    story.append(PageBreak())
    story.append(Paragraph(_p("六、合并拆分"), styles["H1"]))
    for m in split_merge_modules:
        story.append(Paragraph(_p(m.title), styles["H2"]))
        story.append(Paragraph(_p(m.description), styles["Body"]))
    for name, caption in [
        ("08拆分界面.png", "图 10 拆分界面"),
        ("09合并界面.png", "图 11 合并界面"),
    ]:
        p = screenshots.get(name)
        if p:
            _add_screenshot(
                story,
                p,
                caption,
                max_width=usable_width,
                max_height=screenshot_max_height,
                styles=styles,
            )

    doc.multiBuild(story, onFirstPage=_page_decor, onLaterPages=_page_decor)


def main() -> int:
    project_root = Path(__file__).resolve().parents[1]
    out_path = project_root / "文本文件处理工具使用说明书（替换生成版）.pdf"
    build_pdf(out_path=out_path, project_root=project_root)
    print(str(out_path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
