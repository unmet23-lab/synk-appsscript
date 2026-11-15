# 「오늘」 한 장 · 태오 한 줄을 목소리와 입이 맞는 영상으로 굽는다(11-16, 유호님 「웅 써도 돼.」 — 태오 목소리와 입 맞는 영상에 크레딧을 써도 된다).
# 태오 목소리(Julian)는 힉스필드 프리셋이라 일레븐에서 같은 목소리를 못 낸다(docs/일레븐랩스_기능표.md 「힉스필드에 남는 것」). 힉스필드 잔액이 0이라
# 드리미나 시댄스 2.5 flash(울트라 칸)로 굽고, 1화 태오 녹음(senior-01.mp3)을 목소리 결 참고로만 준다 — 그 말을 되풀이하지 않게 지시문이 막는다.
# 시작 그림은 듣는 고리(taeo-listen.mp4)의 첫 장이라 말하는 영상이 끝나고 고리로 돌아갈 때 튀지 않는다. 화면에서는 작은 동그라미로 보여 480p로 굽는다.
# 11-16 첫 판(「차분한 빠르기로」, 목소리는 「결만 따르게」)은 대사가 글자 그대로 나왔지만 음높이 가운데가 118Hz로 1화 녹음(152~165Hz)보다 낮았다 →
# VOICE 줄에 「같은 높이 · 밝기, 더 낮게 말하지 않기」를 적었다(음높이는 영상을 손보지 않고 지시문으로 맞춘다).
#   python -I -X utf8 experiences/drama/qa/오늘한장-20261114/태오굽기.py <틀 code> [--초 8] [--모델 seedance_2.5_flash] [--상한 70] [--실행]
#   기본은 지시문 · 검사 · 견적 미리 보기만 한다. 받은 것은 .tmp/today-20261116/태오목소리/<code>.mp4, 기록은 같은 폴더 _드리미나.json.
#   --넣기 <code> <파일 이름>: 고른 판을 원천 폴더(~/Documents/synk-vendor/drama-today-20261116/<이름>.mp4)에 두고, 메타를 뺀 재생 사본을
#   pilot/media/today-<이름>.mp4(git 밖)에 만든다. 드라마 manifest에는 넣지 않는다 — 공개 빌드가 manifest의 파일을 모두 싣기 때문이다.
#   화면 자리는 content.mjs TAEO_MEDIA에 손으로 적는다(파일이 없는 사본에서는 동그라미가 듣는 고리로만 남는다).
import json, os, re, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
OUT = os.path.join(ROOT, '.tmp', 'today-20261116', '태오목소리')
MEDIA = os.path.join(ROOT, 'experiences', 'drama', 'pilot', 'media')
EXE = os.path.expanduser('~/.ai-tools/dreamina-canvas/dreamina-canvas.exe')
PROJECT = open(os.path.expanduser('~/.ai-tools/dreamina-canvas/캔버스_ultra.txt'), encoding='utf-8').read().split()[0]


def lines():
    """plan.mjs TAEO_LINES를 Node로 읽는다 — 화면 글과 굽는 말이 한 곳에서 나온다."""
    js = "import('./experiences/drama/pilot/today/plan.mjs').then(m=>process.stdout.write(JSON.stringify(m.TAEO_LINES)))"
    return json.loads(subprocess.run(['node', '-e', js], cwd=ROOT, capture_output=True, text=True, encoding='utf-8', check=True).stdout)


