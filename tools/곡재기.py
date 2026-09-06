"""곡 재기 — 배경음 후보를 «쓸 수 있나»로 재고, 쓰던 곡들과 나란히 놓는다 (2026-09-07).

■ 왜 생겼나
  유호님이 Suno 로 만든 곡을 주시기 시작했다(09-07 확정). 그런데 08-26 에 곡을 견줬던
  «자»가 저장소에 없다 — `docs/홍보물/BGM/README.md` 에 그때 잰 «값»만 남아 있고
  재는 코드는 아무 데도 없었다. 값만 있고 자가 없으면 새 곡을 같은 잣대로 못 잰다
  (memory `measurement-needs-its-instrument`).

■ 🔴 이 도구가 «못» 재는 것 — 먼저 밝힌다
  **「음악으로 좋은가」는 못 잰다.** 가락이 예쁜지, 브랜드 결에 맞는지, 몇 번 들어도
  안 질리는지는 사람 귀가 판정한다(memory `suno-is-the-music-tool` 「음악으로 들리는지는
  내가 못 잰다」). 이 도구는 **「이 자리에 물리적으로 맞나」**만 답한다.
  그래서 결과에 ✅ 를 찍어도 그건 「규격 통과」이지 「채택」이 아니다.

■ 재는 것 여섯
  ① 길이            — 릴이 30초라 40초는 넘어야 «꽉 찬 30초»를 고를 수 있다
  ② 라우드니스(LUFS) — 사람이 느끼는 소리 크기. 곡마다 달라서 볼륨을 맞출 때 쓴다
  ③ 레벨 변동계수    — 소리 크기가 얼마나 오르내리나. 낮으면 «깔림»(패드), 높으면 «곡»
  ④ 온셋 밀도        — 초당 몇 번 «툭» 하고 소리가 시작하나. 리듬의 촘촘함
  ⑤ 가장 꽉 찬 30초  — 곡의 어디부터 잘라 써야 릴이 안 밋밋한가(받은 곡은 앞이 인트로다)
  ⑥ 밝기            — 스펙트럼 무게중심(Hz). 높으면 쨍하고 낮으면 묵직하다

  ⚠ ③④⑥ 은 이 파일이 정의한 자다. 08-26 표의 값과 «가깝게» 맞췄지만 그때 코드가 없어
    똑같다고는 말 못 한다. 그래서 기본으로 기존 곡을 함께 재서 **같은 자 안에서만** 견준다.

쓰기:
  python tools/곡재기.py "C:/.../새곡.wav"     → 새 곡 + 쓰던 곡 전부를 나란히
  python tools/곡재기.py "새곡.wav" --혼자      → 그 곡만
  python tools/곡재기.py --쓰던것만             → 지금 쓰는 곡들만
"""
import argparse
import os
import subprocess
import sys
import tempfile

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 22050          # 재는 데는 이 정도면 넉넉하다(밝기 상한 11kHz)
창 = 2048
홉 = 512

쓰던곡 = [
    ("몽글 릴 45편", "docs/홍보물/BGM/05_Toddler-Kids_alex-morgan.mp3"),
    ("까몽 릴 45편", "docs/홍보물/BGM/01_Joyful-Happy-Upbeat_alex-morgan.mp3"),
    ("티저 깔림", "docs/홍보물/BGM_개정판_깔림만.wav"),
]


def 읽기(경로):
    """어떤 꼴이든 ffmpeg 로 모노 22050Hz float 로 편다."""
    r = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", 경로, "-ac", "1", "-ar", str(SR),
         "-f", "f32le", "-"],
        capture_output=True)
    if r.returncode != 0 or not r.stdout:
        sys.exit(f"🔴 못 읽었다: {경로}\n   {r.stderr.decode('utf-8', 'replace')[-300:]}")
    return np.frombuffer(r.stdout, dtype=np.float32)


def 라우드니스(경로):
    """ffmpeg ebur128 의 integrated LUFS. 이건 표준 자라 내가 정의하지 않는다."""
    r = subprocess.run(
        ["ffmpeg", "-v", "info", "-i", 경로, "-af", "ebur128=framelog=quiet", "-f", "null", "-"],
        capture_output=True)
    글 = r.stderr.decode("utf-8", "replace")
    표시 = 글.rfind("I:")
    if 표시 < 0:
        return None
    조각 = 글[표시:표시 + 40].split()
    try:
        return float(조각[1])
    except (IndexError, ValueError):
        return None


