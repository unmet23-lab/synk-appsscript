"""Build and byte-check a new delivery ZIP; preserve the previous archives."""
import hashlib
import json
import pathlib
import sys
import zipfile

root = pathlib.Path(__file__).resolve().parents[1]
output = pathlib.Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root.parent / 'korean-runner-play-20261007-v7-lab.zip'
if output.exists():
    raise FileExistsError('Use a new output name to preserve the existing delivery: ' + str(output))
files = []
for folder in ['assets', 'vendor', 'scripts', 'kit']:
    files.extend(p for p in (root / folder).rglob('*')
                 if p.is_file() and p.suffix.lower() != '.wav' and '__pycache__' not in p.parts)
files.extend(root / f for f in ['index.html', 'style.css', 'app.mjs', 'core.mjs', 'instructions.mjs', 'voice-timing.mjs',
                               'controls.mjs', 'world.mjs', 'course-motion.mjs', 'scenery.mjs', 'hero.mjs', 'report.mjs',
                               'audio.mjs', 'learning.mjs', 'listening-check.mjs', 'listening-check-ui.mjs', 'atlas-learning.js', 'collection.js',
                               'server.mjs', 'README.md',
                               'core.test.mjs', 'controls.test.mjs', 'audio.test.mjs', 'flow.test.mjs', 'learning.test.mjs',
                               'listening-check.test.mjs', 'course-motion.test.mjs', 'report.test.mjs'])
files.extend(root / 'qa' / name for name in ['play.cjs', 'play-results.json', 'MOBILE-CHECK.md'])
with zipfile.ZipFile(output, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for file in sorted(set(files)):
        archive.write(file, 'korean-runner/' + file.relative_to(root).as_posix())
with zipfile.ZipFile(output) as archive:
    if archive.testzip() is not None:
        raise ValueError('ZIP CRC check failed')
    for name in archive.namelist():
        if archive.read(name) != (root / pathlib.PurePosixPath(name).relative_to('korean-runner')).read_bytes():
            raise ValueError('ZIP content mismatch: ' + name)
report = {'zip': output.name, 'entries': len(set(files)), 'bytes': output.stat().st_size,
          'sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'crc': 'passed', 'byteMatch': 'passed'}
(root / 'qa/v7-package.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report))
