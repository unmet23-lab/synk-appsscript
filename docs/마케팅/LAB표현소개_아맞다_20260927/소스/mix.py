# -*- coding: utf-8 -*-
"""소리 섞기 — 장면표의 AUDIO 큐를 시간에 맞춰 섞고, 2패스 loudnorm 으로 −16 LUFS / TP −1.0 에 맞춘 뒤 영상과 합친다."""
import sys, os, json, subprocess, argparse
sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from render import AUDIO, DUR
def run(cmd): return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
def mix(out_wav, voice=True):
    cues = [c for c in AUDIO if voice or not c[1].startswith("tts/")]
    cmd = ["ffmpeg", "-y", "-loglevel", "error"]
    parts = []
    for i, (t, f, g, w) in enumerate(cues):
        cmd += ["-i", os.path.join(HERE, f)]
        parts.append(f"[{i}]aformat=sample_rates=48000:channel_layouts=mono,volume={g}dB,adelay={int(t*1000)}|{int(t*1000)}[a{i}]")
    n = len(cues)
    fc = ";".join(parts) + ";" + "".join(f"[a{i}]" for i in range(n)) + f"amix=inputs={n}:normalize=0:dropout_transition=0,apad=whole_dur={DUR}[m]"
    cmd += ["-filter_complex", fc, "-map", "[m]", "-t", str(DUR), "-ar", "48000", "-ac", "1", out_wav]
    r = run(cmd); assert r.returncode == 0, r.stderr
def loudnorm(in_wav, out_wav, I=-16.0, TP=-1.0, LRA=11.0):
    r = run(["ffmpeg", "-hide_banner", "-i", in_wav, "-af", f"loudnorm=I={I}:TP={TP}:LRA={LRA}:print_format=json", "-f", "null", "-"])
    j = json.loads(r.stderr[r.stderr.rfind("{"):r.stderr.rfind("}") + 1])
    af = (f"loudnorm=I={I}:TP={TP}:LRA={LRA}:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true:print_format=json")
    r2 = run(["ffmpeg", "-y", "-loglevel", "info", "-i", in_wav, "-af", af, "-ar", "48000", out_wav])
    assert r2.returncode == 0, r2.stderr
    j2 = json.loads(r2.stderr[r2.stderr.rfind("{"):r2.stderr.rfind("}") + 1])
    return j, j2
def mux(video, wav, out_mp4):
    r = run(["ffmpeg", "-y", "-loglevel", "error", "-i", video, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", "-movflags", "+faststart", out_mp4])
    assert r.returncode == 0, r.stderr
if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--video", required=True); ap.add_argument("--out", required=True); ap.add_argument("--no-voice", action="store_true")
    a = ap.parse_args()
    raw = a.out + ".raw.wav"; norm = a.out + ".norm.wav"
    mix(raw, voice=not a.no_voice); m1, m2 = loudnorm(raw, norm); mux(a.video, norm, a.out)
    print(json.dumps({"out": a.out, "measured_in": {k: m1[k] for k in ("input_i", "input_tp", "input_lra")}, "after": {k: m2[k] for k in ("output_i", "output_tp", "output_lra")}}, ensure_ascii=False))
