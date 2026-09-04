"""공방 굽기 뒤처리 — 갓 구운 PNG 를 «쓸 수 있는 자산»으로 만든다 (2026-09-05).

무엇을 하나 (규격에 따라 갈린다):
  부품·장면 — 흰 배경·그림자·구멍을 걷는다(`tools/흰배경걷기.py`).
  천        — 배경이 곧 그림이라 안 걷는다.
  둘 다 **원본 크기 그대로 AVIF** 로 담고, `docs/공방/계획.json` 의 `파일` 을 그 이름으로 옮긴다.

🔑 **왜 AVIF 인가 (09-05 실측 · 4K 배지 한 장)**
  원본 PNG 18.6MB → webp q90 1.1MB(PSNR 48.2dB) → **AVIF q70 0.7MB(48.1dB)**.
  같은 품질에 36% 작다. 원본 대비 **3.8%** 이고 눈으로는 구분되지 않는다.
  그래서 «4096px 을 그대로 두고» 담아도 102장이 71MB 다 — 크기를 줄일 이유가 없어졌다.
  ✅ 크롬이 AVIF 를 4096px 그대로 읽는 것을 실물로 확인했다(지면·인쇄 조판이 전부 크롬이다).
  ⚠ PowerPoint 처럼 AVIF 를 못 읽는 곳에 넣을 때만 그때 PNG 로 바꾼다.

왜 따로 있나: 굽는 일(돈·네트워크)과 다듬는 일(이 기계의 CPU)은 성격이 다르다.
  굽기가 끊겨도 이미 난 것은 이 도구로 언제든 마저 다듬을 수 있어야 한다.
  🔑 원본 PNG 는 «안 지운다» — 다른 임계로 다시 걷거나 더 큰 판이 필요할 때 쓴다.
     git 에는 webp 만 들어간다(`.gitignore` 의 `!docs/Loom_자산/구움/공방_*.webp`).

사용:
  python tools/공방뒤처리.py              # 계획의 「구웠다」 중 아직 png 인 것 전부
  python tools/공방뒤처리.py --묶음 "숫자"
  python tools/공방뒤처리.py --꼴 WEBP        # AVIF 를 못 읽는 곳에 쓸 때
  python tools/공방뒤처리.py --너비 1800      # 굳이 줄여야 할 때
"""
import argparse
import io
import json
import os
import subprocess
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit('Pillow 가 없다 — python -m pip install pillow')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
방 = os.path.join(ROOT, 'docs', 'Loom_자산', '구움')
계획경로 = os.path.join(ROOT, 'docs', '공방', '계획.json')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--묶음', help='이 묶음만 다듬는다')
    ap.add_argument('--너비', type=int, default=0,
                    help='담을 때 긴 변 최대(px). 0(기본) 이면 «원본 크기 그대로» — AVIF 라 줄일 이유가 없다')
    ap.add_argument('--꼴', default='AVIF', choices=['AVIF', 'WEBP'],
                    help='담는 꼴. 기본 AVIF(같은 품질에 webp 보다 36%% 작다 · 09-05 실측)')
    ap.add_argument('--품질', type=int, default=0,
                    help='0(기본) 이면 꼴에 맞춰 고른다 — AVIF 70 · WEBP 90')
    a = ap.parse_args()
    확장 = '.avif' if a.꼴 == 'AVIF' else '.webp'
    품질 = a.품질 or (70 if a.꼴 == 'AVIF' else 90)

    계획 = json.load(io.open(계획경로, encoding='utf-8'))
    할것 = []
    for 통로 in 계획.values():
        if not isinstance(통로, dict):
            continue
        for m in 통로.get('묶음', []):
            if a.묶음 and m['이름'] != a.묶음:
                continue
            for x in m.get('것들', []):
                if x.get('상태') == '구웠다' and str(x.get('파일', '')).endswith('.png'):
                    할것.append((m['이름'], x, x.get('규격') or '부품'))

    if not 할것:
        print('■ 다듬을 것이 없다(0장).')
        return

    print(f'■ 뒤처리 {len(할것)}장 · {a.꼴} q{품질} · 긴 변 '
          + (f'{a.너비}px' if a.너비 else '원본 그대로'))
    산것 = 실패 = 0
    for 묶, 것, 규격 in 할것:
        png = os.path.join(방, 것['파일'])
        if not os.path.exists(png):
            print(f'   ⚠ 원본이 없다 — {것["파일"]}')
            실패 += 1
            continue
        담을것 = png[:-4] + 확장
        try:
            if 규격 == '천':
                im = Image.open(png).convert('RGB')
            else:
                누끼 = png[:-4] + '_누끼.png'
                subprocess.run([sys.executable, os.path.join(ROOT, 'tools', '흰배경걷기.py'),
                                png, '--출력', 누끼, '--흰바닥', '0'],
                               capture_output=True, text=True, encoding='utf-8', errors='replace')
                if not os.path.exists(누끼):
                    print(f'   🔴 배경을 못 걷었다 — {것["이름"]}')
                    실패 += 1
                    continue
                im = Image.open(누끼).convert('RGBA')
                os.remove(누끼)
            if a.너비:
                im.thumbnail((a.너비, a.너비), Image.LANCZOS)
            if a.꼴 == 'AVIF':
                im.save(담을것, 'AVIF', quality=품질)
            else:
                im.save(담을것, 'WEBP', quality=품질, method=6)
        except Exception as e:                                   # noqa: BLE001
            print(f'   🔴 {것["이름"]} — {str(e)[:120]}')
            실패 += 1
            continue
        것['파일'] = os.path.basename(담을것)
        산것 += 1
        print(f'   ✅ [{묶}] {것["이름"]} → {os.path.basename(담을것)} '
              f'{im.size[0]}x{im.size[1]} {os.path.getsize(담을것) // 1024}KB')

    io.open(계획경로, 'w', encoding='utf-8', newline='').write(
        json.dumps(계획, ensure_ascii=False, indent=2) + '\n')
    print(f'■ 합계 {len(할것)}장 = 담음 {산것} + 실패 {실패} · 계획.json 의 파일 이름도 함께 옮겼다')


if __name__ == '__main__':
    main()
