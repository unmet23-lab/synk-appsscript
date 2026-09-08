"""Encode selected Imagegen PNGs without resizing; retain alpha and record provenance."""
from pathlib import Path
from PIL import Image
import hashlib, json

root=Path(__file__).resolve().parent.parent
folder=root/'docs/엔진/단추'
items=[]
for number in range(1,7):
    source=folder/f'number-{number:02}.png'
    with Image.open(source) as image:
        if image.mode!='RGBA':
            raise ValueError(f'Missing RGBA: {number}')
        size=image.size
        if image.getchannel('A').getextrema()!=(0,255):
            raise ValueError(f'Missing transparent background: {number}')
        target=source.with_suffix('.avif')
        image.save(target,quality=94,speed=6,subsampling='4:4:4')
    with Image.open(target) as encoded:
        if encoded.size!=size or encoded.mode!='RGBA':
            raise ValueError(f'Invalid encoded asset: {number}')
        if encoded.getchannel('A').getextrema()!=(0,255):
            raise ValueError(f'Lost transparency: {number}')
    items.append({'number':f'{number:02}','file':target.name,'width':size[0],'height':size[1],'source':source.name,'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'bytes':target.stat().st_size})
    print(f'ENCODED {number}/6 {target.stat().st_size}',flush=True)
(folder/'production.json').write_text(json.dumps({'producer':'Codex built-in image_gen','upscaled':False,'format_conversion_only':True,'encoding':{'format':'AVIF','quality':94,'subsampling':'4:4:4'},'preserved_prototype':'number-01-4k.png','assets':items},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
