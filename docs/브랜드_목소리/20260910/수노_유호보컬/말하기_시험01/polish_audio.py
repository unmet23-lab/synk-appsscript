"""Conservative local mastering of the liked Suno A take; no voice generation."""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import sys

BASE = Path(__file__).resolve().parent
SOURCE = BASE / "A_raw.wav"
REFERENCE = BASE / "A_들어보기.wav"
OUTPUT = BASE / "A_음질보정_v1.wav"
SOURCE_SHA = "55f02b5dbf699b08346175c9577f9e6b5904aa2f2f129839d5158c2a4b2ee34f"
TARGET_LUFS = -23.0
FILTERS = [
    "highpass=f=45:p=2:r=f64",
    "equalizer=f=190:t=q:w=0.7:g=-1.2:r=f64",
    "equalizer=f=2300:t=q:w=0.8:g=1.1:r=f64",
    "equalizer=f=6500:t=q:w=1.5:g=-0.6:r=f64",
    "stereotools=slev=0.65",
]


def run(args):
    return subprocess.run(args, capture_output=True, text=True,
                          encoding="utf-8", errors="replace", check=True)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def probe(path):
    return json.loads(run([
        "ffprobe", "-v", "error", "-show_entries",
        "stream=codec_name,sample_rate,channels,bits_per_sample,duration_ts,time_base:format=duration",
        "-of", "json", str(path),
    ]).stdout)


def loudness(path, filters=()):
    chain = ",".join([*filters, "loudnorm=I=-23:TP=-3:LRA=7:print_format=json"])
    result = run(["ffmpeg", "-hide_banner", "-i", str(path),
                  "-af", chain, "-f", "null", "-"])
    return json.loads(re.findall(r'\{\s*"input_i"[\s\S]*?\}', result.stderr)[-1])


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if sha(SOURCE) != SOURCE_SHA:
        raise RuntimeError("Source changed; inspect the actual take before rendering.")
    reference_sha = sha(REFERENCE)
    # loudnorm is used to measure only. Rendering uses fixed gain, no compression.
    filtered = loudness(SOURCE, FILTERS)
    gain = min(TARGET_LUFS - float(filtered["input_i"]),
               -3.0 - float(filtered["input_tp"]))
    chain = ",".join([*FILTERS, f"volume={gain:.6f}dB"])
    run(["ffmpeg", "-y", "-v", "error", "-i", str(SOURCE),
         "-af", chain, "-map_metadata", "-1", "-ar", "48000",
         "-c:a", "pcm_s24le", "-metadata", "title=SYNK A local audio polish v1",
         str(OUTPUT)])
    src_probe, out_probe = probe(SOURCE), probe(OUTPUT)
    src, out = src_probe["streams"][0], out_probe["streams"][0]
    assert src["sample_rate"] == out["sample_rate"] == "48000"
    assert src["duration_ts"] == out["duration_ts"] == 652800
    assert src["channels"] == out["channels"] == 2
    decode = run(["ffmpeg", "-v", "error", "-xerror", "-i", str(OUTPUT),
                  "-f", "null", "-"])
    final = loudness(OUTPUT)
    reference_loudness = loudness(REFERENCE)
    assert abs(float(final["input_i"]) - float(reference_loudness["input_i"])) <= 0.1
    assert float(final["input_tp"]) < -3
    assert sha(SOURCE) == SOURCE_SHA and sha(REFERENCE) == reference_sha
    report = {
        "source": SOURCE.name, "sourceSha256": SOURCE_SHA,
        "reference": REFERENCE.name, "referenceSha256": reference_sha,
        "output": OUTPUT.name, "outputSha256": sha(OUTPUT),
        "filters": FILTERS, "fixedGainDb": gain,
        "sourceProbe": src_probe, "outputProbe": out_probe,
        "referenceLoudness": reference_loudness, "outputLoudness": final,
        "fullDecodePassed": decode.returncode == 0,
        "sourceAndReferencePreserved": True,
        "humanListening": False,
        "limits": "Local EQ and stereo-width adjustment only. No lost detail reconstruction. 24-bit output is a processing container, not added source resolution. No regeneration, denoising, compression, pitch, tempo or cut changes.",
    }
    (BASE / "음질보정_v1_검사.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT), "LUFS": final["input_i"],
                      "truePeak": final["input_tp"], "samples": out["duration_ts"],
                      "gainDb": gain}, ensure_ascii=False))


if __name__ == "__main__":
    main()
