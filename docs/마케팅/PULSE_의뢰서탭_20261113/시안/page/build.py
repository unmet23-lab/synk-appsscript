# 시안 쪽 만들기 — template.html의 {{이름}} 자리에 캡처를 줄여 넣는다(PC 폭 2000 · 휴대폰 폭 780, WebP).
import base64, io, re, sys
from pathlib import Path
from PIL import Image

여기 = Path(__file__).parent
shots = 여기.parent / "shots"
t = (여기 / "template.html").read_text(encoding="utf-8")
합 = 0


def 넣기(m):
    global 합
    이름 = m.group(1)
    im = Image.open(shots / f"{이름}.png").convert("RGB")
    폭 = 780 if "phone" in 이름 else 2000
    if im.width > 폭:
        im = im.resize((폭, round(im.height * 폭 / im.width)), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, "WEBP", quality=80, method=6)
    합 += buf.tell()
    print(f"  {이름:26s} {im.width}x{im.height} {buf.tell() // 1024}KB")
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


out = re.sub(r"\{\{([a-z0-9-]+)\}\}", 넣기, t)
(여기 / "의뢰서탭시안.html").write_text(out, encoding="utf-8")
print("그림 합", 합 // 1024, "KB · 쪽", len(out.encode("utf-8")) // 1024, "KB")
