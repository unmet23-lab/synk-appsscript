# 2차 시안(2026-11-05): 1차 OUTBLUE 셋이 게임 타이틀 · 포토샵 베벨로 읽혀 글자꼴과 재질을 바꾼다.
# 글자 원고는 Anton(OFL) — 세로로 높은 글자라 넓은 글꼴의 B · E 왼쪽 파임이 없다.
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ANTON = os.path.expanduser('~/Documents/synk-vendor/homeshopping-horror-20261021/fonts/Anton-Regular.ttf')


def word(text, size, track, name, W=2400, H=1000):
    ft = ImageFont.truetype(ANTON, size)
    im = Image.new('RGB', (W, H), 'white')
    d = ImageDraw.Draw(im)
    adv = [ft.getlength(c) for c in text]
    x = (W - sum(adv) - track * (len(text) - 1)) / 2
    box = ft.getbbox('H')
    y = (H - (box[3] - box[1])) / 2 - box[1]
    for c, a in zip(text, adv):
        d.text((x, y), c, font=ft, fill='black')
        x += a + track
    im.save(os.path.join(HERE, '원고', name), quality=95)


word('OUTBLUE', 460, 26, 'OUTBLUE_높은.jpg')

HEAD = open(os.path.join(HERE, '지시문', 'B1_두정갑.txt'), encoding='utf-8').read().split('The word reads')[0]

PROMPTS = {
    'B5_매듭': "The word reads OUTBLUE. MATERIAL: traditional Korean maedeup knotwork. All seven letters are formed by hand from thick round braided silk cord in saturated luminous cobalt blue, the cord laid in several tight parallel rows that follow each stroke like a woven sash, with real braided strand texture and tiny silk sheen. At the end of every stroke the cord is bound by a small polished antique brass cap, and a few small neat knots sit at the corners of the letters. SURFACE: one seamless panel of warm pale off-white hanji paper filling the whole image, with soft contact shadows. LIGHT: soft even daylight from upper left, photographed straight on like a fashion-house accessories lookbook. Believable craft object. No tassels hanging down, no flowers, no extra ornaments, no glow, no sparkles.",
    'B6_쪽물': "The word reads OUTBLUE. MATERIAL: real natural indigo dye on white raw silk. The letters are bold and crisp at their core in the deepest indigo, and the dye bleeds softly outward along the silk threads at the lower edge of each letter into luminous cobalt and pale sky blue, like a dip-dye that climbed into the cloth, with fine feathered capillary edges and a few natural white resist lines. The upper edges of the letters stay clean and sharp so the word reads instantly. SURFACE: the whole image is one taut flat sheet of white raw silk with a barely visible slub weave. LIGHT: soft flat daylight, photographed straight on like a fine art print for a fashion campaign. No drips, no water, no splashes, no gold, no glow, no sparkles, no 3D bevel.",
    'B7_티타늄': "The word reads OUTBLUE. MATERIAL: machined aerospace titanium, the letters milled from solid billet, 12mm thick, with razor-sharp knife-edge chamfers and a true anodised finish in saturated electric cobalt blue. Faces have a very fine satin brushed grain, chamfers are polished to a lighter ice blue. Very small flush brass rivets sit in the four corners of each letter. SURFACE: a plain seamless cool pale grey studio sweep filling the whole image, letters standing upright with a soft realistic floor contact shadow. LIGHT: bright high-key product photography with large softboxes, like a luxury sports watch or camera advertisement. Believable metal with accurate tiny reflections. No dark background, no neon, no glow, no lens flare, no plastic bevel, no reflection pool, no liquid chrome.",
    'B8_칠보': "The word reads OUTBLUE. MATERIAL: a high-jewellery brooch in traditional Korean chilbo cloisonne. The letters are fine gold-toned antique brass frames filled with hand-fired translucent glass enamel in rich layered blues: deep ink indigo, luminous cobalt and a few pale sky-blue passages, with thin brass cloison wires dividing each letter into a precise repeating scale pattern taken from Joseon armour plates, and one tiny domed brass rivet at the centre of each scale. The enamel is glossy with real depth and small natural variations. SURFACE: one seamless panel of very deep indigo silk velvet filling the whole image, with a soft contact shadow under the brooch. LIGHT: jewellery catalogue macro with soft tent light. Believable metal and fired glass. No lens flare, no star sparkles, no glow, no chain, no gemstones, no fantasy game look.",
    'O5_오팔글자': "The word reads OFALIN. MATERIAL: all six letters are carved whole from real solid white crystal opal, polished into a soft domed cabochon surface, so each letter is one single gemstone with natural play-of-colour fire drifting inside it in flashes of oxblood red, violet, apple green and deep ink blue on a milky translucent white body. Each letter is held by a very thin polished platinum rim that keeps the serif shape crisp. SURFACE: one seamless panel of warm pale pearl-white silk paper filling the whole image, with small soft contact shadows. LIGHT: jewellery catalogue macro with soft tent light from above. Real stone with real depth, not a gradient, not plastic. No mosaic, no shards, no diamonds, no lens flare, no star sparkles, no glow, no pink cast.",
}
for name, body in PROMPTS.items():
    with open(os.path.join(HERE, '지시문', name + '.txt'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(HEAD + body + '\n')
print(len(PROMPTS))
