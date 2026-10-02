"""Build the self-contained source/assets/QA package; preserve previous release."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import subprocess, sys
root=Path(__file__).resolve().parents[1]
name='story-classroom-play-20261002-v2.zip'
archive=root.parent/name
with ZipFile(archive,'w',ZIP_DEFLATED,compresslevel=6) as package:
 for file in sorted(root.rglob('*')):
  if not file.is_file() or file.name.startswith('package-results') or '__pycache__' in file.parts:continue
  package.write(file,file.relative_to(root).as_posix())
subprocess.run([sys.executable,str(root/'qa'/'verify-package.py'),name],check=True)
