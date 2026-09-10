"""까몽 ⓑ 길 — 제미나이 판 열일곱을 «섞어 입히고 표정을 바꾼다» (2026-09-07 · 0원 · 유호 확정 「ⓑ로 가자」).

■ 무엇을 하나
  제미나이가 «본체 표정으로만» 그린 옷 판(의상 · 악세 각 한 장)에서
    ① 악세 판의 «악세 + 둘레 털»을 의상 판 위에 얹는다      → 옷·악세를 아무렇게나 섞어 입힌다 (0원)
    ② 정본 표정 컷의 «눈 자리»만 갈아 끼운다               → 몸이 같은 표정 열하나 (0원)
  둘 다 이음새가 «털 속»에 떨어진다. 화면 크기(400px)에서는 자연스럽고, 4K 로 크게 보면 눈 둘레에 결 차이가 보인다
  (유호 확정 09-07 「받아들인다」 · 시험 = docs/Loom_자산/옷/편집시험/시험_눈갈이_악세얹기_*.jpg).

■ 순서가 급소다
  의상 판 → 눈 갈아 끼우기 → 악세 얹기. 악세 판에는 본체 눈이 그려져 있어, 악세를 먼저 얹으면 그 둘레 털에 딸려 온 본체 눈이
  바꾼 눈을 덮는다. 그래서 악세 마스크에서 «눈 안쪽»(악세 조각이 덮지 않은 눈 자리)을 뺀다 — 안경은 알이 뚫려 있어 눈이 비친다.

■ 악세 둘레 털은 «옷 위»에는 안 얹힌다 (09-07 실측 · 델 깃이 머리 뒤에서 유령처럼 겹쳤다)
  의상 조각 자리(옷차이떼기가 뗀 알파)는 뺀다. 악세 자체는 언제나 위.

■ 몸이 다른 표정 넷(뾰로통·우34·좌34·응원)은 안 만든다 — 옷 입은 채로는 안 쓴다(결정 원장 09-07).

쓰는 법:
  python tools/옷판합치기.py --떼기                                  # 두그림/ 의 판 전부 → 두그림층/ (옮긴 판 · 옷 조각 · 배경 알파)
  python tools/옷판합치기.py --옷 "겨울델" --악세 "몽골모자" --표정 윙크 --낼곳 <파일.png>
  python tools/옷판합치기.py --판 <낼곳.webp> [--표정 "윙크,눈감음"]    # 열일곱 벌 · 섞어 입기 · 표정 판(유호님이 보실 것)
"""
import argparse
import importlib.util
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

루트 = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(루트 / 'tools'))
from 옷자리맞추기 import 눈들  # noqa: E402
from mascot_originals import ensure_files, ensure_folder  # noqa: E402

_spec = importlib.util.spec_from_file_location('옷차이떼기', 루트 / 'tools/옷차이떼기.py')
C = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(C)

판방 = 루트 / 'docs/Loom_자산/옷/두그림'
층방 = 루트 / 'docs/Loom_자산/옷/두그림층'
정본방 = 루트 / 'docs/캐릭터/정본_4K'
몸같은표정 = C.몸같은표정                       # 감동 궁금함 놀람 눈감음 눈웃음 민망 안도 윙크 으쓱 졸림 집중

# 갈래 — 옷목록.js 와 같다(까몽 목록 · 09-07). 성과 옷 일곱은 셋 다 갖는다(유호 확정 09-05).
의상들 = ['겨울델', '담요망토', 'SYNK후드', '조끼', '여름델', '1급배지코트', '2급배지코트', '3개월출석잎망토']
악세들 = ['전설의팻말', '반짝이목걸이', '안경', '몽골모자', '목도리', '3급왕관', '한달출석새싹', '6개월출석화관', '첫목소리목도리']


# ── 재료 ─────────────────────────────────────────────────────────────────

