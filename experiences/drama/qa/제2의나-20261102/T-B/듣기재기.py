# 「제2의 나」 T-B 듣기 · 재기(2026-11-02) — 크기를 맞춘 이름 부름 20줄을 로컬 받아쓰기 둘로 받아 적고, 길이 · 쉼 자리 · 이름 빠르기 · 음높이를 재서
# 「어색할 만한 줄」에 의심 표시를 단다. 귀로 듣기를 대신하지 않는다 — 들어 볼 줄을 고르는 데만 쓴다.
#   py -3 -I 듣기재기.py [작업 폴더(기본 .tmp/me2-20261102/T-B)]   → <작업>/재기.json, 줄마다 한 줄 요약
# - 받아쓰기: faster-whisper large-v3-turbo(주) · medium(다른 귀), CPU int8(현장노트 영상 「cublas64_12.dll」), 언어 ko, 이름 힌트(initial_prompt) 없음.
#   OpenAI gpt-transcribe(드라마 받아 적기 길)는 11-02 두 키 모두 월 크레딧 바닥(429)이라 이 판에는 로컬만 쓴다(굽기.mjs 받아쓰기).
# - 쉼: silencedetect −35dB · 0.12초. 앞뒤 무음은 빼고 말 사이 쉼만 센다.
# - 이름 끝: turbo 낱말 시각에서 대본의 「이름+아/야」 · 「이름 씨」 마지막 글자가 든 낱말의 끝(낱말 「끝」은 맞는 편 — 현장노트 영상).
# - 음높이: YIN(10ms), 이어진 세 프레임이 2반음 안에서 고른 값만(옥타브 잘못 읽기 거르기, tools/목소리엉킴.py top_pitch와 같은 셈).
# - 기준: 1화 승인 녹음(experiences/drama/s1/소리/ep01-senior-* · ep01-professor-*)을 같은 셈으로 잰 음절 빠르기 · 음높이 폭.
import difflib, json, os, re, subprocess, sys
from pathlib import Path

os.environ.setdefault('HF_HUB_OFFLINE', '1')  # 모델 캐시 확인이 인터넷에서 멈추지 않게(현장노트 영상 「faster-whisper가 좁은 창에서…」)
import numpy as np
from faster_whisper import WhisperModel

뿌리 = Path(__file__).resolve().parents[5]
작업 = Path(sys.argv[1]) if len(sys.argv) > 1 else 뿌리 / '.tmp/me2-20261102/T-B'
기록 = json.loads((작업 / '기록.json').read_text(encoding='utf-8'))
승인폴더 = 뿌리 / 'experiences/drama/s1/소리'
SR = 16000


def 정규(s):
    return re.sub(r'[^가-힣A-Za-z0-9]', '', s or '')


def 음절수(s):
    return len(re.findall(r'[가-힣]', s))


def 소리(path):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True)
    return np.frombuffer(r.stdout, dtype=np.float32).astype(np.float64)


def 쉼들(path, 문턱='-35dB', 최소=0.12):
    err = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(path), '-af', f'silencedetect=noise={문턱}:d={최소}', '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8').stderr
    시작 = [float(x) for x in re.findall(r'silence_start: (-?[\d.]+)', err)]
    끝 = [float(x) for x in re.findall(r'silence_end: (-?[\d.]+)', err)]
    길이 = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)], capture_output=True, text=True).stdout)
    짝 = []
    for i, s in enumerate(시작):
        e = 끝[i] if i < len(끝) else 길이
        짝.append((max(0.0, s), e))
    # 말 시작 · 끝 = 첫 쉼이 0에서 시작하면 그 끝, 마지막 쉼이 파일 끝까지면 그 시작
    말시작 = 짝[0][1] if 짝 and 짝[0][0] <= 0.02 else 0.0
    말끝 = 짝[-1][0] if 짝 and 짝[-1][1] >= 길이 - 0.02 else 길이
    안쪽 = [(round(s, 2), round(e, 2)) for s, e in 짝 if s > 말시작 + 0.01 and e < 말끝 - 0.01]
    return 말시작, 말끝, 안쪽, 길이


