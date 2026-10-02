"""Materialize only the assets used by this first post; preserve approved originals."""
from pathlib import Path
import hashlib
import json
import shutil

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[3]
PUBLIC = OUT / 'public'
KIT = ROOT / 'docs/홍보물/마케팅실행_20260909/브랜드킷'
TRIAL = ROOT / 'docs/홍보물/첫게시물_20260910/_실험/수노_임시남성_01'
hashfile = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()

def main():
    manifest = json.loads((KIT / '배치명세.json').read_text(encoding='utf-8'))
    originals = {}
    for variant, filename in [('Ink', 'logo-shift.png'), ('Paper', 'logo-shift-paper.png')]:
        item = next(x for x in manifest['items'] if x['brand'] == 'SHIFT' and x['variant'] == variant)
        asset = KIT / item['file']
        assert hashfile(asset) == item['sha256'], f'Current approved logo changed: {asset}'
        originals[f'firstpost20260911/{filename}'] = asset
    for filename in ['synk-intro.png', 'felt-dark.webp', 'letter.webp']:
        originals[f'firstpost20260911/{filename}'] = TRIAL / 'public/firstposts20260910' / filename
    film = TRIAL / 'video_17.2초.mp4'
    assert hashfile(film) == '345283d20b41fa48dfc056b264cf702e236f1e71799d806dfb0482a63069f9ec'
    originals['firstpost20260911/approved-trial.mp4'] = film
    for font in (TRIAL / 'public/폰트').iterdir():
        if font.is_file():
            originals[f'폰트/{font.name}'] = font
    originals['audio/master.wav'] = OUT / 'audio/master.wav'
    copied = []
    for rel, original in originals.items():
        target = PUBLIC / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(original, target)
        digest = hashfile(original)
        assert hashfile(target) == digest
        copied.append({'source': str(original.relative_to(ROOT)), 'destination': str(target.relative_to(OUT)), 'sha256': digest})
    canon = ['docs/AI_운영원칙.md', 'docs/SYNK_철학.md', 'docs/마케팅/SHIFT.md', 'DESIGN.md',
             'docs/디자인_토큰.json', 'docs/명품_기준_v1.md', '영상/src/firstposts20260910/theme.ts',
             '영상/src/킷/폰트.ts', '영상/src/firstpost20260911/FirstPost.tsx']
    audit = {'purpose': 'New complete introduction for SHIFT @yuhobuilds; approved 17.2s trial retained for later posting',
             'copiedAssets': copied, 'sourceHashes': {p: hashfile(ROOT / p) for p in canon},
             'approvedTrialUnchanged': True, 'postedToSocial': False}
    (OUT / 'asset-audit.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Materialized {len(copied)} verified assets into {PUBLIC}')

if __name__ == '__main__':
    main()
