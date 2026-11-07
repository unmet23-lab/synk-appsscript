# 8번 「앱 소개 30초(캐스팅북)」 곡 후보(2026-11-07, Claude) — 허깅페이스 PRO ZeroGPU로 (가) 가사 노래 ACE-Step 1.5 · (나) 연주곡 stable-audio-3를
# 굽고, 재고, Gemini 소리 맹검을 돌린다. 옆집 편 video/xmas-neighbors-20261025/곡후보.py · 소리맹검.py와 video/블프_소리듣기.py를 본떴다.
#   굽기  C:/SYNK-LoRA/tools/demucs/venv/Scripts/python.exe -X utf8 곡후보.py 굽기 [이름…]
#   재기  C:/SYNK-LoRA/tools/mmaudio/venv/Scripts/python.exe -X utf8 곡후보.py 재기 [이름…]   (librosa · faster-whisper가 있는 venv)
#   맹검  C:/SYNK-LoRA/tools/mmaudio/venv/Scripts/python.exe -X utf8 곡후보.py 맹검 <회차 1|2>
# 결과는 git 밖 pulse-portfolio12-20261024/최종/p8/소리/곡후보/ — <이름>.wav · _지시문.json · _재기.json · 맹검/.
# 굽기 · 목소리 떼기 · 받아쓰기는 tools/허깅페이스.py로만 부른다(한도를 넘기기 전에 멈춤 — 돈 안 나감). Git Bash에서는 MSYS_NO_PATHCONV=1(현장노트 허깅페이스).
# ACE-Step 1.5(MIT) Space `/generation_wrapper`는 인자 49개(상태 칸은 빠짐) — 11-07 view_api로 읽은 이름(param_N, param_40 없음) 그대로 이름 인자로 넘긴다.
# 맹검은 gemini-3.6-flash 하나만(무료 키 · 키 값은 찍지 않음). 429면 20초 쉬고 두 번까지, 그래도 막히면 다른 모델로 바꾸지 않고 멈춘다(현장노트 AI_CLI 소리 맹검).
import base64, glob, json, os, random, re, shutil, subprocess, sys, tempfile, time, urllib.error, urllib.request

REPO = "C:/Users/q1212/Documents/SYNK-appsscript"
HF = os.path.join(REPO, "tools", "허깅페이스.py")
OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/p8/소리/곡후보"
DEMUCS_PY = "C:/SYNK-LoRA/tools/demucs/venv/Scripts/python.exe"   # 허깅페이스.py를 부르는 파이썬(huggingface_hub · gradio_client)

# ── 편집 짜임(콘티 확정, 편집 시각) ─────────────────────────────────────
곡시작, 첫강박, 후렴, 숨고름, 고조, 내레이션, 멈춤, 끝 = 4.10, 6.0, 13.1, (19.5, 20.3), 22.4, 26.7, 28.0, 30.0

# ── (가) 가사 노래 — ACE-Step 1.5 ───────────────────────────────────────
# 가사는 유호님 원칙(감성 문구 금지 · 한 낱말 훅 + 그 작품 속 일)으로 쓴 그대로. 구조 꼬리표만 모델 예시 꼴([Verse] · [Chorus] · [Bridge])로.
가사 = """[Verse]
넘기고 또 넘기다
손끝이 멈춘 얼굴

[Chorus]
There you are
가방 위에도 창 너머에도
There you are
골목 끝 가로등에도

[Bridge]
이제 우리 가게에도
There you are"""
# 둘째 묶음은 앞뒤에 구조 꼬리표만 더한다(가사 글은 같다) — 편집 6.0~10.3초의 「허밍 · 노래」 재료와 끝 맺음 한 방을 노린다.
가사_앞뒤 = "[Intro - soft female humming over acoustic guitar]\n\n" + 가사 + "\n\n[Outro - acoustic guitar and glockenspiel, one final strum]"

꼬리표 = ("light acoustic pop, warm breathy young Korean female vocal, acoustic guitar, soft hand claps, glockenspiel, upright bass, "
       "84 BPM, major key, bright and hopeful, intimate indie-pop recording")
문장 = ("A light, bright acoustic indie-pop song at 84 BPM in a major key. Warm fingerpicked and softly strummed acoustic guitar, "
      "soft hand claps on the backbeat, sparkling glockenspiel and a warm upright bass. A warm, breathy young Korean female vocal "
      "sings close to the microphone with clear, gentle diction. Hopeful and cozy, like a quiet afternoon café slowly filling with "
      "warmth. Intimate, natural indie-pop studio recording.")

