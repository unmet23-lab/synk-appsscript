# 컷 좌우 미러 — «좌¾ = 우¾ 미러»가 정본 통로다 (실측 08-14, memory/mascot-felt-liveness).
#
# 왜: nano-banana 는 「VIEWER'S LEFT」라고 못박아도 두 벌 다 우향으로 굽는다(실측). 좌향을
#     따로 구우면 190원을 내고도 방향이 틀리고 색·질감 연속성도 진다 — 미러는 결정론·0원이다.
# ⚠ 대가(틀릴 때의 모습): 미러는 조명 방향도 뒤집는다(좌상 → 우상). 정지 컷 단독 검수에선
#     하이라이트가 반대로 보일 수 있다 — 라이브2 크로스페이드 전환 프레임에서는 실측상 안 읽혔다.
#     닫을 것: 없다 — 대안(네이티브 좌향 굽기)이 실측으로 기각된 자리라 이 통로가 유일하다.
#
# 사용법: python tools/컷미러.py <입력.png> <출력.png>
import sys
from PIL import Image

if len(sys.argv) != 3:
    sys.exit("사용법: python tools/컷미러.py <입력.png> <출력.png>")
입력, 출력 = sys.argv[1], sys.argv[2]
im = Image.open(입력)
im.transpose(Image.FLIP_LEFT_RIGHT).save(출력)
print(f"[컷미러] {입력} → {출력} (좌우 반전 · {im.size[0]}x{im.size[1]})")
