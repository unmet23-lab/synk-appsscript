# 실제 화면 캡처를 잘라 가리고 키운다: python -X utf8 화면/만들기.py <캡처 폴더>  (편 폴더에서)
# 캡처 원본: 조율 세션 「예약된 게시물 확인」이 10-20 17:45~17:51에 크롬 확장으로 찍은 절반 크기(732×362) 화면.
#   세션 내보내기(zip)의 <세션 id>/tool-results/mcp-claude-in-chrome-blob-<ms>-*.jpg|png. 원본은 저장소에 넣지 않는다.
# 가림: 인스타 계정 전환 창의 개인 계정 두 줄과 메시지 단추 옆 사진, 샤오훙수 로그인 화면의 사진 묶음(남의 얼굴),
#   rednote 계정 이름. 결과는 화면/*.png(저장소)와 remotion/public/cap/(렌더용 사본).
import os
import shutil
import sys

from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1]
OUT = HERE
PUB = os.path.join(HERE, '..', 'remotion', 'public', 'cap')
os.makedirs(PUB, exist_ok=True)

# 캡처 시각(ms, 파일 이름 앞부분) → 이름
FILES = {
    '1792485901253': 'bs',  # 17:45:01 Business Suite 예약됨 「예약된 게시물 없음」
    '1792486062108': 'ig_sw1',  # 17:47:42 계정 전환 창(지금 개인 계정) → synkbrief
    '1792486081617': 'ig_cal1',  # 17:48:01 @synkbrief 예약 달력
    '1792486097744': 'ig_sw2',  # 17:48:17 계정 전환 창(지금 synkbrief) → yuhobuilds
    '1792486118056': 'ig_cal2',  # 17:48:38 @yuhobuilds 예약 달력
    '1792486137197': 'ig_sw3',  # 17:48:57 계정 전환 창(지금 yuhobuilds) → synk.mn
    '1792486158787': 'ig_cal3',  # 17:49:18 @synk.mn 예약 달력
    '1792486211409': 'tt',  # 17:50:11 틱톡 스튜디오(@synklab.mm)
    '1792486285959': 'xhs',  # 17:51:25 creator.xiaohongshu.com → 로그인 화면
    '1792486302432': 'rednote',  # 17:51:42 creator.rednote.com 노트 관리
}
# 계정 전환 창에서 가릴 줄(위에서 몇째 줄, 1부터): 기록의 화면 순서
SW_HIDE = {'ig_sw1': [1, 5], 'ig_sw2': [2, 5], 'ig_sw3': [2, 5]}
ROW_Y = [100, 136, 172, 208, 244]  # 732×362 기준 줄 가운데


def blur(im, box, r=7):
    region = im.crop(box).filter(ImageFilter.GaussianBlur(r))
    im.paste(region, box)


def find(stamp):
    for f in os.listdir(SRC):
        if stamp in f:
            return os.path.join(SRC, f)
    raise SystemExit(f'캡처 없음: {stamp}')


for stamp, name in FILES.items():
    im = Image.open(find(stamp)).convert('RGB')
    assert im.size == (732, 362), (name, im.size)
    if name.startswith('ig_sw'):
        for k in SW_HIDE[name]:
            y = ROW_Y[k - 1]
            blur(im, (226, y - 18, 360, y + 18), 8)
    if name.startswith('ig_'):
        blur(im, (600, 316, 732, 350), 8)  # 메시지 단추 옆 사진
    if name == 'bs':
        blur(im, (690, 6, 716, 32), 6)  # 오른쪽 위 프로필 사진
    if name == 'xhs':
        blur(im, (60, 58, 480, 330), 14)  # 사진 묶음(남의 얼굴)
    if name == 'rednote':
        blur(im, (626, 4, 726, 28), 6)  # 계정 이름
    # 휴대폰에서 읽히게 한 영역만 잘라 키운다(Fable 콘티 검수 H2). 원본 좌표 732×362 기준.
    crop, k = {
        'bs': ((330, 128, 570, 330), 2.5),  # 「예약된 게시물 없음」 가운데
        'ig_sw1': ((222, 60, 502, 290), 2.5),  # 계정 전환 창만
        'ig_sw2': ((222, 60, 502, 290), 2.5),
        'ig_sw3': ((222, 60, 502, 290), 2.5),
        'ig_cal1': ((60, 8, 660, 248), 2),  # 「2026년 10월」 + 빈 주간
        'ig_cal2': ((60, 8, 660, 248), 2),
        'ig_cal3': ((60, 8, 660, 248), 2),
        'tt': ((0, 0, 560, 200), 2),  # 머리 + 두 줄
        'xhs': ((380, 0, 732, 300), 2.5),  # 로그인 상자(사진 묶음은 흐림)
        'rednote': ((0, 0, 732, 175), 2),  # 머리 + 노트 둘
    }[name]
    im = im.crop(crop)
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    dst = os.path.join(OUT, f'{name}.png')
    im.save(dst, optimize=True)
    shutil.copyfile(dst, os.path.join(PUB, f'{name}.png'))
    print(name, im.size)