ACE_SPACE = "ACE-Step/Ace-Step-v1.5"
# 11-07 16:34 첫 시험(가1 · 가2 두 판 한 번, xl-turbo · think · LRC · 57초)이 왕복 274초 뒤 「GPU task aborted」로 실패했다 — 같은 시각 다른 세션의
# ACE 두 번도 같은 실패였고, 셋이 나란히 돌아 장마다 쓴초가 섞였다(세 번 사이 남은 초 2,040 → 1,299, 한 번에 약 240초로 보인다).
# 코디네이터 지시로 (가) 길을 접었다 — 다시 열려면 판 하나 · think 끔 · LRC 끔부터 작게 시험한다. 아래 목록을 비워 굽기가 부르지 않게 둔다.
ACE_JOBS = [
    # (판 이름들, 지시문, 가사, 조, 씨앗(쉼표 = 판마다), LM 지시문 다시쓰기)
    # (["가1", "가2"], 꼬리표, 가사, "D major", "8401,8402", True),      # 데모 기본값 그대로(LM이 지시문을 자기 꼴로 다시 씀)
    # (["가3", "가4"], 문장, 가사_앞뒤, "G major", "8411,8412", False),  # 우리 지시문 그대로 · 앞뒤 구조 꼬리표
]
ACE_초 = 57          # 84 BPM 20마디 = 57.1초(45초 이상)


def ace인자(지시문, 가사글, 조, 씨앗, 다시쓰기, 판수):
    return {
        "selected_model": "acestep-v15-xl-turbo", "generation_mode": "custom", "simple_query_input": "", "simple_vocal_language": "ko",
        "param_4": 지시문, "param_5": 가사글, "param_6": 84, "param_7": 조, "param_8": "4", "param_9": "ko",
        "param_10": 8, "param_11": 7.0, "param_12": False, "param_13": 씨앗, "param_14": None, "param_15": ACE_초, "param_16": 판수,
        "param_17": None, "param_18": "", "param_19": 0.0, "param_20": -1,
        "param_21": "Fill the audio semantic mask based on the given conditions:", "param_22": 1.0, "param_23": "text2music",
        "param_24": False, "param_25": 0.0, "param_26": 1.0, "param_27": 3.0, "param_28": "ode", "param_29": "", "param_30": "flac",
        "param_31": 0.85, "param_32": True, "param_33": 2.0, "param_34": 0, "param_35": 0.9, "param_36": "NO USER INPUT",
        "param_37": True, "param_38": 다시쓰기, "param_39": True, "param_41": False, "param_42": True, "param_43": False,
        "param_44": True,   # Get LRC — 줄마다 시각(「There you are」 자리를 재는 한 근거)
        "param_45": 0.5, "param_46": 8, "param_47": None, "param_48": [], "param_49": False,
    }


# ── (나) 연주곡 — stable-audio-3 medium ─────────────────────────────────
SA_SPACE = "stabilityai/stable-audio-3"
SA_BASE = "Cozy afternoon café, intimate natural studio recording, high quality, instrumental, no vocals, no singing"
# 허밍 자리의 리드 멜로디는 휘파람이나 글로켄슈필로(노래 목소리 · 「there you are」 없음 — 11-07 코디네이터).
SA_JOBS = [
    ("나1", f"Light acoustic indie pop at 84 BPM in D major, bright and hopeful. Warm fingerpicked and strummed acoustic guitar, soft hand claps on beats 2 and 4, "
            f"warm upright bass, and a sparkling glockenspiel playing a simple, catchy lead melody like a sung tune. {SA_BASE}.", 52, 8421),
    ("나2", f"Bright hopeful acoustic pop at 84 BPM in G major. Strummed acoustic guitar, soft hand claps on the backbeat, warm upright bass, and a cheerful whistled "
            f"lead melody, simple and sing-along, with glockenspiel sparkles answering it. It grows a little brighter toward the end and finishes on one final strum. {SA_BASE}.", 52, 8422),
    ("나3", f"Feel-good gentle acoustic pop, 84 BPM, D major. Acoustic guitar picking pattern, light soft hand claps, upright bass, a whistle and a glockenspiel "
            f"playing the same simple lead melody together, a short pause, then a brighter lift and a clean final strum. {SA_BASE}.", 52, 8423),
]


