#!/usr/bin/env node
/**
 * 옷 굽기 — 마스코트 셋에게 스무 벌씩, «따로 노는 조각»으로 (2026-09-06).
 *
 * ■ 왜 두 번 굽나
 *   씌운 채로만 구우면 조합마다 한 장이 필요하다. 의상 1 + 악세 2 를 동시에 입히려면
 *   마스코트 하나에 711장, 셋이면 716,688원이다(크레딧 414,984원으로는 못 간다).
 *   게다가 옷이 몸에 박혀 있으면 표정을 바꿀 수도 없다.
 *   ⇒ 옷을 «조각»으로 만들면 조합도 표정도 공짜가 된다.
 *
 * ■ 세 걸음 (한 벌에 두 장 = 672원)
 *   ① 씌워 굽는다        규격 「입힘」 + 그 마스코트의 정본을 참조로. 몸에 맞게 접히고 빛이 맞는다.
 *   ② 옷만 다시 굽는다   ①을 참조로 주고 「옷만, 같은 자리 같은 크기, 몸에 가린 부분은 아예 그리지 마라」.
 *   ③ 자리를 맞춘다      `tools/옷자리맞추기.py` — 두 눈을 기준으로 정본 몸 위 «맞는 자리»에 앉힌다(0원).
 *
 * ■ 안 하는 것
 *   자르지 않는다. 09-05 의 「오려 얹기」는 다 구운 그림을 잘라 술이 잘리고 색이 흐려졌다.
 *   여기서는 모델이 가장자리를 «다시 그린다».
 *
 * 쓰는 법:
 *   node tools/옷굽기.js --목록                       # 무엇을 구울지만 본다(0원)
 *   node tools/옷굽기.js --마스코트 몽글 --돈 20000    # 몽글 것만, 상한 2만원
 *   node tools/옷굽기.js --것 "겨울 델,목도리"          # 이름으로 좁힌다
 *   node tools/옷굽기.js --걸음 2                      # ①이 이미 있는 것의 ②③만
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const 루트 = path.resolve(__dirname, '..');
const 굽기 = require('./lib/이미지굽기.js');
const { 규격표 } = require('./lib/공방규격.js');
const { 마스코트들, 목록 } = require('./lib/옷목록.js');

const 낼방 = path.join(루트, 'docs/Loom_자산/옷');
const 장당 = 336;

/* ── 인자 ─────────────────────────────────────────────────────────────── */
const 인자 = process.argv.slice(2);
const 값 = (k, d = null) => (인자.includes(k) ? 인자[인자.indexOf(k) + 1] : d);
const 목록만 = 인자.includes('--목록');
const 돈상한 = Number(값('--돈', 0)) || 0;
const 고른마스코트 = 값('--마스코트');
const 고른것 = 값('--것');
const 걸음 = Number(값('--걸음', 0)) || 0;
const 로그경로 = 값('--로그');

function 말(줄) {
  const t = new Date().toTimeString().slice(0, 8);
  const s = `[${t}] ${줄}`;
  console.log(s);
  if (로그경로) { try { fs.appendFileSync(로그경로, s + '\n'); } catch { /* 로그는 편의일 뿐 */ } }
}

/* ── 지시문 ───────────────────────────────────────────────────────────── */

/** ② 옷만 뜨는 지시문. 🔴 「가린 부분은 아예 그리지 마라」가 이 문장의 급소다 —
 *  없으면 고리의 뒤쪽 안벽까지 그려져서, 얹었을 때 옷이 «그릇»처럼 머리 앞으로 나온다(09-06 실측). */
const 옷만지시 = (옷이름, 설명) =>
  `The reference photograph shows a small handmade felt character wearing ${옷이름}. ` +
  `Show ONLY that garment, with the character completely removed from the picture. ${설명} ` +
  `🔴 MOST IMPORTANT — draw ONLY the parts of the garment that are actually VISIBLE in the ` +
  `reference photograph. Any part of it that the character's body hides in the reference is ` +
  `simply not drawn at all: there is plain white background there instead. Do not invent, ` +
  `reconstruct or reveal the far side, the inside back wall, or the hollow interior of the ` +
  `garment. What you draw is exactly the silhouette of the garment as it is seen there. ` +
  `🔴 SECOND — the garment stays in EXACTLY the same place and at EXACTLY the same size within ` +
  `the square frame as it is in the reference. Do not move it, do not centre it, do not enlarge ` +
  `it, do not straighten it. ` +
  `Every fold, crease, drape and soft shadow it has in the reference is still there, and the ` +
  `light falls on it from the same direction. ` +
  `Nothing of the character remains: no wool of its body colour, no fur, no eyes, no ears, no ` +
  `paws, no helmet, no scalloped body hem, nowhere in the picture. ` +
  `Macro product photograph against a plain flat pure white background, the garment floating in ` +
  `empty space with no ground, no table, no mannequin and no cast shadow on any surface. ` +
  `Every wool fibre is resolved. No text, no watermark, no hands, no doll, no second object. ` +
  `Tack sharp, medium format macro, photorealistic craft object.`;

