import json, pathlib, subprocess
from PIL import Image, ImageDraw, ImageFont

root = pathlib.Path(__file__).resolve().parents[1]
video = root / 'synkbrief-meeting-v19.mp4'
out = root / 'verification'
scenes = json.loads((root / 'scenes.json').read_text(encoding='utf-8'))
frames = []
for i, scene in enumerate(scenes):
    at = scene['start'] + min(4.0, scene['duration'] * .7)
    path = out / f'scene-{i+1:02d}-{scene["id"]}.jpg'
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', str(at), '-i', str(video), '-frames:v', '1', '-vf', 'scale=360:640', str(path)], check=True)
    frames.append((path, f'{i+1:02d}  {scene["id"]}  {at:.2f}s'))
for start in range(0, len(frames), 12):
    batch = frames[start:start+12]
    sheet = Image.new('RGB', (1080, 4*668), '#e5e9f1')
    draw = ImageDraw.Draw(sheet)
    for j, (path, label) in enumerate(batch):
        x, y = (j % 3) * 360, (j // 3) * 668
        draw.text((x+7, y+7), label, fill='#111827')
        sheet.paste(Image.open(path), (x, y+28))
    sheet.save(out / f'final-contact-{start//12+1}.jpg', quality=91)
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', '3', '-i', str(video), '-frames:v', '1', '-vf', 'scale=720:1280', str(out / 'poster.jpg')], check=True)
print(json.dumps({'sampledScenes': len(frames), 'contactSheets': 2, 'poster': 'verification/poster.jpg'}))
