# 「오늘」 한 장 · 태오 한마디를 목소리와 입이 맞는 영상으로 굽는다(11-16, 유호님 「웅 써도 돼.」 — 태오 목소리와 입 맞는 영상에 크레딧을 써도 된다).
# 태오 목소리(Julian)는 힉스필드 프리셋이라 일레븐에서 같은 목소리를 못 낸다(docs/일레븐랩스_기능표.md 「힉스필드에 남는 것」). 힉스필드 잔액이 0이라
# 드리미나 시댄스 2.5 flash(울트라 칸)로 굽고, 1화 태오 녹음(senior-01.mp3)을 목소리 결 참고로만 준다 — 그 말을 되풀이하지 않게 지시문이 막는다.
# 시작 그림은 듣는 고리(taeo-listen.mp4)의 첫 장이라 말하는 영상이 끝나고 고리로 돌아갈 때 튀지 않는다. 화면에서는 작은 동그라미로 보여 480p로 굽는다.
# 11-16 첫 줄 두 판을 유호님이 들으시고 「세개 다 좋다. 특히 두번쨰 새번쨰 느낌 좋아」 — 만족 사례 장부 S54. 나머지 줄도 이 방법 그대로 굽는다.
# (둘째 판은 VOICE에 「같은 높이 · 밝기」를 더한 지시문이다. 음높이는 1화 녹음보다 낮게 나왔지만 그대로 좋다고 하셨다.)
#
#   python -I -X utf8 experiences/drama/qa/오늘한장-20261114/태오굽기.py --차례 [--실행]
#       화면 자리(content.mjs TAEO_MEDIA)가 빈 틀을 자주 나올 차례(차례 표)대로, 잔액이 허락하는 만큼 굽는다. 줄마다 받아쓰기로 대사가 그대로인지 보고,
#       맞으면 원천 폴더에 두고 재생 사본을 만들고 TAEO_MEDIA에 적는다. 기본은 미리 보기(굽을 틀 · 초 · 크레딧 · 잔액)만 찍는다.
#   python -I -X utf8 experiences/drama/qa/오늘한장-20261114/태오굽기.py <틀 code> [--초 8] [--모델 seedance_2.5_flash] [--상한 70] [--실행]
#       한 틀만 굽는다(받기까지). 넣기는 --넣기로 따로 한다.
#   python -I -X utf8 experiences/drama/qa/오늘한장-20261114/태오굽기.py --넣기 <틀 code>
#       받은 판을 원천 폴더(~/Documents/synk-vendor/drama-today-20261116/)에 두고, 메타를 뺀 재생 사본을 pilot/media/today-taeo-<이름>.mp4(git 밖)에
#       만들고 TAEO_MEDIA에 적는다. 드라마 manifest에는 넣지 않는다 — 공개 빌드가 manifest의 파일을 모두 싣기 때문이다.
#       파일이 없는 사본에서는 화면의 동그라미가 듣는 고리로만 남는다.
# 받은 판과 기록(_드리미나.json)은 원천 폴더의 받음/에 남는다 — 어느 작업본에서 돌려도 같은 자리다.
import json, os, re, shutil, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
MEDIA = os.path.join(ROOT, 'experiences', 'drama', 'pilot', 'media')
CONTENT = os.path.join(ROOT, 'experiences', 'drama', 'pilot', 'today', 'content.mjs')
VENDOR = os.path.expanduser('~/Documents/synk-vendor/drama-today-20261116')
OUT = os.path.join(VENDOR, '받음')
EXE = os.path.expanduser('~/.ai-tools/dreamina-canvas/dreamina-canvas.exe')
PROJECT = open(os.path.expanduser('~/.ai-tools/dreamina-canvas/캔버스_ultra.txt'), encoding='utf-8').read().split()[0]
MODEL, PER_SEC = 'seedance_2.5_flash', 8   # 480p 견적 10초 80크레딧, 11-16 8초 한 판 64
CLEAN = ['-map_metadata', '-1', '-map_chapters', '-1', '-fflags', '+bitexact', '-metadata:s', 'encoder=', '-metadata:s', 'handler_name=']
# 자주 나올 차례 — 7번(목표 줄)을 가장 많이 놓친다. 복습 틀(그 장면을 떠올리는 말) → 새 상황 · 나중 확인 → 끝의 한마디 → 드문 틀.
ORDER = ['again.call.s1e01-7.yo', 'again.call.s1e01-7', 'again.call.s1e01-8.yo', 'again.call.s1e01-8', 'again.call.s1e01-6.yo', 'again.call.s1e01-6',
         'new.situation', 'check.delayed', 'again.review', 'done', 'plain', 'new.scene', 'empty']


