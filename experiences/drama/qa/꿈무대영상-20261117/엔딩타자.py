"""
꿈 무대 엔딩 — 목소리를 꺼 둔 학생의 글자 판(2026-11-21, 유호님 「응, 파생판부터」).
기획안 「시즌 마무리 엔딩」: 목소리를 꺼 둔 학생에게는 그때 친 글자가 친 속도대로(틀리고 지운 것까지) 나온다.

실제 판은 게임이 남긴 입력 기록(입력창의 글과 그때의 밀리초)을 그대로 쓴다. 이 파일은 그 기록이 아직 없어서 견본 기록을 만든다.
두벌식 자판으로 한 글쇠씩 치는 것처럼 조합 중인 글자(ㅇ → 아 → 안 → 안ㄴ → 안녀 → 안녕)까지 상태로 남기고,
지우기는 조합 중이면 자모 하나, 아니면 글자 하나를 지운다. 봄(2화)은 느리게, 가을(8화)은 빠르게 쳐서 그사이 는 것이 보이게 한다.

    python -I -X utf8 엔딩타자.py <밖 폴더> [--소리 <자판 녹음>]
      봄.json · 가을.json — {"글": [[밀리초, "입력창의 글"], …], "끝": 밀리초}
      --소리: 글쇠마다 실제 자판 녹음에서 떼어 낸 한 번의 타건을 놓은 봄_소리.wav · 가을_소리.wav(엔딩의 바탕소리로 얹는다)
"""
import json
import os
import random
import subprocess
import sys

import numpy as np

초성 = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"
중성 = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"
종성 = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"]
겹모음 = {("ㅗ", "ㅏ"): "ㅘ", ("ㅗ", "ㅐ"): "ㅙ", ("ㅗ", "ㅣ"): "ㅚ", ("ㅜ", "ㅓ"): "ㅝ", ("ㅜ", "ㅔ"): "ㅞ", ("ㅜ", "ㅣ"): "ㅟ", ("ㅡ", "ㅣ"): "ㅢ"}
겹받침 = {("ㄱ", "ㅅ"): "ㄳ", ("ㄴ", "ㅈ"): "ㄵ", ("ㄴ", "ㅎ"): "ㄶ", ("ㄹ", "ㄱ"): "ㄺ", ("ㄹ", "ㅁ"): "ㄻ", ("ㄹ", "ㅂ"): "ㄼ", ("ㄹ", "ㅅ"): "ㄽ",
       ("ㄹ", "ㅌ"): "ㄾ", ("ㄹ", "ㅍ"): "ㄿ", ("ㄹ", "ㅎ"): "ㅀ", ("ㅂ", "ㅅ"): "ㅄ"}
모음나눔 = {v: k for k, v in 겹모음.items()}
받침나눔 = {v: k for k, v in 겹받침.items()}
자음 = set(초성) | {j for j in 종성 if j}
모음 = set(중성)


def 글쇠들(글):
    """완성된 글을 두벌식 글쇠 차례로 푼다(겹모음 · 겹받침은 두 글쇠, 쌍자음은 한 글쇠)."""
    쇠 = []
    for ch in 글:
        o = ord(ch) - 0xAC00
        if 0 <= o < 11172:
            c, v, j = o // 588, (o % 588) // 28, o % 28
            쇠.append(초성[c])
            쇠 += list(모음나눔.get(중성[v], (중성[v],)))
            if j:
                쇠 += list(받침나눔.get(종성[j], (종성[j],)))
        else:
            쇠.append(ch)
    return 쇠


def 붙임(c, v=None, j=None):
    if v is None:
        return c or ""
    if c is None:
        return v
    return chr(0xAC00 + (초성.index(c) * 21 + 중성.index(v)) * 28 + 종성.index(j or ""))


class 자판:
    """두벌식 조합: 확정된 글 + 조합 중인 한 글자(초 · 중 · 종)."""

    def __init__(self):
        self.확정, self.조합 = "", None

    def 글(self):
        return self.확정 + (붙임(*self.조합) if self.조합 else "")

    def 맺기(self):
        if self.조합:
            self.확정 += 붙임(*self.조합)
        self.조합 = None

    def 누름(self, k):
        if k == "⌫":
            if self.조합:
                c, v, j = self.조합
                if j:
                    self.조합 = (c, v, 받침나눔[j][0] if j in 받침나눔 else None)
                elif v:
                    self.조합 = (c, 모음나눔[v][0], None) if v in 모음나눔 else ((c, None, None) if c else None)
                else:
                    self.조합 = None
            else:
                self.확정 = self.확정[:-1]
            return
        if k in 자음:
            if self.조합 is None:
                self.조합 = (k, None, None)
                return
            c, v, j = self.조합
            if v is None or c is None:
                self.맺기()
                self.조합 = (k, None, None)
            elif j is None and k in 종성:
                self.조합 = (c, v, k)
            elif j and (j, k) in 겹받침:
                self.조합 = (c, v, 겹받침[(j, k)])
            else:
                self.맺기()
                self.조합 = (k, None, None)
            return
        if k in 모음:
            if self.조합 is None:
                self.조합 = (None, k, None)
                return
            c, v, j = self.조합
            if v is None:
                self.조합 = (c, k, None)
            elif j:
                앞, 뒤 = 받침나눔.get(j, (None, j))
                self.조합 = (c, v, 앞)
                self.맺기()
                self.조합 = (뒤, k, None)
            elif (v, k) in 겹모음:
                self.조합 = (c, 겹모음[(v, k)], None)
            else:
                self.맺기()
                self.조합 = (None, k, None)
            return
        self.맺기()
        self.확정 += k


