"""Editable Word companion to book.json. Uses bundled Python/python-docx.

Run: bundled-python build_docx_v2.py [--qa] [--output-dir PATH]
--qa exports a hidden Word PDF and writes page metrics and PNGs under output-20261007/docx_qa.
The book JSON and the separate designed PDF are never modified by this script.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import uuid
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor

sys.stdout.reconfigure(encoding="utf-8")
BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[3]
OUT = BASE / "output-20261007"
QA = OUT / "docx_qa"
DEST = OUT / "SYNK_BM_수정용.docx"
EAST_ASIA = "SUIT BM"
LATIN = "Inter Tight"
INK = "000000"
MUTED = "505B6D"
BLUE_FILL = "EDF3FB"
LINE = "D9E0E9"
BODY_SIZE = 10.0
TABLE_SIZE = 9.35
CONTENT_WIDTH_CM = 18.0


def xml(tag, **attrs):
    el = OxmlElement(tag)
    for k, v in attrs.items():
        el.set(qn(k), str(v))
    return el


def run_style(run, size=BODY_SIZE, bold=False, color=INK, family=LATIN):
    run.font.name = family
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = False
    run.font.color.rgb = RGBColor.from_string(color)
    run.font.underline = False
    rpr = run._r.get_or_add_rPr()
    fonts = rpr.find(qn("w:rFonts"))
    if fonts is None:
        fonts = xml("w:rFonts")
        rpr.insert(0, fonts)
    for key, value in {"w:ascii": family, "w:hAnsi": family,
                       "w:eastAsia": EAST_ASIA, "w:cs": family}.items():
        fonts.set(qn(key), value)
    for key in ("asciiTheme", "hAnsiTheme", "eastAsiaTheme", "cstheme"):
        fonts.attrib.pop(qn("w:" + key), None)
    lang = rpr.find(qn("w:lang"))
    if lang is None:
        lang = xml("w:lang", **{"w:val": "en-US", "w:eastAsia": "ko-KR"})
        rpr.append(lang)
    return run


def add_text(p, text, size=BODY_SIZE, bold=False, color=INK):
    # Explicit script runs avoid Word assigning Korean fallback glyphs to its
    # temporary embedded Latin font and preserve the intended font attribution.
    from fontTools.ttLib import TTFont
    if not hasattr(add_text, "latin_codepoints"):
        add_text.latin_codepoints = set(TTFont(ROOT / "docs/브랜드_폰트/InterTight/InterTight-Medium.ttf").getBestCmap())
    chunks = []
    for ch in str(text):
        family = LATIN if ord(ch) in add_text.latin_codepoints or ch in "\n\t" else EAST_ASIA
        if chunks and chunks[-1][0] == family:
            chunks[-1][1] += ch
        else:
            chunks.append([family, ch])
    for family, value in chunks:
        run_style(p.add_run(value), size, bold, color, family)
    return p


def pformat(p, before=0, after=4, keep=False, line=1.15):
    f = p.paragraph_format
    f.space_before = Pt(before)
    f.space_after = Pt(after)
    f.line_spacing = line
    f.keep_with_next = keep
    f.widow_control = True
    f.keep_together = False
    ppr = p._p.get_or_add_pPr()
    for tag in ("w:pBdr", "w:shd"):
        node = ppr.find(qn(tag))
        if node is not None:
            ppr.remove(node)
    # Wrap Korean naturally at character boundaries; keep Latin words intact.
    if ppr.find(qn("w:wordWrap")) is None:
        ppr.append(xml("w:wordWrap", **{"w:val": "0"}))


def paragraph(doc, text, size=BODY_SIZE, bold=False, color=INK,
              style=None, before=0, after=4, keep=False):
    p = doc.add_paragraph(style=style)
    pformat(p, before, after, keep)
    add_text(p, text, size, bold, color)
    return p


def heading(doc, text, level=2):
    # Outline wording is source-faithful; typography supplies the hierarchy.
    return paragraph(doc, text, 11.7 if level == 2 else 10.3, True,
                     style=f"Heading {level}", before=6, after=3, keep=True)


def compact_gap(doc, points=3):
    p = doc.add_paragraph()
    pformat(p, after=0, line=1)
    p.paragraph_format.line_spacing = Pt(points)
    run_style(p.add_run(""), 1)
    return p


def shade(cell, fill):
    pr = cell._tc.get_or_add_tcPr()
    old = pr.find(qn("w:shd"))
    if old is not None:
        pr.remove(old)
    pr.append(xml("w:shd", **{"w:fill": fill, "w:val": "clear"}))


def table(doc, headers, rows, widths=None, size=TABLE_SIZE, width_cm=CONTENT_WIDTH_CM):
    count = len(headers)
    widths = widths or [1] * count
    fractions = [v / sum(widths) for v in widths]
    tbl = doc.add_table(rows=1, cols=count)
    tbl.autofit = False
    # The requested Word design uses horizontal rules, no boxed grid.
    props = tbl._tbl.tblPr
    borders = props.find(qn("w:tblBorders"))
    if borders is not None:
        props.remove(borders)
    borders = xml("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        attrs = {"w:val": "single", "w:sz": "3", "w:color": LINE} if edge in ("bottom", "insideH") else {"w:val": "nil"}
        borders.append(xml("w:" + edge, **attrs))
    props.append(borders)
    mar = xml("w:tblCellMar")
    for side, val in (("top", 50), ("bottom", 50), ("left", 95), ("right", 95)):
        mar.append(xml("w:" + side, **{"w:w": val, "w:type": "dxa"}))
    props.append(mar)
    props.append(xml("w:tblLayout", **{"w:type": "fixed"}))
    for col, fraction in zip(tbl.columns, fractions):
        col.width = Cm(width_cm * fraction)
    all_rows = [headers] + list(rows)
    for ridx, cells in enumerate(all_rows):
        row = tbl.rows[0] if ridx == 0 else tbl.add_row()
        trpr = row._tr.get_or_add_trPr()
        trpr.append(xml("w:cantSplit"))
        if ridx == 0:
            trpr.append(xml("w:tblHeader"))
        for cidx, value in enumerate(cells):
            cell = row.cells[cidx]
            cell.width = Cm(width_cm * fractions[cidx])
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            p = cell.paragraphs[0]
            pformat(p, after=0, keep=(ridx == 0), line=1.12)
            # Short numbers scan as centered values; narrative stays left.
            s = str(value)
            is_numeric = cidx > 0 and len(s) < 26 and bool(re.search(r"[0-9₮$%]", s)) and not re.search(r"[.!?。]$", s)
            if is_numeric:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            add_text(p, s, size, ridx == 0)
            if ridx == 0:
                shade(cell, BLUE_FILL)
    compact_gap(doc, 4)
    return tbl


def callout(doc, title, text):
    # Editable Word notes stay as prose; the designed PDF carries visual cards.
    heading(doc, title, 3)
    paragraph(doc, text, 9.7, after=5)


def table_pair(doc, items):
    outer = doc.add_table(rows=1, cols=2)
    outer.autofit = False
    props = outer._tbl.tblPr
    borders = xml("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        borders.append(xml("w:" + edge, **{"w:val": "nil"}))
    props.append(borders)
    mar = xml("w:tblCellMar")
    for side, val in (("top", 0), ("bottom", 0), ("left", 0), ("right", 150)):
        mar.append(xml("w:" + side, **{"w:w": val, "w:type": "dxa"}))
    props.append(mar)
    for col in outer.columns:
        col.width = Cm(9)
    for idx, item in enumerate(items):
        cell = outer.cell(0, idx)
        cell.width = Cm(9)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.TOP
        first = cell.paragraphs[0]
        pformat(first, after=3, keep=True)
        add_text(first, item["title"], 10.3, True)
        table(cell, item["headers"], item["rows"], item.get("widths"), 9.1, 8.65)
        if item.get("note"):
            paragraph(cell, item["note"], 8.6, color=MUTED, after=0)
    compact_gap(doc, 5)


def embed_fonts(path):
    """Embed approved TTFs with ECMA-376 fontKey obfuscation; no OS installation.

    Format: https://learn.microsoft.com/en-us/openspecs/office_standards/ms-oe376/1663dabc-5d98-463f-889e-bcd9b77c3d34
    """
    from lxml import etree
    from fontTools.ttLib import TTFont
    # Use the approved static SUIT instances already made for the companion PDF.
    # Normalize only family/style metadata for Word's regular/bold pairing.
    # Glyph outlines, weight, and embedding permissions remain unchanged.
    suit_dir = QA / "fonts"
    suit_dir.mkdir(parents=True, exist_ok=True)
    font_sources = [(LATIN, "Regular", ROOT / "docs/브랜드_폰트/InterTight/InterTight-Medium.ttf"),
                    (LATIN, "Bold", ROOT / "docs/브랜드_폰트/InterTight/InterTight-Bold.ttf")]
    for weight, role in ((500, "Regular"), (800, "Bold")):
        static = TTFont(BASE / "assets" / f"SUIT-{weight}.ttf")
        names = {1: EAST_ASIA, 2: role, 3: "SYNK:" + EAST_ASIA + " " + role, 4: EAST_ASIA + " " + role,
                 6: "SUIT-BM-" + role, 16: EAST_ASIA, 17: role}
        for record in static["name"].names:
            if record.nameID in names:
                record.string = names[record.nameID].encode(record.getEncoding(), errors="replace")
        static["OS/2"].fsSelection = ((static["OS/2"].fsSelection & ~(32 | 64)) | (32 if role == "Bold" else 64))
        static["head"].macStyle = 1 if role == "Bold" else 0
        target = suit_dir / f"SUIT-BM-{role}.ttf"
        static.save(target)
        # SUIT's fsType=4 permits preview/print embedding only, which makes Word
        # force this otherwise editable document read-only. The approved static
        # pair is registered in the user's Fonts area; keep SUIT external here.
    with ZipFile(path) as z:
        members = {name: z.read(name) for name in z.namelist()}
    root = etree.fromstring(members["word/fontTable.xml"])
    families = {}
    for family in (LATIN, EAST_ASIA):
        fonts = [n for n in root if n.get(qn("w:name")) == family]
        font = fonts[0] if fonts else xml("w:font", **{"w:name": family})
        if not fonts:
            root.append(font)
        font.append(xml("w:family", **{"w:val": "swiss"}))
        font.append(xml("w:pitch", **{"w:val": "variable"}))
        if family == EAST_ASIA:
            font.append(xml("w:charset", **{"w:val": "81"}))
            font.append(xml("w:sig", **{"w:usb0": "80000003", "w:usb1": "01D1E46B", "w:usb2": "00000000", "w:usb3": "00000000", "w:csb0": "60280001", "w:csb1": "00000000"}))
        families[family] = font
    relns = "http://schemas.openxmlformats.org/package/2006/relationships"
    relpath = "word/_rels/fontTable.xml.rels"
    rels = etree.fromstring(members[relpath]) if relpath in members else etree.Element("{" + relns + "}Relationships", nsmap={None: relns})
    records = []
    for idx, (family, role, src) in enumerate(font_sources, 1):
        filename = src.name
        font = families[family]
        fs_type = TTFont(src)["OS/2"].fsType
        if fs_type & 0x0002:
            raise ValueError("Font embedding restricted: " + filename)
        source = src.read_bytes()
        key = uuid.uuid5(uuid.NAMESPACE_URL, "SYNK BM " + filename)
        mask = key.bytes[::-1]
        data = bytearray(source)
        for i in range(32):
            data[i] ^= mask[i % 16]
        part = f"fonts/{'intertight' if family == LATIN else 'suit'}-{role.lower()}.odttf"
        members["word/" + part] = bytes(data)
        rid = f"rIdSYNKFont{idx}"
        rel = etree.SubElement(rels, "{" + relns + "}Relationship")
        rel.set("Id", rid)
        rel.set("Type", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/font")
        rel.set("Target", part)
        font.append(xml("w:embed" + role, **{"r:id": rid, "w:fontKey": "{" + str(key).upper() + "}", "w:subsetted": "false"}))
        # Deterministic de-obfuscation must reproduce the complete approved file.
        check = bytearray(data)
        for i in range(32):
            check[i] ^= mask[i % 16]
        assert bytes(check) == source
        records.append({"source": str(src), "font_key": str(key), "fsType": fs_type,
                        "part": part, "sha256": hashlib.sha256(source).hexdigest()})
    members["word/fontTable.xml"] = etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)
    members[relpath] = etree.tostring(rels, xml_declaration=True, encoding="UTF-8", standalone=True)
    ct = etree.fromstring(members["[Content_Types].xml"])
    ctns = "http://schemas.openxmlformats.org/package/2006/content-types"
    if not any(n.get("Extension") == "odttf" for n in ct):
        n = etree.SubElement(ct, "{" + ctns + "}Default")
        n.set("Extension", "odttf")
        n.set("ContentType", "application/vnd.openxmlformats-officedocument.obfuscatedFont")
    members["[Content_Types].xml"] = etree.tostring(ct, xml_declaration=True, encoding="UTF-8", standalone=True)
    settings = etree.fromstring(members["word/settings.xml"])
    settings.append(xml("w:embedTrueTypeFonts", **{"w:val": "true"}))
    settings.append(xml("w:saveSubsetFonts", **{"w:val": "false"}))
    settings.append(xml("w:doNotEmbedSystemFonts", **{"w:val": "false"}))
    members["word/settings.xml"] = etree.tostring(settings, xml_declaration=True, encoding="UTF-8", standalone=True)
    tmp = path.with_suffix(".embedded.docx")
    with ZipFile(tmp, "w", ZIP_DEFLATED) as z:
        for name, data in members.items():
            z.writestr(name, data)
    tmp.replace(path)
    return records


def field(p, name):
    run = p.add_run()
    run._r.append(xml("w:fldChar", **{"w:fldCharType": "begin"}))
    instr = xml("w:instrText", **{"xml:space": "preserve"})
    instr.text = f" {name} "
    run._r.append(instr)
    run._r.append(xml("w:fldChar", **{"w:fldCharType": "end"}))
    run_style(run, 8.2, color=MUTED)


def setup(doc):
    s = doc.sections[0]
    s.page_width, s.page_height = Cm(21), Cm(29.7)
    s.top_margin = s.bottom_margin = Cm(1.5)
    s.left_margin = s.right_margin = Cm(1.5)
    s.header_distance = s.footer_distance = Cm(0.65)
    for name, size in (("Normal", BODY_SIZE), ("Title", 26),
                       ("Heading 1", 24), ("Heading 2", 11.7),
                       ("Heading 3", 10.3), ("Subtitle", 11)):
        st = doc.styles[name]
        st.font.name, st.font.size = LATIN, Pt(size)
        st.font.color.rgb = RGBColor(0, 0, 0)
        st.font.underline = False
        st.paragraph_format.line_spacing = 1.15
        st.paragraph_format.space_after = Pt(4)
        fonts = st.element.get_or_add_rPr().get_or_add_rFonts()
        fonts.set(qn("w:eastAsia"), EAST_ASIA)
        fonts.set(qn("w:ascii"), LATIN)
        fonts.set(qn("w:hAnsi"), LATIN)
        for key in ("asciiTheme", "hAnsiTheme", "eastAsiaTheme", "cstheme"):
            fonts.attrib.pop(qn("w:" + key), None)
        ppr = st.element.find(qn("w:pPr"))
        if ppr is not None:
            for tag in ("w:pBdr", "w:shd"):
                el = ppr.find(qn(tag))
                if el is not None:
                    ppr.remove(el)
    footer = s.footer.paragraphs[0]
    pformat(footer, after=0)
    footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run_style(footer.add_run("SYNK  |  2026.10.07    "), 8.2, color=MUTED)
    field(footer, "PAGE")
    run_style(footer.add_run(" / "), 8.2, color=MUTED)
    field(footer, "NUMPAGES")
    settings = doc.settings.element
    settings.append(xml("w:updateFields", **{"w:val": "true"}))
    doc.core_properties.title = "SYNK 사업모델"
    doc.core_properties.subject = "상품 가격 수익 원가 실행"
    doc.core_properties.author = "SYNK"
    doc.core_properties.keywords = "SYNK LAB SHIFT PULSE PATH WORLD BM"


def cover(doc):
    p = doc.add_paragraph()
    pformat(p, after=20)
    logo = ROOT / "docs/홍보물/마케팅실행_20260909/브랜드킷/배치용/SYNK-Ink.png"
    p.add_run().add_picture(str(logo), width=Cm(3.3))
    paragraph(doc, "BUSINESS MODEL  2026.10.07", 8.6, color=MUTED, after=10)
    paragraph(doc, "SYNK 사업모델", 32, True, style="Title", after=12)
    paragraph(doc, "상품 가격 수익과 다음 결정", 15, True, style="Subtitle", after=16)
    paragraph(doc, "개인화 엔진 Atlas를 중심으로 교육·기업 서비스·콘텐츠·생활 지원을 연결한다. 한국어는 첫 적용 분야다. 아래는 사업별 판매 단위와 지금 검증해야 할 숫자를 한 장에 모은 것이다.", 10.5, after=14)
    table(doc, ["사업", "판매 단위", "지금 볼 숫자"], [
        ["LAB", "정규 한국어 수강료", "등록 인원 × 월 단가 - 실제 운영비"],
        ["SHIFT", "한 업무의 개인화 도입·운영", "도입·지원 시간과 반복 공급의 수익성"],
        ["PULSE", "의뢰 제작 · 콘텐츠/IP", "수정·생성·편집 시간을 포함한 원가"],
        ["PATH", "상담·지원 건 · 제휴 연결", "학생 지원료와 제휴 수수료를 분리"],
        ["WORLD", "타운 정액 · AI/시험 · 기관 좌석", "유료 1명당 잔액과 무료 이용 원가"],
    ], [0.7, 1.3, 2.1], 10)
    callout(doc, "먼저 볼 결론", "SHIFT는 한 업무부터 도입·운영하고 반복 공급·수익성 확인 뒤 API·라이선스로 확장한다. 학원과 WORLD는 등록·전환·반복비를 분리한다. 계획비 4,618만원은 일부 항목의 합계이며 전체 창업자금이 아니다.")
    heading(doc, "읽는 순서")
    paragraph(doc, "회사 구조 02  ·  LAB 03–04  ·  SHIFT 05–06  ·  PULSE 07  ·  PATH 08\nWORLD 09–10  ·  비용·자금 11–12  ·  실행 13  ·  근거 14", 9.5, after=12)
    paragraph(doc, "현행 기준 / 과거 가격안 / 이번 계산 예시를 구분했습니다.\n계산표는 의사결정용이며 실제 매출·청구·운영 성과를 뜻하지 않습니다.", 9, color=MUTED)


def build():
    OUT.mkdir(parents=True, exist_ok=True)
    QA.mkdir(parents=True, exist_ok=True)
    source_bytes = (BASE / "book.json").read_bytes()
    pages = json.loads(source_bytes.decode("utf-8-sig"))
    doc = Document()
    setup(doc)
    for index, page in enumerate(pages, 1):
        if page.get("cover"):
            cover(doc)
            continue
        p = paragraph(doc, page.get("kicker", f"{index:02d}  SYNK"), 8.4,
                      color=MUTED, after=6, keep=True)
        p.paragraph_format.page_break_before = True
        paragraph(doc, page["title"], 23 if len(page["title"]) < 26 else 21,
                  True, style="Heading 1", after=8, keep=True)
        if page.get("lead"):
            paragraph(doc, page["lead"], 10.2, color=MUTED, after=10)
        for block in page.get("blocks", []):
            kind = block["type"]
            if kind == "heading":
                heading(doc, block["text"])
            elif kind == "p":
                paragraph(doc, block["text"], min(block.get("size", BODY_SIZE), BODY_SIZE))
            elif kind == "table":
                table(doc, block["headers"], block["rows"], block.get("widths"), min(block.get("size", TABLE_SIZE), TABLE_SIZE))
            elif kind == "callout":
                callout(doc, block["title"], block["text"])
            elif kind == "table_pair":
                table_pair(doc, block["items"])
            elif kind == "columns":
                for item in block["items"]:
                    heading(doc, item["title"], 3)
                    paragraph(doc, item["text"])
            else:
                raise ValueError(f"Unknown block: {kind}")
        if page.get("sources"):
            paragraph(doc, "근거  " + " · ".join(page["sources"]), 8.1,
                      color=MUTED, before=4, after=0)
    doc.save(DEST)
    embedded = embed_fonts(DEST)
    # Check that the source content is present as text, never rendered page images.
    fulltext = "\n".join(p.text for p in doc.paragraphs)
    def all_table_text(tables):
        chunks = []
        for t in tables:
            for r in t.rows:
                for c in r.cells:
                    chunks.append(c.text)
                    chunks.extend(all_table_text(c.tables))
        return chunks
    fulltext += "\n" + "\n".join(all_table_text(doc.tables))
    missing = []
    for page in pages[1:]:
        expected = [page["title"], page.get("lead", "")]
        for block in page.get("blocks", []):
            if "text" in block:
                expected.append(block["text"])
            if "title" in block:
                expected.append(block["title"])
            if block["type"] == "table":
                expected += [str(v) for row in [block["headers"]] + block["rows"] for v in row]
            for item in block.get("items", []):
                expected += [item.get("title", ""), item.get("note", ""), item.get("text", "")]
                if "headers" in item:
                    expected += [str(v) for row in [item["headers"]] + item["rows"] for v in row]
        missing += [s for s in expected if s and s not in fulltext]
    with ZipFile(DEST) as z:
        media = [x for x in z.namelist() if x.startswith("word/media/")]
        assert len(media) == 1, f"Only the official logo should be embedded: {media}"
        assert not missing, missing
    report = {"source_sha256": hashlib.sha256(source_bytes).hexdigest(),
              "source_pages": len(pages), "docx": str(DEST),
              "paragraphs": len(doc.paragraphs), "tables": len(doc.tables),
              "embedded_images": len(media), "editable_source_text_missing": missing,
              "embedded_fonts": embedded,
              "fonts": {"korean": EAST_ASIA, "latin": LATIN,
                        "note": "Approved Inter Tight Medium/Bold are fully embedded with ODTTF obfuscation. Approved static SUIT 500/800 are registered as SUIT BM in the user Fonts area. SUIT fsType=4 prohibits editable embedding, so SUIT remains an external font to keep the document editable; another editing computer needs the same SUIT BM pair."}}
    (QA / "structure.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return pages


def qa_word(pages):
    pdf = QA / "SYNK_BM_Word_QA.pdf"
    report_path = QA / "word_pages.json"
    # Paths are safely single-quoted for PowerShell; the subprocess is our own hidden Word.
    psq = lambda s: "'" + str(s).replace("'", "''") + "'"
    powershell = f"""
