#!/usr/bin/env node
/**
 * 옷 두 그림 굽기 — 제미나이에게 «몸 한 장 + 우리 옷 그림 여러 장»을 함께 준다 (2026-09-07).
 *
 * ■ 🔴 왜 생겼나 (09-07 실측)
 *   지금 씌움은 옷을 «글로만» 설명해 구운 것이라 옷 모양이 제미나이 마음대로 나온다.
 *   그리고 조각을 떼어 얹는 길은 옷이 「오려 붙인 종이」로 읽힌다(빛이 몸과 안 맞는다).
 *   바깥 편집 모델 넷(FLUX Kontext · Qwen 편집기 둘 · FLUX.2)을 다 재봤는데 넷 다
 *   **우리 니들 펠트 양모 재질을 못 지켰다** — 사람 피부·점토·가죽으로 끌려갔다.
 *   제미나이는 그 재질을 지켜 왔으니, 거기에 «옷 그림»을 참조로 더 주면 디자인까지 고정된다.
 *
 * ■ 실측으로 확인한 것 (09-07)
 *   · 옷 디자인이 우리 것과 거의 같게 나온다(참조로 줬으니 당연하다).
 *   · 몸이 대체로 유지된다 — 귀·눈·꼬리·발바닥이 정본 그대로.
 *   · 🔑 **겹쳐 입기에서 제미나이가 «자리 다툼»을 스스로 푼다.** 조각을 포개면 목도리가
 *     얼굴을 덮어 눈만 남는데, 제미나이는 목도리를 목에 감아 얼굴을 살린다.
 *   · ⚠ 남은 흠 — 몸이 조금 작아지고 앞발이 옷에 가려질 때가 있다.
 *
 * ■ 🔴 이것이 «안» 푸는 것
 *   옷이 몸에 박혀 나오므로 **표정을 못 바꾼다.** 표정까지 곱하면 값이 터진다
 *   (까몽 겹쳐 입기 790가지 × 336원 = 265,440원 · 표정 14종이면 372만원).
 *   ⇒ 표정이 필요한 자리는 조각 길이다. 이 도구는 «보여 주는 자리»와 «시안»을 위한 것이다.
 *
 * 쓰기:
 *   node tools/옷두그림굽기.js --마스코트 까몽 --것 "겨울 델"
 *   node tools/옷두그림굽기.js --마스코트 까몽 --것 "겨울 델,털모자,목도리"   # 겹쳐 입기
 *   node tools/옷두그림굽기.js --마스코트 까몽 --것 "안경" --크기 1K          # 싸게 시험
 *   node tools/옷두그림굽기.js --목록                                       # 무엇을 고를 수 있나
 */
'use strict';

const fs = require('fs');
const path = require('path');

const 저장소 = path.join(__dirname, '..');
const { 키, 한컷, 배치게이트 } = require(path.join(저장소, 'tools', 'lib', '이미지굽기.js'));
const L = require(path.join(저장소, 'tools', 'lib', '옷목록.js'));

const 조각방 = path.join(저장소, 'docs', 'Loom_자산', '옷', '층');
const 흰바탕방 = path.join(저장소, 'docs', 'Loom_자산', '옷', '두그림_참조');
const 낼방 = path.join(저장소, 'docs', 'Loom_자산', '옷', '두그림');

const 인자 = (() => {
  const a = process.argv.slice(2);
  const o = {};
  for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) o[a[i].slice(2)] = a[i + 1] ?? true;
  return o;
})();

