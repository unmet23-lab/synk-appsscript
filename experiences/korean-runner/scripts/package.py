"""Build and byte-check a new delivery ZIP; preserve the previous archives."""
import hashlib
import json
import pathlib
import sys
import zipfile

root = pathlib.Path(__file__).resolve().parents[1]
output = pathlib.Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root.parent / 'korean-runner-play-20261002-v6-journey.zip'
if output.exists():
    raise FileExistsError('Use a new output name to preserve the existing delivery: ' + str(output))
files = []
for folder in ['assets', 'vendor', 'scripts']:
    files.extend(p for p in (root / folder).rglob('*')
                 if p.is_file() and p.suffix.lower() != '.wav' and '__pycache__' not in p.parts
                 and (root / 'assets/shop/source') not in p.parents)
files.extend(root / f for f in ['index.html', 'style.css', 'app.js', 'core.mjs', 'instructions.mjs',
                               'voice-timing.mjs', 'controls.mjs', 'world.mjs', 'server.mjs',
                               'README.md', 'core.test.mjs', 'controls.test.mjs', 'audio.mjs', 'audio.test.mjs',
                               'learning.mjs', 'learning.test.mjs', 'listening-check.mjs', 'listening-check-ui.mjs', 'listening-check.test.mjs', 'atlas-learning.js', 'collection.js',
                               'shop.mjs', 'shop.test.mjs', 'shop-ui.mjs', 'shop-assets.mjs',
                               'world-cosmetics.mjs', 'world-cosmetics.test.mjs', 'goals-ui.mjs',
                               'scenery-details.mjs', 'scenery-details.test.mjs'])
files.extend(p for p in (root / 'qa').glob('v5-*') if p.is_file() and p.name != 'v5-package.json')
files.append(root / 'qa/SHOP-V5.md')
files.append(root / 'qa/LISTENING-V4.md')
files.append(root / 'qa/ATLAS-LEARNING.md')
files.extend(p for p in (root / 'qa').glob('v6-*') if p.is_file() and p.name != 'v6-package.json')
files.extend(root / 'qa' / name for name in ['SCENERY-GOALS-V6.md', 'MOBILE-CHECK.md', 'balance-analysis.mjs'])
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
(root / 'qa/v6-package.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report))
