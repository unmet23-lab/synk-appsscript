"""Shape multilingual text with HarfBuzz and outline it for native SVG covers.
Brand fonts remain for Korean/Latin/Cyrillic. Installed language fonts supply
scripts not covered by the brand fonts; actual choices are recorded per line.
"""
import json, sys
from pathlib import Path
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

ROOT=Path(__file__).resolve().parents[4]
WIN=Path('C:/Windows/Fonts')
FONT=ROOT/'docs/브랜드_폰트'
CACHE={}

def pick(ch, weight):
    cp=ord(ch); bold=weight>=700
    if 0xAC00<=cp<=0xD7AF:
        return FONT/('SUIT/SUIT-ExtraBold.otf' if bold else 'SUIT/SUIT-Medium.otf'),0,False
    if 0x3000<=cp<=0x9FFF:
        return WIN/('msjhbd.ttc' if bold else 'msjh.ttc'),0,False
    if 0x1000<=cp<=0x109F or 0xAA60<=cp<=0xAA7F:
        return WIN/('mmrtextb.ttf' if bold else 'mmrtext.ttf'),0,True
    if 0x0E00<=cp<=0x0E7F:
        return WIN/('LeelaUIb.ttf' if bold else 'LeelawUI.ttf'),0,True
    if 0x0900<=cp<=0x097F or 0x0D80<=cp<=0x0DFF:
        return WIN/'Nirmala.ttc',1 if bold else 0,True
    return FONT/('InterTight/InterTight-Bold.ttf' if bold else 'InterTight/InterTight-Medium.ttf'),0,False

def font_data(key):
    if key not in CACHE:
        file,index,_=key
        ft=TTFont(file,fontNumber=index)
        face=hb.Face(file.read_bytes(),index); font=hb.Font(face)
        font.scale=(face.upem,face.upem); hb.ot_font_set_funcs(font)
        CACHE[key]=(ft,ft.getGlyphSet(),font,face.upem)
    return CACHE[key]

out=[]
for item in json.load(sys.stdin):
    size=item['size']; weight=item.get('weight',700)
    runs=[]
    for ch in item['text']:
        key=pick(ch,weight)
        # Keep whitespace and joiners inside the preceding script run for shaping.
        if runs and (ch.isspace() or ch in '\u200c\u200d'): key=runs[-1][0]
        if runs and runs[-1][0]==key: runs[-1][1]+=ch
        else: runs.append([key,ch])
    x=0; paths=[]; bounds=[]; used=set()
    for key,text in runs:
        ft,gs,font,upem=font_data(key)
        buf=hb.Buffer();buf.add_str(text);buf.guess_segment_properties()
        hb.shape(font,buf,{'kern':True,'liga':True})
        scale=size/upem; order=ft.getGlyphOrder()
        used.add(f'{key[0].name}#{key[1]}')
        for info,pos in zip(buf.glyph_infos,buf.glyph_positions):
            if info.codepoint==0: raise ValueError(f'Missing shaped glyph in {text!r}: {key[0]}')
            glyph=gs[order[info.codepoint]]
            matrix=(scale,0,0,-scale,x+pos.x_offset*scale,-pos.y_offset*scale)
            pen=SVGPathPen(gs);glyph.draw(TransformPen(pen,matrix));paths.append(pen.getCommands())
            bp=BoundsPen(gs);glyph.draw(TransformPen(bp,matrix))
            if bp.bounds:bounds.append(bp.bounds)
            # Never add letter spacing inside complex-script clusters.
            tracking=0 if key[2] else size*item.get('tracking',-.02)
            x+=pos.x_advance*scale+tracking
    box=[min(b[0] for b in bounds),min(b[1] for b in bounds),max(b[2] for b in bounds),max(b[3] for b in bounds)]
    out.append({'d':' '.join(paths),'box':box,'fonts':sorted(used),'shaper':'HarfBuzz'})
json.dump(out,sys.stdout)