def node_json(expr):
    js = f"import('./experiences/drama/pilot/today/plan.mjs').then(async m=>{{const c=await import('./experiences/drama/pilot/today/content.mjs');process.stdout.write(JSON.stringify({expr}))}})"
    return json.loads(subprocess.run(['node', '-e', js], cwd=ROOT, capture_output=True, text=True, encoding='utf-8', check=True).stdout)


def lines():
    """plan.mjs TAEO_LINES — 화면 글과 굽는 말이 한 곳에서 나온다."""
    return node_json('m.TAEO_LINES')


def media_now():
    return node_json('c.TAEO_MEDIA')


def name_of(code):
    """again.call.s1e01-7.yo → taeo-7yo, again.review → taeo-review, new.situation → taeo-situation."""
    m = re.fullmatch(r'again\.call\.s1e01-(\d+)(\.yo)?', code)
    if m:
        return f"taeo-{m.group(1)}{'yo' if m.group(2) else ''}"
    return 'taeo-' + code.split('.')[-1]


def seconds(text):
    """말 길이 + 앞뒤 여유(받아 본 판: 31음절이 1.2초에 시작해 7.3초에 끝남). 잘리면 판 전체를 버리니 넉넉히 잡는다."""
    syl = sum(1 for ch in text if '가' <= ch <= '힣' or ch.isdigit())
    return max(4, -(-int(syl / 4.2 * 10 + 10) // 10))   # 초당 4.2음절(둘째 판 실측) + 1초


def prompt(text, sec):
    # 8초 판(유호님이 좋다고 하신 판)의 박자를 길이에 맞춰 늘이고 줄인다 — 8초면 그 판과 같다.
    s = sec / 8
    t = lambda x: round(x * s, 1)
    speak_end = round(sec - 1.0, 1)
    return f"""@이미지 1 is the exact first frame of this video. @이미지 2 shows the same framing a little later; end close to it.
ONE SINGLE CONTINUOUS SHOT, 9:16, {sec} seconds.
WHO: the young man in @이미지 1 — the same face, hair, grey hoodie under the navy-and-cream varsity jacket, the same lunch tray in front of him.
ACTION: at about 0.2 s he looks straight into the lens and smiles a little; from 0.5 s to {speak_end} s he speaks the Korean line below to the viewer, warmly and clearly, like a friendly senior student talking to a junior he likes; at about {t(1.4)} s he raises his eyebrows slightly; at about {t(2.4)} s he blinks; at about {t(3.2)} s he gives one small nod; at about {t(4.6)} s he tilts his head a little to his left; at about {t(5.6)} s he blinks; from {speak_end} s to {sec} s he keeps smiling and breathing, eyes on the lens, shoulders rising softly with each breath.
CAMERA: locked-off medium close shot at eye level, no zoom, no push in; the framing stays as in @이미지 1 to the last frame.
LOOK: soft daylight from the big windows behind him, a warm school cafeteria, students behind him keep eating and talking, softly out of focus. The light and colour stay exactly like this to the last frame. No new people, no new text.
SOUND: only his natural speaking voice saying this one Korean line, over quiet cafeteria room tone — no music, no other voices, no sound effects.
VOICE: the same young man's voice as the speaker in @오디오 1 — the same pitch (a light, bright young tenor, as high as in @오디오 1), the same brightness and the same smile in the voice; not deeper and not flatter than @오디오 1. Do not say any words from @오디오 1.
LINE (Korean, say exactly this, at a natural friendly pace with the same lively warmth as @오디오 1): {text}"""


def cli(*args, check=True, timeout=3000):
    r = subprocess.run([EXE, '--profile', 'ultra', '--format', 'json', '--non-interactive', *args], capture_output=True, text=True, encoding='utf-8', timeout=timeout)
    j = json.loads(r.stdout or r.stderr)
    if check and not j.get('ok'):
        raise RuntimeError(json.dumps(j.get('error') or j, ensure_ascii=False)[:600])
    return j


def balance():
    return int(float(cli('auth', 'account')['data']['availableCredits']))


def save(key, row):
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, '_드리미나.json')
    led = json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}
    led[key] = row
    json.dump(led, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


def anchors():
    os.makedirs(OUT, exist_ok=True)
    first, later = os.path.join(OUT, 'loop_0.png'), os.path.join(OUT, 'loop_35.png')
    for t, f in ((0, first), (3.5, later)):
        if not os.path.exists(f):
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t), '-i', os.path.join(MEDIA, 'taeo-listen.mp4'), '-frames:v', '1', f], check=True)
    return first, later


