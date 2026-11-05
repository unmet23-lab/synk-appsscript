// 옷 가게 인화지 손글씨 서체를 만든다(2026-11-05) — 게시판 해독의 연필 메모와 같은 Nanum Pen Script(SIL OFL).
// 인화지 아래 여백에 쓰는 글자만 골라 assets/shop-pencil.woff2로 굽는다. 글(shop-items.mjs MOCK_NOTE)을 고치면 다시 돌린다.
// 라이선스(OFL)의 예약 이름 때문에 안쪽 이름은 Shop Pencil로 바꾸고 저작권 · 라이선스 칸은 그대로 둔다. 라이선스 글은 assets/shop-pencil-OFL.txt.
// 원본(git 밖 · 3.2MB): https://raw.githubusercontent.com/google/fonts/main/ofl/nanumpenscript/NanumPenScript-Regular.ttf
//   sha256 6f0d1ab29c7894010dc88831fb7a0a51edb79136e450344183de5b1a8b52bd43 (공용 작업본 .tmp/board-decode-20261104/서체/)
//   node experiences/drama/shop/qa/서체굽기.mjs <원본 ttf>     (fonttools · brotli 필요)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MOCK_NOTE } from '../shop-items.mjs';
import { PRINT_PLACE, PRINT_BACK_WORD, ITEM_TEXT } from '../../../synk-world-app/me2-shop-items.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = process.argv[2];
if (!src) throw Error('사용법은 파일 머리글');
// 날짜 · 곳을 바꿔도 다시 굽지 않게 숫자 · 월 · 일 · 쉼표는 늘 넣는다(이 서체에는 가운뎃점이 없다)
// 앱 옷 가게(11-05)의 인화지 글 「11월 6일, 학생 식당에서」도 같은 조각에 넣는다(앱은 me2-assets/shop-pencil.woff2로 복사).
// 11-06 인화지 뒷면 「11월 6일 도착 / 버터색 카디건」 — 옷 한국어 이름 여덟 벌의 글자도 넣는다(옷을 더하면 다시 굽는다).
const names = Object.values(ITEM_TEXT.ko).map((x) => x.name).join('');
const chars = [...new Set(Object.values(MOCK_NOTE).join('') + PRINT_PLACE + PRINT_BACK_WORD + names + '0123456789월일 ,.')].sort().join('');
const out = path.join(here, '..', 'assets', 'shop-pencil.woff2');
const py = String.raw`
import sys
sys.stdout.reconfigure(encoding='utf-8')
from fontTools.ttLib import TTFont
from fontTools import subset
src, out, text = sys.argv[1:4]
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
for i, v in {1: 'Shop Pencil', 2: 'Regular', 3: 'Shop Pencil Regular', 4: 'Shop Pencil', 6: 'ShopPencil-Regular'}.items():
    name.setName(v, i, 3, 1, 0x409)
subset.save_font(font, out, opt)
back = TTFont(out)
cmap = back.getBestCmap()
missing = [c for c in text if ord(c) not in cmap and c != ' ']
print('글자', len(text), '· 빠진 글자', missing)
sys.exit(1 if missing else 0)
`;
const r = spawnSync('python', ['-I', '-c', py, path.resolve(src), out, chars], { encoding: 'utf8' });
process.stdout.write(r.stdout || '');
process.stderr.write(r.stderr || '');
if (r.status !== 0) process.exit(r.status || 1);
fs.copyFileSync(out, path.join(here, '..', '..', '..', 'synk-world-app', 'me2-assets', 'shop-pencil.woff2'));
console.log(`${path.basename(out)} ${fs.statSync(out).size}B · 앱 사본도 고침`);
