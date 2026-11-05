// 연필 메모 서체를 만든다(2026-11-05 유호님 「내려받아 넣어」, 시안이 쓴 Nanum Pen Script).
// 메모에 나오는 글자만 골라 assets/fonts/board-pencil.woff2로 굽는다. 메모 글을 고치면 다시 돌린다 — core.test.mjs가 빠진 글자를 잡는다.
// 글꼴 라이선스(SIL OFL)의 예약 이름(Nanum · NanumPen 등) 때문에 고른 판의 안쪽 이름은 Board Pencil로 바꾸고, 저작권 · 라이선스 칸은 그대로 둔다. 라이선스 글은 옆 board-pencil-OFL.txt.
// 원본(git 밖 · 3.2MB): https://raw.githubusercontent.com/google/fonts/main/ofl/nanumpenscript/NanumPenScript-Regular.ttf
//   sha256 6f0d1ab29c7894010dc88831fb7a0a51edb79136e450344183de5b1a8b52bd43
//   node experiences/board-decode/qa/서체굽기.mjs <원본 ttf>     (fonttools · brotli 필요)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WORDS } from '../content.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = process.argv[2];
if (!src) throw Error('사용법은 파일 머리글');
const texts = Object.values(WORDS).flatMap((w) => [w.easy, w.decoy].filter(Boolean));
const chars = [...new Set(texts.join(''))].sort().join('');
const charsFile = path.join(here, '서체글자.txt');
fs.writeFileSync(charsFile, `${chars}\n`);
const out = path.join(here, '..', 'assets', 'fonts', 'board-pencil.woff2');

const py = String.raw`
import sys
sys.stdout.reconfigure(encoding='utf-8')
from fontTools.ttLib import TTFont
from fontTools import subset
src, out, chars = sys.argv[1:4]
text = open(chars, encoding='utf-8').read().replace('\r', '').replace('\n', '')
opt = subset.Options()
opt.flavor = 'woff2'
opt.layout_features = ['*']
opt.name_IDs = ['*']
opt.name_languages = ['*']
opt.hinting = False
opt.notdef_outline = True
font = subset.load_font(src, opt)
s = subset.Subsetter(opt)
s.populate(text=text)
s.subset(font)
name = font['name']
name.names = [r for r in name.names if r.nameID in (0, 13, 14)]
for i, v in {1: 'Board Pencil', 2: 'Regular', 3: 'Board Pencil Regular', 4: 'Board Pencil', 6: 'BoardPencil-Regular'}.items():
    name.setName(v, i, 3, 1, 0x409)
subset.save_font(font, out, opt)
back = TTFont(out)
cmap = back.getBestCmap()
missing = [c for c in text if ord(c) not in cmap]
print('글자', len(text), '· 글리프', len(back.getGlyphOrder()), '· 빠진 글자', missing)
print('이름', {r.nameID: str(r)[:60] for r in back['name'].names if r.nameID in (1, 4, 6)})
print('저작권 칸', str(back['name'].getDebugName(0))[:70], '· 라이선스 칸', str(back['name'].getDebugName(13))[:50])
sys.exit(1 if missing else 0)
`;
const r = spawnSync('python', ['-I', '-c', py, path.resolve(src), out, charsFile], { encoding: 'utf8' });
process.stdout.write(r.stdout || '');
process.stderr.write(r.stderr || '');
if (r.status !== 0) process.exit(r.status || 1);
console.log(`${path.basename(out)} ${fs.statSync(out).size}B`);