class 정본:
    def __init__(self, 마스코트='까몽', 판=4096):
        """판 = 작업 크기. 4096 이 실물 · 판(유호님이 보실 것)은 1024 로 줄여서 만든다(칸이 300px 이라 충분하고 16배 빠르다)."""
        self.마스코트 = 마스코트
        self.판 = 판
        self.몸 = Image.open(정본방 / f'{마스코트}_본체.png').convert('RGBA')
        if self.몸.width != 판:
            self.몸 = self.몸.resize((판, 판), Image.LANCZOS)
        self.배율 = 판 / 4096
        self.몸알파 = np.asarray(self.몸)[..., 3] > 128
        몸rgb = np.asarray(self.몸.convert('RGB')).astype(np.int16)
        self.눈 = 눈들(self.몸, '초록')
        if self.눈 is None:
            raise SystemExit('🔴 정본에서 눈을 못 찾았다')
        self.눈반 = [C.눈반지름(몸rgb, e, 최대=int(320 * self.배율)) for e in self.눈]
        self.h, self.w = self.몸알파.shape

    def 눈자리(self, 배=1.12):
        yy, xx = np.ogrid[:self.h, :self.w]
        m = np.zeros((self.h, self.w), bool)
        for (ex, ey), r in zip(self.눈, self.눈반):
            m |= ((xx - ex) ** 2 + (yy - ey) ** 2) <= (r * 배) ** 2
        return m

    def 표정판(self, 표정, 바탕):
        im = Image.open(정본방 / f'{self.마스코트}_{표정}.png').convert('RGBA')
        if im.width != self.판:
            im = im.resize((self.판, self.판), Image.LANCZOS)
        판 = Image.new('RGBA', im.size, 바탕 + (255,))
        판.alpha_composite(im)
        return np.asarray(판.convert('RGB')).astype(np.float32)


def 부드럽게(m, 흐림):
    im = Image.fromarray((m * 255).astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(흐림))
    return np.asarray(im, dtype=np.float32)[..., None] / 255.0


def 섞기(밑, 위, m):
    return np.clip(밑 * (1 - m) + 위 * m, 0, 255)


def 배경색(rgb):
    a = rgb.astype(np.int16)
    귀 = np.concatenate([a[:60, :60].reshape(-1, 3), a[:60, -60:].reshape(-1, 3), a[-60:, :60].reshape(-1, 3), a[-60:, -60:].reshape(-1, 3)])
    return tuple(int(v) for v in np.median(귀, axis=0))


def 이름(s):
    return s.replace(' ', '')


class 옷판:
    """정본 좌표로 옮긴 판 하나 = 옮긴 RGB · 옷 조각 알파 · 배경 알파(몸+옷)."""

    def __init__(self, 마스코트, 옷, 판=4096):
        self.옷 = 이름(옷)
        self.옮긴경로 = 층방 / f'옮긴_{마스코트}_{self.옷}.png'
        self.조각경로 = 층방 / f'옷_{마스코트}_{self.옷}.png'
        ensure_files([self.옮긴경로, self.조각경로])
        for p in (self.옮긴경로, self.조각경로):
            if not p.exists():
                raise SystemExit(f'🔴 없다: {p} — 먼저 python tools/옷판합치기.py --떼기')
        옮긴 = Image.open(self.옮긴경로).convert('RGB')
        조각 = Image.open(self.조각경로).convert('RGBA')
        if 옮긴.width != 판:
            옮긴 = 옮긴.resize((판, 판), Image.LANCZOS)
            조각 = 조각.resize((판, 판), Image.LANCZOS)
        self.rgb = np.asarray(옮긴).astype(np.float32)
        self.조각 = np.asarray(조각)[..., 3] > 128
        self.바탕 = 배경색(self.rgb)
        배경, _ = C.배경찾기(self.rgb.astype(np.int16))
        self.앞 = ~배경


# ── 떼기 — 판 전부를 정본 좌표로 ─────────────────────────────────────────

def 떼기(마스코트='까몽', 강제=False):
    층방.mkdir(parents=True, exist_ok=True)
    ensure_folder(
        판방,
        lambda name: name.startswith(f'{마스코트}_') and name.endswith('.png'),
    )
    ensure_folder(
        층방,
        lambda name: (name.startswith(f'옮긴_{마스코트}_')
                      or name.startswith(f'옷_{마스코트}_')) and name.endswith('.png'),
    )
    판들 = sorted(판방.glob(f'{마스코트}_*.png'))
    if not 판들:
        raise SystemExit(f'🔴 판이 없다 — {판방}')
    for p in 판들:
        옷 = p.stem.split('_', 1)[1]
        옮긴 = 층방 / f'옮긴_{마스코트}_{옷}.png'
        조각 = 층방 / f'옷_{마스코트}_{옷}.png'
        if not 강제 and 옮긴.exists() and 조각.exists() and 옮긴.stat().st_mtime > p.stat().st_mtime:
            print(f'⏭ {옷} — 이미 뗐다')
            continue
        참조 = 루트 / 'docs/Loom_자산/옷/층' / f'옷_{마스코트}_{옷}.png'
        ensure_files([참조])
        참조들 = [str(참조)] if 참조.exists() else None
        층, 옮긴판, _, 잰것 = C.떼어낸다(str(p), str(정본방 / f'{마스코트}_본체.png'), 참조경로들=참조들)
        층.save(조각)
        옮긴판.save(옮긴)
        print(f'✅ {옷} — 몸 {잰것["몸 크기"]} · 확신 {잰것["확신"]} · {잰것["참조의 흰 천 몫"]}')


