"""마스코트 컷을 «화면에 쓸 크기»로 줄인다 (2026-09-07 · 0원).

■ 왜 있나
  정본 컷은 4096² PNG 라 한 장이 11~16MB 다. 그런데 브라우저가 그림을 «펼쳐 놓는» 크기는
  파일 크기가 아니라 픽셀 수로 정해진다 — 4096×4096×4바이트 = **한 장에 67MB**.
  라디오 송출 층이 지금 싣는 13장만으로 이미 871MB 이고, 표정을 넷씩 더하면 1.6GB 가 된다.
  서버 램이 3.9GB 라 그대로 두면 층이 통째로 죽는다(그러면 방송 화면이 빈다).
  화면에 서는 마스코트는 길어야 400px 이라 1024 면 넉넉하다 — 한 장 4MB 로 16분의 1이 된다.

■ 어디에 내나
  `docs/캐릭터/화면_1024/<이름>.webp` — 옷 조각(`docs/Loom_자산/옷층/`)과 같은 규약이다.

■ 지키는 것
  네모를 «안 자른다». 몸과 옷이 같은 네모 안 같은 자리에 있어야 겹쳐 입힐 수 있고,
  액자 보정(마스코트.html `액자재기`)이 «몫»으로 재기 때문에 줄여도 자리가 안 흔들린다.
  표정 컷은 «본체와 같은 자리»에 서야 한다 — 옷 조각이 본체 자리에 얹히기 때문이다(아래 ①②③).

쓰는 법: python tools/마스코트층작게.py [--크기 1024]
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

루트 = Path(__file__).resolve().parent.parent
든곳 = 루트 / 'docs/캐릭터/정본_4K'
낼곳 = 루트 / 'docs/캐릭터/화면_1024'



# ── 🆕 2026-09-08 머리 정렬 ────────────────────────────────────────────────────
# 🔴 유호 지적 09-08 「마린이 눈 깜빡일때 좀 옷이 흐려지거나 변하거든」 — 실측해 보니 깜빡임(눈감음)은
#    멀쩡했고, **표정 살이 컷 셋(궁금함·안도·응원)이 다른 판**이었다. 마린 기준 폭이 4.2% 크고
#    좌우로 8.5칸, 위아래로 45~73칸 밀려 있다. 까몽은 응원 하나가 22% 크고 73칸 밀렸다.
#    옷 조각은 늘 «같은 자리·같은 크기»로 얹히므로, 몸만 커지면 옷이 덜 나와 «변한 것»처럼 보인다.
# 🔑 정본 컷을 안 건드린다. 화면용으로 줄이는 이 자리에서 «머리»를 맞춘다 —
#    기준은 그 마스코트의 «본체» 컷이고, 자는 **헬멧(머리)의 가장 넓은 가로줄**이다.
#    그 줄은 컷마다 흔들리지 않는다(알파 네모 전체는 팔·발 자세에 흔들려 자로 못 쓴다 · 09-08 실측).
# ⚠ 배율은 ±8% 로 묶는다. 그보다 크게 어긋나면 그건 «크기 문제»가 아니라 다른 그림이라,
#    조용히 늘렸다가는 더 이상해진다 — 그때는 건드리지 않고 경고만 낸다.
def 머리자(im):
    """머리의 «가장 넓은 가로줄»을 찾아 그 폭·자리를 낸다. 못 재면 None."""
    a = np.array(im)[:, :, 3] > 16
    ys, xs = np.where(a)
    if not len(ys):
        return None
    위, 아래 = int(ys.min()), int(ys.max())
    반 = 위 + int((아래 - 위) * 0.55)          # 위쪽 55% 안 = 머리
    폭들 = a[:반].sum(axis=1)
    if not 폭들.max():
        return None
    y = int(np.argmax(폭들))
    행 = np.where(a[y])[0]
    return {'y': y, '폭': int(폭들[y]), 'cx': float((행.min() + 행.max()) / 2)}


def 머리맞추기(im, 기준, 이름):
    """기준(본체)의 머리와 같은 폭·자리가 되게 크기·자리를 고친다. 캔버스는 그대로."""
    내 = 머리자(im)
    if not 기준 or not 내 or not 내['폭']:
        return im, None
    배 = 기준['폭'] / 내['폭']
    if not (0.92 <= 배 <= 1.08):
        print(f'   ⚠ {이름} — 머리 폭이 {배:.3f} 배나 달라 손대지 않는다(다른 그림일 수 있다)')
        return im, None
    w, h = im.size
    큰 = im.resize((max(1, round(w * 배)), max(1, round(h * 배))), Image.LANCZOS)
    # 크기를 바꾸면 머리 자리도 그만큼 옮겨진다 — 그 뒤에 기준과의 차이만큼 민다.
    dx = round(기준['cx'] - 내['cx'] * 배)
    dy = round(기준['y'] - 내['y'] * 배)
    판 = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    판.alpha_composite(큰, (dx, dy)) if (dx >= 0 and dy >= 0) else 판.paste(큰, (dx, dy))
    return 판, {'배': round(배, 4), 'dx': dx, 'dy': dy}


# ── 🆕 2026-09-08 ② 몸을 겹쳐 «남은 어긋남»을 잰다 ────────────────────────────────
# 🔴 유호 지적 09-08 「눈 깜빡거릴때 헤드셋은 고정되어있거든? 캐릭터는 미세하게 움직이는데 헤드셋이 안따라오네」
#    위 ① 머리 «가장 넓은 줄» 자는 폭은 맞추지만 위아래 자리를 몇 칸씩 남긴다 — 마린 눈감음이 아래로 5칸,
#    눈웃음이 위로 11칸, 놀람이 위로 26칸(09-08 실측 · 1024 기준). 옷 조각은 늘 같은 자리에 얹히므로
#    컷이 5칸 내려가면 몸만 내려가고 헤드폰은 남는다 = 「헤드셋이 안 따라온다」.
# 🔑 자 = 몸의 «윤곽선»(알파 테두리)을 두 그림에서 겹쳐 «가장 잘 포개지는 이동»을 찾는다(상호상관).
#    윤곽선은 눈·표정과 무관하고 어느 마스코트(코랄·검정·남색)에서나 같은 자다. 팔·발이 있는 아래쪽은 뺀다.
#    (처음 판은 «어두운 칸»을 자로 썼는데, 코랄인 몽글은 어두운 칸이 눈뿐이라 눈이 바뀌는 컷에서 자가 흔들렸다.)
# 🔴 자세가 바뀌는 컷(자세컷)은 이 자를 대지 않는다 — 인사(고개 숙임)·좌34·우34(몸 돌림)는 «어긋남»이 곧 표정이다.
자세컷 = {'인사', '좌34', '우34'}


def 윤곽판(im, 위끝):
    a = (np.array(im)[:, :, 3] > 16).astype(float)
    a[위끝:] = 0.0
    gx = ndimage.sobel(a, axis=1)
    gy = ndimage.sobel(a, axis=0)
    return np.hypot(gx, gy)


def 남은어긋남(im, 본체):
    """본체와 겹쳐 봤을 때 이 컷이 (dx, dy)만큼 밀려 있다. 그만큼 되밀면 포개진다."""
    위끝 = int(im.height * 0.68)
    fa, fb = 윤곽판(im, 위끝), 윤곽판(본체, 위끝)
    if fa.sum() < 100 or fb.sum() < 100:
        return 0, 0
    c = np.real(np.fft.ifft2(np.fft.fft2(fa) * np.conj(np.fft.fft2(fb))))
    p = np.unravel_index(int(np.argmax(c)), c.shape)
    dy = p[0] if p[0] < c.shape[0] // 2 else p[0] - c.shape[0]
    dx = p[1] if p[1] < c.shape[1] // 2 else p[1] - c.shape[1]
    return int(dx), int(dy)


def 옮기기(im, dx, dy):
    if not dx and not dy:
        return im
    판 = Image.new('RGBA', im.size, (0, 0, 0, 0))
    판.paste(im, (dx, dy))
    return 판


# ── 🆕 2026-09-08 ③ «눈만 갈아 끼우기» ─────────────────────────────────────────────
# 자리를 다 맞춰도 컷마다 따로 구운 펠트라 결(섬유)이 조금씩 다르다 — 컷을 통째로 바꾸면 몸 전체가 «떨린다».
# 표정이 눈에만 있는 컷은 **본체 몸 위에 눈 자리만** 그 컷에서 오려 얹는다.
# 그러면 몸은 바이트까지 본체와 같아 한 칸도 안 움직이고, 눈만 바뀐다 — 옷이 따라올 일 자체가 없어진다.
# 🔴 표에 적힌 컷만. 머리가 기울거나 팔이 드는 컷에 걸면 그 표정이 통째로 사라진다.
#    마린 궁금함은 머리가 기우는 컷이라 뺐다(그 컷은 헤드폰을 쓴 채로는 층이 안 든다 · 마스코트.html 기우는컷).
#    몽글·까몽은 아직 안 잤다 — 라디오에 마린만 서는 동안(유호 확정 09-07)은 대상 밖이다.
눈만컷 = {'마린': {'눈감음', '눈웃음', '집중', '안도', '응원', '놀람'}}


def 눈만얹기(컷, 본체):
    """본체 몸 + 컷의 눈 자리. 눈 자리 = 두 그림이 크게 다른 덩이(머리 위쪽 62% 안)를 부풀려 여린 가장자리로."""
    C = np.array(컷).astype(int)
    B = np.array(본체).astype(int)
    h = C.shape[0]
    둘다 = (C[:, :, 3] > 16) & (B[:, :, 3] > 16)
    diff = np.abs(C[:, :, :3] - B[:, :, :3]).sum(axis=2) * 둘다
    다름 = diff > 120
    다름[int(h * 0.62):] = False                     # 가슴 꽃·바구니의 결 차이는 본체가 이긴다
    다름 = ndimage.binary_opening(다름, iterations=1)  # 결(섬유) 차이의 점은 지우고 눈 덩이는 남긴다
    lab, n = ndimage.label(다름)
    if not n:
        return None, 0
    크기 = ndimage.sum(다름, lab, range(1, n + 1))
    # 150칸 = 응원 컷의 눈 반짝이(약 25×20) 가 깎인 뒤에도 남는 크기 · 결 차이의 점은 50칸을 안 넘는다(09-08 실측)
    큰 = np.isin(lab, [i + 1 for i, s in enumerate(크기) if s >= 150])
    if not 큰.any():
        return None, 0
    자리 = ndimage.binary_dilation(큰, iterations=14).astype(float)
    자리 = ndimage.gaussian_filter(자리, 6)
    자리 = np.clip((자리 - 0.05) / 0.9, 0, 1)
    w = 자리[..., None]
    out = B.astype(float)
    out[:, :, :3] = B[:, :, :3] * (1 - w) + C[:, :, :3] * w
    out[:, :, 3] = B[:, :, 3] * (1 - 자리) + C[:, :, 3] * 자리   # 눈이 헬멧 밖으로 커진 컷(놀람)도 따라간다
    return Image.fromarray(np.clip(np.round(out), 0, 255).astype(np.uint8), 'RGBA'), int(큰.sum())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--크기', type=int, default=1024)
    a = ap.parse_args()
    낼곳.mkdir(parents=True, exist_ok=True)
    했다 = 0
    든바이트 = 0
    난바이트 = 0
    판 = {}
    # 🆕 09-08 — «본체» 컷을 먼저 줄여 그 머리를 기준으로 삼고, 나머지를 거기에 맞춘다.
    #   그래서 마스코트별로 본체가 앞에 오도록 정렬한다(파일 이름의 `_본체` 를 앞으로).
    것들 = sorted(든곳.glob('*.png'), key=lambda q: (q.stem.split('_')[0], 0 if q.stem.endswith('_본체') else 1, q.stem))
    기준들 = {}
    본체들 = {}
    맞춘수 = 0
    되민수 = 0
    눈만수 = 0
    for p in 것들:
        im = Image.open(p).convert('RGBA')
        if im.width != im.height:
            print(f'⚠ {p.name} — 네모가 아니다 ({im.size}) · 그래도 같은 비율로 줄인다')
        작은 = im.resize((a.크기, round(a.크기 * im.height / im.width)), Image.LANCZOS)
        누구 = p.stem.split('_')[0]
        컷이름 = p.stem[len(누구) + 1:]
        고침 = None
        되밈 = None
        눈만 = None
        if p.stem.endswith('_본체'):
            기준들[누구] = 머리자(작은)          # 이 마스코트의 기준
            본체들[누구] = 작은
        elif 컷이름 in 자세컷:
            print(f'   · {p.stem} — 자세 컷이라 구운 대로 둔다(맞추면 표정이 사라진다)')
        elif 누구 in 기준들:
            작은, 고침 = 머리맞추기(작은, 기준들[누구], p.stem)
            if 고침 and (abs(고침['dx']) > 1 or abs(고침['dy']) > 1 or abs(고침['배'] - 1) > 0.002):
                print(f"   ↳ {p.stem} 머리 맞춤 — 배 {고침['배']} · dx {고침['dx']:+d} · dy {고침['dy']:+d}")
                맞춘수 += 1
            # ② 남은 어긋남을 몸 겹침으로 재서 되민다(±40칸 안에서만 — 그보다 크면 다른 자세다)
            dx, dy = 남은어긋남(작은, 본체들[누구])
            if (dx or dy) and abs(dx) <= 40 and abs(dy) <= 40:
                작은 = 옮기기(작은, -dx, -dy)
                되밈 = {'dx': -dx, 'dy': -dy}
                되민수 += 1
                print(f'   ↳ {p.stem} 몸 겹침 — {-dx:+d}, {-dy:+d} 칸 되밀었다')
            elif dx or dy:
                print(f'   ⚠ {p.stem} — 몸이 {dx:+d}, {dy:+d} 칸이나 달라 되밀지 않는다(다른 자세)')
            # ③ 눈만 갈아 끼우기 — 표에 적힌 컷만
            if 컷이름 in 눈만컷.get(누구, ()):
                얹은, 칸 = 눈만얹기(작은, 본체들[누구])
                if 얹은 is not None:
                    작은 = 얹은
                    눈만 = 칸
                    눈만수 += 1
                    print(f'   ↳ {p.stem} 눈만 얹었다 — 눈 자리 {칸:,}칸 · 몸은 본체 그대로')
                else:
                    print(f'   ⚠ {p.stem} — 본체와 다른 자리를 못 찾아 컷 그대로 둔다')
        낼것 = 낼곳 / (p.stem + '.webp')
        작은.save(낼것, 'WEBP', quality=92, method=6)
        든바이트 += p.stat().st_size
        난바이트 += 낼것.stat().st_size
        판[p.stem] = {'원본': p.name, '크기': a.크기, '머리맞춤': 고침, '몸겹침되밈': 되밈, '눈만얹음_칸': 눈만}
        했다 += 1
    (낼곳 / '판.json').write_text(json.dumps({
        '언제': datetime.now(timezone.utc).isoformat(),
        '크기': a.크기,
        '몇벌': 했다,
        '컷': 판,
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'   머리를 맞춘 컷 {맞춘수}벌 (기준 = 마스코트별 «본체» 컷의 머리 가장 넓은 줄)')
    print(f'   몸 겹침으로 되민 컷 {되민수}벌 · 눈만 얹은 컷 {눈만수}벌 (표 = 눈만컷)')
    print(f'✅ {했다}벌 · {든바이트/1048576:.0f}MB → {난바이트/1048576:.0f}MB → {낼곳}')
    print(f'   브라우저가 펼쳐 놓는 몫: 한 장 {4096*4096*4/1048576:.0f}MB → {a.크기*a.크기*4/1048576:.0f}MB')


if __name__ == '__main__':
    main()