/* ── 굽을 것 고르기 ───────────────────────────────────────────────────── */
const 쇠로 = (s) => s.replace(/\s+/g, '');

function 고른다() {
  const 담을것 = [];
  for (const m of 마스코트들) {
    if (고른마스코트 && m.이름 !== 고른마스코트) continue;
    for (const 옷 of 목록(m.이름)) {
      if (고른것 && !고른것.split(',').some((s) => 옷.이름.includes(s.trim()))) continue;
      const 쇠 = `옷_${m.이름}_${쇠로(옷.이름)}`;
      담을것.push({
        ...옷,
        쇠,
        씌운: path.join(낼방, '씌움', `${쇠}.png`),
        옷만: path.join(낼방, '조각', `${쇠}_옷만.png`),
        누끼: path.join(낼방, '조각', `${쇠}_옷만_누끼.png`),
        층: path.join(낼방, '층', `${쇠}.png`),
        얹음: path.join(낼방, '얹음', `${쇠}.png`),
      });
    }
  }
  return 담을것;
}

/* ── 굽는 손 ──────────────────────────────────────────────────────────── */
const 잔다 = (ms) => new Promise((r) => setTimeout(r, ms));

/** 한 장 굽는다. 몫 벽이면 두 번까지 기다렸다 다시. 🔴 세 판 잇달아 막히면 부르는 쪽이 멈춘다. */
async function 한장(옵션, 이름) {
  for (let 판 = 0; 판 < 3; 판++) {
    try {
      await 굽기.한컷(옵션);
      return true;
    } catch (e) {
      if (e.돈벽) { 말(`🔴 돈 벽 — ${String(e.사유 || e.message).slice(0, 160)}`); return '돈벽'; }
      if (e.몫벽 && 판 < 2) { 말(`   몫이 찼다 · ${[90, 180][판]}초 쉬고 다시 (${이름})`); await 잔다([90, 180][판] * 1000); continue; }
      말(`🔴 ${이름} — ${String(e.message).slice(0, 160)}`);
      return false;
    }
  }
  return false;
}

