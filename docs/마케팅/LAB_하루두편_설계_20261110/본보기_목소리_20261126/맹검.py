# 목소리 후보 맹검(이름 가림 · 순서 섞음 · 무료 Gemini 귀). python -X utf8 맹검.py <모델> <씨앗>
import base64, json, os, random, subprocess, sys, tempfile, time, urllib.error, urllib.request
H = os.path.dirname(os.path.abspath(__file__))
model, seed = sys.argv[1], int(sys.argv[2])
KEY = open(os.path.expanduser('~/SYNK_보안/제미나이_무료.txt'), encoding='utf-8').read().strip().split()[-1]
S = {
    'f1': ('추워~', '한겨울 밤 찬 바람에 덜덜 떨며 말하는 한국 남자 대학생', {'지금': '지금_f1.wav', 'T': '다듬/b_Taehyung_f1.wav', 'M': '다듬/b_MrK_f1.wav'}),
    'f2': ('손 시려…', '꽁꽁 언 두 손을 비비고 호호 불며 울상으로 말하는 남자 대학생', {'지금': 'f2.wav', 'T': '다듬/b_Taehyung_f2.wav', 'M': '다듬/b_MrK_f2.wav'}),
    'f3': ('얼어 죽겠다!', '30분째 눈을 맞고 얼어붙어 과장되게 외치는 남자 대학생', {'지금': 'f3.wav', 'T': '다듬/b_Taehyung_f3.wav', 'M': '다듬/b_MrK_f3.wav'}),
    'f4': ('이불 밖은 위험해…', '따뜻한 이불에 돌돌 말려 녹아내리듯 나른하게 말하는 남자 대학생', {'지금': 'f4.wav', 'T': '다듬/b_Taehyung_f4.wav', 'M': '다듬/b_MrK_f4.wav'}),
    'f5': ('삼… 삼십 도?!', '믿을 수 없어 깜짝 놀라 말을 더듬으며 되묻는 남자 대학생', {'지금': 'f5.wav', 'T': '다듬/b_Taehyung_f5.wav', 'M': '다듬/b_MrK_f5.wav'}),
    'm1': ('편의점 가자~!', '아이스크림을 들고 신나서 조르는 귀여운 펠트 캐릭터', {'지금': 'm1.wav', 'happy': '몽글/m1_happy.wav', 'toneup': '몽글/m1_toneup.wav', 'smart2': '몽글/m1_smart2.wav'}),
    'm2': ('몽골은 영하 삼십 도야~', '겨우 이 추위에 떠는 친구 앞에서 아무렇지 않게 웃으며 으스대는 귀여운 펠트 캐릭터', {'지금': 'm2.wav', 'happy': '몽글/m2_happy.wav', 'toneup': '몽글/m2_toneup.wav', 'smart2': '몽글/m2_smart2.wav'}),
}


def mp3(p):
    tmp = tempfile.mktemp(suffix='.mp3')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(H, p), '-ac', '1', '-ar', '44100', '-b:a', '160k', '-af', 'loudnorm=I=-16:TP=-1.5', tmp], check=True)
    b = open(tmp, 'rb').read()
    os.remove(tmp)
    return base64.b64encode(b).decode()


def ask(parts):
    body = {'contents': [{'role': 'user', 'parts': parts}]}
    for _ in range(4):
        req = urllib.request.Request('https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent' % model, method='POST', data=json.dumps(body).encode(), headers={'x-goog-api-key': KEY, 'Content-Type': 'application/json'})
        try:
            j = json.loads(urllib.request.urlopen(req, timeout=300).read())
            return ''.join(p.get('text', '') for p in j['candidates'][0]['content']['parts'])
        except urllib.error.HTTPError as e:
            last = 'HTTP %d' % e.code
            time.sleep(25)
        except Exception as e:
            last = repr(e)[:100]
            time.sleep(10)
    return last


R = random.Random(seed)
res = {}
for k, (ko, scene, c) in S.items():
    names = list(c)
    R.shuffle(names)
    q = ('짧은 한국어 영상에 넣을 목소리 후보 %d개를 듣습니다. 대사는 「%s」, 장면은 「%s」입니다. 외국인 10대가 소리만으로 감정을 느끼고 낱말을 알아들어야 합니다.\n'
         '각 소리마다 감정(장면 감정이 또렷하게 들리나), 사람(진짜 사람 연기처럼 들리나), 또렷(낱말이 또렷하나)을 1~10점으로 매기고 까닭을 열다섯 자 안으로 쓰세요. 점수를 몰아주지 말고 갈라 주세요.\n'
         '답은 JSON 배열만: [{"n":1,"감정":0,"사람":0,"또렷":0,"까닭":""}, …]') % (len(names), ko, scene)
    parts = [{'text': q}]
    for n, nm in enumerate(names, 1):
        parts += [{'text': '[소리 %d]' % n}, {'inlineData': {'mimeType': 'audio/mp3', 'data': mp3(c[nm])}}]
    a = ask(parts)
    try:
        arr = json.loads(a[a.index('['):a.rindex(']') + 1])
        res[k] = {names[x['n'] - 1]: x for x in arr}
        print(k, ko, ' | '.join('%s 감정%s 사람%s 또렷%s(%s)' % (nm, res[k][nm]['감정'], res[k][nm]['사람'], res[k][nm]['또렷'], res[k][nm]['까닭']) for nm in c), flush=True)
    except Exception:
        print(k, '답 이상', a[:160], flush=True)
    time.sleep(4)
json.dump(res, open(os.path.join(H, '맹검_%s_%d.json' % (model, seed)), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