def 음높이(x, fmin=70, fmax=500, w=640, hop=160, th=0.12):
    """[(초, Hz 또는 None)] — 이어진 세 프레임이 2반음 안인 값만 남긴다."""
    tmin, tmax = SR // fmax, SR // fmin
    pk = np.abs(x).max() + 1e-9
    tr = []
    for i in range(0, len(x) - w - tmax - 2, hop):
        f = x[i:i + w]
        if np.sqrt((f ** 2).mean()) < pk * 0.08:
            tr.append(None); continue
        d = np.array([np.sum((f - x[i + t:i + t + w]) ** 2) for t in range(tmax + 2)])
        dn = np.r_[1, d[1:] * np.arange(1, len(d)) / (np.cumsum(d[1:]) + 1e-12)]
        c = np.where(dn[tmin:tmax] < th)[0]
        if len(c) == 0:
            tr.append(None); continue
        t = tmin + c[0]
        while t + 1 < tmax and dn[t + 1] < dn[t]:
            t += 1
        a, b, cc = dn[t - 1], dn[t], dn[t + 1]
        tr.append(SR / (t + 0.5 * (a - cc) / (a - 2 * b + cc + 1e-12)))
    고른 = [None] * len(tr)
    for k in range(1, len(tr) - 1):
        trio = tr[k - 1:k + 2]
        if None in trio or max(trio) / min(trio) > 2 ** (2 / 12):
            continue
        고른[k] = tr[k]
    return [((k * hop + w / 2) / SR, v) for k, v in enumerate(고른)]


def 반음(a, b):
    return 12 * np.log2(a / b)


def 음높이요약(track, 구간=None):
    v = [(t, f) for t, f in track if f and (구간 is None or 구간[0] <= t <= 구간[1])]
    if not v:
        return None
    hz = np.array([f for _, f in v])
    # 이웃 10ms 프레임 사이 가장 큰 뜀(반음) — 둘 다 고른 값이고 구간 안일 때만
    뜀 = 0.0
    for (t1, f1), (t2, f2) in zip(track, track[1:]):
        if f1 and f2 and (구간 is None or (구간[0] <= t1 and t2 <= 구간[1])):
            뜀 = max(뜀, abs(반음(f2, f1)))
    return {'중앙Hz': round(float(np.median(hz)), 1), '최고Hz': round(float(hz.max()), 1), '최저Hz': round(float(hz.min()), 1),
            '폭반음': round(float(반음(hz.max(), hz.min())), 1), '최대뜀반음': round(뜀, 1),
            '폭p10p90반음': round(float(반음(np.percentile(hz, 90), np.percentile(hz, 10))), 1), 'p10Hz': round(float(np.percentile(hz, 10)), 1), 'p90Hz': round(float(np.percentile(hz, 90)), 1)}  # 끝 한두 프레임에 끌리지 않는 폭




# 이름 끝 찾기 — 받아 적은 낱말을 글자로 펴서 대본과 맞추고, 대본 이름 부분 마지막 글자에 맞은 낱말의 끝
def 이름끝(words, 말, 이름부분):
    hyp, owner = '', []
    for i, w in enumerate(words):
        t = 정규(w.word)
        hyp += t; owner += [i] * len(t)
    ref = 정규(말)
    n = len(정규(이름부분))
    r2h = {}
    for a, b, k in difflib.SequenceMatcher(None, ref, hyp, autojunk=False).get_matching_blocks():
        for j in range(k):
            r2h[a + j] = b + j
    for r in range(n - 1, -1, -1):
        if r in r2h:
            return words[owner[r2h[r]]].end, r + 1  # (끝 시각, 맞은 글자 수)
    return None, 0


_모델 = {}


def _읽기(이름):
    if 이름 not in _모델:
        print(f'[재기] 모델 읽는 중({이름}, CPU int8)', flush=True)
        _모델[이름] = WhisperModel(이름, device='cpu', compute_type='int8')
    return _모델[이름]


def 주귀():
    return _읽기('large-v3-turbo')


def 다른귀():
    return _읽기('medium')


def 받아(model, path, 낱말=False):
    segs, _ = model.transcribe(str(path), language='ko', beam_size=5, word_timestamps=낱말, vad_filter=False, condition_on_previous_text=False)
    segs = list(segs)
    글 = ' '.join(s.text.strip() for s in segs).strip()
    words = [w for s in segs for w in (s.words or [])] if 낱말 else []
    return 글, words


