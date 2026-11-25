# 시작 그림 다섯 장의 위 벽(늘려 붙인 띠 · 이음매)을 GPT 편집 굽기로 잇는 지시문을 쓴다(11-25 15시 회차).
# 쓰는 법: python -I -X utf8 판/_위잇기.py  →  판/u1.txt … u5.txt. 굽기: node tools/그림굽기.js <편> 판/u1.txt u1 영상칸/시작/h1.jpg
import pathlib
HEAD = '''Use your image generation tool to create exactly ONE image. Do not write code, do not edit files, do not run shell commands. After the image is generated, reply with one short line describing it.

TASK — image repair. Image 1 is a tall portrait 9:16 photo of a handmade needle-felt miniature set. Its top third was crudely stretched: there is a hard horizontal seam about one third down from the top, and flat vertical streaks above it. Make the same photo again as ONE seamless tall portrait 9:16 photo (1080 x 1920).

KEEP EXACTLY as in Image 1 (same place in the frame, same size, same pose, same light, same colours, same lens blur): everything below the seam - the characters, their faces and eyes, every prop, the floor, the lanterns. Do not move, resize, redraw or restyle them. Do not zoom in or out, do not crop.
'''
TAIL = '''
The top 30% of the photo stays calm, plain plum-purple wool felt wall with the same fuzzy needle-felt fibres and the same soft light falloff as just below the seam, getting gently darker toward the top - no seam, no streaks, no lines, no new objects, no windows, no decorations up there.
Mongle is the coral-pink felt blob: it has NO arms, NO legs, NO mouth and NO neck; its eyes stay exactly as in Image 1. Everything is matte needle-felted wool. Absolutely no text, letters, numbers, symbols or watermarks.
'''
ONE = {
 'u1': 'ABOVE THE SEAM: the plum felt wall simply continues upward. The cord of the round amber lantern on the right continues straight up and out of the top of the frame.',
 'u2': 'ABOVE THE SEAM: the plum felt wall simply continues upward.',
 'u3': 'ABOVE THE SEAM: the plum felt wall continues upward. The single thin wool thread the spider hangs from continues perfectly straight up and out of the top of the frame. The two curled brown lantern brackets at the left and right, which are cut off at the seam, finish their curl naturally and end on the wall.',
 'u4': 'ABOVE THE SEAM: the dark plum felt wall simply continues upward, almost black at the top, and the small lantern bracket on the left stays as it is.',
 'u5': 'ABOVE THE SEAM: the near wall corner on the right of the staff member continues straight up as one clean vertical edge to the top of the frame, the wall left of it lighter plum and the wall right of it darker, exactly as below the seam; the curled lantern bracket on the right finishes its curl and ends on the wall; the arch of the green doorway at the far right closes naturally.',
}
for k, v in ONE.items():
    pathlib.Path(__file__).with_name(k + '.txt').write_text(HEAD + '\n' + v + TAIL, encoding='utf-8')
    print(k)
