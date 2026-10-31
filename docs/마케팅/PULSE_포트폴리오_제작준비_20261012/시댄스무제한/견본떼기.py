# 배역 목소리 판 → 견본(2026-10-29) — 시댄스가 견본 없이 처음 낸 목소리를 떼어, 그 배역이 말하는 대사 판마다 넣을 소리 참고를 만든다.
#   python -X utf8 견본떼기.py [<목소리 판 id…>] [--demucs]
#     매진 임박 hs-목소리-<배역> → synk-vendor/homeshopping-horror-20261021/목소리/시댄스견본/<jiyu · ri4 · tong2 · gangdo>.mp3
#     7번      p7-목소리-<배역> → synk-vendor/pulse-portfolio12-20261024/소리/p7/소리참고/B/<ian · seojin · minjae · soyeon>.mp3
#     오미톡   om2-2(10-31 — 한결이 직접 말하는 판, 헐떡임이 섞이니 --demucs) → 웹꾸러미.py의 VOICE_FROM 자리(om2-끝말 판 견본)
# 받기.py가 받은 받음/<판>.mp4(다시 낸 판이 있으면 가장 나중 것)에서 소리를 꺼내 앞뒤 무음을 자르고 −17 LUFS로 둔다. --demucs면 먼저 Demucs로
# 목소리만 뗀다(C:/SYNK-LoRA/tools/demucs — 현장노트 영상 「대사 클립의 목소리만 떼기」, CPU로 11초 클립에 41초). 받아쓰기(faster-whisper medium, VAD 끔)로 그 판에 적은
# 글을 말했는지 보고 다르면 알린다 — 다른 사람 말 · 음악이 섞인 견본은 쓰지 않는다. 다 떼면 웹꾸러미.py(둘째 날은 --둘째날 B)를 다시 돌려 대사 판 폴더를 채운다.
# 견본 목소리가 어색하면(유호님 귀) 그 배역 목소리 판을 다시 내거나 대안 일레븐 v4로 간다(결정 10-29 — 7번은 고른 넷을 구워 둠,
# 소리참고.py B <대안 폴더> <배역>). 견본이 받은 판보다 새것이면(이미 뗐거나 대안으로 바꾼 배역) 판 id를 적지 않는 한 덮지 않는다.
import importlib.util, json, os, re, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("web", os.path.join(HERE, "웹꾸러미.py"))
W = importlib.util.module_from_spec(spec)
spec.loader.exec_module(W)
GOT = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028/받음"
DEMUCS = "C:/SYNK-LoRA/tools/demucs"


def targets():
    out = {}
    for role, _, _, _, text in W.HS_CASTING:
        out[f"hs-목소리-{role}"] = (os.path.join(W.SEED_SAMPLES, W.SAMPLE_FILE[role]), text)
    for role, _, _, _, text in W.P7_CASTING:
        out[f"p7-목소리-{role}"] = (os.path.join(W.P7_SOUND, "B", role + ".mp3"), text)
    for pid, (dst, text) in W.VOICE_FROM.items():   # 다른 편의 「소리 켬」 판(오미톡 om2-2 — 헐떡임이 섞이니 --demucs로)
        out[pid] = (dst, text)
    return out


def norm(s):
    return re.sub(r"[^가-힣0-9]", "", s)


def cer(ref, hyp):
    a, b = norm(ref), norm(hyp)
    d = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        p, d[0] = d[0], i
        for j in range(1, len(b) + 1):
            p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] != b[j - 1]))
    return d[len(b)] / max(1, len(a))


def latest(pid):
    led = json.load(open(os.path.join(GOT, "_받음.json"), encoding="utf-8")) if os.path.exists(os.path.join(GOT, "_받음.json")) else {}
    got = sorted((v for v in led.values() if v["판"] == pid), key=lambda v: v["만든때"])
    return os.path.join(GOT, got[-1]["파일"]) if got else None


def extract(clip, dst, text, model, demucs=False):
    tmp = tempfile.mkdtemp(prefix="견본_")
    try:
        wav = os.path.join(tmp, "소리.wav")
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", clip, "-vn", "-ac", "2", "-ar", "44100", wav], check=True)
        if demucs:
            # CPU로 — 노트북 GPU는 공용 차례(synk-vendor/_공용차례, 10-29 밤)로만 쓰고, 몇 초짜리 견본은 CPU로도 수십 초다
            subprocess.run([os.path.join(DEMUCS, "venv", "Scripts", "python.exe"), "-X", "utf8", os.path.join(DEMUCS, "목소리떼기.py"), tmp, wav], check=True)
            wav = os.path.join(tmp, "소리_목소리.wav")
        segs, _ = model.transcribe(wav, language="ko", vad_filter=False, beam_size=5)
        heard = " ".join(s.text.strip() for s in segs).strip()
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        # 앞뒤 무음 자르기(−45 dB) → −17 LUFS · 봉우리 −1.5 dB
        af = ("silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,"
              "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.15,areverse,loudnorm=I=-17:TP=-1.5:LRA=11")
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", wav, "-ac", "1", "-ar", "48000", "-af", af, "-c:a", "libmp3lame", "-b:a", "192k", dst], check=True)
        dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", dst],
                                   capture_output=True, text=True).stdout.strip() or 0)
        return heard, cer(text, heard), dur
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    want = [a for a in sys.argv[1:] if not a.startswith("--")]
    from faster_whisper import WhisperModel
    model = WhisperModel("medium", device="cpu", compute_type="int8")
    for pid, (dst, text) in targets().items():
        if want and pid not in want:
            continue
        clip = latest(pid)
        if not clip:
            print(f"{pid}: 받은 판 없음")
            continue
        if not want and os.path.exists(dst) and os.path.getmtime(dst) > os.path.getmtime(clip):
            print(f"{pid}: 견본이 받은 판보다 새것이라 그대로 둠(다시 떼려면 판 id를 적는다)")
            continue
        heard, err, dur = extract(clip, dst, text, model, "--demucs" in sys.argv)
        flag = "" if err <= 0.15 else "  ⚠ 적은 글과 다르게 들림 — 다른 말 · 소리가 섞였는지 들어 보고, 섞였으면 그 목소리 판을 다시 낸다"
        print(f"{pid}: {os.path.basename(clip)} → {dst} · {dur:.1f}초 · 받아쓰기 오류율 {err:.2f} 「{heard}」{flag}")


if __name__ == "__main__":
    main()