# ── 승인 녹음 기준(음절 빠르기 · 음높이 폭) ──
기준 = {}
for 역, 머리 in (('선배', 'ep01-senior'), ('교수', 'ep01-professor')):
    meta = json.loads((승인폴더 / f'{머리}.json').read_text(encoding='utf-8'))
    빠르기, 폭, 중앙, 짧은폭 = [], [], [], []
    for l in meta['줄']:
        p = 승인폴더 / l['파일']
        h = 음높이요약(음높이(소리(p)))
        글 = l['말'].replace('3학년', '삼학년')
        if h and 음절수(글) <= 12:
            짧은폭.append(h['폭반음'])  # 되묻기까지 — 이름 부름과 길이가 비슷한 짧은 줄
        if l.get('되묻기'):
            continue
        s, e, 안쪽, _ = 쉼들(p)
        말초 = e - s - sum(b - a for a, b in 안쪽)
        빠르기.append(음절수(글) / 말초)
        if h:
            폭.append(h['폭반음']); 중앙.append(h['중앙Hz'])
    기준[역] = {'음절초_평균': round(float(np.mean(빠르기)), 2), '음절초_범위': [round(min(빠르기), 2), round(max(빠르기), 2)],
              '음높이폭_평균': round(float(np.mean(폭)), 1), '짧은줄음높이폭': [round(x, 1) for x in 짧은폭], '중앙Hz_평균': round(float(np.mean(중앙)), 1), '줄수': len(빠르기)}
    print(f"[재기] 기준 {머리}: 음절/초 {기준[역]['음절초_평균']} {기준[역]['음절초_범위']} · 음높이 폭 {기준[역]['음높이폭_평균']}반음(짧은 줄 {기준[역]['짧은줄음높이폭']}) · 중앙 {기준[역]['중앙Hz_평균']}Hz", flush=True)

