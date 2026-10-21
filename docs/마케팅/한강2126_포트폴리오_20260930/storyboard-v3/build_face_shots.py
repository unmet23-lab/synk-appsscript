# -*- coding: utf-8 -*-
"""한강 2126 콘티 v3 — 얼굴 컷 다시 뽑기 (10-03 저녁).

첫 인물 카드(P1)는 유호님이 「이 사람은 아예 다른 사람인데?」라고 했다. 얼굴을 작게·고개 숙이게 짠 구도와 반대 방향 각도 사진이 겹쳤다.
캐스팅 대표 사진 방식(얼굴을 크게, 확정 얼굴 B·C 먼저)으로 후보 a·b·c를 뽑았고 「좋아 잘 만들었어. 전부 다 마음에 들어」였다.
같은 방식으로 얼굴이 나오는 컷을 다시 뽑는다. 각도는 오른쪽 45도 승인 사진(a·b), 옆얼굴은 오른쪽 90도 승인 사진.

    python build_face_shots.py   → face_shots.json
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
S = 'C:/Users/q1212/AppData/Local/Temp/claude/C--Users-q1212-Documents-SYNK-appsscript/e01eab5a-9585-4a28-83ac-e5bac16b35c9/scratchpad/hanref/'
F5 = [S + 'F_B.png', S + 'F_C.png', S + 'F_P02.png', S + 'F_P11.png', S + 'F_V181.png']
ID = ('The exact same Korean man as in Images 1 and 2 — keep exactly that face in every detail: the shape of his eyes with the visible '
      'double-eyelid crease, his nose, lips, cheekbones and defined jawline, and his tight, neat cornrow braids pulled straight back. '
      'Images 3 to 5 are his real photos, for identity only (ignore the short hair in Images 3 and 4 and all backgrounds and clothing). '
      'Ignore the hand, ring and clothing in Images 1 and 2.')
R45 = ' Images 6 and 7 are his real face at exactly this 45-degree angle: match them.'
R90 = ' Image 6 is his real right-facing profile at exactly this angle: match it.'
END = ('\n\nWell-rested and freshly groomed: clear, healthy, even-toned skin with a fine natural texture (not airbrushed, not plastic), '
       'neat brows, bright alert eyes with catchlights. He looks strikingly handsome while staying unmistakably the same person as in '
       'Images 1 and 2. Large soft key light from the front at a slight angle with a gentle fill, warm filmic color, fine film grain. '
       'A real film frame from a premium brand film, photoreal, not an AI image. No text or logos anywhere.')
END_VR = ('\n\nFreshly groomed: clear, healthy, even-toned skin with a fine natural texture (not airbrushed, not plastic). He stays '
          'unmistakably the same person as in Images 1 and 2: the same nose, lips, cheekbones, jawline and cornrows. Large soft key light '
          'from the front at a slight angle with a gentle fill, warm filmic color, fine film grain. A real film frame from a premium brand '
          'film, photoreal, not an AI image. No text or logos anywhere.')
OUTFIT = 'charcoal shirt jacket over a plain white T-shirt, dark trousers, black backpack, no logos'

rows = [
    {'id': 'S04b_bump_side', 'refs': F5 + [S + 'A_R90.png', S + 'P2.png', S + 'S05.png'],
     'prompt': ID + R90 + '\n\nNew photo: a MEDIUM SHOT from the waist up, side view at 90 degrees, vertical 9:16 frame, 50mm lens at chest height: '
               'he faces the right of the frame in exact profile like Image 6 (nose pointing screen-right), a plain matte-black VR headset with no '
               'logo covering his eyes, and leans hard to the right like a racing driver taking a corner; the clear cup of iced coffee sloshes in '
               'his right hand; the grey-hooded shoulder of a jogger passing the other way clips his shoulder at the edge of the frame. A split '
               f'second before the coffee spills. Image 7 is his outfit ({OUTFIT}; ignore its pose and background). Image 8 is the same place a '
               'moment later: the golden-hour riverside promenade with the white felt building.' + END_VR},
    {'id': 'S08b_recatch_45', 'refs': F5 + [S + 'A_R45a.png', S + 'A_R45b.png', S + 'P2.png', S + 'S05.png'],
     'prompt': ID + R45 + '\n\nNew photo: a CHEST-UP SHOT at 45 degrees, vertical 9:16 frame, 50mm lens at eye level: his face large in the upper '
               'part of the frame, turned about 45 degrees toward the right of the frame like Images 6 and 7, a plain matte-black VR headset with '
               'no logo covering his eyes; calm and deadpan, he sweeps the clear plastic cup through coffee frozen in mid-air, and glassy amber '
               'ribbons and ice cubes stream back into the cup; around him pink petals and a pigeon hang frozen in the golden light. Image 8 is '
               f'his outfit ({OUTFIT}; ignore its pose and background). Image 9 is the same frozen moment on the promenade.' + END_VR},
    {'id': 'S10b_reveal', 'refs': F5 + [S + 'A_R45a.png', S + 'A_R45b.png', S + 'P1n_c.png', S + 'S05.png'],
     'prompt': ID + R45 + '\n\nNew photo: a CHEST-UP PORTRAIT at 45 degrees, vertical 9:16 frame, 85mm lens at eye level: his face large and sharp '
               'in the upper half of the frame, turned about 45 degrees toward the right of the frame exactly like Images 6 and 7; with his left '
               'hand he has just pushed the plain matte-black VR headset up onto the top of his head, revealing his face; his eyes open, clear and '
               'level; a calm, composed poker face, lips closed; the clear cup of iced coffee, lid on, in his right hand at chest height. Behind '
               'him, softly out of focus, the golden-hour riverside promenade, the white felt building, pigeons flying off and pink petals '
               'falling. Image 8 is his outfit with the headset on his head (ignore its framing and background). Image 9 is the scene behind him.' + END},
    {'id': 'S41b_late_entry', 'refs': [S + 'S33.png', S + 'P1n_c.png', S + 'F_B.png', S + 'F_C.png'],
     'prompt': 'WIDE SHOT, vertical 9:16 frame, 24mm lens: at the back of the warm coral felt learning room of Image 1, he walks in through the '
               'doorway with his iced coffee, the VR headset pushed up on his head; he is exactly the man in Image 2, and his face is exactly the '
               'face in Images 3 and 4 (ignore the hand, ring and clothing in Images 3 and 4). In the foreground the curly-haired learner turns '
               'toward him mid-word, pointing playfully; the other two learners look over too. Keep the room, the three learners, their faces, hair '
               'and clothes exactly as in Image 1. Warm golden light through tall windows. A real film frame from a premium brand film, photoreal, '
               'fine film grain. No text or logos anywhere.'},
    {'id': 'S43b_hero_45', 'refs': F5 + [S + 'A_R45a.png', S + 'A_R45b.png', S + 'P1n_c.png', S + 'S40.png', S + 'S33.png'],
     'prompt': ID + R45 + '\n\nNew photo: a HEAD-AND-SHOULDERS PORTRAIT at 45 degrees, vertical 9:16 frame, 85mm lens at eye level: his face large '
               'and sharp in the upper half of the frame, turned about 45 degrees toward the right of the frame exactly like Images 6 and 7, '
               'looking down a little at a dragonfly-like drone (Image 9) that has landed on the flat white lid of the clear iced coffee he holds '
               'up near his chest; perfectly deadpan, one eyebrow barely raised, lips closed, as if raising the cup in a quiet toast; the VR headset '
               'rests on top of his head as in Image 8. Behind him, softly out of focus, the warm coral felt learning room and the learners '
               '(Image 10).' + END},
    {'id': 'S34c_request_45', 'refs': [S + 'S33.png'],
     'prompt': 'MEDIUM SHOT at 45 degrees, upright vertical 9:16 frame with a level horizon, 50mm lens: the curly-haired woman from Image 1 looks at '
               'the glowing blue knot-shaped puzzle piece in the hand of the Southeast Asian man in his thirties from Image 1 (short black hair, '
               'dark green knit; keep his face) and speaks to him, mid-sentence, with a friendly natural expression; both sit upright at the '
               'tabletop river model; the coral felt room softly blurred. Keep the people, faces, hair and clothes exactly as in Image 1. Warm '
               'golden light. A real film frame from a premium brand film, photoreal, fine film grain. No text or logos anywhere.'},
]
for r in rows:
    r.update({'model': 'nano_banana_pro', 'aspect': '9:16', 'resolution': '2k'})
if __name__ == '__main__':
    with open(os.path.join(HERE, 'face_shots.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(rows, f, ensure_ascii=False, indent=1)
    missing = [p for r in rows for p in r['refs'] if not os.path.exists(p)]
    print(len(rows), 'shots, missing refs:', missing)
