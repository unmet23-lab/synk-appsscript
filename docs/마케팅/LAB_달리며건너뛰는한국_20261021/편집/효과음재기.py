# 효과음 후보 재기(2026-11-07, Claude) — CLAP(laion/clap-htsat-unfused, Apache-2.0, 로컬)으로 후보마다 「바라는 소리」와 「헷갈린 소리」 글과의 닮음을 잰다.
#   Gemini 무료 키가 그날 몫(모델마다 하루 20번)을 다 써 소리 맹검을 못 할 때의 귀. 첫 판을 Gemini가 들은 말(발소리 → 박수, 휙 → 칼 쇳소리, 꽃밭 → 비닐 봉지)을
#   헷갈림 후보로 넣어, 바라는 글의 몫(소프트맥스)이 가장 큰 씨앗을 고른다. 숫자는 거르기용이다 — 고른 것은 최종 믹스를 다시 들려 확인한다.
#   C:/SYNK-LoRA/tools/hunyuan-foley/venv/Scripts/python.exe 편집/효과음재기.py [이름 앞부분 …]   → 편집/소리/효과음/_CLAP.json · 한 줄 표
import json
import os
import subprocess
import sys

import numpy as np
import torch
from transformers import ClapModel, ClapProcessor

MODEL = "C:/SYNK-LoRA/tools/clap/htsat-unfused"
DIR = "C:/Users/q1212/Documents/synk-vendor/korea-run-montage-20261021/편집/소리/효과음"
# 종류: (바라는 글, [헷갈림 글 …])
KINDS = {
    "발소리": ("footsteps of sneakers walking on a concrete floor", ["people clapping hands", "high heels walking", "knocking on a door", "music"]),
    "유리": ("hands patting on a glass window", ["knocking on a wooden door", "footsteps", "glass breaking", "music"]),
    "문닫힘": ("subway train doors closing with a pneumatic hiss", ["a wooden door creaking and slamming", "car door closing", "music", "people talking"]),
    "달리기": ("fast running footsteps on a hard floor", ["dress shoes walking slowly on a wooden floor", "people clapping hands", "horse galloping", "music"]),
    "휙": ("a soft whoosh of air", ["a metal sword being drawn", "wind blowing for a long time", "a bird flying", "music"]),
    "풀썩": ("a person falling into bushes with rustling leaves", ["crumpling a plastic bag", "paper tearing", "water splash", "music"]),
    "바스락": ("leaves and plants rustling", ["crumpling a plastic bag", "rain falling", "paper rustling", "music"]),
    "종이": ("a cardboard card dropped on a table", ["tape being torn", "a book page turning", "a door knock", "music"]),
    "톡": ("a single soft click", ["a page turning", "a bell ringing", "water drop", "music"]),
    "테이프": ("tape being pulled off a roll and stuck down", ["paper tearing", "zipper", "music"]),
    "열차": ("an electric subway train accelerating away", ["a car engine", "an airplane", "music"]),
    "한방": ("a deep cinematic boom impact", ["a door slam", "thunder", "a drum kit", "music"]),
    "상승": ("a reverse cymbal swell", ["wind blowing", "a whoosh", "white noise hiss", "music"]),
    "승강장": ("quiet subway station ambience hum", ["people talking", "rain", "music", "a car engine"]),
    "꽃밭바람": ("gentle wind over a field with birds", ["rain falling", "ocean waves", "people talking", "music"]),
    "털썩": ("a body falling into leafy bushes", ["water splash", "crumpling a plastic bag", "paper tearing", "music"]),
}
ALIAS = {"발소리_승강장": "발소리", "유리_두드림": "유리", "문닫힘_차임": "문닫힘", "열차_출발": "열차", "꽃밭_풀썩": "풀썩", "꽃_바스락": "바스락", "종이_착": "종이",
         # v6: 효과음합성.py가 수식으로 만든 꽃밭 소리
         "합성_몸쿵": "털썩", "합성_몸쿵_끝": "털썩", "합성_잎_착지": "바스락", "합성_잎_솟음": "바스락", "합성_잎_쓰러짐": "바스락", "합성_풀썩": "털썩", "합성_잎쉬익": "바스락"}


def kind_of(name):
    if name in ALIAS:
        return ALIAS[name]
    for a in sorted(ALIAS, key=len, reverse=True):   # 「합성_풀썩a」처럼 뒤에 판 글자가 붙은 이름
        if name.startswith(a):
            return ALIAS[a]
    for k in KINDS:
        if name.startswith(k):
            return k
    return None


def load(p, sr=48000):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    proc = ClapProcessor.from_pretrained(MODEL)
    model = ClapModel.from_pretrained(MODEL).eval()
    only = sys.argv[1:]   # 이름 앞부분을 주면 그 파일만 재고 _CLAP.json에 보탠다
    files = sorted(f for f in os.listdir(DIR) if f.endswith(".wav") and (not only or any(f.startswith(o) for o in only)))
    path = os.path.join(DIR, "_CLAP.json")
    rows = json.load(open(path, encoding="utf-8")) if only and os.path.exists(path) else {}
    for f in files:
        name = f[:-4]
        k = kind_of(name)
        if not k:
            continue
        want, confuse = KINDS[k]
        texts = [want] + confuse
        a = load(os.path.join(DIR, f))
        with torch.no_grad():
            inp = proc(text=texts, audio=[a], sampling_rate=48000, return_tensors="pt", padding=True)
            out = model(**inp)
            p = out.logits_per_audio.softmax(dim=-1)[0].numpy()
        best = int(np.argmax(p))
        rows[name] = {"종류": k, "바라는 몫": round(float(p[0]), 3), "가장 닮은 글": texts[best], "몫": {t: round(float(v), 3) for t, v in zip(texts, p)}}
        print(f"{name:14s} {k:6s} 바라는 몫 {p[0]:.2f} · 가장 닮음 「{texts[best]}」 {p[best]:.2f}", flush=True)
    json.dump(rows, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
