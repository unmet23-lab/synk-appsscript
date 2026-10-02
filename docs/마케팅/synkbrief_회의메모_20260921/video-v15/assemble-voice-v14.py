"""Insert three aligned Typecast steps while preserving every other v13 take."""
import json
import math
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parent
base = root.parent / "video-v13"
content_path = root / "content.json"
scenes = json.loads(content_path.read_text(encoding="utf-8"))
original_timing = json.loads((base / "voice-timing.json").read_text(encoding="utf-8"))
extra = json.loads((root / "extra-narration-script.json").read_text(encoding="utf-8"))
audio = root / "audio"

def ffmpeg(*args):
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *map(str, args)], check=True)

def srt_time(seconds):
    milliseconds = round(seconds * 1000)
    hours, milliseconds = divmod(milliseconds, 3600000)
    minutes, milliseconds = divmod(milliseconds, 60000)
    seconds, milliseconds = divmod(milliseconds, 1000)
    return f"{hours:02}:{minutes:02}:{seconds:02},{milliseconds:03}"

starts = {}
data_by_id = {}
for segment in extra["segments"]:
    scene = next(s for s in scenes if s["id"] == segment["id"])
    data = json.loads((audio / (segment["id"] + ".json")).read_text(encoding="utf-8"))
    if data["request"]["text"] != segment["text"] or data["request"]["voice_id"] != extra["voice"]["id"]:
        raise ValueError(f"Voice source mismatch: {segment['id']}")
    scene["duration"] = math.ceil(max(scene["duration"], .22 + data["audio_duration"] + .3) * 30) / 30
    data_by_id[segment["id"]] = data
    ffmpeg("-i", audio / (segment["id"] + ".wav"), "-af", f"aresample=48000,adelay=220:all=1,apad,atrim=duration={scene['duration']}", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", audio / ("block-" + segment["id"] + ".wav"))

for scene in scenes:
    if scene["id"] == "repeat-find":
        scene["camera"]["actionAt"] = 5.9
    if scene["id"] == "repeat-new":
        scene["camera"]["actionAt"] = 6.3
    if scene["id"] == "repeat-send":
        scene["camera"]["actionAt"] = 6.8
        scene["camera"]["nextAt"] = 9.25

time = 0
for scene in scenes:
    starts[scene["id"]] = time
    time += scene["duration"]
base_repeat = next(c for c in original_timing["clips"] if c["id"] == "repeat")
base_ending = next(c for c in original_timing["clips"] if c["id"] == "ending")
delta = starts["ending"] - base_ending["start"]

ffmpeg("-i", base / "audio/narration.wav", "-af", f"atrim=end={base_repeat['start']},asetpts=PTS-STARTPTS", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", audio / "v13-before-repeat.wav")
ffmpeg("-i", base / "audio/narration.wav", "-af", f"atrim=start={base_ending['start']},asetpts=PTS-STARTPTS", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", audio / "v13-ending.wav")
parts = ["v13-before-repeat.wav"] + ["block-" + s["id"] + ".wav" for s in extra["segments"]] + ["v13-ending.wav"]
(audio / "blocks-v14.txt").write_text("".join(f"file '{part}'\n" for part in parts), encoding="utf-8")
ffmpeg("-f", "concat", "-safe", "0", "-i", audio / "blocks-v14.txt", "-c:a", "pcm_s16le", audio / "narration.wav")

clips = [c for c in original_timing["clips"] if c["start"] < base_repeat["start"]]
captions = [c for c in original_timing["captions"] if c["start"] < base_repeat["start"]]
for segment in extra["segments"]:
    sid = segment["id"]
    scene = next(s for s in scenes if s["id"] == sid)
    data = data_by_id[sid]
    start = starts[sid]
    clips.append({"id": sid, "start": start, "duration": scene["duration"], "voiceStart": start + .22, "voiceDuration": data["audio_duration"]})
    group = []
    def flush():
        if group:
            text = " ".join(w["text"] for w in group).replace("챗지피티", "ChatGPT")
            captions.append({"text": text, "start": start + .22 + group[0]["start"], "end": min(start + scene["duration"] - .12, start + .22 + group[-1]["end"] + .12)})
            group.clear()
    for word in data["words"]:
        if group and (len(" ".join(w["text"] for w in [*group, word])) > 32 or word["end"] - group[0]["start"] > 4):
            flush()
        group.append(word)
        if word["text"].endswith((".", "!", "?")):
            flush()
    flush()

clips.append({**base_ending, "start": starts["ending"], "voiceStart": base_ending["voiceStart"] + delta})
captions.extend({**c, "start": c["start"] + delta, "end": c["end"] + delta} for c in original_timing["captions"] if c["start"] >= base_ending["start"])
captions.sort(key=lambda c: c["start"])
content_path.write_text(json.dumps(scenes, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
(root / "voice-timing.json").write_text(json.dumps({"duration": time, "voice": extra["voice"], "clips": clips, "captions": captions}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
(root / "narration.srt").write_text("\n".join(f"{i}\n{srt_time(c['start'])} --> {srt_time(c['end'])}\n{c['text']}\n" for i, c in enumerate(captions, 1)), encoding="utf-8")
print(json.dumps({"duration": time, "scenes": len(scenes), "captions": len(captions), "delta": delta}, ensure_ascii=False))
