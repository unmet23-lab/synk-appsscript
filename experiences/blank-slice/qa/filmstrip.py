# 손맛 프레임: 시연 영상에서 벤 순간 앞뒤를 40ms 간격으로 잘라 한 장에 모은다(qa/demo.cjs가 부른다).
# 쓰는 법: python filmstrip.py <영상> <벤 시각(초)> <x> <y> <화면 폭> <화면 높이> <저장할 jpg>
import io, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

video, at, x, y, W, H, out = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]), int(sys.argv[5]), int(sys.argv[6]), sys.argv[7]
OFFS = [-40, 0, 40, 80, 120, 160, 240, 360, 520]
NOTE = {-40: '베기 직전', 0: '벤 순간', 40: '멈칫(히트스톱)', 80: '멈칫 끝', 120: '두 쪽이 벌어짐', 160: '느린 화면', 240: '반짝이', 360: '낱말이 날아감', 520: '빈칸에 끼워짐'}
cw, ch = (440, 300) if W > 600 else (340, 270)
left = int(min(max(0, x - cw / 2), W - cw)); top = int(min(max(0, y - ch * 0.62), H - ch))

def frame(t):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{max(0, t):.3f}', '-i', video, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'], capture_output=True, check=True)
    return Image.open(io.BytesIO(r.stdout)).convert('RGB')

font = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 19)
small = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 15)
cols, pad, head = 3, 14, 50
rows = (len(OFFS) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (cw + pad) + pad, rows * (ch + head + pad) + pad), '#fbf7f0')
d = ImageDraw.Draw(sheet)
for i, ms in enumerate(OFFS):
    im = frame(at + ms / 1000).crop((left, top, left + cw, top + ch))
    x0 = pad + (i % cols) * (cw + pad); y0 = pad + (i // cols) * (ch + head + pad)
    d.text((x0, y0), f'{ms:+d}ms' if ms else '0ms', font=font, fill='#ae322a')
    d.text((x0, y0 + 25), NOTE.get(ms, ''), font=small, fill='#575046')
    sheet.paste(im, (x0, y0 + head))
sheet.save(out, quality=90)
