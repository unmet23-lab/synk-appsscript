#!/usr/bin/env node
/**
 * 옷 GPT 굽기 — GPT Image 2.5 Sunburst에 «몸 한 장 + 옷 한 장»을 함께 준다.
 * 09-09 유호 확정: 의상은 2.5만 사용. 2.0이나 다른 모델로 대체하지 않는다.
 * 제작 정본 = docs/캐릭터/의상제작_정본.md. 아래 09-08 실측은 구버전의 이력이다.
 *
 * ■ 왜 생겼나 (유호 지시 09-08 「다른 거 안 쓰고 GPT 한테 시켜보고 싶다」)
 *   09-07 에 바깥 편집 모델 넷(FLUX Kontext · Qwen 편집기 둘 · FLUX.2)을 재봤는데 넷 다
 *   니들 펠트 재질을 못 지켰다. **GPT 는 그때 안 재봤다.** 09-08 에 ChatGPT 창으로 넉 장을
 *   구워 보니 «두른 것처럼 보이는가»에서 제미나이를 이겼다 — 닿는 자국·접촉 그림자·같은 조명.
 *
 * ■ 과거 실측 (09-08 · GPT Image 2 결과, 2.5 비용·한계의 근거가 아님)
 *   · 정사각 최대 = **2560×2560**. 3072 는 「화소 예산을 넘는다」로 거절. 정본은 4096 이라 조금 작다.
 *   · 값 = 한 장 **약 63원**($0.0427 · 넣은 것 3,287칸 + 낸 것 548칸). 제미나이 336원의 1/5.
 *   · 🔴 「팔이 만세로 올라간다」는 무늬는 지시에 «팔은 옆으로 뻗은 채로» 한 줄을 더하면 잡힌다.
 *   · 🔴 투명 바탕 참조는 모델이 «빈 그림»으로 읽는다(09-07 제미나이에서 확인한 것과 같다).
 *
 * ■ 열쇠
 *   C:\Users\q1212\SYNK_보안\openai.txt (git 밖). env OPENAI_KEY_FILE 로 경로를 바꾼다.
 *
 * 쓰기:
 *   node tools/옷GPT굽기.js --설정                        # 모델·대체 여부만 조회, 생성 없음
 *   node tools/옷GPT굽기.js --목록                        # 무엇을 고를 수 있나
 *   node tools/옷GPT굽기.js --것 "목도리"                  # 한 벌
 *   node tools/옷GPT굽기.js --전부                         # 여러 벌은 --간다 없이 생성하지 않는다
 *   node tools/옷GPT굽기.js --전부 --간다                  # 묻지 않고 바로
 *   node tools/옷GPT굽기.js --것 "목도리" --크기 1024      # 작은 크기로 시험
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const 저장소 = path.join(__dirname, '..');
const L = require(path.join(저장소, 'tools', 'lib', '옷목록.js'));
const 원본보관 = require(path.join(저장소, 'tools', 'lib', '마스코트원본.js'));

const 조각방 = path.join(저장소, 'docs', 'Loom_자산', '옷', '층');
const 참조방 = path.join(저장소, 'docs', 'Loom_자산', '옷', 'GPT참조');
const 낼방 = path.join(저장소, 'docs', 'Loom_자산', '옷', 'GPT');
const 열쇠경로 = process.env.OPENAI_KEY_FILE || 'C:\\Users\\q1212\\SYNK_보안\\openai.txt';

const 모델 = 'gpt-image-2.5-sunburst';
/** 앞발이 «있는» 캐릭터. 몽글은 팔도 다리도 없는 종 모양이라 앞발 지시를 걸면 안 된다. */
const 앞발있음 = new Set(['까몽', '마린']);
// 09-09 공식 2.5 요율. 입력을 모두 이미지 요율로 잡은 참고값이며 실제 청구액은 아니다.
const 값 = { 넣은칸: 8 / 1e6, 낸칸: 30 / 1e6 };
const 환율 = 1470;

