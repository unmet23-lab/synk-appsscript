"""Prepare the local PATH Korean ASR assets; no account, API key, or paid call.

Run: python tools/prepare-interview-speech.py
Downloads vosk-browser 0.0.8 (~1.8 MB) and Korean model (~82 MB), then
repackages the model as deterministic USTAR gzip for the browser extractor.
The model archive is intentionally ignored by the repository's *.tar.gz rule.
"""
from __future__ import annotations

import base64
import gzip
import hashlib
import io
import json
from pathlib import Path
import re
import sys
import tarfile
import tempfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "experiences/path-vr"
VENDOR = ASSETS / "vendor/vosk"
MODELS = ASSETS / "models"
PACKAGE_URL = "https://registry.npmjs.org/vosk-browser/-/vosk-browser-0.0.8.tgz"
PACKAGE_INTEGRITY = "df9MuChirUGKxP/+4k8tBV6hJOic8IRdJXv64+ET0Ue5CddOzLZINiHOWCka765gBzHJWNtQKgaYakS0FXZIJA=="
MODEL_URL = "https://alphacephei.com/vosk/models/vosk-model-small-ko-0.22.zip"
MODEL_NAME = "vosk-model-small-ko-0.22"
MODEL_ZIP_SHA256 = "eea36124087fed26c59996a4761519458e3bd185e8ea9d9865ad8760c4a1d989"


def download(url: str, dest: Path) -> None:
    if dest.exists():
        print(f"Reusing {dest.name} ({dest.stat().st_size:,} bytes)", flush=True)
        return
    part = dest.with_suffix(dest.suffix + ".part")
    with urllib.request.urlopen(url, timeout=90) as response, part.open("wb") as out:
        total = int(response.headers.get("Content-Length", 0))
        received = 0
        next_notice = 0
        while block := response.read(1024 * 1024):
            out.write(block)
            received += len(block)
            if received >= next_notice:
                print(f"{dest.name}: {received:,}/{total:,} bytes", flush=True)
                next_notice = received + 10 * 1024 * 1024
    part.replace(dest)


def replace_once(source: str, old: str, new: str) -> str:
    if source.count(old) != 1:
        raise RuntimeError(f"Pinned vendor patch no longer matches: {old[:100]}")
    return source.replace(old, new, 1)


def prepare_vendor(package: Path) -> dict:
    raw = package.read_bytes()
    if base64.b64encode(hashlib.sha512(raw).digest()).decode() != PACKAGE_INTEGRITY:
        raise RuntimeError("vosk-browser npm integrity mismatch")
    with tarfile.open(fileobj=io.BytesIO(raw), mode="r:gz") as archive:
        source = archive.extractfile("package/dist/vosk.js").read().decode()
        readme = archive.extractfile("package/README.md").read()
    match = re.search(r"    var WorkerFactory = createBase64WorkerFactory\('([^']+)'[^\n]*", source)
    if not match:
        raise RuntimeError("Cannot locate the pinned inline worker")
    worker = base64.b64decode(match.group(1)).decode().replace("\r", "")
    # Keep all model I/O and inference off the rendering thread. Use a local
    # worker instead of a blob worker, and forward capture ports directly to it.
    source = source[:match.start()] + "    function WorkerFactory() { return new Worker(new URL('./vosk-worker.js', import.meta.url)); }" + source[match.end():]
    source = replace_once(source, "(function (global, factory) {", "const Vosk = {};\n(function (global, factory) {")
    source = replace_once(source, "factory(global.Vosk = {})", "factory(Vosk)")
    source += "\nexport const Model = Vosk.Model;\nexport const createModel = Vosk.createModel;\n"
    source = replace_once(source, "        initialize() {", """        connectAudioPort(port) {
            this.worker.postMessage({ action: 'audioPort' }, [port]);
        }
        dispose() {
            this.worker.terminate();
            this._ready = false;
            this.recognizers.clear();
        }
        initialize() {
            this.worker.addEventListener('error', (error) => this.dispatchEvent(new CustomEvent('error', { detail: { event: 'error', error: error.message || 'worker-failed' } })));
            this.worker.addEventListener('messageerror', () => this.dispatchEvent(new CustomEvent('error', { detail: { event: 'error', error: 'worker-message-error' } })));
""")
    worker = replace_once(worker, "            const message = event.data;", """            const message = event.data;
            if (message?.action === 'audioPort') {
                const port = event.ports[0];
                port.onmessage = (next) => this.handleMessage(next);
                port.start();
                return;
            }
""")
    # A final flag distinguishes the requested flush from an earlier endpoint
    # result already queued by Vosk. This is essential for lossless stop().
    start = worker.index("        retrieveFinalResult(recognizerId) {")
    end = worker.index("        removeRecognizer(recognizerId) {", start)
    chunk = worker[start:end]
    chunk = replace_once(chunk, 'event: "result",', 'event: "result", final: true,')
    worker = worker[:start] + chunk + worker[end:]
    worker = replace_once(worker, "bytesWritten=bytesWritten+value.length;", "bytesWritten=bytesWritten+value.length;self.postMessage({event:'progress',phase:'download',loaded:bytesWritten,total:length||0});")
    worker = replace_once(worker, "yield extract(archivePath,localPath,true);", "self.postMessage({event:'progress',phase:'extract'});yield extract(archivePath,localPath,true);")
    worker = replace_once(worker, "this.model = new this.Vosk.Model(modelPath);", "ctx.postMessage({event:'progress',phase:'initialize'});this.model = new this.Vosk.Model(modelPath);")
    worker = worker.replace("error: error.message", "error: String(error?.message || error)")
    # Speech is transient; only the public acoustic model is in IDBFS. Private
    # mode/storage quota failure should not prevent in-memory recognition.
    worker = replace_once(worker, "return this.Vosk.syncFilesystem(true);", "return this.Vosk.syncFilesystem(true).catch(() => { ctx.postMessage({event:'progress',phase:'cache-unavailable'}); });")
    worker = replace_once(worker, "return this.Vosk.syncFilesystem(false);", "return this.Vosk.syncFilesystem(false).catch(() => { ctx.postMessage({event:'progress',phase:'cache-unavailable'}); });")
    VENDOR.mkdir(parents=True, exist_ok=True)
    (VENDOR / "vosk.mjs").write_text(source, encoding="utf-8", newline="\n")
    (VENDOR / "vosk-worker.js").write_text(worker, encoding="utf-8", newline="\n")
    (VENDOR / "UPSTREAM-README.md").write_bytes(readme)
    license_file = VENDOR / "LICENSE.txt"
    if not license_file.exists():
        download("https://raw.githubusercontent.com/ccoreilly/vosk-browser/master/COPYING", license_file)
    if not (VENDOR / "NOTICE.txt").exists():
        download("https://raw.githubusercontent.com/ccoreilly/vosk-browser/master/NOTICE", VENDOR / "NOTICE.txt")
    return {"name": "vosk-browser", "version": "0.0.8", "url": PACKAGE_URL,
            "license": "Apache-2.0", "npmIntegrity": "sha512-" + PACKAGE_INTEGRITY,
            "patches": ["same-origin ESM and external worker", "direct AudioWorklet MessagePort", "download progress", "final-result flush flag", "hard worker disposal and worker errors", "nonfatal public-model cache failure"]}


