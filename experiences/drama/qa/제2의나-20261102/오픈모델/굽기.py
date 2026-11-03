"""
「제2의 나」 사진 아바타 — 오픈 편집 모델 견주기 실행기 (2026-11-03).

나중에 자체 GPU + 오픈 모델로 옮길 수 있는지, 11-03 GPT 이미지 2.5 작은 시험(`../사진시험/README.md`)과 같은 입력으로 굽는다.
- 기준 사진 「강」: 유호님(본인 동의 사진 ref_pro01_face) · 대역 u1 · u2 — 그때 GPT에 넣은 지시문 파일 그대로
- 나이 「강+」(늘 19~20살 + 「열아홉 얼굴」 단락): 지어낸 36 · 45 · 52세
- 옷장 넷 × 셋: GPT 「강」 기준 사진(같은 입력)에 머리 둘 · 옷 · 액세서리 — 지시문은 `옷장조립.mjs`가 만든 파일 그대로
모델은 우리 비공개 ZeroGPU Space(`space/app.py`, q121235/me2-<모델>)에서 돈다 — 학생 · 유호님 사진은 남의 Space에 올리지 않는다.
한 번 부를 때마다 `tools/허깅페이스.py`의 한도지키기로 남은 초를 보고, 넘치면 멈춘다(현금 0).

LongCat은 글을 512토큰까지만 받아(넘으면 diffusers 0.39 LongCatImageEditPipeline이 경고 줄의 len(len()) 오류로 멈춘다)
기준 · 나이 지시문만 같은 뜻의 짧은 판(아래 짧게)을 쓴다. Qwen 계열은 GPT와 같은 원문(1024토큰 안)을 쓴다.

    python -I -X utf8 experiences/drama/qa/제2의나-20261102/오픈모델/굽기.py <qwen2511|firered11|longcat|longcat_turbo> [--만 base,age,wd] [--빠르게]
        [--일 age-a36,age-a52] [--성별줄 --꼬리 _성별]
"""
import argparse
import glob
import importlib.util
import json
import os
import sys
import time
from pathlib import Path

여기 = Path(__file__).resolve().parent
뿌리 = 여기.parents[4]
spec = importlib.util.spec_from_file_location('허깅페이스', 뿌리 / 'tools' / '허깅페이스.py')
허 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(허)


def 공용작업본() -> Path:
    """.tmp는 공용 작업본(메인)에 있다 — 워크트리에서 돌려도 같은 곳(tools/lib/공용작업본.js와 같은 규칙)."""
    p = 뿌리
    while p.parent != p:
        if p.parent.name == 'worktrees' and p.parent.parent.name in ('.claude', '.codex'):
            return p.parent.parent.parent
        p = p.parent
    return 뿌리


T = 공용작업본() / '.tmp' / 'me2-20261102'
G = T / 'photo-gpt'
첫 = lambda pat: sorted(glob.glob(str(pat)))[0]  # noqa: E731

올림 = {
    'yuho': Path(r'C:\Users\q1212\Videos\한강2126_새판_20261009\재촬영_v40\기준그림\얼굴세트\ref_pro01_face.png'),
    'u1': G / 'u1-up.jpg',
    'u2': T / 'photo-nb2' / 'refs' / 'u2-up.jpg',
    'a36': Path(첫(G / '나이판' / '판' / 'up-a36_*.png')),
    'a45': Path(첫(G / '나이판' / '판' / 'up-a45_*.png')),
    'a52': Path(첫(G / '나이판' / '판' / 'up-a52_*.png')),
}
GPT기준 = {w: Path(첫(G / '판' / f'gpt2-{w}-강_*.png')) for w in ('yuho', 'u1', 'u2')}
원문 = {   # GPT에 넣은 지시문 파일(11-03 17:04~17:58) — 사진시험 README의 숫자가 이 글에서 나왔다
    'base-yuho': G / '지시문' / 'base2-yuho-강.txt',
    'base-u1': G / '지시문' / 'base-u1-강.txt',
    'base-u2': G / '지시문' / 'base-u2-강.txt',
    'age-a36': G / '나이' / 'base-a36-강+.txt',
    'age-a45': G / '나이' / 'base-a45-강+.txt',
    'age-a52': G / '나이' / 'base-a52-강+.txt',
}
옷 = {
    'yuho': 'Clothes: a plain charcoal crew-neck sweater.',
    'u1': 'Clothes: a cream knit cardigan over a plain white T-shirt.',
    'u2': 'Clothes: a navy crew-neck sweatshirt.',
    'a36': 'Clothes: a soft olive-green crew-neck sweatshirt.',
    'a45': 'Clothes: a plain grey crew-neck sweatshirt.',
    'a52': 'Clothes: a soft lilac knit cardigan over a white T-shirt.',
}