def prompt(text, sec):
    speak_end = round(sec - 1.0, 1)
    return f"""@이미지 1 is the exact first frame of this video. @이미지 2 shows the same framing a little later; end close to it.
ONE SINGLE CONTINUOUS SHOT, 9:16, {sec} seconds.
WHO: the young man in @이미지 1 — the same face, hair, grey hoodie under the navy-and-cream varsity jacket, the same lunch tray in front of him.
ACTION: at about 0.2 s he looks straight into the lens and smiles a little; from 0.5 s to {speak_end} s he speaks the Korean line below to the viewer, warmly and clearly, like a friendly senior student talking to a junior he likes; at about 1.4 s he raises his eyebrows slightly; at about 2.4 s he blinks; at about 3.2 s he gives one small nod; at about 4.6 s he tilts his head a little to his left; at about 5.6 s he blinks; from {speak_end} s to {sec} s he keeps smiling and breathing, eyes on the lens, shoulders rising softly with each breath.
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
    p = os.path.join(OUT, '_드리미나.json')
    led = json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}
    led[key] = row
    json.dump(led, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


VENDOR = os.path.expanduser('~/Documents/synk-vendor/drama-today-20261116')
CLEAN = ['-map_metadata', '-1', '-map_chapters', '-1', '-fflags', '+bitexact', '-metadata:s', 'encoder=', '-metadata:s', 'handler_name=']


def place(code, name):
    """고른 판 → 원천(그대로) + 재생 사본(30fps · 480×854 · 메타 없음, 동그라미에 쓴다)."""
    import shutil
    src = os.path.join(OUT, f'{code}.mp4')
    os.makedirs(VENDOR, exist_ok=True)
    keep = os.path.join(VENDOR, f'{name}.mp4')
    shutil.copyfile(src, keep)
    dst = os.path.join(MEDIA, f'today-{name}.mp4')
    subprocess.run(['ffmpeg', '-hide_banner', '-v', 'error', '-nostdin', '-y', '-i', keep, '-vf', 'fps=30,scale=480:854', '-c:v', 'libx264', '-preset', 'slow', '-crf', '26',
                    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', '-flags:v', '+bitexact', '-bsf:v', 'filter_units=remove_types=6',
                    '-flags:a', '+bitexact', *CLEAN, dst], check=True)
    raw = open(dst, 'rb').read().decode('latin1')
    left = [n for n in ('Lavf', 'Lavc', 'x264', 'Users', 'dreamina', 'seedance') if n in raw]
    if left:
        raise SystemExit(f'재생 사본에 {left} 문자열이 남았다 — 확인할 것')
    print(f'원천 {keep}\n재생 사본 {dst} · {os.path.getsize(dst)}바이트\ncontent.mjs TAEO_MEDIA에 적기: \'{code}\': {{ video: \'media/today-{name}.mp4\' }}')


def main():
    a = sys.argv[1:]
    if a[:1] == ['--넣기'] and len(a) >= 3:
        return place(a[1], a[2])
    if not a or a[0].startswith('--'):
        raise SystemExit('쓰는 법: 태오굽기.py <틀 code> [--초 8] [--모델 seedance_2.5_flash] [--상한 70] [--실행]')
    code = a[0]
    val = lambda k, d: a[a.index(k) + 1] if k in a else d
    sec, model, cap = int(val('--초', 8)), val('--모델', 'seedance_2.5_flash'), int(val('--상한', 70))
    text = lines()[code]
    os.makedirs(OUT, exist_ok=True)
    first, later = os.path.join(OUT, 'loop_0.png'), os.path.join(OUT, 'loop_35.png')
    for t, f in ((0, first), (3.5, later)):
        if not os.path.exists(f):
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t), '-i', os.path.join(MEDIA, 'taeo-listen.mp4'), '-frames:v', '1', f], check=True)
    p = prompt(text, sec)
    pf = os.path.join(OUT, f'{code}.지시문.txt')
    open(pf, 'w', encoding='utf-8').write(p)
    chk = subprocess.run([sys.executable, '-I', '-X', 'utf8', os.path.join(ROOT, 'tools', '컷연속성검사.py'), '지시문', pf, '--실내', code],
                         capture_output=True, text=True, encoding='utf-8')
    print(chk.stdout.strip() or chk.stderr.strip())
    if chk.returncode == 1:
        raise SystemExit('멈춤: 지시문 검사 걸림')
    print(f'{code} · {model} · 480p · {sec}초 · 상한 {cap} · 잔액 {balance()}\n말: {text}')
    if '--실행' not in a:
        print('(미리 보기 — --실행을 붙이면 낸다)')
        return
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
    if not rid:
        raise SystemExit(f'안 끝남: {json.dumps(made.get("error") or sub.get("state"), ensure_ascii=False)[:400]} — 다시 내지 않는다(submitId로 확인)')
    dst = os.path.join(OUT, f'{code}.mp4')
    if os.path.exists(dst):
        os.rename(dst, os.path.join(OUT, f'{code}__{int(t0)}.mp4'))
    cli('resource', 'download', rid, '--project-id', PROJECT, '-o', dst, timeout=300)
    after = balance()
    row.update({'파일': os.path.basename(dst), '쓴크레딧': before - after, '남은크레딧': after})
    save(key, row)
    print(f'받음 {dst} · 이번에 쓴 양 {before - after} · 지금 남은 양 {after}')


if __name__ == '__main__':
    main()
