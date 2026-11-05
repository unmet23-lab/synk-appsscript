# 아이돌 두 팀 로고 1차 시안 — 글자 원고와 지시문을 만든다(2026-11-05).
# 글꼴은 OFL(Fraunces · Unbounded). 원고는 흰 바탕 JPEG(투명 참고는 GPT 굽기에 안 먹는다).
import os
import sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
F = os.path.expanduser('~/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p1p3/글꼴')
os.makedirs(os.path.join(HERE, '원고'), exist_ok=True)
os.makedirs(os.path.join(HERE, '지시문'), exist_ok=True)
os.makedirs(os.path.join(HERE, '판'), exist_ok=True)


def word(text, path, axes, size, track, stroke, name, W=2400, H=1000):
    ft = ImageFont.truetype(path, size)
    ft.set_variation_by_axes(axes)
    im = Image.new('RGB', (W, H), 'white')
    d = ImageDraw.Draw(im)
    adv = [ft.getlength(c) for c in text]
    x = (W - sum(adv) - track * (len(text) - 1)) / 2
    box = ft.getbbox('H')
    y = (H - (box[3] - box[1])) / 2 - box[1]
    for c, a in zip(text, adv):
        d.text((x, y), c, font=ft, fill='black', stroke_width=stroke, stroke_fill='black')
        x += a + track
    im.save(os.path.join(HERE, '원고', name), quality=95)


# Fraunces 축 순서: opsz, wght, SOFT, WONK — 가는 획이 끊기지 않게 opsz를 낮춘다
word('OFALIN', os.path.join(F, 'Fraunces.ttf'), [72, 800, 0, 0], 470, 18, 3, 'OFALIN_세리프.jpg')
word('OUTBLUE', os.path.join(F, 'Unbounded.ttf'), [900], 300, 34, 0, 'OUTBLUE_넓은.jpg')

HEAD = """Use your image generation tool to create exactly ONE image. Do not write code, do not edit files, do not run shell commands. After the image is generated, reply with one short line describing it.

IMAGE BRIEF: a premium logo artwork for a fictional K-pop group, 3:2 horizontal. Image 1 is the exact letter artwork. Copy every stroke, proportion, serif, spacing and every enclosed hole of Image 1 exactly, same reading order left to right, letters upright and facing the camera, no perspective tilt, no extra letters, no other text anywhere, no tagline, no watermark. The word must fill about 78% of the image width and stay perfectly legible at phone size. No stroke may be added, merged or removed. Keep generous empty margin around the word.

"""

PROMPTS = {
    'O1_나전': "The word reads OFALIN. MATERIAL: traditional Korean najeonchilgi, real mother-of-pearl inlay. Every letter is filled with hundreds of tiny hand-cut irregular shards of abalone and pearl shell fitted edge to edge with hair-thin dark gaps, flush with the surface and polished. The shell shows real iridescent fire shifting across each letter: pearl white as the base with drifting oxblood rose, violet, apple green and deep ink blue. A very fine silver line outlines each letter. SURFACE: one flat, seamless plate of deep black urushi lacquer filling the whole image, with a soft broad window reflection only along the top edge. LIGHT: soft museum light from upper left, photographed straight on like a high-end auction catalogue macro. Real craft object, not CGI gloss. No lens flare, no sparkle stars, no glow, no bevel, no gold, no flowers, no ornament other than the letters.",
    'O2_보석': "The word reads OFALIN. MATERIAL: a high-jewellery brooch you could actually wear. The letters F, A, L, I, N are solid polished platinum with a fine row of tiny brilliant-cut diamonds set along the thick strokes and clean mirror metal on the thin strokes. The letter O alone is built around one large real oval white opal cabochon held by a platinum rim and four small claws, showing natural play-of-colour flashes in oxblood red, violet, apple green and ink blue on a milky white body. The opal fills the O so the counter of the O reads as the stone. BACKGROUND: seamless pale pearl-white silk paper, slightly warm, completely plain. LIGHT: jewellery catalogue macro, soft tent light, a small natural contact shadow under the brooch. Believable metal and stone, tiny real reflections. No lens flare, no star sparkles, no glow, no hands, no model, no chain, no pink cast.",
    'O3_빛갈림': "The word reads OFALIN. MATERIAL: the letters are thick cut slabs of perfectly clear optical crystal with crisp polished faceted edges, standing on and leaning very slightly from a matte white plaster wall so they cast light onto it. LIGHT: one hard narrow white beam comes from the upper left through the glass. Behind and below each letter the wall shows real refraction caustics: the white light splits cleanly into exactly four soft colour bands in this order, oxblood red, violet, apple green, deep ink blue, fanning out to the lower right as sharp thin streaks with fine caustic lines inside. The crystal letters themselves stay colourless with dark and bright refraction edges so the word reads clearly against the white. BACKGROUND: only the matte white wall. Photographed like a real optics experiment for a fashion campaign. No rainbow gradient fill inside the letters, no glow, no sparkles, no lens flare, no pink haze.",
    'B1_두정갑': "The word reads OUTBLUE. MATERIAL: Joseon-dynasty dujeonggap armour turned into lettering. Each letter is a heavy plate of hand-forged steel covered in deep luminous cobalt-blue lacquered enamel, slightly domed with softly rolled edges, trimmed with a thin antique brass edge band. Evenly spaced rows of round hand-hammered antique brass rivets run along the centre of every stroke, each rivet with a small highlight and tiny tool marks. Faint real wear on the corners. SURFACE: the plates lie on one seamless piece of very dark navy heavy silk with a barely visible woven texture, filling the whole image. LIGHT: one soft directional light from upper left with real small contact shadows, like a museum armour catalogue. No sword, no helmet, no tassels, no glowing edges, no lens flare, no sparks, no gold glitter, no fantasy game look.",
    'B2_쪽데님': "The word reads OUTBLUE. MATERIAL: a real luxury textile applique. The seven letters are cut from four different natural indigo fabrics, used in a varied rhythm across the word: inky raw selvedge denim, mid-blue washed denim, pale bleached denim with soft fading, and glossy indigo-dyed silk satin. Each letter has a padded, softly raised body with slight fabric puckering and a dense chain-stitch outline in antique brass-gold thread, with visible individual stitches and a few frayed fibres at the edges. SURFACE: all lying flat on one seamless panel of very dark raw indigo denim with visible twill weave, filling the whole image. LIGHT: soft raking studio light from upper left that shows the thread and weave. Photographed straight on like a fashion-house embroidery atelier macro. No varsity patches, no extra stitched words, no stars, no badges, no leather labels, no sparkles.",
    'B3_청강': "The word reads OUTBLUE. MATERIAL: heat-blued mirror steel, like a hand-finished luxury watch hand or a master swordsmith blade. Each letter is a thick slab of polished steel with a true temper colour: deep electric cobalt blue across the faces shifting subtly to indigo and to a thin pale straw-gold only at a few edges. Crisp machined bevels catch sharp clean reflections. A row of very small round brass rivets runs along the bottom edge of each letter only. BACKGROUND: one plain seamless matte near-black indigo surface, filling the whole image, with a very faint reflection below the letters. LIGHT: strip softbox reflections from above, like a luxury watch macro advertisement. Believable metal. No liquid chrome blobs, no melted shapes, no glow, no neon, no lens flare, no sparks, no holographic rainbow.",
}
for name, body in PROMPTS.items():
    with open(os.path.join(HERE, '지시문', name + '.txt'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(HEAD + body + '\n')
print(len(PROMPTS), '지시문', file=sys.stdout)
