# 대사 목소리 시험 듣기 판(2026-10-29) — 무제한 날 받은 목소리 시험 넷을 나란히 듣고 고르는 페이지를 만든다.
#   python -X utf8 듣기판.py <받은 폴더>   → <받은 폴더>/듣기판/index.html · 영상 · 소리(Artifact로 올린다)
# 받은 폴더에는 판 id 이름으로 둔다: hs-S07.mp4 · hs-S07-B.mp4 · hs-S12.mp4 · hs-S12-B.mp4(지금 방식 = id, 새 방식 = id-B).
# 판마다 ① 생성 소리 그대로 ② 지금 방식만: 타입캐스트 대사 줄을 생성 말소리 시작에 맞춰 덮은 판(지금 계획의 최종 꼴)
# ③ 받아쓰기(faster-whisper medium · VAD 끔 — 10-26 시험에서 VAD가 짧은 외침을 놓쳤다)를 대본과 견준다.
# 같은 사람으로 들리는지는 방식마다 #7 → #12를 이어 붙인 소리로 귀로 고른다 — 숫자로 대신하지 않는다.
# 10-29 유호님이 새 방식(B — 시댄스가 연기한 목소리)으로 정한 뒤로는 B 둘만 받는다 — 받지 않은 방식은 판에 그리지 않는다.
import html, json, os, re, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PLAN = os.path.join(HERE, "..", "..", "video", "homeshopping-horror-20261021", "목소리", "계획_v5.json")
VO = "C:/Users/q1212/Documents/synk-vendor/homeshopping-horror-20261021/목소리/vo_v5"   # 타입캐스트 대사 줄(지금 방식의 최종 목소리)
CUTS = [7, 12]
GAP = 0.6   # 이어 듣기에서 컷 사이 쉼(초)


def run(*args):
    subprocess.run(args, check=True, capture_output=True)


def lines_by_cut():
    out = {}
    for line in json.load(open(PLAN, encoding="utf-8"))["lines"]:
        m = re.match(r"#(\d+)", line.get("메모", ""))
        if m and int(m.group(1)) in CUTS:
            out[int(m.group(1))] = (line["id"], line["text"])
    return out


def norm(s):
    return re.sub(r"[^가-힣a-zA-Z0-9]", "", s)


def speech_onset(wav):
    # 처음으로 −40 dBFS를 넘는 20ms 창 — 타입캐스트 줄 앞의 빈 자리를 잰다
    import numpy as np
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", wav, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True)
    x = np.frombuffer(r.stdout, dtype=np.float32)
    n = 320
    for i in range(0, len(x) - n, n):
        if 20 * np.log10(np.sqrt(np.mean(x[i:i + n] ** 2)) + 1e-9) > -40:
            return i / 16000
    return 0.0


def transcribe(model, clip, tmp):
    wav = os.path.join(tmp, os.path.basename(clip) + ".wav")
    run("ffmpeg", "-y", "-v", "error", "-i", clip, "-ac", "1", "-ar", "16000", wav)
    segs, _ = model.transcribe(wav, language="ko", vad_filter=False, word_timestamps=True)
    words = [w for s in segs for w in (s.words or [])]
    text = " ".join(w.word.strip() for w in words).strip()
    return text, (words[0].start if words else None)


def overlay(clip, line_wav, at, out):
    # 영상은 그대로 두고 소리만 타입캐스트 줄로 바꾼다(at초에 말이 시작하게)
    ms = max(0, int(round(at * 1000)))
    run("ffmpeg", "-y", "-v", "error", "-i", clip, "-i", line_wav, "-filter_complex", f"[1:a]adelay={ms}|{ms},apad[a]",
        "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", out)


def chain(clips, out):
    # 방식마다 #7 → #12 소리를 GAP초 쉼과 함께 이어 붙인다
    ins, parts = [], []
    for i, c in enumerate(clips):
        ins += ["-i", c]
        parts.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=stereo,apad=pad_dur={GAP}[a{i}]")
    graph = ";".join(parts) + ";" + "".join(f"[a{i}]" for i in range(len(clips))) + f"concat=n={len(clips)}:v=0:a=1[o]"
    run("ffmpeg", "-y", "-v", "error", *ins, "-filter_complex", graph, "-map", "[o]", "-c:a", "libmp3lame", "-b:a", "192k", out)