def 재기(이름, 경로):
    x = 읽기(경로)
    길이 = len(x) / SR

    # ── 창별 세기 ──────────────────────────────────────────────────────────
    수 = max((len(x) - 창) // 홉 + 1, 1)
    틀 = np.lib.stride_tricks.sliding_window_view(x, 창)[::홉][:수]
    rms = np.sqrt((틀.astype(np.float64) ** 2).mean(axis=1)) + 1e-12

    # ③ 레벨 변동계수 = 세기의 «흔들림 폭 ÷ 평균». 조용한 구간이 값을 흔들지 않게
    #    소리가 실제로 있는 창만 센다(최대의 1% 아래는 무음으로 본다).
    산 = rms[rms > rms.max() * 0.01]
    변동계수 = float(산.std() / 산.mean()) if len(산) else 0.0

    # ④ 온셋 = 세기가 «갑자기» 오르는 자리. 오르는 몫만 세고(내려가는 건 온셋이 아니다)
    #    제 이웃보다 높으면서 문턱을 넘은 봉우리만 센다.
    오름 = np.diff(rms, prepend=rms[0])
    오름[오름 < 0] = 0
    # 🔴 문턱을 «곡 제 안»으로만 잡으면 조용한 곡이 과대평가된다(09-07 실측: 깔림이 5.44/초로
    #    나왔는데 그건 리듬이 아니라 잔물결이었다 — 변동이 작으니 std 도 작고 문턱이 같이 내려간다).
    #    그래서 곡의 «전체 세기»에 걸린 절대 문턱을 함께 넘게 한다. 이 한 줄이 깔림과 곡을 가른다.
    문턱 = max(오름.mean() + 오름.std(), rms.mean() * 0.25)
    봉우리 = (오름[1:-1] > 문턱) & (오름[1:-1] >= 오름[:-2]) & (오름[1:-1] > 오름[2:])
    온셋밀도 = float(봉우리.sum() / 길이)

    # ⑤ 가장 꽉 찬 30초 — 30초 창의 평균 세기가 가장 큰 시작점
    창수30 = int(30 * SR / 홉)
    if 수 > 창수30:
        누적 = np.concatenate([[0], np.cumsum(rms)])
        평균들 = (누적[창수30:] - 누적[:-창수30]) / 창수30
        꽉찬시작 = float(np.argmax(평균들) * 홉 / SR)
    else:
        꽉찬시작 = 0.0

    # ⑥ 밝기 = 스펙트럼 무게중심. 소리가 실린 창만 본다.
    스펙 = np.abs(np.fft.rfft(틀 * np.hanning(창), axis=1))
    주파수 = np.fft.rfftfreq(창, 1 / SR)
    힘 = 스펙.sum(axis=1) + 1e-12
    무게중심 = (스펙 * 주파수).sum(axis=1) / 힘
    산창 = rms > rms.max() * 0.01
    밝기 = float(무게중심[산창].mean()) if 산창.any() else 0.0

    return {
        "이름": 이름,
        "길이": 길이,
        "LUFS": 라우드니스(경로),
        "변동계수": 변동계수,
        "온셋": 온셋밀도,
        "꽉찬시작": 꽉찬시작,
        "밝기": 밝기,
    }


def 줄(v):
    lufs = f"{v['LUFS']:6.1f}" if v["LUFS"] is not None else "     ?"
    return (f"  {v['이름'][:22]:<22} {v['길이']:6.1f}초 {lufs}  "
            f"{v['변동계수']:6.3f}  {v['온셋']:5.2f}/초  {v['꽉찬시작']:6.1f}초부터  {v['밝기']:6.0f}Hz")


def 판정(v):
    """규격만 본다. «음악으로 좋은가»는 여기서 안 답한다."""
    말 = []
    말.append("✅ 길이 넉넉" if v["길이"] >= 40 else f"🔴 길이 {v['길이']:.0f}초 — 40초는 넘어야 «꽉 찬 30초»를 고른다")
    if v["변동계수"] < 0.35:
        말.append("· 결 = «깔림»(패드에 가깝다. 티저처럼 소리가 안 나서야 하는 자리)")
    elif v["변동계수"] < 0.55:
        말.append("· 결 = 중간(곡이되 잔잔하다)")
    else:
        말.append("· 결 = «곡»(오르내림이 뚜렷하다. 릴처럼 끌고 가야 하는 자리)")
    if v["온셋"] < 1.5:
        말.append("· 리듬 성김 — 30초를 끌기엔 밋밋할 수 있다")
    elif v["온셋"] > 4.5:
        말.append("· 리듬 촘촘 — 자막·옹알이와 다툴 수 있다")
    else:
        말.append("· 리듬 알맞음")
    return 말


def main():
    ap = argparse.ArgumentParser(description="배경음 후보를 규격으로 재고 쓰던 곡과 견준다")
    ap.add_argument("곡", nargs="*", help="잴 곡 경로(여럿 가능)")
    ap.add_argument("--혼자", action="store_true", help="쓰던 곡과 견주지 않는다")
    ap.add_argument("--쓰던것만", action="store_true", help="지금 쓰는 곡들만 잰다")
    a = ap.parse_args()

    잰것 = []
    for 하나 in (a.곡 or []):
        if not os.path.exists(하나):
            sys.exit(f"🔴 파일이 없다: {하나}")
        잰것.append(재기("🆕 " + os.path.splitext(os.path.basename(하나))[0], 하나))
    새것수 = len(잰것)
    if not a.혼자:
        for 이름, 상대 in 쓰던곡:
            p = os.path.join(ROOT, 상대)
            if os.path.exists(p):
                잰것.append(재기(이름, p))
    if not 잰것:
        sys.exit("잴 것이 없다 — 곡 경로를 주거나 --쓰던것만 을 쓴다")

    print("■ 곡 재기 — 자는 tools/곡재기.py 다(08-26 표와 «같은 자»가 아니다. 아래는 이 자 안에서만 견준다)")
    print(f"  {'곡':<22} {'길이':>7} {'라우드':>6}  {'변동':>6}  {'온셋':>7}  {'꽉 찬 30초':>10}  {'밝기':>7}")
    for v in 잰것:
        print(줄(v))

    if 새것수:
        print()
        print("■ 새 곡 판정 — 규격만이다(«음악으로 좋은가»는 이 도구가 못 잰다)")
        for v in 잰것[:새것수]:
            print(f"  · {v['이름']}")
            for m in 판정(v):
                print("     " + m)


if __name__ == "__main__":
    main()
