"""Convert supplied brand fonts to exact SVG glyph outlines; no bitmap editing."""
import json, sys
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

root=Path(__file__).resolve().parents[4]
fonts={}
for key,filename in {
    'ko800':'SUIT/SUIT-ExtraBold.otf', 'ko500':'SUIT/SUIT-Medium.otf',
    'latin700':'InterTight/InterTight-Bold.ttf', 'latin500':'InterTight/InterTight-Medium.ttf'
}.items():
    f=TTFont(root/'docs/브랜드_폰트'/filename)
    fonts[key]=(f,f.getBestCmap(),f.getGlyphSet())

results=[]
for item in json.load(sys.stdin):
    size=item['size'];weight=str(item.get('weight',800));x=0;paths=[];bounds=[];used=set()
    for ch in item['text']:
        code=ord(ch)
        korean=0xAC00<=code<=0xD7AF or 0x1100<=code<=0x11FF
        key='ko'+weight if korean else 'latin'+('700' if weight=='800' else weight)
        f,cmap,gs=fonts[key]
        if code not in cmap:
            key='ko'+weight;f,cmap,gs=fonts[key]
        if code not in cmap: raise ValueError('Missing glyph: '+ch)
        optical=1.04 if 0x0400<=code<=0x052F else 1.0
        name=cmap[code];glyph=gs[name];scale=size*optical/f['head'].unitsPerEm
        pen=SVGPathPen(gs);glyph.draw(TransformPen(pen,(scale,0,0,-scale,x,0)))
        paths.append(pen.getCommands())
        bp=BoundsPen(gs);glyph.draw(TransformPen(bp,(scale,0,0,-scale,x,0)))
        if bp.bounds: bounds.append(bp.bounds)
        used.add(key);x+=glyph.width*scale+size*item.get('tracking',-.025)
    box=[min(b[0] for b in bounds),min(b[1] for b in bounds),max(b[2] for b in bounds),max(b[3] for b in bounds)] if bounds else [0,0,0,0]
    results.append({'d':' '.join(paths),'width':x-size*item.get('tracking',-.025),'box':box,'fonts':sorted(used)})
json.dump(results,sys.stdout,ensure_ascii=True)