def check_prompt(code, p):
    os.makedirs(OUT, exist_ok=True)
    pf = os.path.join(OUT, f'{code}.지시문.txt')
    open(pf, 'w', encoding='utf-8').write(p)
    chk = subprocess.run([sys.executable, '-I', '-X', 'utf8', os.path.join(ROOT, 'tools', '컷연속성검사.py'), '지시문', pf, '--실내', code],
                         capture_output=True, text=True, encoding='utf-8')
    return chk.returncode != 1, (chk.stdout.strip() or chk.stderr.strip()).splitlines()[0:1]


def bake(code, text, sec, model=MODEL, cap=None):
    """한 틀을 내고 받는다. 받은 파일 경로 또는 None. 서버 쪽 실패(차감 없음)는 한 번 다시 낸다."""
    cap = cap or sec * PER_SEC + 8
    first, later = anchors()
    p = prompt(text, sec)
    ok, msg = check_prompt(code, p)
    if not ok:
        print(f'  ✗ {code}: 지시문 검사 걸림 {msg}')
        return None
    for attempt in (1, 2):
        before = balance()
        ids = [cli('resource', 'upload', '--file', f, '--project-id', PROJECT, '--name', f'{code}_{n}')['data']['resourceId']
               for n, f in (('first', first), ('later', later), ('voice', os.path.join(MEDIA, 'senior-01.mp3')))]
        body = p.replace('@이미지 1', '{{res:%s}}' % ids[0]).replace('@이미지 2', '{{res:%s}}' % ids[1]).replace('@오디오 1', '{{res:%s}}' % ids[2])
        refs = [x for i in ids for x in ('--ref', f'res:{i}')]
        t0 = time.time()
        made = cli('node', 'create', 'video', '--model', model, '--mode', 'm2v', *refs, '--prompt', body, '--ratio', '9:16', '--resolution', '480p',
                   '--duration', str(sec), '--title', f'오늘-태오-{code}', '--project-id', PROJECT, '--run', '--credit-ceiling', str(cap), '--wait', '--timeout', '40m', check=False)
        data = made.get('data') or made.get('partialData') or {}
        it = (data.get('items') or [data])[0]
        sub = it.get('submission') or it
        rid = next((r.get('resourceId') for r in (sub.get('resources') or []) if r.get('state') == 'succeeded'), None)
        row = {'code': code, '말': text, '모델': model, '초': sec, '상한': cap, 'submitId': sub.get('submitId'), 'resourceId': rid, '상태': sub.get('state'),
               '오류': made.get('error'), '걸린초': round(time.time() - t0), '지시문': body}
        key = sub.get('submitId') or f'{code}-{int(t0)}'
        save(key, row)
        if rid:
            dst = os.path.join(OUT, f'{code}.mp4')
            if os.path.exists(dst):
                os.rename(dst, os.path.join(OUT, f'{code}__{int(t0)}.mp4'))
            cli('resource', 'download', rid, '--project-id', PROJECT, '-o', dst, timeout=300)
            after = balance()
            row.update({'파일': os.path.basename(dst), '쓴크레딧': before - after, '남은크레딧': after})
            save(key, row)
            print(f'  받음 {code} · {sec}초 · 이번에 쓴 양 {before - after} · 지금 남은 양 {after}')
            return dst
        spent = before - balance()
        print(f'  ✗ {code} {attempt}번째 안 끝남: {json.dumps(made.get("error") or sub.get("state"), ensure_ascii=False)[:200]} · 차감 {spent}')
        if spent > 0:
            return None   # 돈이 나간 실패는 다시 내지 않는다 — submitId로 확인
    return None


def heard(path):
    """받아쓰기(faster-whisper large-v3-turbo) — 사용자 사이트 패키지가 필요해 -I 없이 따로 부른다."""
    js = ("from faster_whisper import WhisperModel;import sys;m=WhisperModel('large-v3-turbo',device='cpu',compute_type='int8');"
          "s,_=m.transcribe(sys.argv[1],language='ko',vad_filter=False);print(''.join(x.text for x in s))")
    r = subprocess.run([sys.executable, '-X', 'utf8', '-c', js, path], capture_output=True, text=True, encoding='utf-8')
    return r.stdout.strip()


def same_words(a, b):
    keep = lambda s: re.sub(r'[^가-힣0-9]', '', s.replace('일화', '1화').replace('이화', '2화'))
    return keep(a) == keep(b)


