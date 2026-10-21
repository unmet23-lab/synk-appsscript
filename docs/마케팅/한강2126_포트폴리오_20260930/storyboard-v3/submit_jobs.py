# -*- coding: utf-8 -*-
"""힉스필드 영상 주문을 느린 인터넷에서도 겹치지 않게 넣고 받는다.

    python submit_jobs.py <작업표.json>

작업표: {"out": 결과 폴더, "refs_dir": 참고 폴더,
        "jobs": [{"name", "job_type", "prompt", "refs": [파일 이름…], "args": [모델 인자…]}…]}

- 참고 사진은 한 번만 올리고 받은 번호를 `_upload_ids.json`에 적어 다음 작업에 다시 쓴다.
- 주문은 하나씩 넣는다. 응답을 잃으면 다시 넣기 전에 작업 목록에서 새로 생긴 같은 모델 작업을 찾는다(중복 주문 방지).
- 끝날 때까지 20초마다 상태를 보고, 결과를 받아 <이름>.mp4와 <이름>.json으로 둔다.
"""
import json, os, subprocess, sys, time
from datetime import datetime, timezone

H = os.path.join(os.environ['APPDATA'], 'npm', 'higgsfield.exe')
spec = json.load(open(sys.argv[1], encoding='utf-8'))
OUT, RD = spec['out'], spec['refs_dir']
CACHE = os.path.join(os.path.dirname(os.path.abspath(sys.argv[1])), '_upload_ids.json')
ids = json.load(open(CACHE, encoding='utf-8')) if os.path.exists(CACHE) else {}


def log(*a):
    print(datetime.now().strftime('%H:%M:%S'), *a, flush=True)


def hf(args, timeout=300):
    try:
        r = subprocess.run([H, *args, '--json'], capture_output=True, text=True, encoding='utf-8', timeout=timeout)
        return r.returncode, r.stdout, r.stderr
    except subprocess.TimeoutExpired:
        return 124, '', 'timeout'


def upload(fn):
    path = os.path.join(RD, fn)
    key = f'{fn}:{os.path.getsize(path)}'
    if key in ids:
        return ids[key]
    for i in range(6):
        code, out, err = hf(['upload', 'create', path], timeout=600)
        if code == 0 and out.strip():
            ids[key] = json.loads(out)['id']
            json.dump(ids, open(CACHE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            log('올림', fn, ids[key])
            return ids[key]
        log('올림 실패', fn, (err or out).strip()[-160:])
        time.sleep(20 * (i + 1))
    raise SystemExit(f'올림 포기: {fn}')


def recent(job_type, since, prompt_head=''):
    code, out, _ = hf(['generate', 'list', '--video', '--size', '15'])
    if code != 0:
        return None
    d = json.loads(out)
    items = d if isinstance(d, list) else (d.get('items') or d.get('jobs') or d.get('data') or [])
    found = []
    for j in items:
        t = datetime.fromisoformat(j['created_at'].replace('Z', '+00:00'))
        p = (j.get('params') or {}).get('prompt') or ''
        if j.get('job_type') == job_type and t >= since and (not p or not prompt_head or p.startswith(prompt_head)):
            found.append(j['id'])
    return found


def create(job, ref_ids):
    prompt = open(job['prompt'], encoding='utf-8').read()
    args = ['generate', 'create', job['job_type'], *job['args']]
    for rid in ref_ids:
        args += ['--image-references', rid]
    args += ['--prompt', prompt]
    seen = set()
    for i in range(6):
        since = datetime.now(timezone.utc).replace(microsecond=0)
        before = recent(job['job_type'], since.replace(year=since.year - 1)) or []
        seen |= set(before)
        code, out, err = hf(args, timeout=300)
        if code == 0 and out.strip():
            d = json.loads(out)
            d = d[0] if isinstance(d, list) else d
            jid = d if isinstance(d, str) else (d.get('id') or d.get('job_id'))   # 기다리지 않으면 작업 번호만 온다
            if jid:
                log('주문', job['name'], jid)
                return jid
        log('주문 응답 없음', job['name'], (err or out).strip()[-160:])
        after = None
        for _ in range(8):   # 목록을 못 읽은 채 다시 주문하면 겹칠 수 있다
            time.sleep(15)
            after = recent(job['job_type'], since, prompt[:80])
            if after is not None:
                break
        if after is None:
            raise SystemExit(f'목록 확인 실패로 멈춤(겹침 방지): {job["name"]}')
        new = [j for j in (after or []) if j not in seen]
        if new:
            log('응답은 잃었지만 주문은 들어감', job['name'], new[0])
            return new[0]
        time.sleep(20 * (i + 1))
    raise SystemExit(f'주문 포기: {job["name"]}')


def wait(job, jid):
    last = None
    while True:
        code, out, err = hf(['generate', 'get', jid])
        if code == 0 and out.strip():
            d = json.loads(out)
            d = d[0] if isinstance(d, list) else d
            st = d.get('status')
            if st != last:
                log(job['name'], st)
                last = st
            if st in ('completed', 'failed', 'nsfw', 'error', 'canceled', 'cancelled', 'rejected'):
                return d
        time.sleep(20)


made = []
for job in spec['jobs']:   # 올리기·주문은 하나씩, 생성은 서버에서 함께 돈다
    if job.get('job_id'):   # 이미 들어간 주문은 다시 넣지 않고 기다리기만 한다
        made.append((job, job['job_id']))
        continue
    ref_ids = [upload(fn) for fn in job['refs']]
    made.append((job, create(job, ref_ids)))
for job, jid in made:
    d = wait(job, jid)
    json.dump(d, open(os.path.join(OUT, job['name'] + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    url = d.get('result_url') or ''
    if url:
        subprocess.run(['curl', '-sSL', '--retry', '5', '--retry-all-errors', '-o', os.path.join(OUT, job['name'] + '.mp4'), url])
        log('받음', job['name'])
    else:
        log('결과 없음', job['name'], d.get('status'))
