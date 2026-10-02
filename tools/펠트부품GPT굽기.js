#!/usr/bin/env node
/**
 * 펠트 부품 GPT 굽기 — 화면 부품(단추·배지·타일·칩·꼬리표·아이콘)을 실제 니들 펠트 질감으로 «한 판»에 굽는다.
 *
 * 2026-10-02 사용자: 「이런 단순한것들도 있잖아. 마감을 신경써줬으면 좋겠어. 실제 펠트 질감으로 GPT 2.5 IMAGE를
 * 이용해서 뽑아서 사용해줘. … 모든 부분을 최대한 펠트질감 퀄리티 비싸게 보여야하잖아.」
 *
 * 원칙
 *  - 글자는 굽지 않는다. 숫자·문구는 화면 글자로 얹는다(20개국 번역·접근성·선명도).
 *  - 같은 판 안에서 한 번에 굽는다. 따로 구우면 실·빛·털 결이 부품마다 달라진다.
 *  - 승인된 펠트(몽글 본체, 펠트 노트북)를 참조로 줘서 브랜드의 펠트와 같은 재질로 맞춘다.
 *    투명 바탕 참조는 모델이 빈 그림으로 읽으므로 흰 바탕 JPEG로 바꿔 준다(tools/옷GPT굽기.js와 같은 처방).
 *  - 모델은 GPT Image 2.5(gpt-image-2.5-sunburst) 고정. 종량제라 --유료-api 없이는 만들지 않는다.
 *
 * 쓰기
 *   node tools/펠트부품GPT굽기.js --목록
 *   node tools/펠트부품GPT굽기.js --판 UI --유료-api            # 한 판(약 2048 정사각)
 *   node tools/펠트부품GPT굽기.js --판 재료 --크기 1536 --유료-api
 * 결과: docs/디자인/펠트부품/raw/<판>_<시각>.png (git 제외) + 기록 docs/디자인/펠트부품/생성기록.json
 * 원문(쓰는 곳·오리기·늘이기·마감 점검표): docs/디자인/펠트부품/README.md
 * 열쇠: C:\Users\q1212\SYNK_보안\openai.txt (git 밖). env OPENAI_KEY_FILE로 바꾼다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const 저장소 = path.join(__dirname, '..');
const 모델 = 'gpt-image-2.5-sunburst';
const 값 = { 넣은칸: 8 / 1e6, 낸칸: 30 / 1e6 }; // 09-09 공식 2.5 요율 참고값(실제 청구액 아님)
const 환율 = 1470;
const 열쇠경로 = process.env.OPENAI_KEY_FILE || 'C:\\Users\\q1212\\SYNK_보안\\openai.txt';
const 방 = path.join(저장소, 'docs', '디자인', '펠트부품');   // 원문: docs/디자인/펠트부품/README.md
const 참조원본 = ['docs/디자인/SNS키트/assets/mascot-몽글_본체.webp', 'docs/디자인/SNS키트/assets/felt-laptop.webp'];

const 공통 = [
  'Studio product photograph of real handmade needle-felted wool craft pieces laid out flat on a pure white background, shot from directly above.',
  'Soft, even, diffused top light with gentle soft contact shadows. Visible wool fibers, slight fuzz halo, real thickness (about 6–8 mm felt slabs with soft rounded edges).',
  'Match the exact felt material, fiber texture, color warmth and lighting of the reference photos (REFERENCE 1 coral felt ghost, REFERENCE 2 felt laptop). This must look like the same studio and the same maker.',
  'Each piece is separate with generous white space between pieces (at least 8% of the image), nothing touching, nothing cropped by the frame.',
  'Absolutely no letters, numbers, words, logos or symbols other than the ones described. Clean, premium, minimal, Scandinavian craft quality. No props, no hands, no table texture.',
].join(' ');

const 판들 = {
  UI: {
    설명: '앱·게임 화면 부품: 체크 배지, 빈 원 배지, 코랄 단추 판, 크림 타일, 연코랄 타일, 칩, 꼬리표, 코랄·연코랄 펠트 결 조각',
    지시: [
      'Arrange these 10 pieces in a neat grid (3 rows), centered, evenly spaced:',
      'Row 1: (1) a round coral (#F96859) felt disc badge with a white felt check-mark appliqué sewn on top with tiny visible running stitches in white thread; (2) the same round coral felt disc but completely blank; (3) a small round cream/off-white felt disc, blank; (4) a small pill-shaped chip in pale blush pink felt (#FBD3C6), blank.',
      'Row 2: (5) a wide rounded-rectangle button slab in coral felt (#F96859), aspect about 5:1, with a slightly darker coral underside edge showing thickness, and a neat inset running stitch in pale coral thread around the border, blank; (6) a wide rounded-rectangle tile in warm cream wool felt (#FBF7F0), aspect about 5:1, thick, with a subtle inset running stitch in light beige thread, blank; (7) the same wide tile in pale blush felt (#FEE7DE) with an inset running stitch in coral thread, blank.',
      'Row 3: (8) a small rectangular label tag in cream felt with a coral running-stitch border, blank; (9) a flat square swatch of coral felt (#F96859), about 1:1, even texture, no stitching; (10) a flat square swatch of pale blush felt (#FEF0E9), about 1:1, even texture, no stitching.',
    ].join(' '),
  },
  배경: {
    설명: '프로필 사진·배너용: 큰 원판(검정·청금석·코랄), 버터 고리, 브리핑 메모 조각, 큰 결 조각(검정·청금석·버터·크림)',
    지시: [
      'Arrange these 9 pieces in a neat 3×3 grid, centered, evenly spaced, each piece large (about 26% of the image width):',
      'Row 1: (1) a large round disc of deep black wool felt (#141210), perfectly circular, smooth even surface, thin neat running stitch in charcoal thread close to the rim, blank; (2) the same large round disc in lapis blue felt (#3D6BC9) with a running stitch in pale blue thread near the rim, blank; (3) the same large round disc in coral felt (#F96859) with a running stitch in pale coral thread near the rim, blank.',
      'Row 2: (4) a thick round ring (donut shape) of butter-yellow wool felt (#F5C445), the hole is about 78% of the outer diameter, with a running stitch in cream thread along the middle of the ring; (5) a small folded note card made of cream felt (#FBF7F0) with two short stitched lines like text lines and a small coral felt four-point spark sewn on its corner; (6) a flat square swatch of deep black wool felt, even texture, no stitching.',
      'Row 3: (7) a flat square swatch of lapis blue felt (#3D6BC9), even texture, no stitching; (8) a flat square swatch of butter-yellow felt (#F5C445), even texture, no stitching; (9) a flat square swatch of warm cream felt (#FBF7F0), even texture, no stitching.',
    ].join(' '),
  },
  재료: {
    설명: '주문 폭주 재료 아이콘 6개: 커피 원두, 찻잎, 우유, 얼음, 각설탕, 눈송이(차갑게)',
    지시: [
      'Arrange these 6 small felt objects in a neat 3×2 grid, centered, evenly spaced, each about the same visual size, simple iconic silhouettes readable at small size:',
      '(1) two roasted coffee beans in dark brown felt with a stitched center line; (2) a single green tea leaf in sage green felt with a stitched vein; (3) a small milk bottle in white felt with a pale blue felt cap; (4) one translucent-looking pale ice-blue felt ice cube with soft highlights; (5) one white felt sugar cube with tiny fiber sparkle; (6) a pale blue felt snowflake with six arms.',
    ].join(' '),
  },
};

const 인자 = (() => { const a = process.argv.slice(2); const o = {}; for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) o[a[i].slice(2)] = a[i + 1] && !a[i + 1].startsWith('--') ? a[i + 1] : true; return o; })();

function 열쇠() {
  if (!fs.existsSync(열쇠경로)) throw new Error('열쇠 파일이 없다: ' + 열쇠경로);
  const m = String(fs.readFileSync(열쇠경로, 'utf8')).match(/sk-[A-Za-z0-9_\-]{20,}/);
  if (!m) throw new Error('열쇠 파일에 sk- 값이 없다');
  return m[0];
}
function 참조준비() {
  const out = path.join(방, 'ref'); fs.mkdirSync(out, { recursive: true });
  return 참조원본.map((rel, i) => {
    const dst = path.join(out, `ref${i + 1}.jpg`);
    if (!fs.existsSync(dst)) {
      const r = spawnSync('python', ['-c', `
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGBA')
bg = Image.new('RGB', im.size, (255,255,255)); bg.paste(im, mask=im.split()[3])
bb = Image.new('L', im.size, 0); bb.paste(im.split()[3]); box = bb.getbbox(); bg = bg.crop(box) if box else bg
m = max(bg.size)
if m > 1280: r = 1280/m; bg = bg.resize((round(bg.width*r), round(bg.height*r)), Image.LANCZOS)
pad = Image.new('RGB', (bg.width+120, bg.height+120), (255,255,255)); pad.paste(bg, (60,60)); pad.save(sys.argv[2], 'JPEG', quality=92)
`, path.join(저장소, rel), dst], { encoding: 'utf8' });
      if (r.status !== 0) throw new Error('참조 만들기 실패: ' + r.stderr);
    }
    return dst;
  });
}

async function main() {
  if (인자.목록) { for (const [k, v] of Object.entries(판들)) console.log(`${k}: ${v.설명}`); return; }
  const 판 = 판들[인자.판];
  if (!판) throw new Error('--판 ' + Object.keys(판들).join('|'));
  const 크기 = Number(인자.크기 || 2048);
  if (!인자['유료-api']) { console.log(`생성 안 함: GPT Image 2.5 종량제다. 한 판(${크기}²)에 대략 100~400원. 실행하려면 --유료-api`); return; }
  const refs = 참조준비();
  const fd = new FormData();
  fd.append('model', 모델);
  fd.append('prompt', `${공통} ${판.지시}`);
  fd.append('size', `${크기}x${크기}`);
  fd.append('n', '1');
  for (const p of refs) fd.append('image[]', new Blob([fs.readFileSync(p)], { type: 'image/jpeg' }), path.basename(p));
  const t0 = Date.now();
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${열쇠()}` }, body: fd });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message);
  const raw = path.join(방, 'raw'); fs.mkdirSync(raw, { recursive: true });
  const 이름 = `${인자.판}_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.png`;
  fs.writeFileSync(path.join(raw, 이름), Buffer.from(j.data[0].b64_json, 'base64'));
  const u = j.usage || {};
  const 돈 = (u.input_tokens || 0) * 값.넣은칸 + (u.output_tokens || 0) * 값.낸칸;
  const 기록파일 = path.join(방, '생성기록.json');
  const 기록 = fs.existsSync(기록파일) ? JSON.parse(fs.readFileSync(기록파일, 'utf8')) : [];
  기록.push({ 시각: new Date().toISOString(), 판: 인자.판, 모델, 크기, 파일: `raw/${이름}`, 칸: `${u.input_tokens || 0}+${u.output_tokens || 0}`, 참고값_달러: +돈.toFixed(4), 참고값_원: Math.round(돈 * 환율), 걸린초: Math.round((Date.now() - t0) / 1000) });
  fs.writeFileSync(기록파일, JSON.stringify(기록, null, 1));
  console.log(`구움 ${path.relative(저장소, path.join(raw, 이름))} · 칸 ${u.input_tokens || 0}+${u.output_tokens || 0} · 참고값 약 ${Math.round(돈 * 환율)}원`);
}
main().catch((e) => { console.error('실패:', e.message); process.exit(1); });
