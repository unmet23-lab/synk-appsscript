"""Uniformly resize generated rear views to match approved front-view framing."""
from pathlib import Path
import hashlib
import json
import shutil
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
entries = []
for index, name in enumerate(('marin', 'kkamong')):
    raw = ROOT / 'art-source' / f'{name}-rear-generated.png'
    if len(sys.argv) > index + 1:
        shutil.copyfile(sys.argv[index + 1], raw)
    source = Image.open(raw).convert('RGBA')
    reference = Image.open(ROOT / 'assets' / 'mascots' / f'{name}-base.webp').convert('RGBA')
    visible = source.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox()
    ref_box = reference.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox()
    ratio = (ref_box[3] - ref_box[1]) / (visible[3] - visible[1])
    resized = source.resize((round(source.width * ratio), round(source.height * ratio)), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', reference.size)
    position = (round((ref_box[0] + ref_box[2]) / 2 - (visible[0] + visible[2]) / 2 * ratio), round(ref_box[3] - visible[3] * ratio))
    canvas.alpha_composite(resized, position)
    target = ROOT / 'assets' / 'mascots' / f'{name}-rear.webp'
    canvas.resize((512, 512), Image.Resampling.LANCZOS).save(target, 'WEBP', quality=90, method=6)
    data = target.read_bytes()
    entries.append(dict(name=name, source=str(raw.relative_to(ROOT)), path=str(target.relative_to(ROOT)), sourceSize=list(source.size), displaySize=[512, 512], bytes=len(data), sha256=hashlib.sha256(data).hexdigest()))
metadata = dict(method='Built-in image_gen identity-preserve rear-view variants, canonical 4K references. Technical uniform resizing, transparent canvas alignment and WebP encoding only; no stretching or painting. Vehicle-aligned rear planes, not billboards.', prompts='art-source/mascot-rear-prompts.json', assets=entries)
(ROOT / 'assets' / 'mascots' / 'rear-provenance.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(entries, ensure_ascii=False, indent=2))
