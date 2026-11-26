# 새로 온 친구(20대 남자) 줄 — 일레븐 v4 Taehyung(공식 API · Creator 월정액 안). 키는 찍지 않는다. 본보기: LAB_하루두편_설계_20261110/본보기_목소리_20261126
# python -I -X utf8 일레븐.py [줄…]  → ../remotion/public/vo/<줄>.wav(48k · −16 LUFS로 다듬음) · vo.json에 길이를 더한다
import json, os, subprocess, sys, tempfile, urllib.error, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'remotion', 'public', 'vo'))
KEY = open(os.path.expanduser('~/SYNK_보안/elevenlabs.txt'), encoding='utf-8').read().strip().splitlines()[-1].split()[-1]
VOICE = 'm3gJBS8OofDJfycyA2Ip'  # Taehyung
LINES = json.load(open(os.path.join(HERE, '일레븐.json'), encoding='utf-8'))

def dur(p):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p], capture_output=True, text=True)
    return round(float(r.stdout.strip()), 3)

vo_path = os.path.join(OUT, 'vo.json')
vo = json.load(open(vo_path, encoding='utf-8')) if os.path.exists(vo_path) else {'lines': []}
for k in sys.argv[1:] or list(LINES):
    body = {'text': LINES[k], 'model_id': 'eleven_v4', 'language_code': 'ko', 'voice_settings': {'stability': 0.35, 'similarity_boost': 0.75}}
    req = urllib.request.Request('https://api.elevenlabs.io/v1/text-to-speech/%s?output_format=mp3_44100_192' % VOICE, data=json.dumps(body).encode(), headers={'xi-api-key': KEY, 'Content-Type': 'application/json'})
    try:
        r = urllib.request.urlopen(req, timeout=180)
        b = r.read()
    except urllib.error.HTTPError as e:
        print('실패', k, e.code, e.read()[:200]); continue
    tmp = os.path.join(tempfile.gettempdir(), 'm54_%s.mp3' % k)
    open(tmp, 'wb').write(b)
    wav = os.path.join(OUT, '%s.wav' % k)
    # 앞뒤 무음을 자르고 −16 LUFS로 맞춘다(나레이션굽기와 같은 크기)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-ac', '2', wav], check=True)
    d = dur(wav)
    text = LINES[k].split(']')[-1].strip()
    vo['lines'] = [l for l in vo.get('lines', []) if l.get('id') != k] + [{'id': k, 'text': text, 'dur': d, 'src': '%s.wav' % k, 'voice': 'ElevenLabs v4 Taehyung'}]
    print(k, '길이', d, '값', r.headers.get('character-cost'))
json.dump(vo, open(vo_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
