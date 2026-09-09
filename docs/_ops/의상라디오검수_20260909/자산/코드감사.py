"""Read-only targeted diagnostics. Writes reports here, never changes outfit or canonical assets."""
import importlib.util
import json
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, REPO / 'tools' / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

overlay = load('outfit_overlay', '옷표정얹기.py')
checker = load('outfit_checker', '옷표정검사.py')
result = {'scope': 'Three canonical eye detection probes, synthetic alpha preservation test, two targeted current expression audits. Not all-assets visual acceptance.', 'eyeProbes': {}, 'currentExpressionChecks': []}
for name in ['까몽', '몽글', '마린']:
    data, body = overlay.정본읽기(str(REPO / 'docs/캐릭터/정본_4K' / f'{name}_본체.png'))
    eye = overlay.눈찾기(data[..., :3], body)
    result['eyeProbes'][name] = eye
    del data, body

# Exact primitive used by 옷틀맞추기.py at 85 and 109: RGBA is its own paste mask.
rgba = Image.new('RGBA', (1, 1), (200, 100, 50, 128))
masked = Image.new('RGBA', (1, 1), (0, 0, 0, 0))
masked.paste(rgba, (0, 0), rgba)
preserved = Image.new('RGBA', (1, 1), (0, 0, 0, 0))
preserved.alpha_composite(rgba)
result['transparentPasteProbe'] = {'source': list(rgba.getpixel((0,0))), 'preFixMaskedPaste': list(masked.getpixel((0,0))), 'sourceOverTransparent': list(preserved.getpixel((0,0))), 'interpretation': 'Pre-fix masked paste squares alpha and darkens straight RGB against transparent black; proves a resampling/compositing defect, not its visual severity for every production asset.'}
for token in ['안경', '안경+여름델']:
    report = checker.한벌('까몽', token)
    result['currentExpressionChecks'].append(report)
    print(f'checked: {token}', flush=True)
(HERE / '코드감사.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
print(json.dumps(result, ensure_ascii=False, indent=2))