옛 = json.loads((작업 / '재기.json').read_text(encoding='utf-8')) if (작업 / '재기.json').exists() else {}
결과 = {'기준': 기준}
for 열쇠, r in 기록['줄'].items():
    if not r.get('맞춘'):
        continue
    p = 작업 / r['맞춘']
    말, 역, 이름 = r['말'], r['역'], r['이름']
    이름부분 = re.split(r'[,!]', 말)[0]  # 「바트에르덴아」 · 「바트에르덴 씨」 · 「마이」(2판 「마이! 여기야!」)
    if 옛.get(열쇠, {}).get('글') is not None and 옛[열쇠].get('낱말') is not None:
        # 받아쓰기는 한 번만(같은 파일 · 같은 설정) — 이미 받아 적은 줄은 재기만 다시 한다
        글, 글2 = 옛[열쇠]['글'], 옛[열쇠]['글2']
        words = [type('낱말', (), {'word': w[0], 'start': w[1], 'end': w[2]}) for w in 옛[열쇠]['낱말']]
    else:
        글, words = 받아(주귀(), p, 낱말=True)
        글2, _ = 받아(다른귀(), p)
    s, e, 안쪽, 길이 = 쉼들(p)
    track = 음높이(소리(p))
    # 이름 끝 — 대본 쉼표 자리의 쉼(말 길이의 25~85% 안에서 처음 나오는 안쪽 쉼)의 시작.
    # 받아쓰기 낱말 끝은 말끝을 일찍 잡아(현장노트 영상 「받아쓰기 낱말 끝이 … 0.4초쯤 일찍」) 쉼이 없을 때만 쓴다.
    쉼표 = next(((a, c) for a, c in 안쪽 if s + 0.25 * (e - s) <= a <= s + 0.85 * (e - s)), None)
    if 쉼표:
        끝, 끝근거 = 쉼표[0], '쉼표 자리 쉼'
    else:
        끝, 맞은글자 = 이름끝(words, 말, 이름부분)
        끝근거 = '받아쓰기 낱말 끝'
        if 끝 is None or 맞은글자 < max(2, len(정규(이름부분)) // 2):
            끝, 끝근거 = s + (e - s) * 음절수(이름부분) / 음절수(말), '음절 비례 어림'
    끝 = float(min(max(끝, s + 0.1), e))
    이름쉼 = [(a, c) for a, c in 안쪽 if s + 0.05 < a < 끝 - 0.02]  # 이름을 말하는 도중 쉼
    이름초 = 끝 - s - sum(c - a for a, c in 이름쉼)
    뒤시작 = 쉼표[1] if 쉼표 else 끝
    뒷말 = 말[len(이름부분):]
    뒤쉼 = sum(b - a for a, b in 안쪽 if a >= 뒤시작)
    뒤초 = max(0.05, e - 뒤시작 - 뒤쉼)
    이름빠르기 = 음절수(이름부분) / max(0.05, 이름초)
    뒤빠르기 = 음절수(뒷말) / 뒤초
    말초 = e - s - sum(b - a for a, b in 안쪽)
    전체빠르기 = 음절수(말) / 말초
    전체음 = 음높이요약(track)
    이름음 = 음높이요약(track, (s, 끝))
    b = 기준[역]
    의심 = []  # 소리로 잰 의심만 — 받아쓰기로 본 의심(이름이 다르게 들림)은 굽기.mjs 표가 붙인다
    if 이름쉼:
        의심.append('이름 도중 쉼 ' + ', '.join(f'{a:.2f}–{c:.2f}초' for a, c in 이름쉼))
    if not 쉼표:
        의심.append('쉼표 자리에서 안 쉼(이름과 뒷말이 붙음)')
    if 이름빠르기 > b['음절초_범위'][1] * 1.1:
        의심.append(f'이름을 빨리 지나감({이름빠르기:.1f}음절/초, 승인 줄 최고 {b["음절초_범위"][1]})')
    if 이름빠르기 < b['음절초_범위'][0] * 0.8:
        의심.append(f'이름을 끌어 읽음({이름빠르기:.1f}음절/초, 승인 줄 최저 {b["음절초_범위"][0]})')
    if 전체빠르기 < b['음절초_범위'][0] * 0.85 or 전체빠르기 > b['음절초_범위'][1] * 1.15:
        의심.append(f'빠르기가 1화 승인 범위 밖({전체빠르기:.1f}음절/초, 승인 {b["음절초_범위"][0]}~{b["음절초_범위"][1]})')
    if 이름음 and 전체음:
        if 이름음['최대뜀반음'] >= 5:
            의심.append(f'이름 안 음높이 뜀 {이름음["최대뜀반음"]}반음(10ms 사이)')
        if 반음(이름음['최고Hz'], 전체음['중앙Hz']) >= 9:
            의심.append(f'이름 최고 음 {이름음["최고Hz"]:.0f}Hz = 줄 중앙보다 {반음(이름음["최고Hz"], 전체음["중앙Hz"]):.0f}반음 위')
        짧 = b['짧은줄음높이폭']
        if 짧 and 전체음['폭반음'] < 0.5 * float(np.mean(짧)):
            의심.append(f'억양이 평평함(줄 전체 {전체음["폭반음"]}반음, 승인 짧은 줄 평균 {np.mean(짧):.1f})')
    결과[열쇠] = {'글': 글, '글2': 글2, '낱말': [(w.word, round(w.start, 2), round(w.end, 2)) for w in words], '파일초': round(길이, 2),
               '말시작': round(s, 2), '말끝': round(e, 2), '말초': round(말초, 2), '쉼': 안쪽, '이름끝': round(끝, 2), '이름끝근거': 끝근거,
               '음절초': round(전체빠르기, 2), '이름음절초': round(이름빠르기, 2), '뒷말음절초': round(뒤빠르기, 2), '음높이': {'전체': 전체음, '이름': 이름음}, '의심': 의심}
    print(f"[재기] {열쇠}: 「{글}」 / 「{글2}」 · 말 {말초:.2f}초 · {전체빠르기:.1f}음절/초(이름 {이름빠르기:.1f}) · 쉼 {안쪽} · 이름끝 {끝:.2f}({끝근거}) · 의심 {의심 or '-'}", flush=True)
    (작업 / '재기.json').write_text(json.dumps(결과, ensure_ascii=False, indent=1), encoding='utf-8')
