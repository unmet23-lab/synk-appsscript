# 플랫폼 회원 혜택 포스터 물건을 GPT 이미지 2.5(ChatGPT 구독 · Codex CLI)로 굽는다. 비용 0(구독, 계정 한도는 씀).
# 사용: python -X utf8 tools/혜택포스터/굽기.py [이름 …] [--again] [--판=2] [--동시=3]
#   결과: .tmp/혜택포스터/boards/<이름>[-판].png, 기록 log/. 같은 이름이 있으면 굽지 않는다(--again으로 다시).
#   참고 그림(재질·빛)은 desktop/assets/launcher의 펠트 별·메모를 흰 바탕 JPEG로 바꿔 넣는다(투명 PNG는 참고가 안 먹는다).
# 굽기 계정은 tools/codex계정.js가 돌린다 — 한도에 막히면 다음 보조 계정, 본 계정은 맨 마지막 예비.
import json, os, re, shutil, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(REPO, '.tmp', '혜택포스터')
args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = {a.split('=')[0]: (a.split('=') + [''])[1] for a in sys.argv[1:] if a.startswith('--')}
판 = opt.get('--판', '')
동시 = int(opt.get('--동시', '3') or 3)
spec = json.load(open(os.path.join(HERE, '지시문.json'), encoding='utf-8'))
jobs = [j for j in spec['물건'] if not args or j['이름'] in args]
for d in ('boards', 'log', 'refs'):
    os.makedirs(os.path.join(WORK, d), exist_ok=True)

refs = []
for name in ('fortune-star.avif', 'care-note.webp'):
    out = os.path.join(WORK, 'refs', os.path.splitext(name)[0] + '.jpg')
    if not os.path.exists(out):
        subprocess.run(['node', '-e', "require(process.argv[1])(process.argv[2]).flatten({background:'#ffffff'}).resize({width:900,height:900,fit:'inside'}).jpeg({quality:90}).toFile(process.argv[3])",
                        os.path.join(REPO, 'desktop', 'node_modules', 'sharp'), os.path.join(REPO, 'desktop', 'assets', 'launcher', name), out], check=True)
    refs.append(out)

HEAD = ('Use your built-in image generation tool to create exactly ONE image. Do not run any shell commands and do not '
        'create or edit any files yourself. After the image is generated, reply with only the absolute path of the saved image file.\n\n')
ROTATE = os.path.join(REPO, 'tools', 'codex계정.js')


def bake(j):
    name = j['이름'] + (f'-{판}' if 판 else '')
    out = os.path.join(WORK, 'boards', name + '.png')
    if os.path.exists(out) and '--again' not in opt:
        return f'있음 {name}'
    text = HEAD + spec['공통'].replace('{{OBJECT}}', j['OBJECT']).replace('{{BGNAME}}', j['BGNAME']).replace('{{BG}}', j['BG'])
    last = os.path.join(WORK, 'log', name + '.last.txt')
    cmd = ['node', ROTATE, 'exec', '--skip-git-repo-check', '-C', WORK, '-s', 'read-only']
    for r in refs:
        cmd += ['-i', r]
    cmd += ['-o', last, '-']
    t0 = time.time()
    p = subprocess.run(cmd, input=text.encode('utf-8'), capture_output=True)
    log = p.stdout.decode('utf-8', 'replace') + '\n---stderr---\n' + p.stderr.decode('utf-8', 'replace')
    open(os.path.join(WORK, 'log', name + '.txt'), 'w', encoding='utf-8').write(text + '\n\n===\n' + log)
    answer = open(last, encoding='utf-8').read() if os.path.exists(last) else ''
    found = re.findall(r'[A-Za-z]:[\\/][^\s"\'`]+?\.png', answer + '\n' + log)
    src = next((x for x in reversed(found) if os.path.exists(x) and 'generated_images' in x), None)
    if not src:
        return f'실패 {name} 종료 {p.returncode} {answer[-200:]} {log[-400:]}'
    shutil.copyfile(src, out)
    return f'완료 {name} {time.time() - t0:.0f}초 {out}'


with ThreadPoolExecutor(동시) as ex:
    for line in ex.map(bake, jobs):
        print(line, flush=True)