const 인자 = (() => {
  const a = process.argv.slice(2);
  const o = {};
  for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) o[a[i].slice(2)] = a[i + 1] && !a[i + 1].startsWith('--') ? a[i + 1] : true;
  return o;
})();

function 열쇠() {
  if (!fs.existsSync(열쇠경로)) {
    throw new Error(`열쇠 파일이 없다: ${열쇠경로}\n`
      + '   만드는 법: platform.openai.com/api-keys → 「Create new secret key」 → 값을 그 파일에 한 줄로.');
  }
  const t = String(fs.readFileSync(열쇠경로, 'utf8')).replace(/^\uFEFF/, '').trim();
  const m = t.match(/sk-[A-Za-z0-9_\-]{20,}/);
  if (!m) throw new Error(`열쇠 파일에 sk- 로 시작하는 값이 없다: ${열쇠경로}`);
  return m[0];
}

/** 옷 조각(투명 바탕)을 «흰 바탕 + 여백 잘라내기 + 긴 변 1536» 으로 바꿔 둔다.
 *  투명 바탕은 모델이 빈 그림으로 읽고, 큰 그림은 넣는 칸(=돈)만 늘린다. */
function 참조만들기(원본, 낼곳, 긴변 = 1536) {
  원본보관.ensureFiles([원본, 낼곳]);
  if (fs.existsSync(낼곳) && fs.statSync(낼곳).mtimeMs > fs.statSync(원본).mtimeMs) return 낼곳;
  fs.mkdirSync(path.dirname(낼곳), { recursive: true });
  const r = spawnSync('python', ['-c', `
import sys
from PIL import Image
im = Image.open(sys.argv[1])
긴 = int(sys.argv[3])
if im.mode in ('RGBA','LA'):
    im = im.convert('RGBA')
    b = im.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox()
    c = im.crop(b) if b else im
    바 = Image.new('RGB', c.size, (255,255,255))
    바.paste(c, (0,0), c)
    im = 바
else:
    im = im.convert('RGB')
if max(im.size) > 긴:
    r = 긴 / max(im.size)
    im = im.resize((round(im.width*r), round(im.height*r)), Image.LANCZOS)
im.save(sys.argv[2], 'JPEG', quality=92)
`, 원본, 낼곳, String(긴변)], { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  if (r.status !== 0) throw new Error(`참조 만들기 실패 — ${(r.stderr || '').slice(0, 300)}`);
  return 낼곳;
}

function 지시문(마스코트, 옷들) {
  const 여럿 = 옷들.length > 1;
  const 참조설명 = 옷들.map((o, i) =>
    `REFERENCE ${i + 2} shows «${o.이름}» on its own, on a white background.`).join(' ');
  return [
    `Generate an image. You are given ${옷들.length + 1} reference images.`,
    'REFERENCE 1 is the doll itself. This is the exact character you must reproduce; copy it faithfully.',
    `${참조설명} Copy each piece exactly as shown:`,
    'its shape, colours, felt material, stitching and proportions. Do not redesign any of them.',
    '',
    마스코트.표식,
    '',
    `Draw the doll of REFERENCE 1 actually wearing ${여럿 ? `ALL ${옷들.length} pieces at once` : 'it'}. `
      + 옷들.map((o) => o.설명).join(' '),
    '',
    /* 🔴 겹쳐 입힐 때만 붙인다 — 한 벌일 때 넣으면 모델이 없는 옷을 찾아 지어낸다. */
    ...(여럿 ? [
      `All ${옷들.length} pieces must be clearly visible and must not collide with each other:`,
      'each sits on its own part of the body, layered naturally the way a real doll would wear them together.',
      'A head piece sits ON the head, a neck piece around the neck, a body garment on the body.',
      '',
    ] : []),
    'It must read as genuinely worn, not pasted on: it follows the curve of the body it rests on, its outer',
    'edges disappear behind the body outline, the fur presses out from underneath it all the way around, the',
    'wool compresses slightly where it rests, and there is a soft contact shadow beneath it. The garment and',
    'the doll must be lit by exactly the same light, from the same direction, with the same softness.',
    'The doll itself must stay identical to REFERENCE 1 in body shape, fur, eyes, ears, paws, tail and pose.',
    /* 🔴 앞발 줄은 «앞발이 있는 캐릭터»에만 건다 (09-08 이종 검수 4958b5f0ecf6).
       몽글의 표식은 「no arms and no legs anywhere」다 — 함께 넣으면 지시가 서로 부딪혀
       모델이 둘 다 못 지키고 원래 몸까지 흔들린다. */
    ...(앞발있음.has(마스코트.이름)
      ? ['🔴 The two front paws stay held out to the SIDES at mid height — do not raise the arms upward.']
      : []),
    `Nothing about the doll changes; only the ${여럿 ? 'garments are' : 'garment is'} added.`,
    '🔴 The eyes and the tail tip must stay fully visible and unobstructed.',
    '🔴 Keep the doll the same size in frame as in REFERENCE 1. Do not shrink it.',
    '',
    'Studio photograph of a real handmade needle-felted wool object, soft even light, pure white background,',
    'no props, no text.',
  ].join('\n');
}

async function 한벌({ 열쇠값, 마스코트, 옷들, 몸참조, 크기 }) {
  const 옷참조들 = 옷들.map((옷) => {
    const 파일 = 옷.이름.replace(/ /g, '');
    const 옷조각 = path.join(조각방, `옷_${마스코트.이름}_${파일}.png`);
    원본보관.ensureFiles([옷조각]);
    if (!fs.existsSync(옷조각)) throw new Error(`옷 조각이 없다 — ${옷조각}`);
    return 참조만들기(옷조각, path.join(참조방, 마스코트.이름, `${파일}.jpg`));
  });
  const 파일 = 옷들.map((o) => o.이름.replace(/ /g, '')).join('+');

  const fd = new FormData();
  fd.append('model', 모델);
  fd.append('prompt', 지시문(마스코트, 옷들));
  fd.append('size', `${크기}x${크기}`);
  fd.append('n', '1');
  for (const p of [몸참조, ...옷참조들]) {
    fd.append('image[]', new Blob([fs.readFileSync(p)], { type: 'image/jpeg' }), path.basename(p));
  }

  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${열쇠값}` },
    body: fd,
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message);

  const b64 = j.data[0].b64_json;
  fs.mkdirSync(낼방, { recursive: true });
  const 저장경로 = path.join(낼방, `${마스코트.이름}_${파일}.png`);
  fs.writeFileSync(저장경로, Buffer.from(b64, 'base64'));

  const u = j.usage || {};
  const 든돈 = (u.input_tokens || 0) * 값.넣은칸 + (u.output_tokens || 0) * 값.낸칸;
  return { 저장경로, 든돈, 칸: `${u.input_tokens || 0}+${u.output_tokens || 0}` };
}

(async () => {
  if (인자.모델 && 인자.모델 !== 모델) {
    throw new Error(`의상은 ${모델} 고정이다. ${인자.모델} 또는 다른 모델로 대체하지 않는다.`);
  }
  if (인자.설정) {
    console.log(JSON.stringify({ 모델, 대체모델: null, 기본크기: 2560, 생성: false }));
    return;
  }
  const 마스코트이름 = 인자.마스코트 || '까몽';
  const 마스코트 = L.마스코트들.find((m) => m.이름 === 마스코트이름);
  if (!마스코트) throw new Error(`마스코트를 모른다 — ${마스코트이름}`);
  const 벌 = L.목록(마스코트이름);

  if (인자.목록) {
    console.log(`${마스코트이름} — ${벌.length}벌`);
    for (const v of 벌) console.log(`  [${v.갈래}] ${v.이름}`);
    return;
  }

  /** 이름 하나를 옷으로 바꾼다. */
  const 찾기 = (n) => {
    const v = 벌.find((x) => x.이름 === n);
    if (!v) throw new Error(`목록에 없다 — ${n} (--목록 으로 이름을 본다)`);
    return v;
  };

  /* 할것 = «한 장에 들어갈 옷 묶음»의 목록이다.
     --것  "목도리,안경"       → 두 장 (각각 한 벌씩)
     --겹  "목도리+안경"       → 한 장 (둘을 겹쳐 입힌다)
     --겹  "목도리+안경,왕관+조끼" → 두 장 (각각 두 벌 겹쳐) */
  let 할것;
  if (인자.전부) 할것 = 벌.map((v) => [v]);
  else if (인자.겹) {
    할것 = String(인자.겹).split(',').map((덩) =>
      덩.split('+').map((s) => s.trim()).filter(Boolean).map(찾기)).filter((a) => a.length);
    for (const 묶 of 할것) {
      if (묶.length > 4) throw new Error(`한 장에 네 벌까지다 — ${묶.map((o) => o.이름).join('+')}`);
    }
  } else if (인자.것) {
    할것 = String(인자.것).split(',').map((s) => s.trim()).filter(Boolean).map((n) => [찾기(n)]);
  } else throw new Error('--것 "옷 이름" · --겹 "옷+옷" · --전부 중 하나가 있어야 한다.');

  const 크기 = Number(인자.크기 || 2560);
  console.log(`■ ${마스코트이름} ${할것.length}장 · ${크기}×${크기} · ${모델}`);
  console.log('   종량제 API 경로. 2.5의 장당 비용은 미실측이며, 이전 2.0의 장당 예상값을 재사용하지 않는다.');
  if (!인자.간다 && 할것.length > 3) {
    console.log('   → 진짜 굽는다면 --간다 를 붙인다.');
    return;
  }

  const 열쇠값 = 열쇠();
  const 몸참조 = 참조만들기(path.join(저장소, 마스코트.참조), path.join(참조방, `_몸_${마스코트이름}.jpg`));

  let 합 = 0;
  const 실패 = [];
  const 동시 = Number(인자.동시 || 3);
  for (let i = 0; i < 할것.length; i += 동시) {
    const 묶음 = 할것.slice(i, i + 동시);
    await Promise.all(묶음.map(async (옷들) => {
      const 이름 = 옷들.map((o) => o.이름).join(' + ');
      const 시작 = Date.now();
      try {
        const r = await 한벌({ 열쇠값, 마스코트, 옷들, 몸참조, 크기 });
        합 += r.든돈;
        console.log(`  ✅ ${이름} · ${Math.round((Date.now() - 시작) / 1000)}초 · ${r.칸}칸 · 요율 참고 약 ${Math.round(r.든돈 * 환율)}원`);
      } catch (e) {
        실패.push(이름);
        console.log(`  ❌ ${이름} — ${String(e.message).slice(0, 140)}`);
      }
    }));
  }
  console.log(`\n■ 끝 — ${할것.length - 실패.length}/${할것.length}장 · 토큰 요율 참고값 $${합.toFixed(4)} ≈ ${Math.round(합 * 환율)}원(실제 청구액 아님)`);
  console.log(`   낸 곳: ${낼방}`);
  /* 🔴 한 벌이라도 못 구웠으면 «비정상»으로 끝낸다 (09-08 이종 검수 32cc40911543).
     한 장씩의 예외를 배열에만 담고 정상 종료하면, 밤 사슬이나 && 로 이어 붙인 다음 걸음이
     「다 구워졌다」로 알고 지나간다. 셸 종료 상태가 성공·실패를 갈라야 한다. */
  if (실패.length) {
    console.error(`   🔴 못 구운 것 ${실패.length}벌: ${실패.join(', ')}`);
    process.exitCode = 1;
  }
})().catch((e) => { console.error('✗', e.message); process.exit(1); });
