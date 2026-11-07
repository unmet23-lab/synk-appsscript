# 8번 목소리 고르기 판(2026-11-07, Claude) — 유호님이 들어 보고 고르시는 두 자리를 실제 장면 위에서 견준다(콘티 5절 1 · 1절 내레이션).
#   손님: 19번 컷(23.62~26.71초)을 후보마다 한 번씩 — (가) 시댄스(19번 판이 낸 목소리) · (나) 일레븐 v4 수리 · 코코 · 루나
#   내레이션: 20 · 21번(26.71~30.0초)을 후보마다 한 번씩 — 일레븐 v4 아이작 · 에스엠 · 애셔 · 헨리
#   다른 소리(노래 · 효과음)는 최종본과 같고 그 자리의 목소리만 바뀐다. 화면 오른쪽 위에 번호와 이름(고르기용 표시 — 왼쪽 위는 20번 포스터 자리).
#   크기: 후보 섞음(마감 전)에 최종본 마감이 준 이득(최종본 LUFS − 기본 후보 섞음 LUFS)을 똑같이 주고 같은 리미터(0.74)를 건다 — 최종본과 같은 크기로 들린다.
#   python -X utf8 목소리견줌.py   → git 밖 최종/p8/_고르기/목소리_손님_넷.mp4 · 목소리_내레이션_넷.mp4
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, ".."))
import 최종편집 as E

OUT = os.path.join(E.OUT, "_고르기")
SEATS = {
    "손님": {"env": "P8_GUEST", "names": ["시댄스", "수리", "코코", "루나"], "a": 23.40, "b": 26.71},
    "내레이션": {"env": "P8_NARR", "names": ["아이작", "에스엠", "애셔", "헨리"], "a": 26.40, "b": 30.0},
}


def lufs(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-map", "0:a", "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8", errors="replace")
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)[-1])


def mix_of(seat, cfg, name):
    env = dict(os.environ, **{cfg["env"]: name})
    wav = os.path.join(OUT, f"_{seat}_{name}.wav")
    subprocess.run([sys.executable, "-X", "utf8", "-c",
                    "import sys; sys.path.insert(0, r'%s'); sys.path.insert(0, r'%s'); import 최종소리 as S, 최종편집 as E, os; "
                    "S.build(r'%s', os.devnull, E.TF)" % (HERE, os.path.join(HERE, ".."), wav)], check=True, env=env)
    return wav


def main():
    os.makedirs(OUT, exist_ok=True)
    FONT = E.label_font()   # 한글 경로 글꼴은 ffmpeg drawtext가 세그폴트로 죽는다
    final = os.path.join(E.OUT, "캐스팅북_16x9.mp4")
    gain = lufs(final) - lufs(mix_of("기본", SEATS["손님"], "시댄스"))
    print(f"마감 이득 {gain:+.2f} dB")
    for seat, cfg in SEATS.items():
        parts = []
        for k, name in enumerate(cfg["names"], 1):
            wav = mix_of(seat, cfg, name)
            clip = os.path.join(OUT, f"_{seat}_{k}.mp4")
            label = f"{seat} {k} · {'시댄스(판이 낸 목소리)' if name == '시댄스' else '일레븐 v4 ' + name}"
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{cfg['a']}", "-to", f"{cfg['b']}", "-i", final, "-ss", f"{cfg['a']}", "-to", f"{cfg['b']}", "-i", wav,
                            "-map", "0:v", "-map", "1:a", "-vf", f"drawbox=x=1130:y=30:w=760:h=64:color=black@0.55:t=fill,drawtext=fontfile='{FONT}':text='{label}':x=1148:y=44:fontsize=34:fontcolor=white",
                            "-af", f"volume={gain:.2f}dB,alimiter=limit=0.74:level=false",
                            "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", clip], check=True)
            parts.append(clip)
        lst = os.path.join(OUT, f"_{seat}.txt")
        open(lst, "w", encoding="utf-8").write("".join(f"file '{p}'\n" for p in parts))
        dst = os.path.join(OUT, f"목소리_{seat}_넷.mp4")
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", "-movflags", "+faststart", dst], check=True)
        print(dst)


if __name__ == "__main__":
    main()
