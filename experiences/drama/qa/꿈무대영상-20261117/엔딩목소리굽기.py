"""
꿈 무대 엔딩(2026-11-18) — 사진첩 위로 들리는 「그 회에 내가 한 말」 두 줄(봄 자기소개, 가을 무대 인사)을
시댄스가 말하는 영상으로 굽고, 엔딩에는 그 소리만 쓴다.

유호님 「일단 목소리가 너무 어색한데? 하나도 자연스럽지가않아. 여자 목소리는 자연스러운데말이야」에서 나왔다.
일레븐랩스 글 읽기(공유 목소리 Jay Kim)로 만든 세 줄을 버리고, 만족 사례 장부 S54(시댄스 2.5 flash 480p,
배역 녹음을 목소리 결 참고로만)의 방법으로 다시 만든다. 목소리 참고는 영화 컷 3(V3-남)에서 Demucs로 뗀 목소리라,
엔딩 안의 세 목소리(영화 대사, 봄, 가을)가 한 사람으로 들린다. 그림은 그 회의 「내 영화의 한 컷」이다.
실제 학생 판은 학생 본인의 녹음이 들어가므로, 이 도구는 유호님 얼굴로 만드는 시제품에만 쓴다.

    python -I -X utf8 엔딩목소리굽기.py <줄 이름: 봄 | 가을> [--실행]

기본은 미리 보기(지시문 검사, 초, 상한, 잔액)만 찍는다. 받은 판은 git 밖 `.tmp/꿈무대영상-20261117/엔딩/목소리/시댄스/`에 둔다.
"""
import json
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
END = os.path.join(ROOT, '.tmp', '꿈무대영상-20261117', '엔딩')
OUT = os.path.join(END, '목소리', '시댄스')
VOICE = os.path.join(END, '목소리', 'V3-남_목소리.mp3')   # 컷 3의 원래 목소리(Demucs로 뗌, 약 102Hz)
EXE = os.path.expanduser('~/.ai-tools/dreamina-canvas/dreamina-canvas.exe')
PROFILE = 'ultra'
PROJECT = open(os.path.expanduser('~/.ai-tools/dreamina-canvas/캔버스_ultra.txt'), encoding='utf-8').read().split()[0]
MODEL, PER_SEC = 'seedance_2.5_flash', 8   # 480p 초당 8크레딧(S54 실측)

VOICE_RULE = """VOICE: the same young man's voice as the speaker in @오디오 1 — the same low, calm young male pitch, as low as in @오디오 1, the same soft warm tone and the same natural breath; not higher, not brighter and not more theatrical than @오디오 1. Do not say any words from @오디오 1."""

줄 = {
    '봄': {
        '그림': os.path.join(END, '기념물', '판', '카메라테스트-드레드_011437.png'),
        '초': 6,
        '대사': '안녕하세요… 저는 유호예요. 어… 배우가 되고 싶어요.',
        '지시문': """@이미지 1 is the exact first frame of this video.
ONE SINGLE CONTINUOUS SHOT, 16:9, 6 seconds.
WHO: the young man in @이미지 1 — the same face, the same cornrow braids, the same light denim jacket over a white T-shirt.
ACTION: this is his very first camera test in Korea, in spring, and he is nervous. At about 0.3 s he swallows and looks straight into the lens; from 0.6 s to 5.3 s he speaks the Korean line below slowly and a little clumsily, like a foreign student who started learning Korean only weeks ago — a short shy pause after 안녕하세요, and a small hesitant 어… before the last words; at about 1.8 s he blinks; at about 3.2 s his eyes drop to the floor for a moment and come back to the lens; at about 4.6 s a small shy smile starts at one corner of his mouth; from 5.3 s to 6 s he breathes out through his nose, eyes on the lens.
CAMERA: locked-off medium close shot at eye level, no zoom, no push in; the framing stays as in @이미지 1 to the last frame.
PHYSICS: the clapperboard at the left edge stays where it is, at the same spot to the last frame.
LOOK: soft studio light from the front left on a plain warm grey backdrop. The light and colour stay exactly like this to the last frame. Indoors: nothing falls or drifts anywhere. No new people, no new text.
SOUND: only his natural speaking voice, close and clean, over quiet studio room tone — no music, no other voices, no sound effects.
""" + VOICE_RULE + """
LINE (Korean, say exactly this, slowly, with the small pauses, a beginner's careful Korean): 안녕하세요… 저는 유호예요. 어… 배우가 되고 싶어요.""",
    },
    '가을': {
        '그림': os.path.join(END, '기념물', '판', '녹음실-드레드_011241.png'),
        '초': 6,
        '대사': '안녕하세요. 안녕, 서울에서 유학생을 연기한 유호입니다.',
        '지시문': """@이미지 1 is the exact first frame of this video.
ONE SINGLE CONTINUOUS SHOT, 16:9, 6 seconds.
WHO: the young man in @이미지 1 — the same face, the same cornrow braids, the same black headphones, the same light denim jacket over a white T-shirt, in front of the same studio microphone with its round pop filter.
ACTION: this is autumn, months later, and he now speaks Korean calmly and warmly. At about 0.3 s he takes one small breath and lifts his eyes from the script to the glass in front of him; from 0.6 s to 5.2 s he speaks the Korean line below into the microphone, clear and steady, like a young actor greeting the audience before his film is screened; at about 2.0 s he blinks; at about 3.4 s he gives one small nod; at about 4.6 s a small proud smile; from 5.2 s to 6 s he keeps the smile and breathes, shoulders rising softly.
CAMERA: locked-off medium close shot at eye level, no zoom, no push in; the framing stays as in @이미지 1 to the last frame.
LOOK: the warm desk lamp on the left and the dark recording booth stay exactly like this; the monitor on the right keeps showing the same still sunset picture. The light and colour stay the same to the last frame. Indoors: nothing falls or drifts anywhere. No new people, no new text.
SOUND: only his natural speaking voice, close to the microphone and clean, over quiet studio room tone — no music, no other voices, no sound effects.
""" + VOICE_RULE + """
PRONUNCIATION: 안녕, 서울 is the title of his film. Say it as a title, with a tiny pause after 안녕 and a tiny pause before 에서.
LINE (Korean, say exactly this, at a natural calm pace): 안녕하세요. 안녕, 서울에서 유학생을 연기한 유호입니다.""",
    },
}


