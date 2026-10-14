# GPT 이미지 2.5(ChatGPT 구독 · Codex CLI)로 판 하나 굽기. 비용 0(구독).
# 사용: python bake.py <이름> <지시문.txt> [참고 그림 ...]   → boards/<이름>.png, log/<이름>.txt
# 같은 이름이 이미 있으면 굽지 않는다(--again 으로 다시).
import os, re, shutil, subprocess, sys, time

ROOT = os.path.dirname(os.path.abspath(__file__))
name, prompt_file, *refs = [a for a in sys.argv[1:] if a != '--again']
again = '--again' in sys.argv
out = os.path.join(ROOT, 'boards', name + '.png')
os.makedirs(os.path.dirname(out), exist_ok=True)
os.makedirs(os.path.join(ROOT, 'log'), exist_ok=True)
if os.path.exists(out) and not again:
    print('있음', out)
    sys.exit(0)
HEAD = ('Use your built-in image generation tool to create exactly ONE image. Do not run any shell commands and do not '
        'create or edit any files yourself. After the image is generated, reply with only the absolute path of the saved image file.\n\n')
body = open(os.path.join(ROOT, prompt_file), encoding='utf-8').read()
common = open(os.path.join(ROOT, 'mascot_common.txt'), encoding='utf-8').read()
text = HEAD + body.replace('{{MASCOTS}}', common)
last = os.path.join(ROOT, 'log', name + '.last.txt')
cmd = ['codex', 'exec', '--skip-git-repo-check', '-C', ROOT, '-s', 'read-only']
for r in refs:
    cmd += ['-i', os.path.join(ROOT, r)]
cmd += ['-o', last, '-']
t0 = time.time()
p = subprocess.run(cmd, input=text.encode('utf-8'), capture_output=True, shell=(os.name == 'nt'))
log = p.stdout.decode('utf-8', 'replace') + '\n---stderr---\n' + p.stderr.decode('utf-8', 'replace')
open(os.path.join(ROOT, 'log', name + '.txt'), 'w', encoding='utf-8').write(log)
answer = open(last, encoding='utf-8').read() if os.path.exists(last) else ''
m = re.findall(r'[A-Za-z]:[\\/][^\s"\'`]+?\.png', answer + '\n' + log)
src = next((x for x in reversed(m) if os.path.exists(x) and 'generated_images' in x), None)
if not src:
    print('실패', name, p.returncode, answer[-300:], log[-600:])
    sys.exit(1)
shutil.copyfile(src, out)
print('완료', name, f'{time.time() - t0:.0f}초', out)
