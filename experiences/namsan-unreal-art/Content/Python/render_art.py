"""Run the exact common UE comparison cameras in the content-only art project."""
from pathlib import Path
import runpy

shared = Path(__file__).resolve().parents[3] / "namsan-unreal" / "Content" / "Python" / "render_comparison.py"
if not shared.is_file():
    raise RuntimeError("Keep namsan-unreal-art and namsan-unreal next to each other")
namespace = runpy.run_path(str(shared), run_name="__main__")
