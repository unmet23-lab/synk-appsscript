# -*- coding: utf-8 -*-
"""
굽기대조 — **옛 판(git 커밋) 대 지금 판**을 나란히 세우고, 눈이 아니라 «재서» 가른다.

■ 왜 있나 (08-24)
  다시 굽고 나서 「나아졌나」를 물을 자리가 없었다. 08-23 에 나는 배율 세 판을 눈으로 보고
  「거의 같다」고 유호님께 보고했다가 픽셀로 재니 분명히 움직이고 있어 철회했다.
  ⇒ 재굽기의 판정은 **나란히 놓은 그림 + 숫자** 둘 다 있어야 한다. 그림만으로는 못 가르고,
    숫자만으로는 무엇이 이상해졌는지 못 본다.

■ 되는 조건
  옛 판이 git 에 있어야 한다. (08-24 재굽기는 옆 세션이 «직전»에 156장을 커밋해 둔 덕에 가능했다 —
  그 습관이 없으면 덮어쓰는 순간 비교 대상이 사라진다.)

쓰기:
  python tools/굽기대조.py --옛 4a4d2472
  python tools/굽기대조.py --옛 4a4d2472 --세트 음식,초밥 --폭 300
  python tools/굽기대조.py --옛 4a4d2472 --방 docs/캐릭터/요소공방_0822 --낼곳 docs/캐릭터/요소공방_0822
"""
import io
import os
import subprocess
import sys
import tempfile
import colorsys

sys.stdout.reconfigure(encoding='utf-8')
try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print('PIL 이 없다 — pip install pillow'); raise SystemExit(2)


def 글꼴(크기, 굵게=False):
    """⚠PIL 기본 글꼴엔 한글 글리프가 없다 — 라벨이 통째로 두부(□)가 된다(08-24 1판 실측).
       읽으라고 만든 지면의 라벨이 안 읽히면 지면이 아니다. 덧씌움 열넷과 같은 글꼴을 쓴다."""
    for 길 in ([r'C:\Windows\Fonts\malgunbd.ttf'] if 굵게 else []) + [
            r'C:\Windows\Fonts\malgun.ttf', r'C:\Windows\Fonts\gulim.ttc']:
        try:
            return ImageFont.truetype(길, 크기)
        except OSError:
            continue
    return ImageFont.load_default()

여기 = os.path.dirname(os.path.abspath(__file__))
루트 = os.path.dirname(여기)


def 인자읽기():
    a = {}
    i = 1
    while i < len(sys.argv):
        t = sys.argv[i]
        if t.startswith('--'):
            k = t[2:]
            if i + 1 < len(sys.argv) and not sys.argv[i + 1].startswith('--'):
                a[k] = sys.argv[i + 1]; i += 1
            else:
                a[k] = True
        i += 1
    return a


인자 = 인자읽기()
옛 = 인자.get('옛')
if not 옛:
    print('🔴 --옛 <커밋> 이 필요하다 (옛 판이 git 에 있어야 대조가 선다)'); raise SystemExit(2)
방 = 인자.get('방', 'docs/캐릭터/요소공방_0822').replace('\\', '/')
낼곳 = 인자.get('낼곳', 방).replace('\\', '/')
폭 = int(인자.get('폭', '260'))
고른세트 = [s.strip() for s in 인자.get('세트', '').split(',') if s.strip()] if 인자.get('세트') else None


