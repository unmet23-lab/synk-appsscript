import sys,glob,os
from PIL import Image,ImageDraw,ImageFont
from fontTools.ttLib import TTFont
paths=sys.argv[2:]
rows=[]
for p in paths:
    f=TTFont(p); ax=[(a.axisTag,a.minValue,a.defaultValue,a.maxValue) for a in f['fvar'].axes] if 'fvar' in f else []
    rows.append((p,ax))
W=2000;H=210*len(rows)+10
im=Image.new('RGB',(W,H),'white');d=ImageDraw.Draw(im);y=10
small=ImageFont.truetype(paths[0],18)
for p,ax in rows:
    ft=ImageFont.truetype(p,130)
    if ax:
        try:
            vals=[]
            for t,a,b,c in ax:
                vals.append({'wght':c if t=='wght' else b,'opsz':c if t=='opsz' else b}.get(t,b))
            ft.set_variation_by_axes(vals)
        except Exception as e: print(e)
    d.text((20,y+10),'OFALIN',font=ft,fill='black'); d.text((1000,y+10),'OUTBLUE',font=ft,fill='#123C9C')
    d.text((20,y+175),os.path.basename(p)+' '+str(ax)[:120],font=small,fill='#888'); y+=210
im.save(sys.argv[1]); print(rows)