$ErrorActionPreference='Stop'
$app = $null
$doc = $null
try {{
  $app = New-Object -ComObject Word.Application
  $app.Visible = $false
  $app.DisplayAlerts = 0
  $doc = $app.Documents.Open({psq(DEST)}, $false, $false)
  $doc.Repaginate()
  $pageCount = $doc.ComputeStatistics(2)
  $doc.ExportAsFixedFormat({psq(pdf)}, 17)
  [pscustomobject]@{{pages=$pageCount; expected={len(pages)}; read_only=$doc.ReadOnly; exported_pdf={psq(pdf)}}} | ConvertTo-Json | Set-Content -LiteralPath {psq(report_path)} -Encoding UTF8
}} finally {{
  if ($null -ne $doc) {{ $doc.Close(0); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($doc) }}
  if ($null -ne $app) {{ $app.Quit(); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($app) }}
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}}
"""
    result = subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", powershell], capture_output=True, text=True, timeout=120)
    if result.returncode:
        (QA / "word_export_error.txt").write_text(result.stdout + "\n" + result.stderr, encoding="utf-8")
        raise RuntimeError("Word export failed: " + result.stderr)
    import pypdfium2 as pdfium
    from pypdf import PdfReader
    d = pdfium.PdfDocument(pdf)
    pdf_reader = PdfReader(pdf)
    findings = []
    font_names = set()
    for index, page in enumerate(d, 1):
        textpage = page.get_textpage()
        text = textpage.get_text_range()
        page.render(scale=1.6).to_pil().save(QA / f"page-{index}.png")
        findings.append({"page": index, "chars": len(text), "text": text})
        for _, font in pdf_reader.pages[index-1].get("/Resources", {}).get("/Font", {}).items():
            font_names.add(str(font.get_object().get("/BaseFont")))
    data = {"actual_pages": len(d), "expected_pages": len(pages), "pdf_fonts": sorted(font_names), "pages": findings}
    (QA / "render_report.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"actual_pages": len(d), "expected_pages": len(pages), "qa": str(QA)}, ensure_ascii=False))
    if len(d) != len(pages):
        raise RuntimeError(f"Page count mismatch: expected {len(pages)}, got {len(d)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--qa", action="store_true")
    parser.add_argument("--output-dir", type=Path, default=OUT)
    args = parser.parse_args()
    OUT = args.output_dir.resolve()
    QA = OUT / "docx_qa"
    DEST = OUT / "SYNK_BM_수정용.docx"
    p = build()
    if args.qa:
        qa_word(p)
