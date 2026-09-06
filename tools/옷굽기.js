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
 *   ① 씌워 굽는다      규격 「입힘」 + 그 마스코트의 정본을 참조로. **보여주는 그림**이다(옷 가게·차림 카드).
 *   ② 초록 몸에 굽는다  같은 옷을 «몸이 단색 초록인» 마스코트에 입혀 한 장 더 굽는다. **조각을 뜨는 그림**이다.
 *   ③ 떼어 앉힌다      `tools/옷초록떼기.py` — 초록이 아닌 곳이 곧 옷이다(0원).
 *
 * ■ 왜 초록인가 (09-06 새벽 · 네 길을 실물로 태운 끝)
 *   ⓐ옷만 굽기 = 몸을 모른 채 구워 잘린 모양(유호 반려) · ⓑ오려 얹기 = 술이 잘리고 색이 흐려짐(유호 반려)
 *   ⓒ씌워 굽고 옷만 다시 굽기 = 21벌 중 8벌이 프레임을 바꾸거나 딴 조각을 붙였다
 *   ⓓ정본과의 차이로 떼기 = 그늘진 크림이 코랄과 가까워 구멍이 뚫린다
 *   ⓔ초록 몸 = 가를 것이 없다. 덤으로 «가림»도 공짜다(몸이 앞을 가린 자리는 애초에 안 그려진다).
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
const { spawnSync, spawn } = require('child_process');

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
/** 굽지 않고 «떼어 앉히기»만 다시 한다(0원) — 자리 맞추는 자를 고쳤을 때 쓴다. */
const 떼기만 = 인자.includes('--떼기만');
const 한번에 = Number(값('--한번에', 4)) || 4;
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

/** ② 초록 몸 지시문 — 몸만 단색 초록으로 바꾸고 같은 옷을 입힌다.
 *  🔑 눈은 검은 구슬 그대로 둔다. 자리를 두 눈으로 잡기 때문이다(눈이 없으면 앉힐 데를 모른다). */
const 바탕색 = { 초록: 'bright CHROMA GREEN (#00B140)', 자홍: 'bright CHROMA MAGENTA (#D6009A)' };

const 초록지시 = (표식, 설명, 바탕 = '초록') =>
  /* 🔴 09-06 실측 — 「몸을 초록으로」를 앞에 세웠더니 그 말이 옷 지시를 덮었다.
     왕관·밀짚모자·학생 가방·새싹 넷이 «옷 없는 초록 몸»으로 나왔다(작은 악세일수록 잘 밀린다).
     ⇒ 옷을 맨 앞에 세우고, 끝에서 한 번 더 못 박는다. 초록은 «곁들이는 조건»으로 내린다. */
  `A small handmade felt character is WEARING something, and that garment is the point of this ` +
  `picture. ${설명} ` +
  `${표식}` +
  `The character itself is EXACTLY the one in the reference photograph — the same silhouette, ` +
  `the same size, the same pose, the same camera angle, the same eyes in the same place — ` +
  `with ONE difference: its own wool is dyed a flat uniform ${바탕색[바탕]}, the ` +
  `same colour everywhere, with no heathering, no pattern and no shading variation. ` +
  `Its eyes keep their real colour and stay exactly as they are. ` +
  `🔴 The GARMENT keeps all of its own real colours and is clearly, fully visible — only the ` +
  `character's own body is that flat colour. Do not leave the garment out. ` +
  /* 🔴 09-06 저녁 실측 — 까몽 안경 컷에 «아무도 안 시킨 왕관»이 얹혀 나왔다. 조각을 뜨면 그
     왕관까지 옷으로 딸려 온다. 그 한 벌만이 아니라 통로 전체에 걸리는 자리라 여기서 못 박는다. */
  `🔴 ONLY that one garment is worn. Nothing else is added to the character — no crown, no hat, ` +
  `no scarf, no glasses, no bag, no badge beyond what is described in the sentence above. ` +
  /* 🔴 09-06 실측 — 일곱 벌이 «크기»에서 어긋났다. 모자·왕관이 몸보다 크게 그려지거나
     캐릭터가 화면에서 작아졌다. 그래서 크기를 두 가지로 못 박는다: 옷은 몸에 맞고,
     캐릭터는 화면을 늘 같은 만큼 채운다. */
  `🔴 SIZE — the garment is made to FIT this character: it is in scale with its body, the way a ` +
  `real doll's clothes are. A hat sits on the head without being wider than the head; a crown is ` +
  `small enough to rest on it. Nothing is oversized. ` +
  `The character fills the frame the same way it does in the reference photograph — the same ` +
  `distance, the same crop. Do not zoom out and do not shrink it. ` +
  `Macro product photograph against a plain flat pure white background, the whole character ` +
  `floating in empty space with no ground and no cast shadow on any surface. ` +
  /* 🔴 09-06 밤 실측 — 「no cast shadow」한 마디로는 부족했다. 까몽 여섯 벌에 바닥 그림자가 났고,
     그 회색이 옷에 «이어져» 붙어 조각을 떼도 안 떨어졌다(떨어져 있으면 덩어리째 버릴 수 있다).
     떼는 자로는 더 못 내리는 자리라 굽는 문장에서 막는다. */
  `🔴 There is NO shadow anywhere in the picture: none under the character, none beside it, ` +
  `none behind it, and none on the background. The background is one single flat even white ` +
  `with absolutely nothing on it — no grey patch, no gradient, no floor, no surface, no ` +
  `reflection. The character is lit so evenly that it casts nothing at all. ` +
  `Studio lighting: broad soft diffused light from every side with one gentle key from the upper ` +
  `left. Every wool fibre is resolved. No text, no watermark, no hands, no second character. ` +
  `Tack sharp, medium format macro, photorealistic craft object.`;

