"""Bounded, private Hugging Face Jobs renders for the Han River SYNK scene.

Uses the existing hf login and private jobs-artifacts bucket. It never changes
billing settings or starts a background schedule. Each submit is one explicit job.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import struct
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from huggingface_hub import HfApi

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parent
IMAGE = "linuxserver/blender:5.2.1"
FLAVOR = "cpu-upgrade"
RATE_USD_HOUR = 0.03
TIMEOUT_MINUTES = 20


def emit(value):
    print(json.dumps(value, ensure_ascii=True, indent=2), flush=True)


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def cli(args, cwd=None):
    executable = shutil.which("hf")
    if not executable:
        raise RuntimeError("Existing Hugging Face CLI not found on PATH")
    result = subprocess.run([executable, *args], cwd=cwd, capture_output=True,
                            text=True, encoding="utf-8", errors="replace")
    output = result.stdout + result.stderr
    if result.returncode:
        raise RuntimeError(output[-2400:])
    return output


def submit(args):
    source = HERE / "build_scene.py"
    logo = PROJECT / "inputs" / "synk-approved-logo.png"
    if not source.exists() or not logo.exists():
        raise RuntimeError("Scene source or approved logo is missing")
    compile(source.read_text(encoding="utf-8"), str(source), "exec")
    if not (128 <= args.width <= 1440 and 128 <= args.height <= 2560 and 1 <= args.samples <= 128):
        raise ValueError("Preview bounds: 128..1440 width, 128..2560 height, 1..128 samples")
    api = HfApi()
    namespace = api.whoami()["name"]
    bucket_id = f"{namespace}/jobs-artifacts"
    bucket = api.bucket_info(bucket_id)
    if not getattr(bucket, "private", False):
        raise RuntimeError("The existing jobs-artifacts bucket must be private")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run_id = f"{stamp}-{args.camera}-{digest(source)[:8]}"
    run_dir = HERE / "runs" / run_id
    staging = run_dir / "input"
    (staging / "inputs").mkdir(parents=True, exist_ok=False)
    (run_dir / "output").mkdir()
    shutil.copy2(source, staging / "build_scene.py")
    shutil.copy2(logo, staging / "inputs" / "synk-approved-logo.png")
    remote = (
        "blender -b --threads 8 --python-exit-code 1 -P /work/build_scene.py -- "
        f"--out-dir /out --width {args.width} --height {args.height} "
        f"--samples {args.samples} --camera {args.camera} "
        "--logo /work/inputs/synk-approved-logo.png --render"
    )
    command = ["jobs", "run", "-d", "--name", f"synk-hanriver-{run_id}",
               "--flavor", FLAVOR, "--timeout", f"{TIMEOUT_MINUTES}m",
               "-v", "./input:/work:ro", "-v", "./output:/out:rw",
               IMAGE, "sh", "-c", remote]
    manifest = {
        "run_id": run_id, "created_utc": stamp, "state": "prepared",
        "namespace": namespace, "bucket_id": bucket_id, "private_bucket": True,
        "image": IMAGE, "flavor": FLAVOR, "timeout_minutes": TIMEOUT_MINUTES,
        "hardware_rate_usd_hour": RATE_USD_HOUR,
        "twenty_minute_compute_estimate_usd": RATE_USD_HOUR * TIMEOUT_MINUTES / 60,
        "note": "20-minute execution limit; Starting time and billing rounding can add cost. Actual billing is not read.",
        "width": args.width, "height": args.height, "samples": args.samples,
        "camera": args.camera, "source_sha256": digest(source), "logo_sha256": digest(logo),
        "command": command,
    }
    record = run_dir / "run.json"
    write_json(record, manifest)
    try:
        output = cli(command, cwd=run_dir)
    except RuntimeError as exc:
        error = str(exc)
        manifest["state"] = ("blocked_insufficient_credits" if "credit balance is insufficient" in error
                             else "submission_failed_requires_inspection")
        manifest["submission_error"] = error[-2400:]
        write_json(record, manifest)
        raise
    match = re.search(r"(?:id=|/jobs/)([0-9a-f]{24})", output)
    if not match:
        manifest["state"] = "submission_result_requires_inspection"
        write_json(record, manifest)
        raise RuntimeError("Submission returned without a recognized ID. Inspect Jobs before retrying. " + output[-1200:])
    manifest.update(job_id=match.group(1), state="submitted")
    write_json(record, manifest)
    emit({"manifest": str(record), "job_id": manifest["job_id"],
          "twenty_minute_compute_estimate_usd": manifest["twenty_minute_compute_estimate_usd"]})


def inspect_run(record):
    manifest = json.loads(record.read_text(encoding="utf-8"))
    api = HfApi()
    job = api.inspect_job(job_id=manifest["job_id"], namespace=manifest["namespace"])
    status = {"job_id": job.id, "stage": job.status.stage,
              "message": getattr(job.status, "message", None),
              "checked_utc": datetime.now(timezone.utc).isoformat()}
    for key in ("created_at", "started_at", "finished_at"):
        value = getattr(job, key, None)
        status[key] = value.isoformat() if hasattr(value, "isoformat") else value
    manifest["last_status"] = status
    write_json(record, manifest)
    return api, job, manifest, status


def fetch(record):
    api, job, manifest, status = inspect_run(record)
    if status["stage"] != "COMPLETED":
        raise RuntimeError(f"Job is {status['stage']}; no completed output claimed")
    volume = next((v for v in (job.volumes or []) if v.mount_path == "/out"), None)
    if volume is None:
        raise RuntimeError("Job has no output volume")
    if volume.source != manifest["bucket_id"]:
        raise RuntimeError("Output volume does not match this run's private bucket")
    remote = f"hf://buckets/{volume.source}/{volume.path}"
    destination = record.parent / "output"
    cli(["buckets", "sync", remote, str(destination)])
    files = []
    for file in sorted(destination.rglob("*")):
        if not file.is_file():
            continue
        item = {"file": str(file.relative_to(destination)), "bytes": file.stat().st_size,
                "sha256": digest(file)}
        if file.suffix.lower() == ".png":
            header = file.read_bytes()[:24]
            if header[:8] != b"\x89PNG\r\n\x1a\n":
                raise RuntimeError("Output named PNG has invalid signature")
            item["dimensions"] = list(struct.unpack(">II", header[16:24]))
        files.append(item)
    if not any(f.get("dimensions") == [manifest["width"], manifest["height"]] for f in files):
        raise RuntimeError("Completed job did not provide the requested image dimensions")
    if not any(f["file"].endswith(".blend") for f in files):
        raise RuntimeError("Editable Blender scene is missing")
    manifest.update(state="downloaded_file_checks_passed", outputs=files)
    write_json(record, manifest)
    emit({"output_dir": str(destination), "files": files,
          "visual_review": "Pending; file checks do not establish visual quality."})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["submit", "status", "logs", "fetch"])
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--camera", choices=["hero", "detail"], default="hero")
    parser.add_argument("--width", type=int, default=720)
    parser.add_argument("--height", type=int, default=1280)
    parser.add_argument("--samples", type=int, default=32)
    args = parser.parse_args()
    if args.action == "submit":
        submit(args)
        return
    if args.manifest is None:
        parser.error("--manifest is required for status, logs and fetch")
    if args.action == "fetch":
        fetch(args.manifest)
        return
    api, job, manifest, status = inspect_run(args.manifest)
    if args.action == "logs":
        for line in api.fetch_job_logs(job_id=job.id, namespace=manifest["namespace"], tail=16):
            print(line, flush=True)
    else:
        emit(status)


if __name__ == "__main__":
    main()
