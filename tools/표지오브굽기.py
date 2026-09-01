# 표지오브굽기 — 소개서 표지의 «실물 오브 1점»을 실굽기 렌더에서 잘라 굽는다 (2026-09-01)
#
# 왜 있나 (유호 교정 09-01 「이거 별로야 — Loom 으로 만든 퀄리티 좋은 재질·요소를 써라」):
#   소개서 표지의 .오브 가 «펠트천 타일 + inset 그림자» = CSS 흉내였다(F498 계급 —
#   Loom 헌법 ① 「결은 사진 픽셀에서만 · 프로시저럴은 매끈한 왁스」를 표지가 어기고 있었다).
#   실굽기 라이브러리(오브공방_0821 · 26색 Blender Cycles)가 이미 있으니 그중 한 장을 표지 규격으로 굽는다.
#
# 통로:  python tools/표지오브굽기.py            # → docs/tools/표지오브.json (uri = webp data URI)
#        스킨(tools/펠트문서.js)이 그 json 을 읽어 .오브 배경으로 쓴다 — 펠트천.json 과 같은 무늬:
#        굽는 도구(ffmpeg·Pillow)는 여기서 끝나고, 굽기(--굽기/--전량)는 json 만 읽는다(CI 의존 0).
#
# 색 픽 = Paper(근백색). 까닭: ①현행 표지가 백색(Chalk 천)이라 가장 충실한 승격이고
#   ②레퍼런스 문법(검은 무대 위 «밝은» 양모 아이콘) 그대로이며 ③Ink 글자 대비가 가장 넉넉하다.
#   색을 바꾸는 날 = 여기 원본 한 줄 + 재실행 + --전량 (색 직책 판정은 유호님 몫).
#
# ⚠자르는 법 — 「뒤를 오려내지 않는다」: 펠트의 잔털은 어두운 무대가 있어야 읽힌다
#   (loom-engine-scope ③ 「알파로 오려낸 유리는 뒤를 잃는다」와 같은 원리). 그래서 받침 무대째
#   넓게 자르고, 바깥 가장자리만 라운드 사각 마스크로 깃털처럼 죽인다 — 페이지의 검은 무대에 이음매 0.

import base64
import datetime
import io
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

out = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
루트 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

색이름 = 'Paper'
원본길 = os.path.join(루트, 'docs', '캐릭터', '오브공방_0821', 색이름 + '.png')
출력길 = os.path.join(루트, 'docs', 'tools', '표지오브.json')
목표px = 448          # 표시 126px 의 3.5x — 레티나에서도 섬유가 안 뭉갠다
여유율 = 1.55         # 몸판(털 제외) 대비 프레임 — 잔털(+~13%)과 어두운 여백 한 겹까지. 뒤의 어둠은 지면 무대가 잇는다

if not os.path.exists(원본길):
    raise SystemExit('원본 렌더가 없다: ' + 원본길)

im = Image.open(원본길).convert('RGBA')

# ① 프레이밍 — 오브공방_0821 은 26색이 «같은 카메라·같은 무대»의 시리즈라 기하를 박는다
#    (잔털까지 백색이라 휘도 문턱으로는 몸판과 털이 안 갈린다 — 두 번 실측하고 상수로 왔다).
#    검산: 밝은 픽셀 상자가 이 중심을 품지 않으면 렌더가 갈린 것이니 죽는다.
cx, cy, 몸판 = 905, 732, 690          # 펠트 몸판(털 제외) 중심·한 변 — 시리즈 공통
변 = int(몸판 * 여유율)
bbox = im.convert('L').point(lambda v: 255 if v > 150 else 0).getbbox()
if not bbox or not (bbox[0] < cx < bbox[2] and bbox[1] < cy < bbox[3]):
    raise SystemExit('렌더 기하가 기대와 다르다(밝은 상자가 중심을 안 품는다): ' + 원본길)

# ② 정사각 자르기 — 프레임이 원본 밖으로 나가면 순검정(무대와 같은 값)으로 채운다
x0, y0 = cx - 변 // 2, cy - 변 // 2
캔버스 = Image.new('RGBA', (변, 변), (0, 0, 0, 255))
캔버스.paste(im.crop((x0, y0, x0 + 변, y0 + 변)), (0, 0))

# ③ 가장자리 깃털 — 라운드 사각을 크게 흐려 알파로 쓴다(잔털은 살고 프레임 모서리만 죽는다)
#    원본 알파는 전면 255(무대까지 구운 렌더)라, 최종 알파 = 이 마스크 하나다.
마스크 = Image.new('L', (변, 변), 0)
안 = int(변 * 0.045)
ImageDraw.Draw(마스크).rounded_rectangle([안, 안, 변 - 안, 변 - 안], radius=int(변 * 0.26), fill=255)
마스크 = 마스크.filter(ImageFilter.GaussianBlur(변 * 0.055))
캔버스.putalpha(마스크)

작게 = 캔버스.resize((목표px, 목표px), Image.LANCZOS)

# ④ 중심 휘도 — 대비 심판 주석의 근거(글자가 앉는 면이 실제로 얼마나 밝은가)
안쪽 = 작게.convert('L').crop((int(목표px * .36), int(목표px * .36), int(목표px * .64), int(목표px * .64)))
중심휘도 = round(sum(안쪽.getdata()) / (안쪽.width * 안쪽.height))

buf = io.BytesIO()
작게.save(buf, format='WEBP', quality=84, method=6)
uri = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')

os.makedirs(os.path.dirname(출력길), exist_ok=True)
with io.open(출력길, 'w', encoding='utf-8') as f:
    json.dump({
        '판': '표지오브 v1',
        '만든날': str(datetime.date.today()),
        '어떻게': 'tools/표지오브굽기.py — 오브공방_0821 실굽기에서 자름(가장자리 라운드 깃털)',
        '원본': 'docs/캐릭터/오브공방_0821/' + 색이름 + '.png',
        '색이름': 색이름,
        'px': 목표px,
        '중심휘도': 중심휘도,
        'uri': uri,
    }, f, ensure_ascii=False, indent=1)

out.write(f'■ 표지오브  {색이름} · {변}px→{목표px}px · 중심휘도 {중심휘도} · {len(uri) // 1024}KB → docs/tools/표지오브.json\n')
out.flush()
