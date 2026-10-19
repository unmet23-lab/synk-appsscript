"""라디오 DJ 장면 굽기용 참고 그림 셋을 만든다 (2026-10-19).

10-14 규칙: 정본은 생김새 참고로만 넣는다. 투명 PNG는 참고가 안 먹으므로 흰 바탕 JPEG로 바꾼다
(현장 노트 「투명 참고 PNG를 넣으면 참고가 안 먹는다」).

  참고1_까몽정본.jpg   docs/캐릭터/정본_4K/까몽_본체.png — 생김새(털·눈·꼬리)
  참고2_DJ차림.jpg     docs/Loom_자산/라디오DJ/까몽_여름델+전설의팻말_본체.webp — 09-09 확정 DJ 차림(여름 델 + 전설의 팻말)
  참고3_까몽현장.jpg   방송 중인 해 질 녘 한옥 마당(09-19)의 까몽 — 장면 속 빛·재질
  ── 2차(10-19 유호님 「까몽 혼자 말고 지금 방송처럼 세 친구가 같이」) ──
  참고4_마린정본.jpg   docs/캐릭터/정본_4K/마린_본체.png
  참고5_몽글정본.jpg   docs/캐릭터/정본_4K/몽글_눈웃음.png — 방송 장면의 몽글은 수놓은 눈웃음이다
  참고6_세친구현장.jpg 방송 중인 장면의 세 친구 — 셋의 크기 비율·장면 속 재질

python -X utf8 docs/라디오/DJ장면_20261019/참고만들기.py
"""
from pathlib import Path
from PIL import Image

뿌리 = Path(__file__).resolve().parents[3]
여기 = Path(__file__).resolve().parent
참고 = 여기 / '참고'
참고.mkdir(exist_ok=True)


def 흰바탕(경로, 긴변=1024):
    im = Image.open(경로).convert('RGBA')
    판 = Image.new('RGBA', im.size, (255, 255, 255, 255))
    판.alpha_composite(im)
    판 = 판.convert('RGB')
    # 그림이 든 자리만 남기고 여백을 고르게 둔다
    bbox = im.getchannel('A').point(lambda a: 255 if a > 16 else 0).getbbox()
    if bbox:
        x0, y0, x1, y1 = bbox
        여백 = int(max(x1 - x0, y1 - y0) * 0.08)
        판 = 판.crop((max(0, x0 - 여백), max(0, y0 - 여백), min(im.width, x1 + 여백), min(im.height, y1 + 여백)))
    판.thumbnail((긴변, 긴변), Image.Resampling.LANCZOS)
    return 판


흰바탕(뿌리 / 'docs/캐릭터/정본_4K/까몽_본체.png').save(참고 / '참고1_까몽정본.jpg', quality=90)
흰바탕(뿌리 / 'docs/Loom_자산/라디오DJ/까몽_여름델+전설의팻말_본체.webp').save(참고 / '참고2_DJ차림.jpg', quality=90)

장면 = Image.open(뿌리 / 'docs/라디오/눈깜빡임_정지마당_20260919/해질녘_원본.png').convert('RGB')
장면.crop((1100, 360, 1460, 700)).resize((720, 680), Image.Resampling.LANCZOS).save(참고 / '참고3_까몽현장.jpg', quality=90)
흰바탕(뿌리 / 'docs/캐릭터/정본_4K/마린_본체.png').save(참고 / '참고4_마린정본.jpg', quality=90)
흰바탕(뿌리 / 'docs/캐릭터/정본_4K/몽글_눈웃음.png').save(참고 / '참고5_몽글정본.jpg', quality=90)
장면.crop((640, 330, 1500, 720)).resize((1290, 585), Image.Resampling.LANCZOS).save(참고 / '참고6_세친구현장.jpg', quality=90)
print('참고 셋:', sorted(p.name for p in 참고.iterdir()))