def cli(*args, check=True, timeout=3000):
    r = subprocess.run([EXE, '--profile', PROFILE, '--format', 'json', '--non-interactive', *args],
                       capture_output=True, text=True, encoding='utf-8', timeout=timeout)
    j = json.loads(r.stdout or r.stderr)
    if check and not j.get('ok'):
        raise RuntimeError(json.dumps(j.get('error') or j, ensure_ascii=False)[:600])
    return j


def balance():
    return int(float(cli('auth', 'account')['data']['availableCredits']))


def check_prompt(name, text):
    os.makedirs(OUT, exist_ok=True)
    pf = os.path.join(OUT, f'{name}.지시문.txt')
    open(pf, 'w', encoding='utf-8').write(text)
    chk = subprocess.run([sys.executable, '-I', '-X', 'utf8', os.path.join(ROOT, 'tools', '컷연속성검사.py'), '지시문', pf, '--실내', name],
                         capture_output=True, text=True, encoding='utf-8')
    return chk.returncode != 1, (chk.stdout.strip() or chk.stderr.strip())


def save(key, row):
    p = os.path.join(OUT, '_드리미나.json')
    led = json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}
    led[key] = row
    json.dump(led, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


def bake(name):
    c = 줄[name]
    sec = c['초']
    cap = sec * PER_SEC + 8
    ok, msg = check_prompt(name, c['지시문'])
    print(msg.splitlines()[0] if msg else '', f'\n{name} · {MODEL} · 480p · 16:9 · {sec}초 · 상한 {cap} · 잔액 {balance()}\n말: {c["대사"]}')
    if not ok:
        raise SystemExit('멈춤: 지시문 검사 걸림\n' + msg)
    if '--실행' not in sys.argv:
        print('(미리 보기 — --실행을 붙이면 낸다)')
        return None
    if not os.path.exists(VOICE):
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', VOICE[:-4] + '.wav', '-ac', '1', '-b:a', '192k', VOICE], check=True)
    before = balance()
    ids = [cli('resource', 'upload', '--file', f, '--project-id', PROJECT, '--name', f'엔딩-{name}_{n}')['data']['resourceId']
           for n, f in (('first', c['그림']), ('voice', VOICE))]
    body = c['지시문'].replace('@이미지 1', '{{res:%s}}' % ids[0]).replace('@오디오 1', '{{res:%s}}' % ids[1])
    refs = [x for i in ids for x in ('--ref', f'res:{i}')]
    t0 = time.time()
    made = cli('node', 'create', 'video', '--model', MODEL, '--mode', 'm2v', *refs, '--prompt', body, '--ratio', '16:9', '--resolution', '480p',
               '--duration', str(sec), '--title', f'꿈무대-엔딩-{name}', '--project-id', PROJECT, '--run', '--credit-ceiling', str(cap),
               '--wait', '--timeout', '40m', check=False)
    data = made.get('data') or made.get('partialData') or {}
    it = (data.get('items') or [data])[0]
    sub = it.get('submission') or it
    rid = next((r.get('resourceId') for r in (sub.get('resources') or []) if r.get('state') == 'succeeded'), None)
    row = {'줄': name, '말': c['대사'], '모델': MODEL, '초': sec, '상한': cap, 'submitId': sub.get('submitId'), 'resourceId': rid,
           '상태': sub.get('state'), '오류': made.get('error'), '걸린초': round(time.time() - t0)}
    key = sub.get('submitId') or f'{name}-{int(t0)}'
    save(key, row)
    if not rid:
        print(f'  ✗ {name} 안 끝남: {json.dumps(made.get("error") or sub.get("state"), ensure_ascii=False)[:300]} · 차감 {before - balance()}')
        return None
    dst = os.path.join(OUT, f'{name}.mp4')
    if os.path.exists(dst):
        os.rename(dst, os.path.join(OUT, f'{name}__{int(t0)}.mp4'))
    cli('resource', 'download', rid, '--project-id', PROJECT, '-o', dst, timeout=300)
    after = balance()
    row.update({'파일': os.path.basename(dst), '쓴크레딧': before - after, '남은크레딧': after})
    save(key, row)
    print(f'  받음 {name} · {sec}초 · 이번에 쓴 양 {before - after} · 지금 남은 양 {after}')
    return dst


if __name__ == '__main__':
    if len(sys.argv) < 2 or sys.argv[1] not in 줄:
        raise SystemExit('쓰는 법: 엔딩목소리굽기.py <봄 | 가을> [--실행]')
    bake(sys.argv[1])
