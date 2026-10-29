# 7번 숏드라마 배역 목소리 후보(2026-10-29) — 타입캐스트 · 힉스필드 엔진 후보를 배역마다 같은 대사로 재고 이어 붙인다.
#   <측정 venv python> -X utf8 목소리후보.py 재기 <후보 폴더>   → <폴더>/_측정.json · <폴더>/듣기/<판>.mp3(줄을 0.6초 쉼으로 이음)
# 측정 venv: 저장소 .tmp/voice-pick-20261018/venv(10-18 캐스팅북 목소리 고르기 — torch · transformers · parselmouth · faster_whisper).
# 후보 폴더 안: tc/<배역>_<목소리>/<줄>.wav(tools/나레이션굽기.mjs 출력) · hf/<배역>_<엔진>_<목소리>/<줄>.wav(힉스필드 받은 것을 줄로 나눈 것).
# 재는 것(거르기용 — 고르기는 유호님 귀, 10-29 결정 「엔진 후보를 들려 드리고 고르기」): 줄마다 받아쓰기(faster-whisper medium,
#   VAD 끔)와 글자 오류율, 판마다 음높이 중앙값(parselmouth) · 들리는 나이 · 성별(audeering age-gender, 10-18과 같은 모델).
import json, os, re, subprocess, sys

import numpy as np

GAP = 0.6
LUFS = -17


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


def ffmpeg(*args):
    subprocess.run(["ffmpeg", "-y", "-v", "error", *args], check=True)


