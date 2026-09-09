"""Frame two existing outfits to a separate review folder and compare alpha handling."""
import hashlib
import importlib.util
import json
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
spec = importlib.util.spec_from_file_location('outfit_frame', REPO / 'tools/옷틀맞추기.py')
frame = importlib.util.module_from_spec(spec)
spec.loader.exec_module(frame)
out = HERE / '알파보존후보'
out.mkdir(exist_ok=True)
kit = json.loads((REPO / 'docs/디자인_토큰.json').read_text(encoding='utf8'))['색']['킷']
colors = {v['이름']:v['hex'] for v in kit}
def fingerprint(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()
def rgb_on(image, color):
    bg=Image.new('RGBA',image.size,color)
    bg.alpha_composite(image)
    return bg.convert('RGB')

report={'scope':'Two outfits, one expression each. Deterministic alpha-compositing correction only; not all 1862 output assets regenerated.', 'comparisons':[]}
ruler=frame.정본자('까몽')
canon=REPO/'docs/캐릭터/정본_4K/까몽_본체.png'
canon_before=fingerprint(canon)
for token in ['안경+여름델','목도리+여름델']:
    source=REPO/f'docs/Loom_자산/옷/GPT_표정_누끼/까몽_{token}_본체.png'
    base=REPO/f'docs/Loom_자산/옷/GPT정액시험_누끼/까몽_{token}.png'
    existing=REPO/f'docs/Loom_자산/옷/GPT_표정_누끼_틀/까몽_{token}_본체.png'
    originals={str(p):fingerprint(p) for p in [source,base,existing]}
    values=frame.맞춤값(str(base),ruler,4096)
    target=out/source.name
    measured=frame.앉히기(str(source),str(target),ruler,값=values)
    with Image.open(source) as image:
        image=image.convert('RGBA')
        resized=image.resize((round(image.width*values['k']),round(image.height*values['k'])),Image.Resampling.LANCZOS)
    legacy=Image.new('RGBA',(4096,4096),(0,0,0,0))
    legacy.paste(resized,(values['dx'],values['dy']),resized)
    with Image.open(target) as image:
        fixed=image.convert('RGBA')
    before=np.asarray(legacy)
    after=np.asarray(fixed)
    delta=np.any(before!=after,axis=2)
    with Image.open(existing) as image:
        actual=np.asarray(image.convert('RGBA'))
    unchanged_opaque=(before[...,3]==255)&(after[...,3]==255)
    visible_change=delta&((before[...,3]>0)|(after[...,3]>0))
    original_masked_match=bool(np.array_equal(actual,before))
    preview=Image.new('RGB',(800,800),colors['Paper'])
    for row,color in enumerate([colors['Paper'],colors['Ink Deep']]):
        for col,item in enumerate([legacy,fixed]):
            preview.paste(rgb_on(item,color).resize((400,400),Image.Resampling.LANCZOS),(col*400,row*400))
    preview_path=out/f'{token}_기존왼쪽_수정오른쪽_400px.png'
    preview.save(preview_path)
    for p,sha in originals.items():
        assert fingerprint(Path(p))==sha, f'Original modified: {p}'
    report['comparisons'].append({'outfit':token,'expression':'본체','values':values,'output':str(target),'preview':str(preview_path),'measurement':measured,'existingExactlyMatchesOldMaskedPaste':original_masked_match,'changedVisiblePixels':int(visible_change.sum()),'changedFullyOpaquePixels':int((delta&unchanged_opaque).sum()),'semiTransparentPixelCountAfter':int(((after[...,3]>0)&(after[...,3]<255)).sum()),'originalHashesUnchanged':originals})
    print(f'complete {token}',flush=True)
    del before,after,actual,delta,unchanged_opaque,visible_change
assert fingerprint(canon)==canon_before
report['canonicalUnchangedSha256']=canon_before
(HERE/'알파비교.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps(report,ensure_ascii=False,indent=2))
