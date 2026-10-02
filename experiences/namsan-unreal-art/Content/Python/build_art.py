"""Import the shared scene without loading the Namsan gameplay C++ module."""
from pathlib import Path
import runpy

shared = Path(__file__).resolve().parents[3] / "namsan-unreal" / "Content" / "Python" / "build_namsan.py"
if not shared.is_file():
    raise RuntimeError("Keep namsan-unreal-art and namsan-unreal next to each other")
namespace = runpy.run_path(str(shared))
namespace["main"](art_only=True)