# ── 합치기 ───────────────────────────────────────────────────────────────

def 합친다(정, 옷: 옷판 | None, 악세: 옷판 | None, 표정='본체', 여유=90, 흐림=35):
    """의상 판(없으면 정본 몸) → 눈 갈아 끼우기 → 악세 얹기. RGBA(정본 좌표)를 낸다. 칸 값은 4096 기준이라 판 크기에 맞춰 줄인다."""
    b = 정.배율
    여유, 흐림 = max(2, 여유 * b), max(1, 흐림 * b)
    if 옷 is not None:
        밑 = 옷.rgb.copy()
        바탕 = 옷.바탕
        앞 = 옷.앞.copy()
        옷조각 = 옷.조각
    else:
        바탕 = (255, 255, 255)
        밑 = 정.표정판('본체', 바탕)
        앞 = 정.몸알파.copy()
        옷조각 = np.zeros_like(앞)

    # ② 눈 갈아 끼우기 — 몸이 같은 표정만
    if 표정 != '본체':
        if 표정 not in 몸같은표정:
            raise SystemExit(f'🔴 {표정} 은 몸이 다른 표정이라 옷 입은 채로는 안 만든다(결정 원장 09-07)')
        위 = 정.표정판(표정, 바탕)
        m = 부드럽게(정.눈자리(1.12), max(1, 18 * b))
        밑 = 섞기(밑, 위, m)

    # ① 악세 얹기 — 악세 + 둘레 털 · 옷 조각 위는 뺀다 · 눈 안쪽(악세가 안 덮은 눈)은 뺀다
    if 악세 is not None:
        근 = lambda 마스크, 칸: C.근처(마스크, max(1, 칸 * b), 판=min(2048, 정.판))
        알파 = 악세.조각
        표, 수 = ndimage.label(알파, structure=np.ones((3, 3), bool))
        if 수 > 1:
            # 🔴 «제일 큰 덩어리»가 악세가 아닐 때가 있다 (09-07 실측 · 한 달 출석 새싹) — 판의 몸이 정본보다 조금 커서
            #   몸 둘레에 밝은 털 «테»가 조각으로 남는데, 그 테가 작은 브로치보다 크다. 그래서 새싹이 통째로 빠졌다.
            #   🔑 테는 정본 실루엣 가장자리 띠(60칸) «안»에 거의 다 들어간다. 그런 덩어리는 빼고 큰 것을 고른다.
            크기 = ndimage.sum(알파, 표, range(1, 수 + 1))
            가장자리띠 = 근(정.몸알파 ^ ndimage.binary_erosion(정.몸알파, np.ones((3, 3), bool)), 60)   # 실루엣 경계 양쪽 60칸
            띠몫 = ndimage.sum(가장자리띠, 표, range(1, 수 + 1)) / np.maximum(크기, 1)
            # 🔴 «제일 큰 것 하나»도 틀린다 — 새싹은 흰 원반과 잎 둘이 «떨어진 조각»이라 잎이 빠졌다. 테가 아닌 것은 전부 악세다.
            후보 = [i for i in range(수) if 띠몫[i] < 0.85 and 크기[i] >= 크기.max() * 0.01]
            if not 후보:
                후보 = [int(np.argmax(크기))]
            알파 = np.isin(표, [i + 1 for i in 후보])
        m = 부드럽게(근(알파, 여유 / b), 흐림)
        옷만 = 옷조각 & ~근(알파, 12)
        m = m * (1 - 부드럽게(옷만, max(1, 12 * b)))
        눈안쪽 = 정.눈자리(1.0) & ~근(알파, 6)
        m = m * (1 - 부드럽게(눈안쪽, max(1, 10 * b)))
        m = np.maximum(m, 부드럽게(알파, max(1, 3 * b)))
        몸밖 = ~근(정.몸알파, 30)
        m[몸밖] = 0
        위 = 악세.rgb
        # 악세 판의 배경이 의상 판과 조금 다르다(회색 229 vs 흰 255) — 둘레 털이 배경과 닿는 자리는 밑의 바탕색으로 맞춘다
        if 악세.바탕 != 바탕:
            차 = np.array(바탕, np.float32) - np.array(악세.바탕, np.float32)
            배경쪽 = 부드럽게(~악세.앞, max(1, 20 * b))
            위 = np.clip(위 + 차 * 배경쪽, 0, 255)
        밑 = 섞기(밑, 위, m)
        앞 |= 알파

    알파판 = 부드럽게(앞, max(0.6, 1.2 * b))[..., 0]
    out = np.dstack([밑, 알파판 * 255.0]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


# ── 판 — 유호님이 보실 것 ─────────────────────────────────────────────────

def 판만들기(정, 마스코트, 낼곳, 표정들, 칸높=300):
    spec = importlib.util.spec_from_file_location('옷입혀보기', 루트 / 'tools/옷입혀보기.py')
    M = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(M)
    ensure_folder(
        층방,
        lambda name: (name.startswith(f'옮긴_{마스코트}_')
                      or name.startswith(f'옷_{마스코트}_')) and name.endswith('.png'),
    )
    있는 = {p.stem.split('_', 2)[2] for p in 층방.glob(f'옮긴_{마스코트}_*.png')}   # 옮긴_까몽_겨울델 → 겨울델
    의상 = [o for o in 의상들 if o in 있는]
    악세 = [a for a in 악세들 if a in 있는]
    없는 = [o for o in 의상들 + 악세들 if o not in 있는]
    if 없는:
        print(f'⚠ 아직 판이 없는 것 {len(없는)}: {", ".join(없는)} — 빠진 채로 판을 낸다(빠졌다고 적는다)')
    판들 = {n: 옷판(마스코트, n, 정.판) for n in 의상 + 악세}
    칸 = []
    # 줄 1 — 의상 한 벌씩(제미나이 판 그대로)
    for o in 의상:
        칸.append((f'의상 · {o}', M.흰바탕(합친다(정, 판들[o], None))))
    # 줄 2 — 악세 한 개씩(정본 몸 위에)
    for a in 악세:
        칸.append((f'악세 · {a}', M.흰바탕(합친다(정, None, 판들[a]))))
    # 줄 3~ — 섞어 입기: 의상마다 악세 둘 · 표정
    for i, o in enumerate(의상):
        짝 = [악세[(i * 2) % len(악세)], 악세[(i * 2 + 1) % len(악세)]] if 악세 else []
        for a in 짝:
            칸.append((f'{o} + {a}', M.흰바탕(합친다(정, 판들[o], 판들[a]))))
            for e in 표정들:
                칸.append((f'{o} + {a} · {e}', M.흰바탕(합친다(정, 판들[o], 판들[a], e))))
    칸 = [(라벨, M.잘라(im.convert('RGBA')) if im.mode == 'RGBA' else im) for 라벨, im in 칸]
    판 = M.판만들기(칸, 칸높=칸높, 줄당=max(len(의상), len(악세), 2 + 2 * len(표정들)))
    판.save(낼곳, quality=88, method=6)
    print(f'✅ {낼곳} — {len(칸)}칸 · {판.width}×{판.height} · 의상 {len(의상)} · 악세 {len(악세)}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--마스코트', default='까몽')
    ap.add_argument('--떼기', action='store_true')
    ap.add_argument('--강제', action='store_true')
    ap.add_argument('--옷')
    ap.add_argument('--악세')
    ap.add_argument('--표정', default='본체')
    ap.add_argument('--낼곳')
    ap.add_argument('--판', dest='판낼곳')
    ap.add_argument('--칸높', type=int, default=300)
    ap.add_argument('--판크기', type=int, help='작업 크기. 한 장은 4096 · 판은 1024 가 기본')
    a = ap.parse_args()
    if a.떼기:
        떼기(a.마스코트, a.강제)
        return
    판크기 = a.판크기 or (1024 if a.판낼곳 else 4096)
    정 = 정본(a.마스코트, 판크기)
    if a.판낼곳:
        표정들 = [s.strip() for s in (a.표정 if a.표정 != '본체' else '윙크,눈감음').split(',') if s.strip()]
        판만들기(정, a.마스코트, a.판낼곳, 표정들, a.칸높)
        return
    if not a.낼곳:
        raise SystemExit('🔴 --낼곳 이 있어야 한다')
    옷 = 옷판(a.마스코트, a.옷, 판크기) if a.옷 else None
    악세 = 옷판(a.마스코트, a.악세, 판크기) if a.악세 else None
    out = 합친다(정, 옷, 악세, a.표정)
    out.save(a.낼곳)
    print(f'✅ {a.낼곳}')


if __name__ == '__main__':
    main()