# ── 짧게: LongCat 몫(512토큰 안). 원문의 줄마다 뜻을 그대로 두고 겹친 말만 줄였다. ──
_머리 = ("PHOTOREAL CANDID SMARTPHONE PHOTO, vertical 3:4.\n"
       "Image 1 is the student's own uploaded selfie. Show THE SAME PERSON, instantly recognisable to friends — same face shape and "
       "width, eye shape and eyelids, brows, nose, lips, ears, hairline and skin tone. Ignore the camera angle, wide-angle "
       "distortion, lighting, room, colour cast and clothes of Image 1.")
_보정강 = ("LOOK: as attractive as they could plausibly look on their best day — well-rested, freshly groomed, flawless but real skin, a "
        "slightly slimmer, more defined jawline, brighter eyes, well-styled hair; eyes, nose and lips stay recognisably theirs.")
_젊게 = ("ALWAYS: a few years younger than in Image 1 — no wrinkles, forehead lines, creases, under-eye bags, dark circles or sagging; "
       "firm, smooth, youthful skin with a fine natural texture, never airbrushed, waxy or plastic; forehead and brows stay relaxed "
       "when smiling.")
_젊게19 = ("ALWAYS: show them at about 19 to 20, a first-year university student, whatever their age in Image 1 (30s to 50s look much "
         "younger), clearly still the same person: no wrinkles, forehead lines, creases, under-eye bags, dark circles or sagging; firm, "
         "smooth, youthful skin with a fine natural texture; clean-shaven; forehead and brows relaxed when smiling.\n"
         "FACE OF A 19-YEAR-OLD: fuller, softer cheeks, a slender jaw without jowls or a double chin, no temple recession, thick hair "
         "with no grey, no age spots — keeping their own face width and jaw shape.")
_순간 = ("MOMENT: early afternoon in the bright, empty university cafeteria; a friend across the table says something funny and the "
       "student smiles for real — a relaxed, open smile showing the upper teeth, eyes crinkling a little; head level, facing the "
       "camera{손}.\n"
       "CAMERA: the friend's phone at eye level about 1 m away; chest-up, the face about a third of the frame wide, a little "
       "off-centre, true proportions. Behind, a little soft: long pale tables and chairs, tall windows with bare trees, no other "
       "people.")
_빛 = ("LIGHT: March daylight from tall windows on one side, the other side of the face in soft shadow; phone-camera sharpness, faint "
      "noise in the shadows, slightly warm white balance, a natural flush. Not an illustration, advert or fashion shoot; no "
      "airbrushing, glow or HDR.\n"
      "No text, letters, logos or watermarks anywhere; no frame. Hands have five fingers.")


def 짧게(일: str) -> str:
    종류, 누구 = 일.split('-', 1)
    나이 = 종류 == 'age'
    return '\n'.join([_머리, 옷[누구], _보정강, _젊게19 if 나이 else _젊게,
                      _순간.format(손=', hands out of the frame, never on the face' if 나이 else ''), _빛])


def 일목록(만: set) -> list:
    일 = []
    if 'base' in 만:
        일 += [(f'base-{w}', 올림[w], 원문[f'base-{w}']) for w in ('yuho', 'u1', 'u2')]
    if 'age' in 만:
        일 += [(f'age-{a}', 올림[a], 원문[f'age-{a}']) for a in ('a36', 'a45', 'a52')]
    if 'wd' in 만:
        for w in ('yuho', 'u1', 'u2'):
            for k in ('hair1', 'hair2', 'outfit', 'acc'):
                일 += [(f'wd-{w}-{k}', GPT기준[w], G / '옷장' / f'{w}-{k}.txt')]
    return 일