function 파이썬(인자들) {
  const r = spawnSync('python', ['-X', 'utf8', ...인자들],
    { cwd: 루트, encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  return { ok: r.status === 0, 코드: r.status, 글: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

/** 흰 배경을 걷고 자리를 맞춘다(0원). 자리 맞추기가 3 이면 «확신이 낮다» = 옷만 뜨기가 잘못됐다. */
function 다듬어앉힌다(x) {
  const 걷기 = 파이썬(['tools/흰배경걷기.py', x.옷만, '--출력', x.누끼,
    '--흰바닥', '254', '--임계', '50', '--조각몫', '0', '--그대로']);
  if (!걷기.ok) return { ok: false, 왜: `흰 배경을 못 걷었다: ${걷기.글.slice(-140)}` };
  const 맞춤 = 파이썬(['tools/옷자리맞추기.py', x.누끼, x.씌운, x.얹음,
    '--몸', path.join(루트, x.마스코트.참조), '--눈', x.마스코트.눈, '--층', x.층]);
  const 점 = (맞춤.글.match(/겹침: 배율 ([\d.]+) · 점수 ([\d.]+)/) || [])[2];
  if (맞춤.코드 === 3) return { ok: false, 낮음: true, 점, 왜: `확신이 낮다(${점})` };
  if (!맞춤.ok) return { ok: false, 왜: `자리를 못 맞췄다: ${맞춤.글.slice(-140)}` };
  return { ok: true, 점 };
}

/* ── 본 일 ────────────────────────────────────────────────────────────── */
(async () => {
  for (const d of ['씌움', '조각', '층', '얹음']) fs.mkdirSync(path.join(낼방, d), { recursive: true });
  const 굽을것 = 고른다();

  if (목록만) {
    console.log(`\n■ 옷 굽기 — ${굽을것.length}벌 · 한 벌에 두 장 · 약 ${(굽을것.length * 2 * 장당).toLocaleString()}원\n`);
    let 앞 = null;
    for (const x of 굽을것) {
      if (x.마스코트.이름 !== 앞) { 앞 = x.마스코트.이름; console.log(`  [${앞}] ${목록(앞).length}벌`); }
      const 표 = fs.existsSync(x.얹음) ? '✅' : (fs.existsSync(x.씌운) ? '◐' : '·');
      console.log(`     ${표} ${x.갈래}  ${x.이름}${x.고유 ? '  (그 아이만의 것)' : ''}${x.성과 ? '  (성과)' : ''}`);
    }
    console.log('\n  ✅ = 다 됐다 · ◐ = 씌운 것만 있다 · · = 아직\n');
    return;
  }

  const 셀수 = 돈상한 > 0 ? Math.floor(돈상한 / (장당 * 2)) : 굽을것.length;
  const 할것 = 굽을것.slice(0, 셀수);
  말(`■ 옷 굽기 — ${할것.length}벌 · 약 ${(할것.length * 2 * 장당).toLocaleString()}원`
    + (돈상한 ? ` (상한 ${돈상한.toLocaleString()}원)` : ' (상한 없음)'));

  const ok = await 굽기.배치게이트(할것.length * 2, '4K');
  if (!ok) { 말('🚫 게이트가 막았다 — 한 장도 안 구웠다(0원).'); return; }

  let 됨 = 0, 실패 = 0, 연속막힘 = 0;
  for (let i = 0; i < 할것.length; i++) {
    const x = 할것[i];
    const 머리 = `${i + 1}/${할것.length} [${x.마스코트.이름}] ${x.이름}`;

    // ① 씌워 굽는다
    if (걸음 !== 2 && !fs.existsSync(x.씌운)) {
      말(`■ ${머리} — ① 씌워 굽기`);
      const r = await 한장({
        이름: `${x.마스코트.이름} ${x.이름}`,
        지시: x.마스코트.표식 + x.설명 + ' ' + 규격표['입힘'],
        비율: '1:1', 크기: '4K', 참조: [path.join(루트, x.마스코트.참조)], 저장경로: x.씌운,
      }, x.이름);
      if (r === '돈벽') break;
      if (!r) { 실패++; if (++연속막힘 >= 3) { 말('🔴 세 판 잇달아 막혔다 — 그만둔다.'); break; } continue; }
      연속막힘 = 0;
      await 잔다(45000);
    }

    // ② 옷만 다시 굽는다
    if (!fs.existsSync(x.옷만)) {
      말(`■ ${머리} — ② 옷만 뜨기`);
      const r = await 한장({
        이름: `${x.이름} 옷만`,
        지시: 옷만지시(x.이름, x.설명),
        비율: '1:1', 크기: '4K', 참조: [x.씌운], 저장경로: x.옷만,
      }, `${x.이름} 옷만`);
      if (r === '돈벽') break;
      if (!r) { 실패++; if (++연속막힘 >= 3) { 말('🔴 세 판 잇달아 막혔다 — 그만둔다.'); break; } continue; }
      연속막힘 = 0;
    }

    // ③ 흰 배경을 걷고 자리를 맞춘다 (0원)
    let 결과 = 다듬어앉힌다(x);

    /* 🔑 확신이 낮으면 «옷만 뜨기»를 한 번 다시 굽는다(336원). 자리가 아니라 그림이 잘못된 것이다 —
     *   ② 가 물체를 프레임 가득 키워 그리거나 딴 조각을 붙여 낸 장이 그렇다(09-06 실측).
     *   한 번만 다시 던진다. 두 번째도 낮으면 사람이 본다(조용히 넘어가지 않는다). */
    if (!결과.ok && 결과.낮음) {
      말(`   ⚠ ${x.이름} — ${결과.왜} · 옷만 뜨기를 한 번 다시 굽는다`);
      try { fs.unlinkSync(x.옷만); } catch { /* 없으면 그만 */ }
      await 잔다(45000);
      const r2 = await 한장({
        이름: `${x.이름} 옷만(다시)`,
        지시: 옷만지시(x.이름, x.설명),
        비율: '1:1', 크기: '4K', 참조: [x.씌운], 저장경로: x.옷만,
      }, `${x.이름} 옷만(다시)`);
      if (r2 === '돈벽') break;
      if (r2) 결과 = 다듬어앉힌다(x);
    }
    if (!결과.ok) { 말(`🔴 ${머리} — ${결과.왜} · 아침에 사람이 본다`); 실패++; continue; }

    됨++;
    말(`✅ ${머리} — 조각까지 났다 (겹침 ${결과.점} · 누적 ${(됨 * 2 * 장당).toLocaleString()}원)`);
    if (i < 할것.length - 1) await 잔다(45000);
  }

  말(`■ 끝 — ${됨}벌 · 실패 ${실패} · 약 ${(됨 * 2 * 장당).toLocaleString()}원 · ${낼방}`);
})();
