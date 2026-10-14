# 튜터 고르기 판을 복숭아색 무지 촬영 배경지로 다시(10-14 유호님 「튜터 고르기 배경은 복숭아색 배경지로 다시 구워줘」).
# 첫 화면 바탕 #F8C6B3과 이어지게. 소품·자세·표정 지시는 그대로 두고 방·벽·창·나무 바닥만 배경지로 바꾼다.
# 결과: p_onbpeach_<id>.txt(지시문), hf_onbpeach_<id>.txt(MASCOTS까지 채운 최종 글 — 힉스필드 GPT Image 2.5에 그대로 넣는다)
import os, re

ROOT = os.path.dirname(os.path.abspath(__file__))
PAPER = ('on a seamless peach-coloured paper photography backdrop - a soft, warm, slightly dusty peach (close to #F8C6B3) - '
         'that curves smoothly from the back down onto the floor with no visible seam, corner or horizon line, like a small tabletop photo studio. '
         'The paper has a very fine matte paper texture and gets a touch darker toward the bottom corners')
LIGHT = ('Lighting: one large soft key light from the upper left like a big diffused window, gentle fill from the right, '
         'a soft real contact shadow on the paper under the toy and the props. No room, no wall texture, no window frame, no wooden floor, '
         'nothing else in the background but the peach paper. Eye-level camera, 50mm lens look, shallow depth of field.')
SHOT = {
    'mongle': f'Mongle (see MASCOTS below and REFERENCE 1) sits {PAPER}. Mongle is curious and loves to touch everything: just to the right of Mongle stands a tiny felt flower pot with a sage-green sprout, and a small red felt ladybug rests on one leaf. Mongle\'s body is turned about 15 degrees toward the pot but its face looks straight at the camera. {LIGHT}',
    'kkamong': f'Kkamong (see MASCOTS) SITS firmly on top of a small stack of three felt books (dusty blue, mustard and cream covers, no titles) standing {PAPER}. Its round fluffy bottom presses down into the top book (the cover dents slightly), both short arms rest on its round belly, and its long tail with the coral felt paddle hangs down over the side of the books and touches the paper. It is NOT floating and its arms are NOT raised. Kkamong believes it is the coolest dragon in the world, so it sits proudly with its chest out, facing the camera. {LIGHT}',
    'marin': f'Marin (see MASCOTS) stands very upright {PAPER}, next to a tiny open felt notebook with neat dotted lines and a small pencil; beside the notebook a single white felt daisy stands in a thimble used as a vase. Marin is serious and precise but secretly kind: it stands straight like on duty, its feet flat on the paper, one tiny arm holding the strap of its cross-body pouch, facing the camera. {LIGHT}',
}
common = open(os.path.join(ROOT, 'mascot_common.txt'), encoding='utf-8').read()
for tid, shot in SHOT.items():
    body = open(os.path.join(ROOT, f'p_onb_{tid}.txt'), encoding='utf-8').read()
    lines = body.split('\n')
    idx = [i for i, l in enumerate(lines) if l.startswith('The shot (same in every frame):')]
    assert len(idx) == 1, tid
    lines[idx[0]] = 'The shot (same in every frame): ' + shot
    text = '\n'.join(lines)
    # 말풍선 자리도 배경지로
    text, n = re.subn(r'calm,? empty (cream wall|background)', 'calm empty peach backdrop paper', text)
    assert n == 1, tid
    open(os.path.join(ROOT, f'p_onbpeach_{tid}.txt'), 'w', encoding='utf-8', newline='\n').write(text)
    open(os.path.join(ROOT, f'hf_onbpeach_{tid}.txt'), 'w', encoding='utf-8', newline='\n').write(text.replace('{{MASCOTS}}', common))
    print(tid, len(text.replace('{{MASCOTS}}', common)))
