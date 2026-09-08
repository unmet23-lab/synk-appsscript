"""3D 문지기 — 블렌더로 지은 까몽이 정본 4K 까몽과 «같은 몸»인가. 0원 실측.

■ 왜 이것이 문지기인가 (2026-09-08)
  유호님이 주신 인스타 게시물(힉스필드가 공개한 GPT-6 Astra 사례 열 개 = 「말 → 장면 코드 →
  블렌더가 실행 → 고칠 수 있는 3D 파일이 남는다」)을 우리 자리에 대 본 끝자리다.

  같은 날 낮에 **재질 축은 이미 닫혔다** — 마린을 범프 판·털 판 두 벌로 구워 정본 4K 옆에
  놓았더니 둘 다 «플라스틱 장난감»이고 양모 결에 못 닿았다. 같은 날 GPT 판 까몽 목도리는
  감김·접촉 그림자·조명이 다 살아 있다. ⇒ 최종 그림을 3D 로 내는 길은 닫았다.

  **남은 값은 «깊이» 하나다.** 지금 앱의 4D 층(`tools/lib/깊이격자.js`)은 그림의 바깥선만 보고
  「몸이 회전체일 것이다」라고 가정해 z 를 되짚는다. 그 파일 주석이 스스로 이렇게 적는다 —
  「귀·날개·꼬리는 회전체가 아니라 그 자리의 깊이는 «비슷하게»지 정확하지는 않습니다」.
  블렌더는 가정 없이 진짜 z 를 낸다. 그림은 지금 GPT·제미나이 판 그대로 두고 숫자만 받는다.

  🔑 **그런데 그 숫자를 쓰려면 두 몸의 «바깥선»이 먼저 겹쳐야 한다.** 안 겹치면 블렌더 z 를
  정본 그림에 얹는 순간 엉뚱한 자리의 깊이가 된다. 그래서 이 대본이 앞에 선다.

■ 자 — 「그냥 겹치기」는 거짓 빨강을 낸다
  블렌더 렌더와 정본 4K 는 카메라 구도가 다르다(정본은 제미나이가 구운 사진이다). 그대로
  겹치면 크기·자리 차이가 형태 차이로 둔갑한다. 그래서 **각 그림에서 몸의 경계 상자를 떠서
  비율을 보존해 같은 네모 안에 가운데 맞춘 뒤** 겹침을 잰다. 가로·세로를 따로
  늘리면 몸 비율의 차이까지 사라지므로, 이전 방식은 참고값으로만 함께 기록한다.

  🔴 **숫자만 내지 않는다** — 겹친 그림을 반드시 한 장 남긴다. 자가 틀리면 숫자로는 안 보이고
  그림에 겹쳐야 보인다(09-08 에 한 판에 세 번 틀렸고 셋 다 유호님이 잡으셨다).

■ 쓰기
  python tools/삼디실루엣대조.py                 # 렌더부터 전부
  python tools/삼디실루엣대조.py --렌더건너뜀     # 이미 구운 PNG 로 재기만
"""
import subprocess
import sys

# 🔴 밤 일감이 부를 때 한글 출력이 깨지지 않게 여기서 정한다 (09-08 실패 자리).
#    예약에 `set PYTHONUTF8=1 &&` 를 넣었더니 cmd 가 «&& 앞의 빈칸까지» 값으로 먹어
#    파이썬이 「invalid PYTHONUTF8 value」로 시작도 못 하고 죽었다(종료코드 1).
#    ⇒ 환경변수에 기대지 않는다. 대본이 스스로 정한다.
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding='utf-8')
    except Exception:
        pass
import time
from pathlib import Path

import numpy as np
from PIL import Image

저장소 = Path(__file__).resolve().parent.parent
블렌더 = Path(r'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe')
정본 = 저장소 / 'docs' / '캐릭터' / '정본_4K' / '까몽_본체.png'
일방 = 저장소 / 'docs' / '_ops' / '삼디문지기'
렌더판 = 일방 / '까몽_블렌더_누끼.png'
겹친판 = 일방 / '까몽_겹친판.png'
보고 = 일방 / '판정.md'

