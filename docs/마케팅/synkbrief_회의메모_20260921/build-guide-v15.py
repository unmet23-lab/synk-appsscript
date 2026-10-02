"""Append a large-type repeat-use page to the existing checked ten-page guide."""
from io import BytesIO
from pathlib import Path
import shutil
import zipfile

from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

root = Path(__file__).resolve().parent
source = root / "follow-along-v11"
dest = root / "follow-along-v15"
dest.mkdir(exist_ok=True)
for name in ["그대로 복사할 문장.txt", "다음 회의 연습 메모.txt", "다음 회의에 쓸 문장.txt", "정리 전 원본 메모.txt", "정리 후 회의록 예시.txt", "프로젝트에 저장할 규칙.txt"]:
    shutil.copyfile(source / name, dest / name)

regular = root / "follow-along-v8/tmp/SUIT-Regular.ttf"
bold = root / "follow-along-v8/tmp/SUIT-Bold.ttf"
pdfmetrics.registerFont(TTFont("SUIT", str(regular)))
pdfmetrics.registerFont(TTFont("SUIT-Bold", str(bold)))
W, H = A4
ink, blue, grey = HexColor("#172132"), HexColor("#315FBE"), HexColor("#53647F")
paper = BytesIO()
c = canvas.Canvas(paper, pagesize=A4)
c.setFillColor(HexColor("#F8FAFE")); c.rect(0, 0, W, H, fill=1, stroke=0)
c.setFont("SUIT-Bold", 11); c.setFillColor(blue); c.drawString(44, H-48, "synkbrief  |  다시 따라 하기")
c.setFont("SUIT-Bold", 24); c.setFillColor(ink); c.drawString(44, H-91, "다음 회의도 여기서부터 시작하세요")
c.setFont("SUIT", 11); c.setFillColor(grey); c.drawString(44, H-117, "지난 회의 채팅을 다시 열 필요는 없습니다. 아래 순서대로 새 채팅을 시작하세요.")

steps = [
    ("1", "ChatGPT 왼쪽에서 ‘프로젝트’를 누르세요.", "왼쪽에 폴더 그림과 함께 ‘프로젝트’라고 쓰인 메뉴가 있습니다.", "왼쪽 메뉴  →  프로젝트"),
    ("2", "같은 ‘회의 정리’ 프로젝트를 여세요.", "프로젝트 목록에서 처음 만들어 둔 ‘회의 정리’를 누르세요.", "프로젝트 목록  →  회의 정리"),
    ("3", "프로젝트 이름 아래 ‘새 채팅’ 칸을 누르세요.", "위쪽의 긴 입력창입니다. 아래쪽 지난 회의 대화는 누르지 않아도 됩니다.", "회의 정리 화면  →  새 채팅 입력창"),
    ("4", "이번 회의 기록을 새 채팅에 넣으세요.", "‘이번 회의도 정리해줘’라고 쓴 뒤 오늘 메모를 붙여넣으세요.", "부탁할 말 + 오늘 메모  →  새 채팅 입력창"),
    ("5", "오른쪽 ↑를 눌러 메모를 보내세요.", "입력창 오른쪽 아래에 있는 위쪽 화살표가 보내기 버튼입니다.", "입력창 오른쪽 아래  →  ↑ 보내기"),
]
top = 145
for number, heading, explanation, route in steps:
    y = H - top - 105
    c.setFillColor(HexColor("#FFFFFF")); c.setStrokeColor(HexColor("#D9E4F8")); c.roundRect(42, y, W-84, 98, 13, fill=1, stroke=1)
    c.setFillColor(blue); c.roundRect(58, y+63, 30, 27, 9, fill=1, stroke=0)
    c.setFillColor(HexColor("#FFFFFF")); c.setFont("SUIT-Bold", 14); c.drawCentredString(73, y+70, number)
    c.setFillColor(ink); c.setFont("SUIT-Bold", 13.5); c.drawString(99, y+69, heading)
    c.setFillColor(grey); c.setFont("SUIT", 10.7); c.drawString(59, y+44, explanation)
    c.setFillColor(blue); c.setFont("SUIT-Bold", 10.7); c.drawString(59, y+19, route)
    top += 108

c.setFillColor(HexColor("#EAF1FF")); c.roundRect(42, 83, W-84, 62, 12, fill=1, stroke=0)
c.setFillColor(ink); c.setFont("SUIT-Bold", 11); c.drawString(58, 122, "매번 같은 긴 지침을 다시 붙이지 않아도 됩니다.")
c.setFont("SUIT", 10.5); c.drawString(58, 101, "회의 정리 프로젝트에 저장한 규칙은 그 안에서 여는 새 채팅에 적용됩니다.")
c.setFont("SUIT", 8); c.setFillColor(grey); c.drawString(44, 45, "2026.09.23 확인 · 화면 위치는 계정과 기기에 따라 조금 다를 수 있습니다.")
c.drawRightString(W-44, 45, "11 / 11")
c.showPage(); c.save(); paper.seek(0)

writer = PdfWriter()
for page in PdfReader(str(source / "synkbrief-meeting-guide-v11.pdf")).pages:
    writer.add_page(page)
writer.add_page(PdfReader(paper).pages[0])
pdf = dest / "synkbrief-meeting-guide-v15.pdf"
with pdf.open("wb") as handle:
    writer.write(handle)

(dest / "읽어주세요.md").write_text("# synkbrief 회의 정리 따라 하기\n\n1–10쪽은 처음 회의 메모를 정리하고 프로젝트 지침을 저장하는 과정입니다. 마지막 11쪽은 다음 회의 때 저장한 프로젝트를 다시 열어 새 채팅에 이번 기록을 보내는 순서입니다.\n\n복사용 문장은 각각의 txt 파일에 있습니다. 음성 기록을 쓴다면 먼저 사용 중인 기록 앱에서 글로 옮긴 내용을 준비하세요.\n", encoding="utf-8")
(dest / "README.md").write_text("# synkbrief 회의 정리 자료 v15\n\n11쪽 PDF, 처음 정리할 요청문, 프로젝트에 한 번 저장할 규칙, 원본/결과 예시, 다음 회의에 쓸 짧은 문장과 연습 메모를 포함합니다. 11쪽의 다섯 단계는 영상 v15의 다음 회의 장면과 같습니다.\n", encoding="utf-8")
archive = dest / "synkbrief-meeting-kit-v15.zip"
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as z:
    for item in dest.iterdir():
        if item.is_file() and item != archive:
            z.write(item, item.name)
print(f"{len(writer.pages)} pages; PDF {pdf.stat().st_size} bytes; ZIP {archive.stat().st_size} bytes")