def prepare_model(archive: Path) -> dict:
    if hashlib.sha256(archive.read_bytes()).hexdigest() != MODEL_ZIP_SHA256:
        raise RuntimeError("Korean model ZIP integrity mismatch")
    MODELS.mkdir(parents=True, exist_ok=True)
    target = MODELS / (MODEL_NAME + ".tar.gz")
    if not target.exists() or '--repack' in sys.argv:
        print("Repacking model as deterministic USTAR gzip...", flush=True)
        with zipfile.ZipFile(archive) as zipped, target.with_suffix(".part").open("wb") as raw:
            with gzip.GzipFile(fileobj=raw, mode="wb", filename="", mtime=0, compresslevel=6) as compressed:
                with tarfile.open(fileobj=compressed, mode="w|", format=tarfile.USTAR_FORMAT) as tar:
                    for name in sorted(zipped.namelist()):
                        if not name.startswith(MODEL_NAME + "/") or ".." in Path(name).parts:
                            raise RuntimeError("Unexpected model archive path")
                        if name.endswith("/"):
                            info = tarfile.TarInfo(name)
                            info.type, info.mode, info.mtime = tarfile.DIRTYPE, 0o755, 0
                            tar.addfile(info)
                            continue
                        payload = zipped.read(name)
                        info = tarfile.TarInfo(name)
                        info.size, info.mode, info.mtime = len(payload), 0o644, 0
                        tar.addfile(info, io.BytesIO(payload))
        target.with_suffix(".part").replace(target)
    return {"name": MODEL_NAME, "url": MODEL_URL, "license": "Apache-2.0",
            "catalog": "https://alphacephei.com/vosk/models", "format": "USTAR gzip",
            "zipBytes": archive.stat().st_size, "zipSha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
            "file": target.name, "bytes": target.stat().st_size,
            "sha256": hashlib.sha256(target.read_bytes()).hexdigest()}


def main() -> None:
    cache = Path(tempfile.gettempdir()) / "synk-path-vosk-assets"
    cache.mkdir(parents=True, exist_ok=True)
    package, model = cache / "vosk-browser-0.0.8.tgz", cache / (MODEL_NAME + ".zip")
    download(PACKAGE_URL, package)
    vendor = prepare_vendor(package)
    download(MODEL_URL, model)
    metadata = {"preparedAt": "2026-10-11", "runtime": vendor, "model": prepare_model(model),
                "privacy": "Microphone PCM and transcripts are processed locally and never uploaded by this module. IDBFS caches public model files only."}
    (MODELS / "speech-assets.json").write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(metadata["model"], indent=2), flush=True)


if __name__ == "__main__":
    main()
