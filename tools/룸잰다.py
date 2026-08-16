# Loom 대조판을 «눈»이 아니라 «자»로 읽는다.
#
# 왜 필요한가: 「비싸 보인다」는 취향이라 두 판을 나란히 놓고 봐도 판정이 안 선다.
#   그리고 렌더 대조에는 **맞는 얼굴로 틀린 값**이 산다 — 조용히 미적용된 판은
#   「차이 없음」이 아니라 「통과」로 보인다(F045 ①). 다른 픽셀이 0.0% 면 그건
#   「효과가 미미하다」가 아니라 **그 눈금이 안 걸렸다**는 뜻이다.
#
# 사용: python tools/룸잰다.py <A.png> <B.png> [라벨A] [라벨B]
import sys, os
import numpy as np
from PIL import Image

# 🔴 F065 자리 — Windows 콘솔 기본이 CP949 라 «—»·한글 기호에서 UnicodeEncodeError 로 죽는다.
#    실측 08-16: 이 두 줄이 없어 잰 값이 하나도 안 나왔다(측정 도구가 측정 전에 죽는 형태).
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


def 읽기(p):
    im = Image.open(p).convert("RGBA")
    return np.asarray(im).astype(np.float32) / 255.0


def 국소대비(rgb, a):
    """반사에 «세상»이 맺히면 국소 대비가 오른다 — 단색 얼룩은 평평하고, 구조는 결이 있다.
    라플라시안 절대값의 평균을 «몸 안에서만» 잰다(배경은 알파 0이라 빼야 한다)."""
    g = rgb.mean(axis=2)
    lap = np.abs(4 * g[1:-1, 1:-1] - g[:-2, 1:-1] - g[2:, 1:-1] - g[1:-1, :-2] - g[1:-1, 2:])
    몸 = a[1:-1, 1:-1] > 0.5
    return float(lap[몸].mean()) if 몸.any() else 0.0


def 밝은결(rgb, a, 문턱=0.62):
    """하이라이트가 «몇 조각»으로 나뉘어 있는가 — 얼룩 하나 vs 구조 여럿."""
    g = rgb.mean(axis=2)
    몸 = (a > 0.5) & (g > 문턱)
    return float(몸.mean() * 100.0)


A, B = sys.argv[1], sys.argv[2]
라A = sys.argv[3] if len(sys.argv) > 3 else os.path.basename(A)
라B = sys.argv[4] if len(sys.argv) > 4 else os.path.basename(B)
a, b = 읽기(A), 읽기(B)
if a.shape != b.shape:
    print("🔴 크기가 다르다 — 대조가 성립하지 않는다:", a.shape, b.shape); sys.exit(2)

ar, aa = a[:, :, :3], a[:, :, 3]
br, ba = b[:, :, :3], b[:, :, 3]
d = np.abs(ar - br).max(axis=2)
겹 = (aa > 0.5) & (ba > 0.5)

print("■ 대조 — %s  ↔  %s" % (라A,라B))
print("  다른 픽셀       %.2f%%  (문턱 = 2/255 · 0.00%% 면 그 눈금이 «안 걸렸다»는 뜻이다)"
      % ((d > 2 / 255).mean() * 100))
print("  평균 |Δ|        %.2f / 255   ·   최대 %.1f / 255" % (d.mean() * 255, d.max() * 255))
print("  ─ 알파(지면에 얹히는 자리) ─")
print("    덮인 픽셀     %5.1f%%  →  %5.1f%%   (Δ %+0.1f%%p)"
      % ((aa > 0.02).mean() * 100, (ba > 0.02).mean() * 100,
         ((ba > 0.02).mean() - (aa > 0.02).mean()) * 100))
print("    옅은 띠       %5.1f%%  →  %5.1f%%   (0<α<0.35 · 안개가 알파를 오염시키면 여기가 뛴다)"
      % (((aa > 0.02) & (aa < 0.35)).mean() * 100, ((ba > 0.02) & (ba < 0.35)).mean() * 100))
print("  ─ 반사 구조(«세상»이 맺혔나) ─")
ca, cb = 국소대비(ar, aa), 국소대비(br, ba)
print("    국소 대비     %.4f  →  %.4f   (%+.1f%%)" % (ca, cb, (cb / ca - 1) * 100 if ca else 0))
ha, hb = 밝은결(ar, aa), 밝은결(br, ba)
print("    하이라이트    %5.2f%% →  %5.2f%%  (몸 대비 밝은 자리의 넓이)" % (ha, hb))
if 겹.any():
    print("  ─ 겹치는 몸에서만 ─")
    print("    평균 |Δ|      %.2f / 255" % (np.abs(ar - br).max(axis=2)[겹].mean() * 255))
