"""Optional Rust kernel for felt dye transfer. Install with python tools/felt_dye.py --build."""
import argparse
import hashlib
import math
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import sysconfig
import tempfile

try:
    import ctypes
except ImportError:
    ctypes = None


SOURCE = Path(__file__).resolve().with_suffix(".rs")


def library_path(source_bytes):
    if sys.platform == "win32":
        cache = Path(os.environ.get("LOCALAPPDATA") or Path.home() / "AppData" / "Local")
        suffix = ".dll"
    elif sys.platform == "darwin":
        cache = Path.home() / "Library" / "Caches"
        suffix = ".dylib"
    else:
        cache = Path(os.environ.get("XDG_CACHE_HOME") or Path.home() / ".cache")
        suffix = ".so"
    if not cache.is_absolute():
        raise ValueError("사용자 캐시의 절대 경로가 필요합니다.")
    target = f"{sysconfig.get_platform()}-{platform.machine()}"
    revision = hashlib.sha256(source_bytes.replace(b"\r\n", b"\n")).hexdigest()
    return cache / "SYNK" / "felt-dye" / target / revision / ("felt_dye" + suffix)


def load_kernel(path):
    if ctypes is None:
        return None
    try:
        kernel = ctypes.CDLL(str(path)).felt_apply_v1
    except (OSError, AttributeError):
        return None
    kernel.argtypes = [
        ctypes.c_char_p, ctypes.POINTER(ctypes.c_ubyte), ctypes.c_size_t,
        ctypes.c_double, ctypes.c_double, ctypes.c_double, ctypes.c_double,
        ctypes.c_ubyte, ctypes.POINTER(ctypes.c_size_t),
    ]
    kernel.restype = ctypes.c_int
    return kernel


def build():
    source_bytes = SOURCE.read_bytes().replace(b"\r\n", b"\n")
    dest = library_path(source_bytes)
    if load_kernel(dest) is not None:
        return dest
    compiler = shutil.which("rustc")
    if compiler is None:
        raise FileNotFoundError("rustc를 찾을 수 없습니다. Rust를 설치하고 다시 실행하세요.")
    dest.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=dest.parent) as temp:
        source = Path(temp) / SOURCE.name
        source.write_bytes(source_bytes)
        built = Path(temp) / dest.name
        cmd = [str(Path(compiler).absolute()), "--edition=2021", "--crate-type", "cdylib",
               "-O", "-C", "strip=symbols", "-C", "panic=abort"]
        if sys.platform == "win32":
            cmd.extend(["-C", "target-feature=+crt-static"])
        subprocess.run([*cmd, str(source), "-o", str(built)], check=True, cwd=temp)
        try:
            os.replace(built, dest)
        except PermissionError:
            # A concurrent builder may have published and loaded this exact version on Windows.
            if load_kernel(dest) is None:
                raise
    if load_kernel(dest) is None:
        raise OSError(f"현재 Python에서 felt_apply_v1 함수를 불러올 수 없습니다 ({dest})")
    return dest


def prepare(image, knee, neutral):
    from PIL import Image

    if image.mode != "RGB" or not 0.0 <= knee <= 1.0:
        return None
    try:
        kernel = load_kernel(library_path(SOURCE.read_bytes()))
        if kernel is None:
            return None
        source = image.tobytes()
    except (OSError, ValueError, MemoryError):
        return None
    size = image.size

    def apply(gains):
        if not all(math.isfinite(gain) for gain in gains):
            return None
        try:
            result = bytearray(len(source))
            buf = (ctypes.c_ubyte * len(result)).from_buffer(result)
            counts = (ctypes.c_size_t * 2)()
            if kernel(source, buf, len(source), *gains, knee, neutral, counts) != 0:
                return None
            return Image.frombytes("RGB", size, result), counts[0], counts[1]
        except MemoryError:
            return None

    return apply


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="펠트 재염색용 Rust 계산기를 사용자 캐시에 설치합니다.")
    parser.add_argument("--build", required=True, action="store_true")
    parser.parse_args()
    try:
        print(build())
    except (OSError, ValueError, subprocess.CalledProcessError) as exc:
        sys.exit(str(exc))