def load16(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768


def lines_of(folder):
    # 줄 파일은 대본 차례(i1 · i2 …)로 — 글은 같은 이름의 .json(나레이션굽기 출력) 또는 _줄.json(힉스필드 나눈 것)에서
    texts = {}
    side = os.path.join(folder, "_줄.json")
    if os.path.exists(side):
        texts = json.load(open(side, encoding="utf-8"))
    out = []
    for f in sorted(os.listdir(folder), key=lambda n: (re.sub(r"\d+", "", n), int(re.sub(r"\D", "", n) or 0))):
        if not f.endswith(".wav"):
            continue
        k = f[:-4]
        t = texts.get(k)
        if t is None and os.path.exists(os.path.join(folder, k + ".json")):
            t = json.load(open(os.path.join(folder, k + ".json"), encoding="utf-8")).get("text")
        out.append((k, os.path.join(folder, f), t or ""))
    return out


def join(paths, dst):
    ins, parts = [], []
    for i, p in enumerate(paths):
        ins += ["-i", p]
        parts.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=mono,apad=pad_dur={GAP}[a{i}]")
    graph = ";".join(parts) + ";" + "".join(f"[a{i}]" for i in range(len(paths))) + \
        f"concat=n={len(paths)}:v=0:a=1,loudnorm=I={LUFS}:TP=-1.5:LRA=11[o]"
    ffmpeg(*ins, "-filter_complex", graph, "-map", "[o]", "-c:a", "libmp3lame", "-b:a", "160k", dst)


def measure(root):
    from faster_whisper import WhisperModel
    import parselmouth, torch, torch.nn as nn
    from transformers import Wav2Vec2Processor
    from transformers.models.wav2vec2.modeling_wav2vec2 import Wav2Vec2Model, Wav2Vec2PreTrainedModel

    class Head(nn.Module):
        def __init__(self, config, n):
            super().__init__()
            self.dense = nn.Linear(config.hidden_size, config.hidden_size)
            self.dropout = nn.Dropout(config.final_dropout)
            self.out_proj = nn.Linear(config.hidden_size, n)

        def forward(self, x):
            return self.out_proj(self.dropout(torch.tanh(self.dense(self.dropout(x)))))

    class AgeGender(Wav2Vec2PreTrainedModel):
        def __init__(self, config):
            super().__init__(config)
            self.wav2vec2 = Wav2Vec2Model(config)
            self.age = Head(config, 1)
            self.gender = Head(config, 3)
            self.init_weights()

        def forward(self, x):
            h = self.wav2vec2(x)[0].mean(1)
            return self.age(h), torch.softmax(self.gender(h), 1)

    whisper = WhisperModel("medium", device="cpu", compute_type="int8")
    name = "audeering/wav2vec2-large-robust-6-ft-age-gender"
    proc, ag = Wav2Vec2Processor.from_pretrained(name), AgeGender.from_pretrained(name).eval()
    res_path = os.path.join(root, "_측정.json")
    res = json.load(open(res_path, encoding="utf-8")) if os.path.exists(res_path) else {}
    listen = os.path.join(root, "듣기")
    os.makedirs(listen, exist_ok=True)
    for engine in ("tc", "hf"):
        base = os.path.join(root, engine)
        if not os.path.isdir(base):
            continue
        for cand in sorted(os.listdir(base)):
            folder = os.path.join(base, cand)
            if not os.path.isdir(folder) or cand.startswith("_"):
                continue
            key = f"{engine}/{cand}"
            lines = lines_of(folder)
            if not lines or (key in res and res[key].get("줄수") == len(lines)):
                continue
            row = {"엔진": engine, "판": cand, "배역": cand.split("_")[0], "줄수": len(lines), "줄": []}
            for k, p, text in lines:
                segs, _ = whisper.transcribe(p, language="ko", vad_filter=False, beam_size=5)
                heard = " ".join(s.text.strip() for s in segs).strip()
                row["줄"].append({"id": k, "글": text, "들림": heard, "오류율": round(cer(text, heard), 3),
                                 "길이": round(len(load16(p)) / 16000, 2)})
            mp3 = os.path.join(listen, f"{engine}_{cand}.mp3")
            join([p for _, p, _ in lines], mp3)
            snd = parselmouth.Sound(mp3)
            male = row["배역"] in ("이안", "민재")
            pitch = snd.to_pitch_ac(time_step=0.01, pitch_floor=60 if male else 120, pitch_ceiling=280 if male else 520)
            f0 = pitch.selected_array["frequency"]
            f0 = f0[f0 > 0]
            x = load16(mp3)
            with torch.no_grad():
                age, g = ag(proc(x, sampling_rate=16000, return_tensors="pt").input_values)
            row.update({"듣기": os.path.relpath(mp3, root).replace("\\", "/"), "음높이": round(float(np.median(f0)), 1) if len(f0) else None,
                        "들리는나이": round(float(age[0, 0]) * 100, 1), "여자확률": round(float(g[0, 0]), 3), "남자확률": round(float(g[0, 1]), 3),
                        "오류율평균": round(float(np.mean([l["오류율"] for l in row["줄"]])), 3)})
            res[key] = row
            json.dump(res, open(res_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            bad = [f"{l['id']} 「{l['들림']}」" for l in row["줄"] if l["오류율"] > 0.15]
            print(f"{key:<24} 나이 {row['들리는나이']:>5} · 음높이 {row['음높이']} · 오류율 {row['오류율평균']}" + (f" · 다르게 들린 줄 {bad}" if bad else ""), flush=True)
    return res


# ── 듣기 판(Artifact로 올린다 — 고른 목소리는 판의 db 「picks/<배역>」에 남는다) ──────────────────────
ROLES = [
    ("ian", "이안", "M01 · 20대 중반", "부드럽고 차분한 중저음, 리액션은 부드럽게",
     [("1-4", "결혼 얘기 피했더니… 반찬이 끊겼어."), ("1-17", "이미 같이 사는데, 종이 한 장이 뭐가 그렇게 중요해."),
      ("2-28", "너 거짓말할 때 귀 빨개지는 거 알아?"), ("2-39", "…나 진짜 무서웠어."), ("2-45", "우리 결혼하자.")],
     [("hf/이안_일레븐_Caspian", "일레븐 v4", "Caspian", ""), ("hf/이안_일레븐_Orion", "일레븐 v4", "Orion", "")]),
    ("seojin", "서진", "F03 · 20대 후반", "또렷하고 신뢰감 있는 톤, 과장된 리액션은 피함",
     [("1-5", "우리 내년이면 칠 년이야. 이제 날 잡자."), ("1-25", "반찬 먹고 싶으면, 저기 이름 써."), ("2-9", "비밀."),
      ("2-36·37", "다 연기였어. 늦은 것도, 원피스도, 향수도."), ("2-40", "계획표, 다 버릴게.")],
     [("hf/서진_일레븐_Elena", "일레븐 v4", "Elena", ""), ("hf/서진_일레븐_Roxie", "일레븐 v4", "Roxie", "서진보다 어리게 들림")]),
    ("minjae", "민재", "M04 · 20대 후반", "친근하고 솔직한 회사 동기, 장난스럽게",
     [("1-15", "야~"), ("1-16", "그 도시락, 사랑 한 칸은 있냐?"), ("1-19", "여자친구 내년에 몇이야?"),
      ("1-21", "그럼 너 같아도 급하겠다."), ("1-41", "육 년 된 사이가 제일 잘 놓쳐.")],
     [("hf/민재_일레븐_Andre", "일레븐 v4", "Andre", ""), ("hf/민재_일레븐_Kevin", "일레븐 v4", "Kevin", "민재보다 나이 많게 들림")]),
    ("soyeon", "소연", "F05 · 30대 중반", "따뜻하고 친근한 서진의 친구(아기 엄마), 끝 줄은 속삭임",
     [("1-32", "너 아직도 계획표 들고 다녀?"), ("1-35", "원래 남자는 등 떠밀면 더 버텨."), ("1-43", "등 떠밀지 말고… 한 발 빼 봐.")],
     [("hf/소연_일레븐_Nora", "일레븐 v4", "Nora", ""), ("hf/소연_일레븐_Vesper", "일레븐 v4", "Vesper", "소연보다 어리게 들림")]),
]
TAKE = "가나다라마바"


def page(root):
    import html, shutil
    e = html.escape
    res = json.load(open(os.path.join(root, "_측정.json"), encoding="utf-8"))
    out = os.path.join(root, "판")
    os.makedirs(os.path.join(out, "snd"), exist_ok=True)
    cands, sections = {}, []
    for rid, name, code, brief, lines, cs in ROLES:
        cards = []
        for n, (key, engine, voice, note) in enumerate(cs):
            r = res[key]
            cid = f"{rid}-{n + 1}"
            snd = f"snd/{cid}.mp3"
            shutil.copy2(os.path.join(root, r["듣기"]), os.path.join(out, snd))
            cands[cid] = f"{name} {TAKE[n]} · {engine} {voice}"
            said = "대본대로 들림" if r["오류율평균"] <= 0.08 else "대본과 다르게 들린 곳이 있음"
            cards.append(f"""<article class="take" data-cid="{cid}" data-role="{rid}">
<div class="take-head"><span class="mark">{TAKE[n]}</span><span class="engine">{e(engine)}</span><b>{e(voice)}</b></div>
<audio controls preload="none" src="{snd}"></audio>
<p class="meta">들리는 나이 {r['들리는나이']:.0f}세 · {said}{(' · ' + e(note)) if note else ''}</p>
<button type="button" class="pick" data-cid="{cid}" data-role="{rid}" aria-pressed="false">이 목소리로</button>
</article>""")
        script = "".join(f"<li><span class=\"cut\">{e(c)}</span>{e(t)}</li>" for c, t in lines)
        sections.append(f"""<section class="role" id="{rid}">
<header class="role-head"><h2>{e(name)}</h2><p class="code">{e(code)}</p><p class="brief">{e(brief)}</p></header>
<ol class="script">{script}</ol>
<div class="takes">{''.join(cards)}</div>
<div class="memo"><label for="memo-{rid}">{e(name)} 메모</label><textarea id="memo-{rid}" rows="2" placeholder="예: 다가 좋은데 끝 줄은 더 떨리게"></textarea>
<button type="button" class="save" data-role="{rid}">메모 저장</button><span class="state" id="state-{rid}" aria-live="polite"></span></div>
</section>""")
    chips = "".join(f'<a class="chip" href="#{rid}" id="chip-{rid}"><b>{e(name)}</b><span>아직 안 고름</span></a>' for rid, name, *_ in ROLES)
    doc = PAGE.replace("{{CHIPS}}", chips).replace("{{SECTIONS}}", "\n".join(sections)).replace("{{CANDS}}", json.dumps(cands, ensure_ascii=False))
    open(os.path.join(out, "index.html"), "w", encoding="utf-8").write(doc)
    print(f"듣기 판 → {out} (후보 {len(cands)})")


PAGE = """<meta name="claude:viewport-fit-sides" content="cover">
<title>사랑 한 칸 목소리 캐스팅</title>
<style>
/* 배역마다 대본 한 장 + 테이크 여섯, 오디션 기록지처럼 위에서 아래로 */
:root{--paper:#f6f7f3;--card:#ffffff;--ink:#1e231f;--mute:#5f675f;--line:#dde2d8;--accent:#557a2a;--accent-ink:#ffffff;--picked:#e8efdb;--warn:#9a531c;
--sans:'SUIT Variable','Pretendard','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--paper:#131612;--card:#1a1e19;--ink:#e6eae2;--mute:#a1a99d;--line:#2b3129;--accent:#a4c26b;--accent-ink:#131612;--picked:#232d1f;--warn:#e3a56c;color-scheme:dark}}
:root[data-theme="dark"]{--paper:#131612;--card:#1a1e19;--ink:#e6eae2;--mute:#a1a99d;--line:#2b3129;--accent:#a4c26b;--accent-ink:#131612;--picked:#232d1f;--warn:#e3a56c;color-scheme:dark}
body{background:var(--paper);color:var(--ink);font:15px/1.6 var(--sans);font-variant-numeric:tabular-nums}
main{max-width:960px;margin:0 auto;padding-block:20px 56px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));display:grid;gap:40px}
h1{font-size:26px;font-weight:800;letter-spacing:-.01em;margin:0;text-wrap:balance}
.lead{margin:8px 0 0;color:var(--mute);max-width:62ch}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.chip{display:flex;gap:8px;align-items:baseline;padding:6px 12px;border:1px solid var(--line);border-radius:999px;color:var(--ink);text-decoration:none;background:var(--card)}
.chip span{color:var(--mute);font-size:13px}.chip.done{border-color:var(--accent)}.chip.done span{color:var(--accent);font-weight:600}
.role{display:grid;gap:14px}
.role-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 14px;border-bottom:2px solid var(--ink);padding-bottom:8px}
.role-head h2{font-size:30px;font-weight:800;margin:0;line-height:1.1}
.code{margin:0;color:var(--mute);font-size:13px;letter-spacing:.02em}.brief{margin:0;flex-basis:100%;color:var(--ink)}
.script{list-style:none;margin:0;padding:0;display:grid;gap:2px}
.script li{display:grid;grid-template-columns:5.2em 1fr;gap:10px;min-width:0}
.cut{color:var(--mute);font-size:13px;padding-top:2px}
.takes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
@media (max-width:680px){.takes{grid-template-columns:1fr}}
.take{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px;display:grid;gap:8px;min-width:0}
.take.chosen{background:var(--picked);border-color:var(--accent)}
.take-head{display:flex;align-items:center;gap:8px;min-width:0}
.mark{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-weight:800;border:1.5px solid var(--ink);flex:none}
.engine{font-size:12px;color:var(--mute);letter-spacing:.02em}
audio{width:100%;height:36px}
.meta{margin:0;font-size:13px;color:var(--mute)}
button{font:600 14px/1 var(--sans);padding:9px 14px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;justify-self:start}
button:focus-visible,a:focus-visible,textarea:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.pick[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
button:disabled{opacity:.55;cursor:default}
.memo{display:grid;gap:6px}
.memo label{font-size:13px;color:var(--mute)}
textarea{font:15px/1.5 var(--sans);padding:8px 10px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ink);resize:vertical;width:100%;box-sizing:border-box}
.state{font-size:13px;color:var(--mute)}.state.err{color:var(--warn)}
.note{font-size:13px;color:var(--mute);margin:0;max-width:62ch}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
</style>
<main>
<header>
<h1>사랑 한 칸 · 배역 목소리</h1>
<p class="lead">대안 목소리입니다. 기본은 배역마다 시댄스가 처음 내 준 목소리이고(10-29), 그 목소리가 어색할 때만 여기 일레븐 v4 둘 가운데 하나로 바꿉니다 — 타입캐스트는 광고 배우 목소리에 쓰지 않기로 해서 뺐습니다. 미리 골라 두셔도 되고, 시댄스 목소리를 들어 보신 뒤 고르셔도 됩니다. 배역마다 「이 목소리로」를 누르면 저장됩니다.</p>
<div class="chips">{{CHIPS}}</div>
<p class="note">일레븐은 줄마다 연기 지시를 붙여 구웠습니다. 나이는 기계로 잰 「들리는 나이」라 참고만 해 주세요.</p>
</header>
{{SECTIONS}}
<p class="note" id="db-note" hidden>이 화면에서는 고른 것이 저장되지 않습니다. 대화창에 「이안 다 · 서진 가」처럼 적어 주세요.</p>
</main>
<script>
const CANDS = {{CANDS}};
const audios = [...document.querySelectorAll('audio')];
audios.forEach(a => a.addEventListener('play', () => audios.forEach(b => { if (b !== a) b.pause(); })));
const picks = {};
function paint(rid) {
  const chip = document.getElementById('chip-' + rid);
  if (!chip) return;
  const p = picks[rid] || {};
  document.querySelectorAll(`.take[data-role="${rid}"]`).forEach(t => t.classList.toggle('chosen', t.dataset.cid === p.pick));
  document.querySelectorAll(`.pick[data-role="${rid}"]`).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cid === p.pick)));
  chip.classList.toggle('done', !!p.pick);
  chip.querySelector('span').textContent = p.pick ? CANDS[p.pick].split(' ').slice(1).join(' ') : '아직 안 고름';
  const memo = document.getElementById('memo-' + rid);
  if (document.activeElement !== memo && typeof p.memo === 'string') memo.value = p.memo;
}
function say(rid, text, bad) { const s = document.getElementById('state-' + rid); s.textContent = text; s.classList.toggle('err', !!bad); }
(async () => {
  let db = null;
  try { db = await window.claude?.use?.('db'); } catch (e) { db = null; }
  if (!db) {
    document.getElementById('db-note').hidden = false;
    document.querySelectorAll('.pick, .save').forEach(b => b.disabled = true);
    return;
  }
  const col = db.collection('picks');
  const ROLE_IDS = [...document.querySelectorAll('.role')].map(s => s.id);
  col.onSnapshot(snap => {
    ROLE_IDS.forEach(rid => { delete picks[rid]; });
    snap.docs.forEach(d => { if (ROLE_IDS.includes(d.id)) picks[d.id] = d.data() || {}; });
    ROLE_IDS.forEach(paint);
  }, () => document.querySelectorAll('.state').forEach(s => s.textContent = '고른 것을 불러오지 못했습니다. 새로 고침해 주세요.'));
  const busy = {};
  async function save(rid, patch, done) {
    if (busy[rid]) return;
    busy[rid] = true;
    const body = { ...(picks[rid] || {}), ...patch, memo: document.getElementById('memo-' + rid).value.trim(), at: new Date().toISOString() };
    if (body.pick) body.label = CANDS[body.pick];
    try { await col.doc(rid).set(body); picks[rid] = body; paint(rid); say(rid, done); }
    catch (e) { say(rid, e && e.code === 'invalid_argument' ? '이 화면에서는 저장할 수 없습니다. 대화창에 적어 주세요.' : '저장하지 못했습니다. 잠시 뒤 다시 눌러 주세요.', true); }
    finally { busy[rid] = false; }
  }
  document.querySelectorAll('.pick').forEach(b => b.addEventListener('click', () => save(b.dataset.role, { pick: b.dataset.cid }, CANDS[b.dataset.cid] + ' — 저장했습니다')));
  document.querySelectorAll('.save').forEach(b => b.addEventListener('click', () => save(b.dataset.role, {}, '메모를 저장했습니다')));
})();
</script>
"""


if __name__ == "__main__":
    if sys.argv[1] == "재기":
        measure(sys.argv[2])
    elif sys.argv[1] == "판":
        page(sys.argv[2])