def 기록(행동, 빠르기, 씨앗):
    """행동: [("친다", 글) | ("쉼", 초) | ("지운다", 번)]. 빠르기: 글쇠 사이 초(바탕 · 흔들림 · 낱말 앞 · 문장부호 뒤)."""
    rng = random.Random(씨앗)
    바탕, 흔들림, 낱말, 부호 = 빠르기
    판, t, 상태 = 자판(), 0.0, []
    for 종류, 값 in 행동:
        if 종류 == "쉼":
            t += 값
            continue
        쇠 = ["⌫"] * 값 if 종류 == "지운다" else 글쇠들(값)
        앞 = None
        for k in 쇠:
            d = 바탕 + rng.uniform(-흔들림, 흔들림)
            if k == "⌫":
                d = 바탕 * 0.7
            elif 앞 == " ":
                d += 낱말
            elif 앞 in (".", ",", "?"):
                d += 부호
            t += max(0.04, d)
            판.누름(k)
            상태.append([round(t * 1000), 판.글()])
            앞 = k
    return {"글": 상태, "끝": round(t * 1000)}


# 견본: 봄(2화) 첫 자기소개는 「유호에요」로 쳤다가 멈춘 뒤 「예요」로 고친다(받침 없는 이름 뒤 -예요).
# 가을(8화) 무대 인사는 「연기했」까지 치다 지우고 「연기한」으로 고친다(꾸미는 말).
견본 = {
    "봄": ([("친다", "안녕하세요."), ("친다", " 저는 유호에요"), ("쉼", 1.1), ("지운다", 3), ("쉼", 0.35), ("친다", "예요.")],
          (0.24, 0.07, 0.3, 0.55), 20261121),
    "가을": ([("친다", "안녕하세요."), ("친다", " 유학생을 연기했"), ("쉼", 0.55), ("지운다", 3), ("친다", "한 유호입니다.")],
           (0.13, 0.04, 0.1, 0.3), 20261122),
}

def 자판소리(기록값, 녹음, 밖, 씨앗):
    """녹음에서 타건 시작(앞 5ms 대비 8dB 넘게 커지는 곳)을 찾아 55ms씩 떼고, 글쇠마다 하나씩 골라 놓는다."""
    SR = 48000
    b = subprocess.run(["ffmpeg", "-v", "error", "-i", 녹음, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    s = np.frombuffer(b, np.float32)
    hop = 240
    db = 20 * np.log10(np.array([np.sqrt((s[i:i + hop] ** 2).mean()) for i in range(0, len(s) - hop, hop)]) + 1e-9)
    시작들 = []
    for i in range(1, len(db)):
        if db[i] - db[i - 1] > 8 and db[i] > db.max() - 30 and (not 시작들 or i * hop - 시작들[-1] > 0.05 * SR):
            시작들.append(i * hop)
    n, k = round(0.055 * SR), round(0.008 * SR)
    조각들 = []
    for a in 시작들:
        c = s[max(0, a - 240):max(0, a - 240) + n].copy()
        if len(c) == n:
            c[-k:] *= np.linspace(1, 0, k)
            조각들.append(c)
    rng = random.Random(씨앗)
    줄 = np.zeros(round((기록값["끝"] / 1000 + 0.3) * SR), np.float32)
    앞글 = ""
    for ms, 글 in 기록값["글"]:
        c = 조각들[rng.randrange(len(조각들))] * (1.15 if len(글) < len(앞글) else rng.uniform(0.8, 1.0))
        i = round(ms / 1000 * SR)
        줄[i:i + n] += c[: len(줄) - i]
        앞글 = 글
    (np.clip(줄, -1, 1) * 32767).astype(np.int16).tofile(밖 + ".raw")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "s16le", "-ar", str(SR), "-ac", "1", "-i", 밖 + ".raw", 밖], check=True)
    os.remove(밖 + ".raw")
    return len(조각들)


if __name__ == "__main__":
    시험 = 자판()
    for k in 글쇠들("안녕"):
        시험.누름(k)
    assert 시험.글() == "안녕"
    밖 = sys.argv[1]
    os.makedirs(밖, exist_ok=True)
    for 이름, (행동, 빠르기, 씨앗) in 견본.items():
        r = 기록(행동, 빠르기, 씨앗)
        json.dump(r, open(os.path.join(밖, f"{이름}.json"), "w", encoding="utf-8"), ensure_ascii=False)
        print(이름, f"{r['끝'] / 1000:.2f}초", len(r["글"]), "글쇠 ·", " → ".join(s for _, s in r["글"][:8]), "… →", r["글"][-1][1])
        if "--소리" in sys.argv:
            print("  타건", 자판소리(r, sys.argv[sys.argv.index("--소리") + 1], os.path.join(밖, f"{이름}_소리.wav"), 씨앗), "가지")
