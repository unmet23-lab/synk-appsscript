from pathlib import Path
from PIL import Image
import hashlib, json
root=Path(__file__).resolve().parents[1]
source=Path(r'C:\Users\q1212\.codex\generated_images\01a0f3a6-d765-7340-833d-201fc4caabf1\exec-e62b5001-6425-4aee-893d-f666ab13c224.png')
original=root/'art-source/blossom-tree-generated.png'
original.write_bytes(source.read_bytes())
image=Image.open(original)
assert image.mode=='RGBA' and image.getchannel('A').getextrema()[0]==0
image.thumbnail((768,1152),Image.Resampling.LANCZOS)
image.save(root/'assets/blossom-tree.webp',quality=88,method=6)
print(json.dumps({'pixels':image.size,'bytes':(root/'assets/blossom-tree.webp').stat().st_size,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest()}))