/** (옛 길 · 안 쓴다) 옷만 뜨는 지시문 — 21벌 중 8벌이 프레임을 바꿔 09-06 에 초록 길로 갈았다. */
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
        초록: path.join(낼방, '초록', `${쇠}_초록.png`),
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

/** 같은 일을 여러 개 «동시에» 돌린다 — 떼기는 한 장에 25초라 63벌이면 26분이다. */
function 파이썬비동기(인자들) {
  return new Promise((끝) => {
    const p = spawn('python', ['-X', 'utf8', ...인자들],
      { cwd: 루트, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
    let 글 = '';
    p.stdout.on('data', (d) => { 글 += d; });
    p.stderr.on('data', (d) => { 글 += d; });
    p.on('close', (코드) => 끝({ ok: 코드 === 0, 코드, 글: 글.trim() }));
  });
}

async function 떼기만돈다(할것) {
  const 있는것 = 할것.filter((x) => fs.existsSync(x.초록));
  말(`■ 떼어 앉히기만 다시 — ${있는것.length}벌 · 한 번에 ${한번에}개 · 0원`);
  let 됨 = 0, 실패 = 0;
  const 줄선것 = [...있는것];
  const 일꾼 = Array.from({ length: Math.max(1, 한번에) }, async () => {
    for (;;) {
      const x = 줄선것.shift();
      if (!x) return;
      const r = await 파이썬비동기(['tools/옷초록떼기.py', x.초록, x.층,
        '--몸', path.join(루트, x.마스코트.참조), '--눈', x.마스코트.눈, '--얹음', x.얹음,
        '--바탕', x.바탕 || x.마스코트.바탕 || '초록']);
      const 끝줄 = (r.글.split('\n').pop() || '').trim();
      if (r.ok) { 됨++; 말(`   [${x.마스코트.이름}] ${x.이름} — ${끝줄.replace(/^\S+\s+\S+\s+—\s+/, '')}`); }
      else { 실패++; 말(`🔴 [${x.마스코트.이름}] ${x.이름} — ${끝줄.slice(-140)}`); }
    }
  });
  await Promise.all(일꾼);
  말(`■ 끝 — ${됨}벌 다시 앉혔다 · 실패 ${실패} · 0원`);
  /* 🔴 실패가 있으면 «종료 상태»로도 말한다 (09-06 밤 검수). 안 그러면 `--떼기만 && 다음일`
     처럼 이어 붙인 자리가 몇 벌이 어긋난 채로 그냥 다음으로 넘어간다 — 오늘 내가 그렇게 이었다. */
  if (실패) process.exitCode = 4;
}

/** 초록 그림에서 옷을 떼어 정본 몸 자리에 앉힌다(0원). */
function 떼어앉힌다(x) {
  const r = 파이썬(['tools/옷초록떼기.py', x.초록, x.층,
    '--몸', path.join(루트, x.마스코트.참조), '--눈', x.마스코트.눈, '--얹음', x.얹음,
    '--바탕', x.바탕 || x.마스코트.바탕 || '초록']);
  if (!r.ok) return { ok: false, 왜: r.글.slice(-140) };
  const 점 = (r.글.match(/옷 ([\d,]+)점/) || [])[1];
  return { ok: true, 점 };
}

/* ── 본 일 ────────────────────────────────────────────────────────────── */
(async () => {
  for (const d of ['씌움', '초록', '층', '얹음']) fs.mkdirSync(path.join(낼방, d), { recursive: true });
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

  if (떼기만) { await 떼기만돈다(굽을것); return; }

  /* 🔴 돈 상한은 «아직 안 구운 것»에만 먹인다 (09-06 실측).
     전에는 목록 앞에서부터 잘랐는데, 앞쪽이 이미 다 구워진 벌이면 상한이 그 자리에서 소진되고
     정작 구울 것에는 안 닿았다 — 여덟 벌을 시켰더니 이미 난 두 벌을 세고 끝났다. */
  const 아직 = 굽을것.filter((x) => !fs.existsSync(x.씌운) || !fs.existsSync(x.초록));
  const 셀수 = 돈상한 > 0 ? Math.floor(돈상한 / (장당 * 2)) : 아직.length;
  const 할것 = 아직.slice(0, 셀수);
  if (아직.length === 0) { 말('■ 다 나 있다 — 구울 것이 없다(0원). 조각만 다시 뜨려면 --떼기만'); return; }
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

    // ② 초록 몸에 같은 옷을 입혀 굽는다 — 조각을 뜨는 그림
    if (!fs.existsSync(x.초록)) {
      말(`■ ${머리} — ② 초록 몸`);
      const r = await 한장({
        이름: `${x.이름} 초록`,
        지시: 초록지시(x.마스코트.초록표식 || x.마스코트.표식, x.설명, x.바탕 || x.마스코트.바탕 || '초록'),
        비율: '1:1', 크기: '4K', 참조: [path.join(루트, x.마스코트.참조)], 저장경로: x.초록,
      }, `${x.이름} 초록`);
      if (r === '돈벽') break;
      if (!r) { 실패++; if (++연속막힘 >= 3) { 말('🔴 세 판 잇달아 막혔다 — 그만둔다.'); break; } continue; }
      연속막힘 = 0;
    }

    // ③ 초록에서 떼어 앉힌다 (0원)
    let 결과 = 떼어앉힌다(x);
    /* 🔑 한 번 다시 굽는다(336원) — 초록이 흐리게 나오거나 눈을 못 찾은 장이 그렇다.
     *   두 번째도 안 되면 사람이 본다(조용히 넘어가지 않는다). */
    if (!결과.ok) {
      말(`   ⚠ ${x.이름} — ${결과.왜} · 초록 몸을 한 번 다시 굽는다`);
      try { fs.unlinkSync(x.초록); } catch { /* 없으면 그만 */ }
      await 잔다(45000);
      const r2 = await 한장({
        이름: `${x.이름} 초록(다시)`,
        지시: 초록지시(x.마스코트.초록표식 || x.마스코트.표식, x.설명, x.바탕 || x.마스코트.바탕 || '초록'),
        비율: '1:1', 크기: '4K', 참조: [path.join(루트, x.마스코트.참조)], 저장경로: x.초록,
      }, `${x.이름} 초록(다시)`);
      if (r2 === '돈벽') break;
      if (r2) 결과 = 떼어앉힌다(x);
    }
    if (!결과.ok) { 말(`🔴 ${머리} — ${결과.왜} · 아침에 사람이 본다`); 실패++; continue; }

    됨++;
    말(`✅ ${머리} — 조각까지 났다 (옷 ${결과.점}점 · 누적 ${(됨 * 2 * 장당).toLocaleString()}원)`);
    if (i < 할것.length - 1) await 잔다(45000);
  }

  말(`■ 끝 — ${됨}벌 · 실패 ${실패} · 약 ${(됨 * 2 * 장당).toLocaleString()}원 · ${낼방}`);
})();
