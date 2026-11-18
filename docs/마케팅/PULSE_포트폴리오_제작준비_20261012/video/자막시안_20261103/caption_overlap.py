"""Optional Rust pixel counter for caption placement. Install with python caption_overlap.py --build."""
import argparse
import hashlib
import os
import platform
from pathlib import Path
import shutil
import subprocess
import sys
import sysconfig
import tempfile

import numpy as np

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
    target = f"{sysconfig.get_platform()}-{platform.machine()}"
    # Git worktrees can use different line endings for exactly the same Rust source.
    revision = hashlib.sha256(source_bytes.replace(b"\r\n", b"\n")).hexdigest()
    return cache.resolve() / "SYNK" / "caption-overlap" / target / revision / ("caption_overlap" + suffix)


def load_counter(path):
    if ctypes is None:
        return None
    try:
        lib = ctypes.CDLL(str(path))
        counter = lib.caption_overlap_v1
    except (OSError, AttributeError):
        return None
    counter.argtypes = (ctypes.c_size_t, ctypes.c_size_t, ctypes.POINTER(ctypes.c_void_p),
                        ctypes.c_size_t, ctypes.c_void_p, ctypes.c_size_t, ctypes.c_void_p)
    counter.restype = ctypes.c_int
    return counter


def build():
    source_bytes = SOURCE.read_bytes()
    destination = library_path(source_bytes)
    if load_counter(destination) is not None:
        return destination
    compiler = shutil.which("rustc")
    if compiler is None:
        raise FileNotFoundError("rustc를 찾을 수 없습니다. Rust를 설치하고 다시 실행하세요.")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=destination.parent) as temp:
        work = Path(temp)
        source = work / SOURCE.name
        source.write_bytes(source_bytes.replace(b"\r\n", b"\n"))
        built = work / destination.name
        subprocess.run([str(Path(compiler).absolute()), "--edition=2024", "-O", "-C", "debuginfo=0",
                        "--crate-type", "cdylib", "--crate-name", "caption_overlap", str(source),
                        "-o", str(built)], check=True, cwd=work)
        try:
            os.replace(built, destination)
        except PermissionError:
            # Another Windows process can already have installed and loaded this revision.
            if load_counter(destination) is None:
                raise
    if load_counter(destination) is None:
        raise OSError(f"현재 Python으로 빌드 결과의 caption_overlap_v1 함수를 불러올 수 없습니다 ({destination})")
    return destination


def prepare(data, word_of):
    if not data or sys.byteorder != "little":
        return None
    try:
        counter = load_counter(library_path(SOURCE.read_bytes()))
        if counter is None:
            return None
        shape = next(iter(data.values()))[1].shape
        if len(shape) != 2 or any(mask is not None and (mask.shape != shape or mask.dtype != np.bool_)
                                  for masks in data.values() for mask in masks):
            return None
        return Overlap(counter, data, word_of, shape)
    except (OSError, MemoryError):
        return None


class Overlap:
    def __init__(self, counter, data, word_of, shape):
        self.counter = counter
        self.height, self.width = shape
        words_per_row = (self.width + 63) // 64
        frames = {}
        for frame in data:
            frames.setdefault(word_of[frame], []).append(frame)
        self.packed = {}
        for word, numbers in frames.items():
            # Each frame has a subject plane, an ink contrast plane and a paper contrast plane.
            planes = np.zeros((len(numbers), 3, self.height, words_per_row), dtype=np.uint64)
            byte_rows = planes.view(np.uint8)
            for row, number in enumerate(numbers):
                for channel, mask in enumerate(data[number]):
                    if mask is not None:
                        bits = np.packbits(mask, axis=1, bitorder="little")
                        byte_rows[row, channel, :, :bits.shape[1]] = bits
            self.packed[word] = numbers, planes

    def measure(self, word, chars):
        if word not in self.packed or not chars:
            return None
        shape = (self.height, self.width)
        if any(c.dtype != np.uint8 or c.shape != shape or not c.flags.c_contiguous for c in chars):
            return None
        numbers, planes = self.packed[word]
        try:
            addresses = (ctypes.c_void_p * len(chars))(*(c.ctypes.data for c in chars))
            out = np.empty((len(numbers), 6), dtype=np.float64)
            if not self.counter(self.width, self.height, addresses, len(chars), planes.ctypes.data,
                                len(numbers), out.ctypes.data):
                return None
            return dict(zip(numbers, out))
        except MemoryError:
            return None


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="이 PC에 자막 마스크 집계용 Rust 라이브러리를 설치합니다.")
    parser.add_argument("--build", action="store_true", required=True, help="rustc로 빌드해 사용자 캐시에 설치")
    parser.parse_args()
    try:
        print(build())
    except (OSError, subprocess.CalledProcessError) as error:
        sys.exit(str(error))