def 잰다(im):
    """채도·밝기·대비 — 무대(검정)는 빼고 «몸»만 잰다. 무대가 통계를 먹으면 아무것도 안 보인다."""
    s = im.convert('RGB')
    s = s.resize((max(1, s.width // 5), max(1, s.height // 5)))
    몸 = [(r, g, b) for (r, g, b) in s.getdata() if r + g + b > 45]
    if not 몸:
        return None
    ch = 0.0
    밝 = []
    for (r, g, b) in 몸:
        ch += colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)[1]
        밝.append(0.2126 * r + 0.7152 * g + 0.0722 * b)
    m = sum(밝) / len(밝)
    대비 = (sum((x - m) ** 2 for x in 밝) / len(밝)) ** 0.5
    return {'채도': ch / len(몸), '밝기': m, '대비': 대비}


def 옛판(rel):
    """git 에서 옛 판을 꺼내 임시 파일로 놓는다 — 없으면 None(그 장은 «새로 생긴 것»이다)."""
    p = subprocess.run(['git', '-C', 루트, 'show', '%s:%s' % (옛, rel)], capture_output=True)
    if p.returncode != 0 or not p.stdout:
        return None
    fd, 길 = tempfile.mkstemp(suffix='.png')
    os.close(fd)
    with open(길, 'wb') as f:
        f.write(p.stdout)
    return 길


뿌리 = os.path.join(루트, *방.split('/'))
세트들 = sorted([d for d in os.listdir(뿌리) if os.path.isdir(os.path.join(뿌리, d))])
if 고른세트:
    세트들 = [s for s in 세트들 if s in 고른세트]
# 🔑 «납작한 방»도 받는다 — 오브공방·퍼프로브·글자공방은 하위 세트 없이 PNG 가 바로 있다.
#   08-24 에 이 도구로 그 52장을 대조하려다 「세트가 없다」로 막혔다. 이 도구가 요소공방(하위 폴더식)에만
#   맞춰져 있었던 것이지, 그 방들이 대조할 값이 없어서가 아니다. 세트 이름 '' = 「방 자체가 한 세트」.
if not 세트들 and any(f.lower().endswith('.png') for f in os.listdir(뿌리)):
    세트들 = ['']
if not 세트들:
    print('🔴 대조할 세트가 없다:', 뿌리); raise SystemExit(1)

print('■ 굽기 대조 — 옛 %s vs 지금 · 세트 %d개' % (옛, len(세트들)))
표 = []
난것 = []

for 세트 in 세트들:
    방길 = os.path.join(뿌리, 세트)
    # ⚠자기 산출은 뺀다 — 납작한 방은 대조판이 «같은 폴더»에 떨어져, 안 빼면 다음 실행이
    #   자기가 만든 대조판을 한 줄로 또 싣는다(하위 폴더식에서는 원리상 안 생기던 일이다).
    장들 = sorted([f for f in os.listdir(방길)
                  if f.lower().endswith('.png') and not f.startswith('_대조_')])
    쌍 = []
    for fn in 장들:
        rel = '/'.join(x for x in (방, 세트, fn) if x)
        새길 = os.path.join(방길, fn)
        옛길 = 옛판(rel)
        try:
            새im = Image.open(새길)
            새값 = 잰다(새im)
        except Exception as 왜:
            print('  🔴 못 읽음:', rel, 왜); continue
        옛im = 옛값 = None
        if 옛길:
            try:
                옛im = Image.open(옛길)
                옛값 = 잰다(옛im)
            except Exception:
                옛im = 옛값 = None
        쌍.append((fn, 옛im, 새im, 옛값, 새값, 옛길))
        if 옛값 and 새값:
            표.append(('/'.join(x for x in (세트, fn[:-4]) if x), 옛값, 새값))

    if not 쌍:
        continue

    # ── 대조 지면: 한 줄에 [옛 | 새] 한 쌍 ────────────────────────────────
    칸h = int(폭 * 1.0)
    머리, 여백, 이름칸 = 26, 10, 118
    W = 이름칸 + (폭 + 여백) * 2 + 여백
    H = 머리 + (칸h + 여백) * len(쌍) + 여백
    판 = Image.new('RGB', (W, H), (16, 16, 18))
    d = ImageDraw.Draw(판)
    큰 = 글꼴(15, 굵게=True)
    작 = 글꼴(13)
    d.text((이름칸, 6), '옛 (%s)' % 옛[:8], fill=(170, 170, 170), font=큰)
    d.text((이름칸 + 폭 + 여백, 6), '지금 (PBR 중립 · 노출 +0.25 · 256샘플)', fill=(245, 245, 245), font=큰)
    for i, (fn, 옛im, 새im, 옛값, 새값, 옛길) in enumerate(쌍):
        y = 머리 + i * (칸h + 여백)
        d.text((8, y + 칸h // 2 - 14), fn[:-4][:14], fill=(225, 225, 225), font=큰)
        for j, im in enumerate((옛im, 새im)):
            x = 이름칸 + j * (폭 + 여백)
            if im is None:
                d.text((x + 10, y + 칸h // 2 - 6), '(옛 판 없음)', fill=(120, 120, 120), font=작)
                continue
            t = im.convert('RGB').copy()
            t.thumbnail((폭, 칸h))
            판.paste(t, (x + (폭 - t.width) // 2, y + (칸h - t.height) // 2))
        if 옛값 and 새값:
            변 = (새값['채도'] / 옛값['채도'] - 1) * 100 if 옛값['채도'] else 0
            밝변 = (새값['밝기'] / 옛값['밝기'] - 1) * 100 if 옛값['밝기'] else 0
            d.text((8, y + 칸h // 2 + 4), '채도 %+.0f%%' % 변, fill=(232, 152, 122), font=작)
            d.text((8, y + 칸h // 2 + 20), '밝기 %+.0f%%' % 밝변, fill=(150, 150, 150), font=작)
        if 옛길:
            try:
                os.unlink(옛길)
            except OSError:
                pass
    이름표 = 세트 or os.path.basename(뿌리)   # 납작한 방은 방 이름이 곧 세트 이름이다
    저장 = os.path.join(루트, *낼곳.split('/'), '_대조_%s.png' % 이름표)
    판.save(저장)
    난것.append(저장)
    print('  %-12s %2d장 → %s' % (이름표, len(쌍), os.path.relpath(저장, 루트)))

# ── 숫자 — 눈으로 못 가르는 것을 여기가 가른다 ─────────────────────────────
if 표:
    print('\n■ 전체 평균 (몸만 · 무대 제외)')
    for 이름, 키 in (('채도', '채도'), ('밝기', '밝기'), ('대비', '대비')):
        a = sum(o[키] for _, o, _ in 표) / len(표)
        b = sum(n[키] for _, _, n in 표) / len(표)
        print('  %-4s %7.3f → %7.3f   %+6.1f%%' % (이름, a, b, (b / a - 1) * 100 if a else 0))
    변화 = sorted(표, key=lambda x: (x[2]['채도'] / x[1]['채도']) if x[1]['채도'] else 1)
    print('\n■ 채도가 «가장 덜» 오른 열 장 — 과보정 의심 자리부터 본다')
    for 이름, o, n in 변화[:10]:
        print('  %-24s 채도 %+6.1f%%  밝기 %+6.1f%%' % (
            이름, (n['채도'] / o['채도'] - 1) * 100 if o['채도'] else 0,
            (n['밝기'] / o['밝기'] - 1) * 100 if o['밝기'] else 0))
    print('\n■ 밝기가 «가장 많이» 내린 열 장 — 두 번 보정된 자리 후보')
    어두 = sorted(표, key=lambda x: (x[2]['밝기'] / x[1]['밝기']) if x[1]['밝기'] else 1)
    for 이름, o, n in 어두[:10]:
        print('  %-24s 밝기 %+6.1f%%  채도 %+6.1f%%' % (
            이름, (n['밝기'] / o['밝기'] - 1) * 100 if o['밝기'] else 0,
            (n['채도'] / o['채도'] - 1) * 100 if o['채도'] else 0))
print('\n■ 끝 — 지면 %d벌' % len(난것))