/** 옷 조각(투명 바탕)을 흰 바탕으로 바꿔 둔다 — 투명 배경은 모델이 «빈 그림»으로 읽는다(09-07 실측). */
function 흰바탕참조(마스코트, 이름) {
  const 파일 = `${이름.replace(/ /g, '')}.png`;
  const 원본 = path.join(조각방, `옷_${마스코트}_${파일}`);
  if (!fs.existsSync(원본)) throw new Error(`옷 조각이 없다 — ${원본}`);
  const 낼곳 = path.join(흰바탕방, 마스코트, 파일);
  if (fs.existsSync(낼곳) && fs.statSync(낼곳).mtimeMs > fs.statSync(원본).mtimeMs) return 낼곳;
  fs.mkdirSync(path.dirname(낼곳), { recursive: true });
  const r = require('child_process').spawnSync('python', ['-c', `
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGBA')
b = im.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox()
c = im.crop(b) if b else im
바 = Image.new('RGB', c.size, (255, 255, 255))
바.paste(c, (0, 0), c)
바.save(sys.argv[2])
`, 원본, 낼곳], { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  if (r.status !== 0) throw new Error(`흰 바탕 만들기 실패 — ${(r.stderr || '').slice(0, 200)}`);
  return 낼곳;
}

function 지시문(마스코트, 옷들) {
  const 참조설명 = 옷들
    .map((o, i) => `REFERENCE ${i + 2} shows «${o.이름}» on its own, on a white background.`)
    .join(' ');
  const 옷설명 = 옷들.map((o) => o.설명).join(' ');
  const 여럿 = 옷들.length > 1;
  return [
    `You are given ${옷들.length + 1} reference images.`,
    'REFERENCE 1 is the doll itself. This is the exact character you must draw — copy it faithfully.',
    `${참조설명} Copy each garment exactly as shown: its shape, its colours, its felt material, its stitching, its proportions. Do not redesign any of them.`,
    '',
    마스코트.표식,
    '',
    `Draw the doll of REFERENCE 1 wearing ${여럿 ? `ALL ${옷들.length} garments at once` : 'that garment'}. ${옷설명}`,
    '',
    여럿
      ? `All ${옷들.length} garments must be clearly visible and must not collide with each other: each sits on its own part of the body, layered naturally the way a real doll would wear them together.`
      : 'The garment must read as genuinely worn: it wraps the round body, its outer edges disappear behind the body outline, and the long fur presses out from underneath it all the way around.',
    'The doll itself must stay identical to REFERENCE 1 in body shape, fur, eyes, ears, paws, tail and pose. Nothing about the doll changes. Only the garment is added.',
    '🔴 The front paws and the tail tip must remain fully visible and uncovered, and the eyes must stay fully visible and unobstructed — they are what makes it this creature.',
    '🔴 Keep the doll the same size in frame as in REFERENCE 1. Do not shrink it.',
    '',
    'Studio photograph of a real handmade felt object, soft even light, pure white background, no props, no text.',
  ].join('\n');
}

(async () => {
  const 마스코트이름 = 인자.마스코트 || '까몽';
  const 마스코트 = L.마스코트들.find((m) => m.이름 === 마스코트이름);
  if (!마스코트) throw new Error(`마스코트를 모른다 — ${마스코트이름}`);
  const 벌 = L.목록(마스코트이름);

  if (인자.목록) {
    console.log(`${마스코트이름} — ${벌.length}벌`);
    for (const v of 벌) console.log(`  [${v.갈래}] ${v.이름}`);
    return;
  }
  if (!인자.것) throw new Error('--것 "옷 이름" 이 있어야 한다(겹쳐 입기는 쉼표로 나눈다). --목록 으로 이름을 본다.');

  const 이름들 = String(인자.것).split(',').map((s) => s.trim()).filter(Boolean);
  const 옷들 = [];
  const 참조 = [path.join(저장소, 마스코트.참조)];
  for (const n of 이름들) {
    const v = 벌.find((x) => x.이름 === n);
    if (!v) throw new Error(`목록에 없다 — ${n} (--목록 으로 이름을 본다)`);
    옷들.push(v);
    참조.push(흰바탕참조(마스코트이름, n));
  }

  const 크기 = 인자.크기 || '4K';
  const 꼬리 = 이름들.map((s) => s.replace(/ /g, '')).join('+');
  const 저장경로 = path.join(낼방, `${마스코트이름}_${꼬리}.png`);
  fs.mkdirSync(낼방, { recursive: true });

  await 배치게이트(1, 크기);
  await 한컷({
    이름: `두그림 ${마스코트이름} ${이름들.join('+')}`,
    지시: 지시문(마스코트, 옷들),
    참조,
    비율: '1:1',
    크기,
    저장경로,
    k: 키(),
  });
  console.log('  ⚠ 시안이다 — 옷이 몸에 박혀 나오므로 «표정이 바뀌는 자리»에는 못 쓴다.');
})().catch((e) => { console.error('🔴', e.message); process.exit(1); });