기본 = {   # 공식 데모 기본값(Space app.py · 모델 카드) — 스텝 · CFG
    'qwen2511': (40, 4.0),
    'firered11': (30, 4.0),
    'longcat': (50, 4.5),
    'longcat_turbo': (8, 1.0),
}
STEP_S = {'qwen2511': 3.2, 'firered11': 3.2, 'longcat': 2.2, 'longcat_turbo': 1.2}   # space/app.py의 _dur와 같은 셈
QWEN = ('qwen2511', 'firered11')   # bf16 57.7GB — xlarge 조각(한도 2배)에서 돈다


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('모델', choices=sorted(기본))
    ap.add_argument('--만', default='base,age,wd')
    ap.add_argument('--스텝', type=int)
    ap.add_argument('--cfg', type=float)
    ap.add_argument('--seed', type=int, default=42)
    ap.add_argument('--꼬리', default='', help='판 이름 꼬리(같은 일을 다른 설정으로 다시 구울 때)')
    ap.add_argument('--빠르게', action='store_true', help='Qwen 계열 8스텝 증류 LoRA · CFG 1(판은 <모델>-fast 폴더)')
    ap.add_argument('--일', default='', help='이 일만(쉼표로) — 예: age-a36,age-a52')
    ap.add_argument('--성별줄', action='store_true',
                    help='「같은 성별」을 신원 목록 맨 앞에 넣는다(11-03 Qwen 계열이 나이 판에서 여성을 남성으로 바꿈)')
    ap.add_argument('--나이강', action='store_true', help='나이 판을 강+ 대신 강(「열아홉 얼굴」 단락 없음) GPT 지시문으로')
    a = ap.parse_args()
    if a.빠르게 and a.모델 not in QWEN:
        raise SystemExit('--빠르게는 Qwen 계열만 — LongCat 빠른 판은 longcat_turbo 모델')
    스텝, cfg = (8, 1.0) if a.빠르게 else (기본[a.모델][0], 기본[a.모델][1])
    스텝, cfg = a.스텝 or 스텝, a.cfg or cfg
    space = f"q121235/me2-{a.모델.replace('_', '-')}"
    밖 = T / 'photo-open' / (a.모델 + ('-fast' if a.빠르게 else ''))
    (밖 / '판').mkdir(parents=True, exist_ok=True)
    (밖 / '지시문').mkdir(parents=True, exist_ok=True)
    예상초 = int(min(240, 30 + 스텝 * STEP_S[a.모델] * (1.0 if cfg > 1 else 0.55)))
    배수 = 2 if a.모델 in QWEN else 1
    고른일 = set(filter(None, a.일.split(',')))
    for 이름, 입력, 글파일 in 일목록(set(a.만.split(','))):
        if 고른일 and 이름 not in 고른일:
            continue
        판 = 밖 / '판' / f'{이름}{a.꼬리}.png'
        if 판.exists():
            continue
        if a.나이강 and 이름.startswith('age-'):
            글파일 = G / '나이' / f"base-{이름.split('-', 1)[1]}-강.txt"
        글 = Path(글파일).read_text(encoding='utf-8').strip()
        if a.모델.startswith('longcat'):
            # LongCat은 따옴표 안 글을 글자 단위로 읽어 그림에 글자로 쓰려 한다(모델 카드 「텍스트는 따옴표로」) — 따옴표는 뺀다.
            글 = 짧게(이름) if not 이름.startswith('wd-') else 글.replace('"', '')
        if a.성별줄:
            for 앞 in ('keep who they are — ', 'instantly recognisable to friends — '):
                글 = 글.replace(앞, 앞 + 'the same sex and gender as in Image 1, ', 1)
        (밖 / '지시문' / f'{이름}{a.꼬리}.txt').write_text(글 + '\n', encoding='utf-8')
        # Qwen 계열은 3:4 세로(864×1152, 약 1메가화소)로 맞춘다 — GPT 판과 같은 비율. LongCat은 입력 비율을 따른다.
        가로, 세로 = (0, 0) if a.모델.startswith('longcat') else (864, 1152)
        t0 = time.time()
        try:
            r = 허.지키며_부르기(space, api='/edit', 인자=[{'$파일': str(입력)}, 글, a.seed, 스텝, cfg, 가로, 세로, a.빠르게],
                             예상초=예상초, 배수=배수, 받을곳=밖 / '받음', 메모=f'me2 오픈모델 {밖.name} {이름}')
        except Exception as e:  # noqa: BLE001 — 한도 · 멈춤이면 남은 일은 다음에
            print(f'[굽기] {이름} 실패: {type(e).__name__}: {str(e)[:300]}', flush=True)
            if isinstance(e, (허.멈춰있음, 허.한도모자람)):
                break
            continue
        그림, 기록글 = r['결과']
        Path(그림).replace(판)
        줄 = {'일': 이름, '판': str(판), '입력': str(입력),
             '지시문': '짧게' if a.모델.startswith('longcat') and not 이름.startswith('wd-') else str(글파일),
             **json.loads(기록글), '한도쓴초': r['쓴초'], '왕복초': r['왕복초'], '남은초': r['남은초'], '때': time.strftime('%H:%M:%S')}
        with open(밖 / '기록.jsonl', 'a', encoding='utf-8') as f:
            f.write(json.dumps(줄, ensure_ascii=False) + '\n')
        print(f"[굽기] {이름} → {판.name} · GPU {줄['gpu_s']}초 · 한도 {r['쓴초']}초 · 왕복 {round(time.time() - t0, 1)}초 · 남은 {r['남은초']}초", flush=True)


if __name__ == '__main__':
    sys.exit(main())
