# 구운 판(../판/*.png, git 밖 원본)을 화면 크기 1080x1920 JPEG로 public/img에 옮긴다 — 가운데를 9:16으로 잘라(cover) 좌표를 코드와 맞춘다.
#   python -I -X utf8 판옮기기.py
import os
from PIL import Image

여기 = os.path.dirname(os.path.abspath(__file__))
판 = os.path.join(여기, '..', '판')
밖 = os.path.join(여기, 'public', 'img')
os.makedirs(밖, exist_ok=True)

# 화면 이름 → 판 파일(마지막으로 고른 판)
고른판 = {
    'hook': '첫화면_073343.png',  # 시험 3판까지의 머리 칸(11-06 시험 v2 · v3 「0~3초가 강의 광고처럼 멈춤」으로 open으로 바꿈)
    'open': '첫인사2_082002.png',  # 머리 칸 — 그 사람 앞에서 새빨갛게 굳은 몽글(끝 장면을 앞에서 먼저). 080959 판은 그 사람이 손만 보여 시험 v4에서 「누구에게 설레는지 모른다」
    'lib1': '도서관_073650.png',  # 073343 판은 그 사람이 책만 보고 있어 눈이 마주치는 게 안 읽혀 다시 구웠다
    'lib2': '두근_073343.png',
    'rain1': '비_073343.png',
    'rain2': '우산_073622.png',
    'rain3': '설레_074224.png',
    'rain3b': '설레2_080959.png',  # 설레 칸 뒷절반(시험 「10 · 12초가 거의 같은 그림」)
    'hall1': '이름_073343.png',
    'hall2': '심쿵_073343.png',
    'tree1': '웃음_073343.png',
    'tree2': '반했어_073343.png',
    'tree2b': '반했어2_080959.png',  # 반했어 칸 뒷절반 — 하트 모양으로 다 녹음(시험 「20 · 22초가 거의 같은 그림」)
    'greet': '인사_072137.png',
    'phone': '문자_072413.png',
    'burst': '불꽃_072413.png',
}

for 이름, 파일 in 고른판.items():
    p = os.path.join(판, 파일)
    if not os.path.exists(p):
        print('없음', 이름, 파일)
        continue
    im = Image.open(p).convert('RGB')
    w, h = im.size
    if w / h > 9 / 16:
        nw = round(h * 9 / 16)
        x = (w - nw) // 2
        im = im.crop((x, 0, x + nw, h))
    else:
        nh = round(w * 16 / 9)
        y = (h - nh) // 2
        im = im.crop((0, y, w, y + nh))
    im = im.resize((1080, 1920), Image.LANCZOS)
    im.save(os.path.join(밖, 이름 + '.jpg'), quality=92)
    print('옮김', 이름, 파일, (w, h))
