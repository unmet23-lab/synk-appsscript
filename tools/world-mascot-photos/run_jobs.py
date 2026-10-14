# 판 여러 장을 동시에 3개씩 굽고(이미 있으면 건너뜀) 표정 판은 바로 나눈다.
# 사용: python run_jobs.py <jobs.json> [이름 거르기 문자열...] [--par=3]
import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
par = int(next((a.split('=')[1] for a in sys.argv[1:] if a.startswith('--par=')), 3))
jobs = json.load(open(os.path.join(ROOT, args[0]), encoding='utf-8'))
want = args[1:]
if want:
    jobs = [j for j in jobs if any(w in j['name'] for w in want)]


def one(j):
    r = subprocess.run([sys.executable, '-X', 'utf8', 'bake.py', j['name'], j['prompt'], *j['refs']], cwd=ROOT,
                       capture_output=True, stdin=subprocess.DEVNULL)
    msg = r.stdout.decode('utf-8', 'replace').strip().splitlines()[-1:] or ['?']
    if r.returncode == 0 and j.get('faces'):
        g = j.get('grid', [3, 2])
        s = subprocess.run([sys.executable, '-X', 'utf8', 'split.py', j['name'], str(g[0]), str(g[1]), ','.join(j['faces']),
                            *j.get('split', [])], cwd=ROOT, capture_output=True, stdin=subprocess.DEVNULL)
        tail = s.stdout.decode('utf-8', 'replace').strip().splitlines()
        msg.append('나눔 ' + ('완료' if s.returncode == 0 else '실패 ' + s.stderr.decode('utf-8', 'replace')[-200:]))
        msg += [t for t in tail if '바뀐 면적' in t]
    return j['name'] + ': ' + ' | '.join(msg)


with ThreadPoolExecutor(par) as ex:
    for line in ex.map(one, jobs):
        print(line, flush=True)
