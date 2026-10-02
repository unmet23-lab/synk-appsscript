from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / 'tmp/pdfs/yuhobuilds-ep01-v1/fonts'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE = ROOT / 'docs/브랜드_폰트/SUIT/SUIT-Variable.woff2'
for weight in (400, 500, 600, 800):
    target = OUT / f'SUIT-{weight}.ttf'
    if target.exists():
        continue
    font = TTFont(SOURCE)
    font = instantiateVariableFont(font, {'wght': weight}, inplace=True, updateFontNames=True)
    font.flavor = None
    font.save(target)
    check = TTFont(target)
    assert check['OS/2'].usWeightClass == weight
    assert 'fvar' not in check
print('Static SUIT font weights ready.')
