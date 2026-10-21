"""Verify current dated output; previous verifier is preserved in previous-sources."""
from pathlib import Path
import argparse
import runpy

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', type=Path, default=Path(__file__).resolve().parent / 'output-20261007')
    args = parser.parse_args()
    verifier = args.output_dir.resolve() / 'verify-20261007.py'
    if not verifier.is_file():
        raise FileNotFoundError(f'Current output verifier not found: {verifier}')
    runpy.run_path(str(verifier), run_name='__main__')
