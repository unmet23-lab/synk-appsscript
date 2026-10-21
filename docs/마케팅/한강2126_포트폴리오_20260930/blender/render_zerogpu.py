"""Render one packed, non-sensitive .blend through a community ZeroGPU Space.

Consumes the authenticated user's ZeroGPU quota, not Hugging Face Jobs credit.
The Space operator can access uploads; do not submit private client/person assets.
"""
import argparse
import hashlib
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from gradio_client import Client, handle_file
from huggingface_hub import get_token


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("blend", type=Path)
    parser.add_argument("--width", type=int, default=720)
    parser.add_argument("--height", type=int, default=720)
    parser.add_argument("--samples", type=int, default=32)
    parser.add_argument("--gpu-seconds", type=int, default=120)
    args = parser.parse_args()
    source = args.blend.resolve(strict=True)
    token = get_token()
    if not token:
        raise SystemExit("Hugging Face login required; no render submitted.")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out = Path(__file__).resolve().parent / "zerogpu" / "runs" / stamp
    out.mkdir(parents=True, exist_ok=False)
    config = dict(mode="image", width=args.width, height=args.height,
                  samples=args.samples, engine="CYCLES", device="CUDA",
                  gpu_size="large", gpu_seconds=args.gpu_seconds,
                  frame=1, camera=None, strict_assets=True)
    record = dict(space="cpuai/blender-render-studio", started_utc=stamp,
                  input=str(source), input_bytes=source.stat().st_size,
                  input_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                  config=config, state="connecting", phases={})
    started = time.monotonic()

    def save(state):
        record["state"] = state
        record["elapsed_seconds"] = round(time.monotonic() - started, 3)
        (out / "run.json").write_text(json.dumps(record, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
        print(json.dumps(dict(state=state, elapsed=record["elapsed_seconds"], run=str(out)), ensure_ascii=False), flush=True)

    save("connecting")
    try:
        client = Client(record["space"], token=token, verbose=False,
                        analytics_enabled=False, download_files=out / "downloads")
        job_id, prepared = client.predict(
            files=[handle_file(str(source))], config_json=json.dumps(config),
            config_file=None, api_name="/prepare_job")
        record["job_id"] = job_id
        record["phases"]["prepare"] = prepared
        save("prepared")
        inspection = client.predict(job_id, api_name="/inspect_job")
        record["phases"]["inspect"] = inspection
        save("inspected")
        if not isinstance(inspection, dict) or inspection.get("status") != "ready" or not inspection.get("inspection", {}).get("ok"):
            raise RuntimeError("Space inspection failed; no GPU chunk requested.")
        chunk = client.predict(job_id, api_name="/render_chunk")
        record["phases"]["render"] = chunk
        save("render_returned")
        actual = chunk.get("last_render") or {}
        if chunk.get("status") != "complete" or not actual.get("ok"):
            raise RuntimeError("Space did not complete the one-frame render; see local run record.")
        if actual.get("backend") not in {"CUDA", "OPTIX"} or not any(d.get("type") in {"CUDA", "OPTIX"} and d.get("use") for d in actual.get("devices", [])):
            raise RuntimeError("No active CUDA/OPTIX render device reported.")
        final = client.predict(job_id, api_name="/finalize_job")
        record["phases"]["finalize"] = final
        record["downloaded_files"] = [
            dict(path=str(p), bytes=p.stat().st_size, sha256=hashlib.sha256(p.read_bytes()).hexdigest())
            for p in sorted((out / "downloads").rglob("*")) if p.is_file()
        ]
        save("finalize_returned")
        # The remote job id grants file access; keep it in the local record only.
        print(json.dumps(dict(backend=actual.get("backend"), timings=actual.get("timings"), downloaded_count=len(record["downloaded_files"])), ensure_ascii=True), flush=True)
    except Exception as exc:
        record["error"] = f"{type(exc).__name__}: {exc}".replace(token, "[REDACTED]")
        save("failed")
        print(record["error"], flush=True)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