def build(src):
    from faster_whisper import WhisperModel
    model = WhisperModel("medium", device="cpu", compute_type="int8")
    out = os.path.join(src, "듣기판")
    tmp = os.path.join(out, "_tmp")
    os.makedirs(tmp, exist_ok=True)
    lines = lines_by_cut()
    cuts = []
    for cut in CUTS:
        vid, script = lines[cut]
        row = {"컷": cut, "대본": script, "판": []}
        for way, pid in (("A", f"hs-S{cut:02d}"), ("B", f"hs-S{cut:02d}-B")):
            clip = os.path.join(src, pid + ".mp4")
            if not os.path.exists(clip):
                continue
            shutil.copy2(clip, os.path.join(out, pid + ".mp4"))
            text, start = transcribe(model, clip, tmp)
            row["판"].append({"방식": way, "id": pid, "파일": pid + ".mp4", "받아쓰기": text, "시작": start,
                             "맞음": norm(script) in norm(text), "덮음": False})
            if way == "A" and start is not None:
                line_wav = os.path.join(VO, vid + ".wav")
                at = start - speech_onset(line_wav)
                overlay(clip, line_wav, at, os.path.join(out, pid + "-덮음.mp4"))
                row["판"].append({"방식": "A덮음", "id": pid, "파일": pid + "-덮음.mp4", "받아쓰기": script, "시작": start,
                                 "맞음": True, "덮음": True, "옮김": at})
        cuts.append(row)
    chains = {}
    for way, label in (("A", "지금 방식 · 생성 소리"), ("A덮음", "지금 방식 · 타입캐스트를 덮은 최종 꼴"), ("B", "새 방식 · 생성 소리")):
        files = [os.path.join(out, p["파일"]) for r in cuts for p in r["판"] if p["방식"] == way and not p.get("없음")]
        if len(files) == len(CUTS):
            name = f"이어듣기_{way}.mp3"
            chain(files, os.path.join(out, name))
            chains[name] = label
    shutil.rmtree(tmp)
    ref = None   # 기준 — 지유 목소리 판(견본 없이 시댄스가 처음 낸 목소리, 10-29 결정)
    if os.path.exists(os.path.join(src, "hs-목소리-지유.mp4")):
        shutil.copy2(os.path.join(src, "hs-목소리-지유.mp4"), os.path.join(out, "hs-목소리-지유.mp4"))
        ref = "hs-목소리-지유.mp4"
    json.dump(cuts, open(os.path.join(out, "_결과.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    open(os.path.join(out, "index.html"), "w", encoding="utf-8").write(page(cuts, chains, ref))
    print(f"듣기 판 → {out}")
    for r in cuts:
        for p in r["판"]:
            if p.get("없음"):
                print(f"  #{r['컷']} {p['방식']}: 받은 판 없음")
            else:
                print(f"  #{r['컷']} {p['방식']}: {'대본대로' if p['맞음'] else '대본과 다름'} · 「{p['받아쓰기']}」"
                      + (f" · 말 시작 {p['시작']:.2f}초" if p["시작"] is not None else " · 말소리 못 찾음"))


NAMES = {"A": "지금 방식 — 생성 소리", "A덮음": "지금 방식 — 타입캐스트를 덮은 최종 꼴", "B": "새 방식 — 생성 소리"}
NOTES = {"A": "대사 녹음을 소리 참고로 넣어 뽑은 판에서 나온 소리 그대로",
         "A덮음": "지금 계획대로 나중에 녹음을 덮은 꼴 — 입과 소리가 맞는지 0.5배로 봐 주세요",
         "B": "배역 목소리 견본을 넣고 대사는 영상 모델이 연기한 소리 그대로"}


def page(cuts, chains, ref=None):
    e = html.escape
    out = ["""<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>대사 목소리 시험</title><style>
:root{--bg:#f6f4ef;--card:#fff;--ink:#1d1c1a;--mute:#6b6760;--line:#e2ddd3;--acc:#2f5bd3;--ok:#2f7d4f;--bad:#b4532a}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#17171a;--card:#212125;--ink:#ecebe8;--mute:#a19d95;--line:#33333a;--acc:#8aa6ff;--ok:#7fcf9c;--bad:#f0a07a}}
:root[data-theme="dark"]{--bg:#17171a;--card:#212125;--ink:#ecebe8;--mute:#a19d95;--line:#33333a;--acc:#8aa6ff;--ok:#7fcf9c;--bad:#f0a07a}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 system-ui,'Malgun Gothic',sans-serif}
main{max-width:1100px;margin:0 auto;padding:16px}
h1{font-size:22px;margin:8px 0}h2{font-size:18px;margin:28px 0 8px}.note{color:var(--mute)}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
@media (max-width:760px){.grid{grid-template-columns:1fr}}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px}
.card b{display:block;margin-bottom:4px}video{width:100%;border-radius:8px;background:#000}audio{width:100%}
.ok{color:var(--ok)}.bad{color:var(--bad)}
button{font:inherit;padding:2px 10px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;margin-top:6px}
</style></head><body><main>
<h1>대사 목소리 시험 — 시댄스가 연기한 목소리</h1>
<p class="note">맨 위는 지유 목소리 판 — 견본 없이 시댄스가 처음 낸 지유 목소리입니다(10-29 정하신 기본). 그 소리를 떼어 견본으로 넣고 지유 대사 두 컷을 시댄스가 직접 연기하게 뽑았습니다. 연기 말투가 자연스러운지, 입과 소리가 맞는지(0.5배로), 두 컷이 목소리 판과 같은 사람 목소리로 들리는지 봐 주세요. 괜찮으면 매진 임박 대사 13컷과 7번 숏드라마 대사 컷을 이대로 내고, 어색하면 대안 일레븐 v4로 갑니다.</p>"""]
    if ref:
        out.append(f'<h2>기준 — 지유 목소리 판</h2><div class="grid"><div class="card"><b>시댄스가 처음 낸 지유 목소리</b>'
                   f'<video controls playsinline preload="metadata" src="{e(ref)}"></video><p class="note">이 소리가 견본이 됐습니다.</p></div></div>')
    for r in cuts:
        out.append(f"<h2>#{r['컷']} 「{e(r['대본'])}」</h2><div class=\"grid\">")
        for p in r["판"]:
            if p.get("없음"):
                out.append(f'<div class="card"><b>{e(NAMES[p["방식"]])}</b><p class="note">아직 받은 판이 없습니다.</p></div>')
                continue
            said = (f'<span class="ok">대본대로 들림</span>' if p["맞음"] else f'<span class="bad">대본과 다르게 들림</span>')
            heard = "" if p["덮음"] else f' · 받아쓰기 「{e(p["받아쓰기"])}」'
            out.append(f'<div class="card"><b>{e(NAMES[p["방식"]])}</b><video controls playsinline preload="metadata" src="{e(p["파일"])}"></video>'
                       f'<button type="button" data-rate>0.5배로</button><p class="note">{e(NOTES[p["방식"]])}<br>{said}{heard}</p></div>')
        out.append("</div>")
    if chains:
        out.append("<h2>같은 사람으로 들리나 — #7 → #12 이어 듣기</h2><div class=\"grid\">")   # 받은 방식만
        for name, label in chains.items():
            out.append(f'<div class="card"><b>{e(label)}</b><audio controls preload="metadata" src="{e(name)}"></audio></div>')
        out.append("</div>")
    out.append("""<script>
document.querySelectorAll('button[data-rate]').forEach(b=>b.onclick=()=>{const v=b.previousElementSibling;const slow=v.playbackRate!==0.5;
v.playbackRate=slow?0.5:1;b.textContent=slow?'원래 빠르기로':'0.5배로'});
</script></main></body></html>""")
    return "\n".join(out)


if __name__ == "__main__":
    build(sys.argv[1])
