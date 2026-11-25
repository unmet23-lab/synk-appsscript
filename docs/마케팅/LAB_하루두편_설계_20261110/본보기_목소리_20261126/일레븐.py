# 「추울 때」 친구 줄 감정 시험 — 일레븐 v4(공식 API · Creator 월정액 안). 키는 찍지 않는다.
# python -I -X utf8 일레븐.py <목소리이름> [줄…]
import json, os, sys, urllib.error, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
KEY = open(os.path.expanduser('~/SYNK_보안/elevenlabs.txt'), encoding='utf-8').read().strip().splitlines()[-1].split()[-1]
VOICES = {'Taehyung': 'm3gJBS8OofDJfycyA2Ip', 'MrK': 'LKOcTG4J4tYTPR9DnLeM', 'Apollo': 'xsfFw9plbX0VhNMhHgl1'}
LINES = {
    'f1': '[shivering, teeth chattering, quick] 으 추워어',
    'f2': '[whimpering, pitiful, freezing] 으 손 시려어~',
    'f3': '[overdramatic desperate wail, fast] 으아 얼어 죽겠다!',
    'f4': '[cozy, drowsy, melting, happy sigh] 이불 밖은 위험해애~',
    'f5': '[shocked, stammering in disbelief, voice cracking] 사, 삼십 도?!',
}
name = sys.argv[1]
for k in sys.argv[2:] or list(LINES):
    body = {'text': LINES[k], 'model_id': 'eleven_v4', 'language_code': 'ko', 'voice_settings': {'stability': 0.35, 'similarity_boost': 0.75}}
    req = urllib.request.Request('https://api.elevenlabs.io/v1/text-to-speech/%s?output_format=mp3_44100_192' % VOICES[name], data=json.dumps(body).encode(), headers={'xi-api-key': KEY, 'Content-Type': 'application/json'})
    try:
        r = urllib.request.urlopen(req, timeout=180)
        b = r.read()
        out = os.path.join(HERE, 'v4b_%s_%s.mp3' % (name, k))
        open(out, 'wb').write(b)
        print(name, k, len(b), '값', r.headers.get('character-cost'))
    except urllib.error.HTTPError as e:
        print('실패', name, k, e.code, e.read()[:200])