# 통과선 — 마스코트_착용_설계 §1 이 「표정이 바뀔 때 몸이 그 자리인가」를 IoU 로 쟀고
#   몽글 정면 13컷이 99.0~99.5% 였다. 그것은 «같은 그림 안»의 잣대라 여기 쓰면 너무 세다.
#   여기는 «다른 도구로 지은 두 몸»이라 자를 낮춘다. 까몽 표정끼리도 73.7~82.9% 였으므로
#   그 아래면 「다른 몸」으로 읽는 것이 맞다.
통과선 = 0.80


def 알파(경로, 크기=512):
    """알파(투명도) > 128 인 자리를 몸으로 본다."""
    im = Image.open(경로).convert('RGBA')
    a = np.asarray(im, dtype=np.uint8)[..., 3]
    if not (a <= 128).any() or not (a > 128).any():
        raise ValueError(f'몸과 투명 배경이 함께 있어야 한다: {경로}')
    return a > 128, im


def 상자맞춤(마스크, 크기=512, 비율보존=True):
    """위치와 전체 크기만 맞춘다. 몸의 가로세로 비율은 판정에 남긴다."""
    행 = np.any(마스크, axis=1)
    열 = np.any(마스크, axis=0)
    if not 행.any() or not 열.any():
        raise SystemExit('🔴 몸이 없다(알파가 전부 투명이다) — 누끼로 구운 것이 맞는지 본다.')
    y0, y1 = np.where(행)[0][[0, -1]]
    x0, x1 = np.where(열)[0][[0, -1]]
    잘림 = Image.fromarray((마스크[y0:y1 + 1, x0:x1 + 1] * 255).astype(np.uint8))
    if not 비율보존:
        return np.asarray(잘림.resize((크기, 크기), Image.Resampling.NEAREST)) > 128
    배율 = 크기 / max(잘림.size)
    w, h = (max(1, round(v * 배율)) for v in 잘림.size)
    판 = Image.new('L', (크기, 크기), 0)
    판.paste(잘림.resize((w, h), Image.Resampling.NEAREST), ((크기-w)//2, (크기-h)//2))
    return np.asarray(판) > 128


def 렌더한다():
    일방.mkdir(parents=True, exist_ok=True)
    if not 블렌더.exists():
        raise SystemExit(f'🔴 블렌더가 없다: {블렌더}')
    # 🔴 GPU 로 돌리면 죽는다 — 09-08 실측: Arc 드라이버(ze_intel_gpu64.dll)가 렌더 중 사망했다.
    #    파일 주석이 이미 「Arc B390 OOM → CPU 되물림 41분」으로 적어 둔 그 자리다. CPU 로 못 박는다.
    #    품질=조율 은 자식 털을 절반으로 줄인다(형태만 볼 것이라 정본 품질이 필요 없다).
    명령 = [
        str(블렌더), '--background', '--python', str(저장소 / 'tools' / '몽글친구굽기.py'), '--',
        f'출력={렌더판}', '표정=본체', '너비=1024', '품질=조율', '장치=CPU', '투명=1',
    ]
    print(f'[{time.strftime("%H:%M:%S")}] 블렌더를 부른다(CPU · 조율 · 누끼) — 완료 시각을 실제로 확인한다.')
    시작 = time.time()
    r = subprocess.run(명령, cwd=str(저장소), capture_output=True, text=True, encoding='utf-8', errors='replace')
    (일방 / '블렌더실행.log').write_text((r.stdout or '') + '\n' + (r.stderr or ''), encoding='utf-8')
    if r.returncode != 0 or not 렌더판.exists() or 렌더판.stat().st_mtime < 시작 - 1:
        꼬리 = (r.stdout or '')[-1500:] + (r.stderr or '')[-1500:]
        raise SystemExit(f'🔴 이번 렌더 성공을 확인하지 못했다(종료코드 {r.returncode})\n{꼬리}')
    알파(렌더판)
    print(f'[{time.strftime("%H:%M:%S")}] 렌더 끝 — {렌더판}')


def 잰다():
    ㄱ마스크, ㄱ그림 = 알파(정본)
    ㄴ마스크, ㄴ그림 = 알파(렌더판)
    ㄱ = 상자맞춤(ㄱ마스크)
    ㄴ = 상자맞춤(ㄴ마스크)

    겹침 = np.logical_and(ㄱ, ㄴ).sum()
    합집합 = np.logical_or(ㄱ, ㄴ).sum()
    iou = 겹침 / 합집합

    # 🔑 겹친 그림 — 빨강 = 정본만 · 파랑 = 블렌더만 · 흰색 = 둘 다.
    #    숫자가 같아도 «어디가» 다른지는 이 그림만 안다.
    h, w = ㄱ.shape
    캔버스 = np.zeros((h, w, 3), dtype=np.uint8)
    캔버스[..., 0] = np.where(ㄱ, 255, 0)
    캔버스[..., 2] = np.where(ㄴ, 255, 0)
    둘다 = np.logical_and(ㄱ, ㄴ)
    캔버스[둘다] = (255, 255, 255)
    일방.mkdir(parents=True, exist_ok=True)
    Image.fromarray(캔버스).save(겹친판)

    정본만 = np.logical_and(ㄱ, ~ㄴ).sum()
    블렌더만 = np.logical_and(ㄴ, ~ㄱ).sum()
    옛ㄱ = 상자맞춤(ㄱ마스크, 비율보존=False)
    옛ㄴ = 상자맞춤(ㄴ마스크, 비율보존=False)
    옛iou = np.logical_and(옛ㄱ, 옛ㄴ).sum() / np.logical_or(옛ㄱ, 옛ㄴ).sum()
    return iou, 정본만, 블렌더만, ㄱ.sum(), ㄴ.sum(), 옛iou


def 적는다(iou, 정본만, 블렌더만, ㄱ넓이, ㄴ넓이, 옛iou):
    지남 = iou >= 통과선
    판정 = '🟢 실루엣 후보 통과 — 깊이 정확도는 미검증' if 지남 else '🔴 현 후보 탈락 — 이 몸의 깊이를 정본에 적용하지 않는다'
    글 = f"""# 3D 문지기 판정 — 블렌더 까몽 vs 정본 4K 까몽

> 잰 날 = {time.strftime('%Y-%m-%d %H:%M')} · 자 = 경계 상자를 비율 보존·중앙 정렬한 뒤 512×512 에서 실루엣 겹침(IoU)

## {판정}

| 잰 것 | 값 |
|---|---|
| 실루엣 겹침 | **{iou * 100:.1f}%** (통과선 {통과선 * 100:.0f}%) |
| 이전 각축 늘림 방식 참고값 | {옛iou * 100:.1f}% — 비율 차이를 지우므로 통과 근거로 쓰지 않음 |
| 정본에만 있는 몸 | {정본만:,}칸 ({정본만 / ㄱ넓이 * 100:.1f}%) |
| 블렌더에만 있는 몸 | {블렌더만:,}칸 ({블렌더만 / ㄴ넓이 * 100:.1f}%) |

겹친 그림 = `{겹친판.name}` — 빨강은 정본만, 파랑은 블렌더만, 흰색은 둘 다.

## 이 판정이 무엇을 가르나

- **통과면**: 이 3D 후보의 정면 바깥선이 1차 조건을 충족했다. 실루엣만으로는 두께·내부 깊이·카메라 정합을 증명할 수 없다. 깊이를 앱에 등록하지 않는다.
- **탈락이면**: 이 후보의 깊이를 정본에 적용하지 않는다. 모든 3D 방식이 불가능하다는 뜻은 아니다. 기존 정본 그림과 착용 통로는 그대로 보존한다.

## 다음 걸음

{'눈으로 겹친판과 원본 렌더를 비교한다. 깊이 시험을 별도로 할 경우 카메라·랜드마크 정합부터 확인한다. 두 추정 깊이의 차이만으로 어느 쪽이 실제 몸과 일치하는지 판정하지 않는다.' if 지남 else '현 후보는 종료한다. 겹친판의 불일치 부위를 기록하고, 기존 정본·깊이 코드는 변경하지 않는다.'}
"""
    보고.write_text(글, encoding='utf-8')
    print(글)


if __name__ == '__main__':
    if '--렌더건너뜀' not in sys.argv:
        렌더한다()
    적는다(*잰다())
