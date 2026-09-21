"""Outline native SVG text; reuse approved fonts, with Yu Gothic for missing Japanese glyphs."""
import json, sys
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

root = Path(__file__).resolve().parents[4]
fonts = {}
for key, filename in {
    'ko800':'SUIT/SUIT-ExtraBold.otf','ko500':'SUIT/SUIT-Medium.otf',
    'latin700':'InterTight/InterTight-Bold.ttf','latin500':'InterTight/InterTight-Medium.ttf'
}.items():
    f=TTFont(root/'docs/브랜드_폰트'/filename)
    fonts[key]=(f,f.getBestCmap(),f.getGlyphSet())
for key, filename in {'ja700':'YuGothB.ttc','ja500':'YuGothM.ttc'}.items():
    f=TTFont(Path('C:/Windows/Fonts')/filename,fontNumber=0)
    fonts[key]=(f,f.getBestCmap(),f.getGlyphSet())
out=[]
for item in json.load(sys.stdin):
    size=item['size']; weight=item.get('weight',700); x=0; paths=[]; bounds=[]; used=set()
    for ch in item['text']:
        code=ord(ch)
        if 0xAC00<=code<=0xD7AF: key='ko800' if weight>=700 else 'ko500'
        elif 0x3000<=code<=0x9FFF: key='ja700' if weight>=700 else 'ja500'
        else: key='latin700' if weight>=700 else 'latin500'
        f,cmap,gs=fonts[key]
        if code not in cmap: raise ValueError(f'Missing glyph {ch!r} in {key}')
        glyph=gs[cmap[code]]; scale=size/f['head'].unitsPerEm
        matrix=(scale,0,0,-scale,x,0)
        pen=SVGPathPen(gs); glyph.draw(TransformPen(pen,matrix)); paths.append(pen.getCommands())
        bp=BoundsPen(gs); glyph.draw(TransformPen(bp,matrix))
        if bp.bounds: bounds.append(bp.bounds)
        used.add(key); x+=glyph.width*scale+size*item.get('tracking',-.02)
    box=[min(b[0] for b in bounds),min(b[1] for b in bounds),max(b[2] for b in bounds),max(b[3] for b in bounds)]
    out.append({'d':' '.join(paths),'box':box,'fonts':sorted(used)})
json.dump(out,sys.stdout)
