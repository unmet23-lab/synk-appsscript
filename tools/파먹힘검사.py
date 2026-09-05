"""걷기가 «물건 안쪽»을 파먹은 자산을 전수로 찾는다 (2026-09-05 · 0원).

쓰기: python tools/파먹힘검사.py
고치는 법: 걸린 장을 눈으로 되본 뒤 `tools/흰배경걷기.py <원본> --흰바닥 254 --임계 50 --조각몫 0`
      (그 처방의 까닭은 흰배경걷기.py 머리말에 있다).


09-05 저녁에 눈으로 셋을 찾았다 — 넘김손가락(엄지가 사라짐) · 북마크(몸통이 벌집) ·
달력(종이가 크게 뚫림). 셋 다 밝은 색(크림·버터) 물건이다. 흰 배경과 밝기가 가까워
floodfill 이 물건 안으로 파고든 것이다. 인계문 ④가 미리 적어 둔 바로 그 위험이다:
「밝기 임계로 자르지 않는 이유: 버터색 별·크림색 실처럼 밝은 물건이 통째로 사라진다」.

자: 알파의 «바깥 윤곽을 채운 뒤»(binary_fill_holes) 그 안에서 알파가 낮은 자리를 센다.
    물건은 속이 찬 것이 정상이므로, 윤곽 안의 빈자리 = 파먹힌 자리다.
⚠ 「일부러 뚫린 구멍」이 있는 물건이 있다(단추 구멍 넷 · 가위 손잡이 · 지우기의 세로 홈).
   그래서 «몫»으로 가르고 눈으로 되본다. 이 자는 후보를 좁힐 뿐 판정하지 않는다.
"""
import glob
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

규격 = {}
try:
    # ⚠ 굽기 배치가 도는 동안에는 이 파일이 계속 다시 써진다 — 못 읽어도 검사는 이어간다.
    계획 = json.load(open('docs/공방/계획.json', encoding='utf-8'))
    for m in 계획['제미나이']['묶음']:
        for it in m.get('것들', []):
            쇠 = it.get('쇠') or os.path.splitext(str(it.get('파일', '')))[0]
            if 쇠:
                규격[쇠] = (it.get('규격') or ('천' if m['이름'].startswith('천') else '부품'), m['이름'])
except Exception as e:
    print('⚠ 계획.json 을 못 읽었다(%s) — 규격을 모른 채 전부 「부품」으로 본다' % type(e).__name__)

# 인자로 글롭을 주면 그것을 본다. 없으면 공방 자산만(기본).
글롭들 = sys.argv[1:] or ['docs/Loom_자산/구움/공방_*.avif',
                        'docs/Loom_자산/구움/공방_*.webp']
파일들 = sorted({f for g in 글롭들 for f in glob.glob(g, recursive=True)})
후보, 잰것 = [], 0
for f in 파일들:
    쇠 = os.path.splitext(os.path.basename(f))[0]
    g, 묶 = 규격.get(쇠, ('부품', '(계획 밖)'))
    if g == '천':
        continue
    im = Image.open(f).convert('RGBA')
    a = np.array(im.getchannel('A').resize((600, 600), Image.BILINEAR))
    있다 = a > 100
    if 있다.sum() < 200:
        continue
    잰것 += 1
    # 가장 큰 덩어리만 본다 — 떨어진 조각은 여기서 셀 대상이 아니다
    표, 수 = ndimage.label(있다, structure=np.ones((3, 3), dtype=bool))
    if 수 == 0:
        continue
    크기 = ndimage.sum(있다, 표, range(1, 수 + 1))
    본체 = 표 == (int(np.argmax(크기)) + 1)
    채움 = ndimage.binary_fill_holes(본체)
    구멍 = 채움 & ~본체
    몫 = 구멍.sum() / max(채움.sum(), 1) * 100
    # 구멍이 «잘게 흩어져» 있으면 파먹힘, «큼직한 몇 개»면 설계된 구멍이다
    표2, 수2 = ndimage.label(구멍, structure=np.ones((3, 3), dtype=bool))
    if 몫 >= 1.0:
        후보.append((쇠, round(몫, 1), int(수2), 묶))

"""🔑 갈라 세우는 축은 «빈자리 몫»이 아니라 «구멍 개수»다(09-05 실측으로 바로잡았다).

고리·도장처럼 가운데가 비는 물건은 빈자리가 60% 라도 구멍이 두세 개뿐이라 정상이다.
파먹힘은 반대다 — 잘게 흩어져 수십·수백 개가 된다(북마크 870 · 달력 139).
그래서 구멍 개수로 줄을 세우고, 스무 개를 넘는 것만 «되볼 것»으로 낸다.
"""
문턱 = 20
후보.sort(key=lambda x: -x[2])
되볼것 = [x for x in 후보 if x[2] >= 문턱]
print('■ 부품·장면 %d장을 쟀다 (천 제외)' % 잰것)
print('■ 윤곽 안에 빈자리가 1%% 이상인 것 : %d장' % len(후보))
print('■ 그중 구멍이 %d개를 넘어 «잘게 파먹힌» 무늬 : %d장 ← 눈으로 되본다' % (문턱, len(되볼것)))
print('   (고리·도장처럼 가운데가 비는 물건은 빈자리가 커도 구멍이 두셋뿐이라 여기 안 든다)')
후보 = 되볼것
print('')
print('   %-24s %7s %7s  %s' % ('이름', '빈자리%', '구멍수', '묶음'))
for x in 후보:
    print('   %-24s %6.1f%% %7d  [%s]' % x)