def _부르기(인자들, 메모, 받을곳):
    env = dict(os.environ, MSYS_NO_PATHCONV="1", PYTHONIOENCODING="utf-8", HF_HUB_DISABLE_SYMLINKS_WARNING="1")
    r = subprocess.run([DEMUCS_PY if os.path.exists(DEMUCS_PY) else sys.executable, "-X", "utf8", HF, "부르기", *인자들, "--받을곳", 받을곳, "--메모", 메모, "--json"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace", env=env)
    줄 = [x for x in r.stdout.splitlines() if x.startswith("{")]
    if r.returncode != 0 or not 줄:
        raise RuntimeError(f"부르기 실패(코드 {r.returncode}): {(r.stdout + r.stderr)[-1500:]}")
    return json.loads(줄[-1])


def _wav로(src, dst):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vn", "-c:a", "pcm_s16le", dst], check=True, stdin=subprocess.DEVNULL)


def _기록읽기():
    try:
        return json.load(open(os.path.join(OUT, "_지시문.json"), encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _기록쓰기(줄):
    json.dump(줄, open(os.path.join(OUT, "_지시문.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)


def 굽기(want):
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(os.path.join(OUT, "_원본"), exist_ok=True)
    기록 = {x["이름"]: x for x in _기록읽기()}
    for 이름들, 지시문, 가사글, 조, 씨앗, 다시쓰기 in ACE_JOBS:
        if want and not set(이름들) & set(want):
            continue
        if all(os.path.exists(os.path.join(OUT, n + ".wav")) for n in 이름들):
            print("있음", 이름들)
            continue
        받을곳 = os.path.join(OUT, "_받음", "_".join(이름들))
        인자 = ace인자(지시문, 가사글, 조, 씨앗, 다시쓰기, len(이름들))
        out = _부르기([ACE_SPACE, "--api", "/generation_wrapper", "--이름인자", json.dumps(인자, ensure_ascii=False), "--예상초", "120"],
                     f"8번 캐스팅북 곡 {'·'.join(이름들)}", 받을곳)
        결과 = out["결과"]
        json.dump(out, open(os.path.join(OUT, "_원본", "_".join(이름들) + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        씨앗들 = 씨앗.split(",")
        for i, n in enumerate(이름들):
            src = 결과[i]
            if not src or not os.path.exists(str(src)):
                print("못 받음", n, str(결과[10])[:300])
                continue
            _wav로(src, os.path.join(OUT, n + ".wav"))
            기록[n] = {"이름": n, "길": "가 · ACE-Step 1.5 (acestep-v15-xl-turbo · Space ACE-Step/Ace-Step-v1.5 /generation_wrapper)",
                     "지시문": 지시문, "가사": 가사글, "씨앗": int(씨앗들[i]), "BPM지시": 84, "조": 조, "박자": "4/4", "초": ACE_초,
                     "LM지시문다시쓰기": 다시쓰기, "단계": 8, "shift": 3.0, "한번에": 이름들,
                     "쓴초(한 번 부름 전체)": out.get("쓴초"), "왕복초": out.get("왕복초"),
                     "LRC": 결과[28 + i], "생성정보": 결과[9], "상태": 결과[10], "원본파일": str(src)}
            print("받음", n, f"쓴 {out.get('쓴초')}초 · 왕복 {out.get('왕복초')}초", flush=True)
        _기록쓰기(list(기록.values()))
    for 이름, 지시문, 초, 씨앗 in SA_JOBS:
        if want and 이름 not in want:
            continue
        dst = os.path.join(OUT, 이름 + ".wav")
        if os.path.exists(dst):
            print("있음", 이름)
            continue
        받을곳 = os.path.join(OUT, "_받음", 이름)
        out = _부르기([SA_SPACE, "--api", "/infer", "--인자", json.dumps(["medium", 지시문, 초, 8, 1.0, "pingpong", 씨앗]), "--예상초", "60"],
                     f"8번 캐스팅북 연주곡 {이름}", 받을곳)
        new = sorted(glob.glob(os.path.join(받을곳, "**", "*.wav"), recursive=True))
        if not new:
            print("못 받음", 이름, str(out.get("결과"))[:300])
            continue
        shutil.copyfile(new[0], dst)
        기록[이름] = {"이름": 이름, "길": "나 · stable-audio-3 medium (Space stabilityai/stable-audio-3 /infer)", "지시문": 지시문, "가사": None,
                    "씨앗": 씨앗, "초": 초, "설정": ["medium", "<지시문>", 초, 8, 1.0, "pingpong", 씨앗],
                    "쓴초": out.get("쓴초"), "왕복초": out.get("왕복초"), "원본파일": new[0]}
        print("받음", 이름, f"쓴 {out.get('쓴초')}초 · 왕복 {out.get('왕복초')}초", flush=True)
        _기록쓰기(list(기록.values()))


# ── 재기 ───────────────────────────────────────────────────────────────
TYA = re.compile(r"there\s*you\s*are|데어\s*유\s*아|데얼\s*유|데어유|there you|you are", re.I)


def _lrc줄(lrc):
    줄 = []
    for m in re.finditer(r"\[(\d+):(\d+(?:\.\d+)?)\]([^\n\[]*)", str(lrc or "")):
        줄.append((int(m.group(1)) * 60 + float(m.group(2)), m.group(3).strip()))
    return 줄


def _구간(시각, 켜짐, 이음=0.3, 최소=0.2):
    구간, 시작 = [], None
    for t, on in zip(시각, 켜짐):
        if on and 시작 is None:
            시작 = t
        if not on and 시작 is not None:
            구간.append([시작, t]); 시작 = None
    if 시작 is not None:
        구간.append([시작, 시각[-1]])
    합 = []
    for a, b in 구간:
        if 합 and a - 합[-1][1] < 이음:
            합[-1][1] = b
        else:
            합.append([a, b])
    return [[round(a, 2), round(b, 2)] for a, b in 합 if b - a >= 최소]


def _가까운(값들, x):
    return min(값들, key=lambda v: abs(v - x)) if len(값들) else None


def 재기(want):
    import numpy as np
    import librosa
    기록 = {x["이름"]: x for x in _기록읽기()}
    이름들 = [n for n in 기록 if (not want or n in want) and os.path.exists(os.path.join(OUT, n + ".wav"))]
    떼기폴더 = os.path.join(OUT, "_목소리")
    가목록 = [n for n in 이름들 if n.startswith("가")]
    env = dict(os.environ, MSYS_NO_PATHCONV="1", PYTHONIOENCODING="utf-8", HF_HUB_DISABLE_SYMLINKS_WARNING="1")
    py = DEMUCS_PY if os.path.exists(DEMUCS_PY) else sys.executable
    # 1) (가) 목소리 떼기(허깅페이스 BS-RoFormer 먼저) — 우리가 구운 곡이라 남의 Space에 보내도 된다
    아직 = [os.path.join(OUT, n + ".wav") for n in 가목록 if not os.path.exists(os.path.join(떼기폴더, n + "_목소리.wav"))]
    if 아직:
        r = subprocess.run([py, "-X", "utf8", HF, "목소리떼기", 떼기폴더, *아직, "--남에게보내도됨", "--cpu", "--메모", "8번 곡 후보 목소리"],
                           capture_output=True, text=True, encoding="utf-8", errors="replace", env=env)
        print(r.stdout.strip(), r.stderr.strip()[-600:])
    # 2) (가) 받아쓰기(허깅페이스 whisper-large-v3 먼저 — 글만) — 떼어 낸 목소리로
    받아쓴파일 = os.path.join(OUT, "_받아쓰기.json")
    try:
        받아쓴 = json.load(open(받아쓴파일, encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        받아쓴 = {}
    아직 = [os.path.join(떼기폴더, n + "_목소리.wav") for n in 가목록 if n not in 받아쓴 and os.path.exists(os.path.join(떼기폴더, n + "_목소리.wav"))]
    if 아직:
        r = subprocess.run([py, "-X", "utf8", HF, "받아쓰기", *아직, "--남에게보내도됨", "--언어", "ko", "--json", "--메모", "8번 곡 후보 받아쓰기"],
                           capture_output=True, text=True, encoding="utf-8", errors="replace", env=env)
        줄 = [x for x in r.stdout.splitlines() if x.startswith("{")]
        if 줄:
            for x in json.loads(줄[-1])["결과"]:
                받아쓴[os.path.basename(x["파일"]).replace("_목소리.wav", "")] = {"글": x["글"], "엔진": x["엔진"], "쓴초": x.get("쓴초")}
        else:
            print("받아쓰기 실패", (r.stdout + r.stderr)[-600:])
        json.dump(받아쓴, open(받아쓴파일, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    # 3) (가) 낱말 시각 — 로컬 faster-whisper large-v3-turbo CPU(낮은 우선순위), 언어 자동(영어 훅이 라틴 글자로 남게)
    낱말파일 = os.path.join(OUT, "_낱말시각.json")
    try:
        낱말 = json.load(open(낱말파일, encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        낱말 = {}
    아직 = [n for n in 가목록 if n not in 낱말 and os.path.exists(os.path.join(떼기폴더, n + "_목소리.wav"))]
    if 아직:
        if sys.platform == "win32":
            import ctypes
            ctypes.windll.kernel32.SetPriorityClass(ctypes.windll.kernel32.GetCurrentProcess(), 0x4000)   # BELOW_NORMAL
        from faster_whisper import WhisperModel
        m = WhisperModel("large-v3-turbo", device="cpu", compute_type="int8", cpu_threads=8)
        for n in 아직:
            조각, 정보 = m.transcribe(os.path.join(떼기폴더, n + "_목소리.wav"), language=None, beam_size=5, word_timestamps=True,
                                   vad_filter=False, condition_on_previous_text=False)
            줄 = []
            for s in 조각:
                줄.append({"시작": round(s.start, 2), "끝": round(s.end, 2), "글": s.text.strip(),
                          "낱말": [[round(w.start, 2), round(w.end, 2), w.word.strip()] for w in (s.words or [])]})
            낱말[n] = {"언어": 정보.language, "조각": 줄}
            json.dump(낱말, open(낱말파일, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            print("낱말 시각", n, 정보.language, " / ".join(x["글"] for x in 줄)[:200], flush=True)
    # 4) 박 · 크기 · 목소리 구간 · 추천 자리
    결과 = {}
    for n in 이름들:
        y, sr = librosa.load(os.path.join(OUT, n + ".wav"), sr=22050, mono=True)
        길이 = len(y) / sr
        tempo, beats = librosa.beat.beat_track(y=y, sr=sr, start_bpm=84, units="time")
        tempo = float(np.atleast_1d(tempo)[0])
        beats = [float(b) for b in beats]
        간격 = float(np.median(np.diff(beats))) if len(beats) > 2 else None
        # 강박(마디 첫 박) 추정 — 박마다 화음(크로마) 바뀜 + 낮은 소리 치기를 네 자리(mod 4)로 모아 가장 센 자리
        hop = 512
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop)
        bf = librosa.time_to_frames(beats, sr=sr, hop_length=hop)
        bs = librosa.util.sync(chroma, bf, aggregate=np.median)   # 칸 i+1 = 박 i에서 시작하는 덩이(앞뒤 덧댐)
        바뀜 = np.linalg.norm(np.diff(bs, axis=1), axis=0)[: len(beats)]   # 박 i 앞 덩이 → 뒤 덩이 화음 바뀜
        S = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop))
        낮은 = librosa.onset.onset_strength(S=librosa.amplitude_to_db(S[: int(200 / (sr / 2048)) + 1]), sr=sr, hop_length=hop)
        치기 = np.array([낮은[min(f, len(낮은) - 1)] for f in bf]) if len(bf) else np.array([])
        점수 = []
        for k in range(4):
            idx = list(range(k, len(beats), 4))
            if len(idx) < 3:
                점수.append(0.0); continue
            점수.append(float(np.mean(바뀜[idx]) / (np.mean(바뀜) + 1e-9) + np.mean(치기[idx]) / (np.mean(치기) + 1e-9)))
        자리 = int(np.argmax(점수)) if 점수 else 0
        강박 = [beats[i] for i in range(자리, len(beats), 4)]
        확신 = round(sorted(점수)[-1] / (sorted(점수)[-2] + 1e-9), 2) if len(점수) == 4 else None
        # 0.5초 RMS(dBFS, 원래 표본율로)
        y2, sr2 = librosa.load(os.path.join(OUT, n + ".wav"), sr=None, mono=True)
        w = int(sr2 * 0.5)
        rms = [round(float(20 * np.log10(np.sqrt(np.mean(y2[i:i + w] ** 2)) + 1e-9)), 1) for i in range(0, len(y2) - w // 2, w)]
        ibi = np.diff(beats) if len(beats) > 2 else np.array([0.0])
        y2s, _ = librosa.load(os.path.join(OUT, n + ".wav"), sr=None, mono=False)
        봉우리 = float(20 * np.log10(np.max(np.abs(y2s)) + 1e-9))
        클립 = int(np.sum(np.abs(y2s) >= 0.999))
        급변 = [[round(i * 0.5, 1), round(rms[i] - rms[i - 1], 1)] for i in range(2, len(rms) - 4) if abs(rms[i] - rms[i - 1]) >= 9]   # 처음 · 끝 2초 밖에서 0.5초 사이 9dB 넘게 뛴 곳
        줄 = {"길이초": round(길이, 2), "BPM": round(tempo, 1), "박간격초": round(간격, 3) if 간격 else None,
             "박간격흔들림초": round(float(np.std(ibi)), 3), "박30": [round(b, 2) for b in beats[:30]], "강박추정": [round(b, 2) for b in 강박[:10]],
             "강박확신": 확신, "RMS0.5초": rms, "최대dB": max(rms), "끝3초dB": rms[-6:], "표본봉우리dBFS": round(봉우리, 2), "클립표본": 클립, "급변": 급변}
        # (가) 목소리 구간 · 「There you are」 시각
        if n.startswith("가") and os.path.exists(os.path.join(떼기폴더, n + "_목소리.wav")):
            v, svr = librosa.load(os.path.join(떼기폴더, n + "_목소리.wav"), sr=22050, mono=True)
            hv = int(svr * 0.05)
            vr = librosa.feature.rms(y=v, frame_length=hv * 2, hop_length=hv)[0]
            vdb = 20 * np.log10(vr + 1e-9)
            t = librosa.frames_to_time(np.arange(len(vdb)), sr=svr, hop_length=hv)
            문턱 = max(float(np.max(vdb)) - 24, -48)
            줄["목소리구간"] = _구간(list(t), list(vdb > 문턱))
            줄["목소리문턱dB"] = round(문턱, 1)
            lrc = _lrc줄(기록[n].get("LRC"))
            줄["LRC"] = [[round(a, 2), b] for a, b in lrc]
            # 첫 「There you are」: 낱말 시각(위스퍼) → 없으면 LRC 줄 → 그 둘레 목소리 시작으로 다듬는다
            후보 = []
            for 조각 in (낱말.get(n) or {}).get("조각", []):
                ws = 조각["낱말"]
                for i in range(len(ws)):
                    셋 = " ".join(x[2] for x in ws[i:i + 3])
                    if TYA.search(셋) and re.search(r"there|데", ws[i][2], re.I):
                        후보.append(("위스퍼 낱말", ws[i][0])); break
            lrc_tya = [a for a, b in lrc if re.search(r"there\s*you\s*are", b, re.I)]
            if lrc_tya:
                후보.append(("LRC", lrc_tya[0]))
            시작들 = [a for a, b in 줄["목소리구간"]]
            tya = None
            if 후보:
                근거, 시각 = 후보[0]
                if 근거 == "LRC" and len(후보) == 1 and 시작들:   # LRC 줄 시각은 목소리 시작보다 어긋날 수 있다 — 0.6초 안 목소리 시작으로 다듬음
                    가까이 = _가까운(시작들, 시각)
                    if abs(가까이 - 시각) <= 0.6:
                        시각, 근거 = 가까이, "LRC + 목소리 시작"
                tya = (근거, round(시각, 2))
            줄["TYA근거들"] = 후보
            줄["TYA"] = tya
            줄["받아쓰기"] = (받아쓴.get(n) or {}).get("글")
            줄["위스퍼낱말글"] = " / ".join(x["글"] for x in (낱말.get(n) or {}).get("조각", []))
        # 추천 자리 — 곡의 몇 초를 편집 4.10초에 놓나(오프셋 S: 편집 시각 = 곡 시각 − S + 4.10)
        추천 = {}
        if n.startswith("가") and 줄.get("TYA"):
            T = 줄["TYA"][1]
            Sa = T - (후렴 - 곡시작)                     # 「There you are」를 13.1초에
            b = _가까운(beats, Sa + (첫강박 - 곡시작))
            추천["후렴맞춤"] = {"S": round(Sa, 2), "6.0초 가까운 박 어긋남": round(b - (Sa + 1.9), 2) if b is not None else None,
                            "그 박이 강박인가": bool(강박 and min(abs(b - x) for x in 강박) < 0.05) if b is not None else None}
            b2 = _가까운([x for x in beats if x - 1.9 >= 0], T - (후렴 - 첫강박))   # 박을 6.0초에
            if b2 is not None:
                Sb = b2 - 1.9
                추천["박맞춤"] = {"S": round(Sb, 2), "There you are 어긋남": round((T - Sb + 곡시작) - 후렴, 2),
                              "그 박이 강박인가": bool(강박 and min(abs(b2 - x) for x in 강박) < 0.05)}
            # 고른 자리(후렴맞춤이 박 반 개 안이면 그대로, 아니면 박맞춤)에서 내레이션 26.7초 뒤 목소리가 있나 · 노래 시작이 몇 초에 오나
            고름 = "후렴맞춤" if Sa >= 0 and abs(추천["후렴맞춤"]["6.0초 가까운 박 어긋남"] or 9) <= 0.12 else "박맞춤"
            if 추천.get(고름) and 추천[고름]["S"] < 0:
                고름 = "박맞춤" if 추천.get("박맞춤") and 추천["박맞춤"]["S"] >= 0 else 고름
            Sx = 추천[고름]["S"]
            뒤 = [[round(a - Sx + 곡시작, 2), round(b_ - Sx + 곡시작, 2)] for a, b_ in 줄.get("목소리구간", []) if b_ - Sx + 곡시작 > 내레이션 and a - Sx + 곡시작 < 끝]
            앞 = [round(a - Sx + 곡시작, 2) for a, b_ in 줄.get("목소리구간", []) if a - Sx + 곡시작 >= 곡시작]
            추천["고른 자리"] = 고름
            추천["그 자리 첫 목소리(편집 초)"] = 앞[0] if 앞 else None
            추천["그 자리 26.7초 뒤 목소리(편집 초)"] = 뒤
            추천["그 자리 4.10초에 목소리가 이미 나오나"] = any(a - Sx < 0 < b_ - Sx for a, b_ in 줄.get("목소리구간", []))
        elif beats:
            # 연주곡 — 곡 처음(0초)부터 쓰면 첫 강박이 편집 몇 초에 오나, 그리고 강박을 6.0초에 두는 가장 이른 자리
            첫 = next((x for x in 강박 if x >= 0.05), None)
            추천["처음부터"] = {"S": 0.0, "첫 강박 편집 초": round(첫 + 곡시작, 2) if 첫 is not None else None,
                            "6.0초와 어긋남": round(첫 + 곡시작 - 첫강박, 2) if 첫 is not None else None}
            다음 = next((x for x in 강박 if x - 1.9 >= 0), None)
            if 다음 is not None:
                추천["강박맞춤"] = {"S": round(다음 - 1.9, 2), "어긋남": 0.0}
            고름 = "처음부터" if 첫 is not None and abs(첫 + 곡시작 - 첫강박) <= 0.12 else ("강박맞춤" if 다음 is not None else "처음부터")
            Sx = 추천[고름]["S"]
            추천["고른 자리"] = 고름
            # 그 자리에서 편집 짜임 칸마다 평균 크기(dB) — 숨 고름 · 고조 · 멈춤은 편집에서 크기로 건다(이 모델은 시간 지시를 따르지 않는다)
            def 칸(a, b):
                i0, i1 = int(max(0, (a - 곡시작 + Sx)) / 0.5), int(max(0, (b - 곡시작 + Sx)) / 0.5)
                조각 = rms[i0:max(i1, i0 + 1)]
                return round(float(10 * np.log10(np.mean(10 ** (np.array(조각) / 10)))), 1) if 조각 else None
            추천["편집 칸 크기dB"] = {"4.1-6.0": 칸(4.1, 6.0), "6.0-13.1": 칸(6.0, 13.1), "13.1-19.5": 칸(13.1, 19.5), "19.5-20.3": 칸(19.5, 20.3),
                                 "20.3-22.4": 칸(20.3, 22.4), "22.4-26.7": 칸(22.4, 26.7), "26.7-28.0": 칸(26.7, 28.0), "28.0-30.0": 칸(28.0, 30.0)}
            추천["편집 30초까지 곡이 되나"] = bool(Sx + (끝 - 곡시작) <= 길이)
            # 강박 격자: 편집 6.0초에 맞춘 뒤 원본 박(6.02 + 0.72k)과 13.1 · 22.4 · 28.0 둘레에서 얼마나 벌어지나
            if 간격:
                추천["원본 박 격자와 벌어짐(22.4초 둘레)"] = round((22.4 - 6.02) / 0.72 * (간격 - 0.72), 3)
        줄["추천"] = 추천
        결과[n] = 줄
        print(n, json.dumps({k: 줄[k] for k in 줄 if k not in ("RMS0.5초", "박30", "LRC")}, ensure_ascii=False)[:1500], flush=True)
    json.dump(결과, open(os.path.join(OUT, "_재기.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)


# ── 맹검(Gemini가 소리를 직접 듣는다) ───────────────────────────────────
맹검질문 = """너는 광고 음악 감독이다. 아래 소리 {n}개는 같은 30초 앱 광고의 배경 음악 후보이고, 각 후보의 앞 30초 안팎이다. 모두 노래 없는 연주곡이어야 한다.
광고: 손님 없는 오후, 동네 카페 사장이 폰 앱에서 모델 사진을 넘기다 한 모델의 얼굴에서 눈이 멈추고, 그 얼굴이 쇼핑백 · 옆 가게 포스터 · 냉장고 스티커 · 가로등 배너에도 있다는 걸 알아챈다. 그 모델로 신메뉴 광고를 만들자 가게가 따뜻해지고 손님이 온다. 가벼운 어쿠스틱 팝 결이 원래 자리다.

후보마다 소리를 끝까지 듣고 아래를 답하라. 칭찬으로 채우지 말고 들린 것만, 시각은 그 소리의 처음부터 초로.
① 진짜 사람이 연주 · 녹음한 곡처럼 들리나 1~10(높을수록 진짜 같음) · AI가 만든 티가 나는 곳(초와 무엇)
② 사람 목소리(노래 · 허밍 · 말소리 · 가사 같은 소리)가 섞였나 — 있으면 초와 무엇, 없으면 「없음」. 리드 멜로디는 무슨 악기로 들리나
③ 위 광고에 맞나 1~10 · 까닭 한 줄
④ 깨짐 · 지지직 · 박 튐 · 갑자기 끊김(초와 무엇, 없으면 「없음」)

마지막에 이 광고에 쓸 순서(가장 좋은 것부터)를 한 줄로.
답은 아래 JSON 하나만(설명 글 없이):
{{"후보": [{{"이름": "A", "진짜같음": 0, "AI티": "", "목소리": "", "리드악기": "", "광고맞음": 0, "까닭": "", "깨짐": ""}}], "순서": ["A"]}}"""


def _mp3(src, dst, 초=30.0):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-t", str(초), "-af", f"afade=t=out:st={초 - 0.6}:d=0.6", "-ac", "2", "-ar", "44100",
                    "-b:a", "192k", dst], check=True, stdin=subprocess.DEVNULL)


def 맹검(회차):
    기록 = {x["이름"]: x for x in _기록읽기()}
    이름들 = sorted(n for n in 기록 if os.path.exists(os.path.join(OUT, n + ".wav")))
    차례 = 이름들[:]
    random.Random(1107 + 회차).shuffle(차례)
    글자 = [chr(ord("A") + i) for i in range(len(차례))]
    폴더 = os.path.join(OUT, "맹검")
    os.makedirs(폴더, exist_ok=True)
    짝 = dict(zip(글자, 차례))
    json.dump(짝, open(os.path.join(폴더, f"회차{회차}_짝.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    임시 = tempfile.mkdtemp(prefix="맹검_")
    parts = [{"text": 맹검질문.format(n=len(차례))}]
    for g, n in 짝.items():
        p = os.path.join(임시, g + ".mp3")
        _mp3(os.path.join(OUT, n + ".wav"), p)
        parts.append({"text": f"소리 {g}:"})
        parts.append({"inlineData": {"mimeType": "audio/mp3", "data": base64.b64encode(open(p, "rb").read()).decode()}})
    key = open(os.path.join(os.path.expanduser("~"), "SYNK_보안", "제미나이_무료.txt"), encoding="utf-8").read().strip().split()[-1]
    model = "gemini-3.6-flash"
    body = {"contents": [{"role": "user", "parts": parts}], "generationConfig": {"responseMimeType": "application/json"}}
    t0 = time.time()
    j = None
    for 시도 in range(3):
        req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent", method="POST",
                                     data=json.dumps(body).encode(), headers={"x-goog-api-key": key, "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=900) as r:
                j = json.loads(r.read())
        except urllib.error.HTTPError as e:
            msg = e.read()[:400].decode("utf-8", "replace")
            print(f"HTTP {e.code} {msg}", flush=True)
            if e.code in (429, 500, 503) and 시도 < 2:
                time.sleep(20)
                continue
            open(os.path.join(폴더, f"회차{회차}_막힘.txt"), "w", encoding="utf-8").write(f"{model} HTTP {e.code}\n{msg}\n")
            sys.exit(2)
        text = "".join(p.get("text", "") for c in j.get("candidates", []) for p in c.get("content", {}).get("parts", []))
        if text.strip():
            break
        print("빈 답", [c.get("finishReason") for c in j.get("candidates", [])], flush=True)
        j = None
    if not j:
        sys.exit(2)
    out = f"[{model} · {time.time() - t0:.0f}초 · 소리 {len(차례)}개 · 토큰 {j.get('usageMetadata', {}).get('totalTokenCount')}]\n" + text
    open(os.path.join(폴더, f"회차{회차}_답.txt"), "w", encoding="utf-8").write(out)
    print(out)


if __name__ == "__main__":
    for s in (sys.stdout, sys.stderr):
        try:
            s.reconfigure(encoding="utf-8")
        except AttributeError:
            pass
    명령, *나머지 = sys.argv[1:] or ["굽기"]
    if 명령 == "굽기":
        굽기(나머지)
    elif 명령 == "재기":
        재기(나머지)
    elif 명령 == "맹검":
        맹검(int(나머지[0]) if 나머지 else 1)
    else:
        sys.exit(f"모르는 명령: {명령} (굽기 · 재기 · 맹검)")