def place(code):
    """받은 판 → 원천(그대로) + 재생 사본(30fps · 480×854 · 메타 없음) + content.mjs TAEO_MEDIA 한 줄."""
    name = name_of(code)
    src = os.path.join(OUT, f'{code}.mp4')
    keep = os.path.join(VENDOR, f'{name}.mp4')
    if os.path.abspath(src) != os.path.abspath(keep):
        shutil.copyfile(src, keep)
    dst = os.path.join(MEDIA, f'today-{name}.mp4')
    subprocess.run(['ffmpeg', '-hide_banner', '-v', 'error', '-nostdin', '-y', '-i', keep, '-vf', 'fps=30,scale=480:854', '-c:v', 'libx264', '-preset', 'slow', '-crf', '26',
                    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', '-flags:v', '+bitexact', '-bsf:v', 'filter_units=remove_types=6',
                    '-flags:a', '+bitexact', *CLEAN, dst], check=True)
    raw = open(dst, 'rb').read().decode('latin1')
    left = [n for n in ('Lavf', 'Lavc', 'x264', 'Users', 'dreamina', 'seedance') if n in raw]
    if left:
        raise SystemExit(f'재생 사본에 {left} 문자열이 남았다 — 확인할 것')
    # 화면 자리 — TAEO_MEDIA 덩이 안에 한 줄(있으면 그대로).
    s = open(CONTENT, encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in s else '\n'
    entry = f" '{code}': {{ video: 'media/today-{name}.mp4' }},"
    if entry not in s:
        m = re.search(r'export const TAEO_MEDIA = Object\.freeze\(\{\r?\n(.*?)\}\);', s, re.S)
        if not m:
            raise SystemExit('content.mjs에서 TAEO_MEDIA 덩이를 못 찾았다')
        body = [x for x in m.group(1).replace('\r\n', '\n').split('\n') if x.strip()] + [entry]
        body.sort(key=lambda x: ORDER.index(re.search(r"'([^']+)'", x).group(1)) if re.search(r"'([^']+)'", x).group(1) in ORDER else 99)
        s = s[:m.start(1)] + nl.join(body) + nl + s[m.end(1):]
        open(CONTENT, 'w', encoding='utf-8', newline='').write(s)
    print(f'  넣음 {code} → media/today-{name}.mp4 ({os.path.getsize(dst)}바이트) · 원천 {keep}')


def queue(run):
    L, have = lines(), media_now()
    todo = [(c, L[c], seconds(L[c])) for c in ORDER if c in L and c not in have]
    missing = [c for c in L if c not in ORDER]
    if missing:
        print(f'차례 표에 없는 틀(굽지 않음): {missing}')
    bal = balance()
    print(f'빈 틀 {len(todo)}개 · 합 {sum(s for _, _, s in todo) * PER_SEC}크레딧 어림 · 지금 잔액 {bal}')
    plan, left = [], bal
    for c, t, s in todo:
        if s * PER_SEC + 8 <= left:   # 상한 여유 8까지 남아 있어야 낸다
            plan.append((c, t, s)); left -= s * PER_SEC
    for c, t, s in todo:
        print(f"  {'굽기' if (c, t, s) in plan else '다음'} {c:<24} {s}초 {s * PER_SEC}크레딧 · {t}")
    if not run:
        print('(미리 보기 — --실행을 붙이면 「굽기」 줄을 낸다)')
        return
    for c, t, s in plan:
        got = bake(c, t, s)
        if not got:
            continue
        said = heard(got)
        if not same_words(said, t):
            print(f'  ✗ {c}: 받아쓰기가 대사와 다르다 — 넣지 않음\n    대사 {t}\n    들림 {said}')
            continue
        place(c)
    print(f'끝 · 지금 잔액 {balance()} · 남은 빈 틀 {len([c for c in ORDER if c in L and c not in media_now()])}개')


def main():
    a = sys.argv[1:]
    if a[:1] == ['--차례']:
        return queue('--실행' in a)
    if a[:1] == ['--넣기'] and len(a) >= 2:
        return place(a[1])
    if not a or a[0].startswith('--'):
        raise SystemExit('쓰는 법: 태오굽기.py --차례 [--실행] | <틀 code> [--초 8] [--모델 seedance_2.5_flash] [--상한 70] [--실행] | --넣기 <틀 code>')
    code = a[0]
    val = lambda k, d: a[a.index(k) + 1] if k in a else d
    text = lines()[code]
    sec, model = int(val('--초', seconds(text))), val('--모델', MODEL)
    cap = int(val('--상한', sec * PER_SEC + 8))
    ok, msg = check_prompt(code, prompt(text, sec))
    print(msg[0] if msg else '', f'\n{code} · {model} · 480p · {sec}초 · 상한 {cap} · 잔액 {balance()}\n말: {text}')
    if not ok:
        raise SystemExit('멈춤: 지시문 검사 걸림')
    if '--실행' not in a:
        print('(미리 보기 — --실행을 붙이면 낸다)')
        return
    bake(code, text, sec, model, cap)


if __name__ == '__main__':
    main()
