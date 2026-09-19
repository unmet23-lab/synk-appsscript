from pathlib import Path
import cv2
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent
cap = cv2.VideoCapture(str(root / 'H3_몽글눈웃음_4K_무음.mp4'))
times = [3.35 + i * .125 for i in range(15)]
sheet = Image.new('RGB', (960 * 3, 560 * 5), '#171717')
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 26)
for i, sec in enumerate(times):
    cap.set(cv2.CAP_PROP_POS_MSEC, sec * 1000)
    ok, frame = cap.read()
    if not ok: continue
    image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    image = image.resize((960, 540), Image.Resampling.LANCZOS)
    ImageDraw.Draw(image).text((12, 10), f'{sec:.3f}s', font=font, fill='white', stroke_width=2, stroke_fill='black')
    sheet.paste(image, ((i % 3) * 960, (i // 3) * 560))
sheet.save(root / '루프마감_후반프레임.jpg', quality=94)
cap.release()
