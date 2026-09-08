#!/usr/bin/env node
'use strict';
/**
 * 훅 몽골어 «짓는» 자 — 옮기지 않고 몽골어로 쓴다 (유호 확정 2026-09-08).
 *
 * ■ 왜 새로 짓나 — 있는 자가 «반대 방향»으로 서 있다
 *   `tools/몽골어대조.js` 의 다섯 겹 중 둘(①직역 역번역 · ⑤뜻 대조)은 「한국어와 뜻이 같은가」를 잰다.
 *   그 둘이 통과시키는 문장은 **한국어 모양을 한 몽골어**다. 자연스러움을 보는 층은 ② 하나뿐인데,
 *   그 하나가 앞의 둘과 싸운다. 09-08 에 F1 폼 한 줄이 정확히 그 자리에서 「어색」으로 걸렸다.
 *   유호 지시: 「뜻이 약간은 달라지더라도 몽골어로 완전히 자연스러웠으면 좋겠다.」
 *   ⇒ 훅(첫 2.5초 자막)에 한해 자를 바꾼다.
 *
 * ■ 바꾼 것 셋
 *   ① **옮기라고 안 시킨다.** 한국어 문장을 안 준다. «장면»과 «할 일»만 주고 몽골어로 세 개 쓰게 한다.
 *      (한국어를 주면 그것을 옮기려 들고, 옮긴 티는 못 지운다.)
 *   ② **재는 자를 「문장이 같은가」에서 「장면이 같은가」로.** 낱말이 흘러도 된다.
 *      다만 그 줄이 **같은 장면을 세우고 같은 물음을 여는지**는 잰다 — 그것까지 흐르면 편이 무너진다.
 *   ③ **흔들림을 거름망으로 쓴다.** 같은 바이트에 「정상」과 「어색」이 번갈아 나오는 자다
 *      ([[machine-verdict-not-repeatable]]). 그래서 자연스러움 판정을 **N번 돌려 매번 통과한 것만** 남긴다.
 *      한 번이라도 어색하면 뺀다. 흔들리는 자를 도장으로 쓰는 대신, 흔들림 자체를 거름망으로 쓴다.
 *   맞춤법 층은 그대로 쓴다 — 사전·형태소 자라 뜻이 흘러도 상관없이 철자를 잡는다.
 *
 * ■ 🔴 이 자가 «못» 하는 것 — 먼저 밝힌다
 *   우리 중 몽골어를 읽는 사람이 없다. 「완전히 자연스럽다」는 끝내 **기계의 주장**이다.
 *   이 자가 올리는 것은 «확률»이지 도장이 아니다. 원어민 감수는 그대로 남는다(감수 큐 §N · 09-10~15).
 *   그래서 낸 것은 전부 「감수 전」으로 표시하고, 감수자가 오면 그 사람 일이 «쓰기»가 아니라 «고치기»가 된다.
 *
 * ■ 쓰는 법
 *   node tools/훅몽골어짓기.js --편 02            그 편 다섯 화를 짓는다
 *   node tools/훅몽골어짓기.js --편 02 --화 1     한 화만
 *   node tools/훅몽골어짓기.js --전부             02~08 서른다섯 화
 *   node tools/훅몽골어짓기.js --편 02 --회차 5   자연스러움 판정을 다섯 번 돌린다(기본 3)
 *   node tools/훅몽골어짓기.js --편 02 --미리보기 호출 0 · 무엇을 보낼지만 낸다
 *   낼 곳: docs/_ops/훅몽골어_초벌.json (덧붙인다 · 대본은 «안» 건드린다)
 *
 * ■ 대본을 왜 안 고치나
 *   대본은 지금 옆 세션이 만지는 자리다. 이 자는 «초벌 장부»만 쌓고,
 *   그것을 대본에 넣는 것은 사람이 한 번 보고 하는 별도 걸음이다(`--넣기` 는 일부러 안 만들었다).
 */

const fs = require('fs');
const path = require('path');

const 루트 = path.join(__dirname, '..');
const 대본방 = path.join(루트, '.claude', 'skills', 'synk-content', 'references', '리드크루클립');
const 낼곳 = path.join(루트, 'docs', '_ops', '훅몽골어_초벌.json');

const 정책 = require(path.join(루트, 'tools', '모델정책.js'));
const { 제미나이 } = require(path.join(루트, 'tools', 'lib', '제미나이호출.js'));
const { 맞춤법검사 } = require(path.join(루트, 'tools', 'lib', '몽골어맞춤법.js'));

const argv = process.argv.slice(2);
const 인자 = (이름) => { const i = argv.indexOf(이름); return i >= 0 ? argv[i + 1] : null; };
const 있나 = (이름) => argv.includes(이름);

/* ── 대본에서 한 화의 «장면»을 읽는다 ──────────────────────────────────────
 * 🔑 한국어 훅 문장은 «장면을 짓는 재료»로만 쓰고, 짓는 모델에게는 안 보낸다.
 *   보내면 그것을 옮기려 든다. 대신 상황·실수·반응 칸을 장면으로 넘긴다. */
function 편읽기(편) {
  const f = fs.readdirSync(대본방).find((x) => x.startsWith(편 + '_'));
  if (!f) throw new Error(`대본을 못 찾았다 — ${편}편`);
  const 줄 = fs.readFileSync(path.join(대본방, f), 'utf8').split(/\r?\n/);
  const 화들 = [];
  let 지금 = null;
  for (let i = 0; i < 줄.length; i++) {
    const l = 줄[i];
    if (/^\*\*\[훅 자막\]\*\*/.test(l)) {
      let j = i + 1;
      while (j < 줄.length && !/^>/.test(줄[j]) && j < i + 4) j++;
      const t = j < 줄.length && /^>/.test(줄[j]) ? 줄[j].replace(/^>\s*/, '') : '';
      const 한 = t.indexOf(' — ') >= 0 ? t.split(' — ')[0] : t;
      const 몽 = t.indexOf(' — ') >= 0 ? t.split(' — ')[1] : '';
      지금 = { 편, 화: 화들.length + 1, 훅한국어: 한.trim(), 이미있는몽골어: 몽.trim(), 칸: {} };
      화들.push(지금);
    }
    /* 장면형 표 = | 타이밍 | 자막 | 의 행들 */
    const m = l.match(/^\|\s*(상황|실수|반응|표현)\s*\|\s*(.+?)\s*\|\s*$/);
    if (m && 지금) 지금.칸[m[1]] = m[2].replace(/\*\*/g, '').trim();
    const 자리 = l.match(/^\*\*자리\*\*:\s*(.+)$/);
    if (자리 && 화들.length) 화들[화들.length - 1].자리 = 자리[1].trim();
  }
  return 화들;
}

/* ── ① 짓기 — 옮기지 말고 몽골어로 쓰게 한다 ─────────────────────────────── */
function 짓기프롬프트(화) {
  const 장면 = [
    `상황: ${화.칸.상황 || '(대본에 없음)'}`,
    `학생이 흔히 하는 실수: ${화.칸.실수 || '(없음)'}`,
    `그 말이 부른 결과: ${화.칸.반응 || '(없음)'}`,
    화.자리 ? `찍는 자리: ${화.자리}` : '',
  ].filter(Boolean).join('\n');

  return `You write short-form video hooks in Mongolian (Cyrillic) for Mongolian viewers aged 15-25.

TASK: write THREE different candidate hook lines in Mongolian for the scene below.

SCENE
${장면}

RULES
- Write in Mongolian. Do NOT translate from another language. This must read like a Mongolian person wrote it, not like a translation.
- It is shown for 2.5 seconds at the very start of an 18-second video. Its only job is to make the viewer NOT scroll away.
- Open a small question the viewer can feel immediately. Do not merely report the situation.
- 6 to 14 words. One line. No hashtags. No emoji.
- Colloquial, the way a young person actually speaks. Avoid textbook or news register.
- The three candidates must differ in approach, not just in wording.

Return JSON only:
{"후보":[{"몽골어":"...","왜":"one short line in Korean explaining the angle"},{...},{...}]}`;
}

/* ── ② 자연스러움 — 한국어를 «안 보여주고» 잰다. 흔들림을 거름망으로. ────── */
function 자연프롬프트(몽) {
  return `You are a native Mongolian speaker, 22 years old, who watches a lot of short-form video.

Read this single line of Mongolian and judge it. You are NOT given any source text; judge it on its own.

LINE
${몽}

Answer these:
1. Does this read like a Mongolian person wrote it, or like something translated from another language?
2. Is the grammar correct and the register natural for a 15-25 year old?
3. Would this make you stop scrolling for a second?

Return JSON only:
{"자연스러움":"native|slightly_off|translated","문법":"정상|어색|파손","멈추나":"yes|maybe|no","까닭":"one short line in Korean"}`;
}

/* ── ③ 장면 지킴 — 낱말이 흘러도 «같은 장면»인가 ───────────────────────── */
function 장면프롬프트(몽, 화) {
  return `A Mongolian hook line was written for a specific scene. Check whether it still sets up that scene.

SCENE (what the video is about)
- situation: ${화.칸.상황 || '(none)'}
- learner's common mistake: ${화.칸.실수 || '(none)'}
- what that mistake causes: ${화.칸.반응 || '(none)'}

MONGOLIAN LINE
${몽}

The wording is allowed to differ freely from any original. What matters is:
- Does the line put the viewer in THAT situation (not a different one)?
- Does it open the question that the video then answers?

Return JSON only:
{"같은장면":"yes|drifted|no","무엇이달라졌나":"one short line in Korean","판정까닭":"one short line in Korean"}`;
}

/* ── 제미나이 한 번 부르기 ─────────────────────────────────────────────── */
/* 모델 이름은 정책이 정본이다 — 여기 값을 박지 않는다(09-05 에 옛 값이 세 번 갈렸다). */
const 모델 = 인자('--모델') || (정책.몽골어검문모델 && 정책.몽골어검문모델()) || 'gemini-3.8-flash';
const 용도 = 인자('--용도') || 정책.기본용도();

async function 물어보기(프롬프트, 스키마설명) {
  const key = 정책.제미나이키(용도);
  if (!key) throw new Error('확인 불가: ' + 정책.제미나이키안내(용도));
  const r = await 제미나이(key, 모델, 프롬프트, { thinking: 'high', timeoutMs: 120000, 용도, 상세: true });
  const t = String(r.text || '');
  const m = t.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`${스키마설명}: JSON 을 못 찾았다`);
  return JSON.parse(m[0]);
}

/* ── 한 화를 짓고 거른다 ──────────────────────────────────────────────── */
async function 한화(화, 회차) {
  const 결과 = { 편: 화.편, 화: 화.화, 훅한국어: 화.훅한국어, 자리: 화.자리 || '', 후보: [], 고른것: null, 잰때: new Date().toISOString() };

  const 지음 = await 물어보기(짓기프롬프트(화), '짓기');
  const 후보들 = (지음.후보 || []).slice(0, 3);
  if (!후보들.length) { 결과.오류 = '후보가 0개다'; return 결과; }

  for (const c of 후보들) {
    const 몽 = String(c.몽골어 || '').trim();
    if (!몽) continue;
    const 칸 = { 몽골어: 몽, 왜: c.왜 || '', 자연: [], 장면: null, 맞춤법: null, 통과: false };

    /* ③ 흔들림 거름망 — 회차만큼 돌려 «매번» native/정상이어야 한다 */
    for (let k = 0; k < 회차; k++) {
      try { 칸.자연.push(await 물어보기(자연프롬프트(몽), '자연스러움')); }
      catch (e) { 칸.자연.push({ 오류: e.message }); }
    }
    const 매번 = 칸.자연.length === 회차
      && 칸.자연.every((v) => v && v.자연스러움 === 'native' && v.문법 === '정상');

    /* ② 장면 지킴 — 낱말은 흘러도 되고 장면은 안 된다 */
    try { 칸.장면 = await 물어보기(장면프롬프트(몽, 화), '장면'); }
    catch (e) { 칸.장면 = { 오류: e.message }; }
    const 장면OK = 칸.장면 && 칸.장면.같은장면 === 'yes';

    /* ④ 맞춤법 — 사전 자라 뜻이 흘러도 그대로 쓴다.
     * 🔴 **「0건」과 「못 쟀다」를 가른다.** 그 서비스는 시간당 몫이 있어 벽에 닿으면 null 을 준다
     *   ([[mongolian-review-gate]] · 09-08 실측). 앞 판은 둘을 뭉개서, 못 잰 후보를
     *   「맞춤법 의심 0건」이라는 **거짓 사유**로 떨어뜨렸다([[zero-is-a-success-face-taxonomy]]). */
    /* 🔑 벽에 닿은 것이면 한 번 쉬었다 다시 잰다 — 한 번 못 쟀다고 그 후보를 버리면
     *   시간당 몫에 걸린 판에서 «멀쩡한 문장이 통째로» 떨어진다. */
    칸.맞춤법 = await (async () => {
      for (let 회 = 0; 회 < 2; 회++) {
        if (회) await new Promise((r) => setTimeout(r, 20000));
        try {
          const s = await 맞춤법검사(몽);
          if (s && Array.isArray(s.의심)) return { 의심: s.의심, 제안: s.제안 || {} };
        } catch (e) { if (회) return { 못잼: true, 까닭: e.message }; }
      }
      return { 못잼: true, 까닭: '두 번 물었는데 자가 답을 안 줬다(시간당 몫에 닿았을 수 있다)' };
    })();
    const 철자못잼 = !!(칸.맞춤법 && 칸.맞춤법.못잼);
    const 철자OK = !철자못잼 && 칸.맞춤법.의심.length === 0;

    칸.통과 = !!(매번 && 장면OK && 철자OK);
    칸.왜안됨 = 칸.통과 ? '' : [
      매번 ? '' : '자연스러움이 매번 native·정상이 아니다',
      장면OK ? '' : '장면이 흘렀다',
      철자못잼 ? '맞춤법을 **못 쟀다**(0건이 아니다)' : (철자OK ? '' : '맞춤법 의심 ' + 칸.맞춤법.의심.length + '건'),
    ].filter(Boolean).join(' · ');
    결과.후보.push(칸);
  }

  결과.고른것 = 결과.후보.find((c) => c.통과) || null;
  return 결과;
}

/* ── 달리기 ───────────────────────────────────────────────────────────── */
(async () => {
  const 회차 = Number(인자('--회차')) || 3;
  const 편들 = 있나('--전부') ? ['02', '03', '04', '05', '06', '07', '08'] : [인자('--편')].filter(Boolean);
  if (!편들.length) { console.error('무엇을 지을지 안 줬다 — --편 02 또는 --전부'); process.exit(1); }
  const 한화만 = 인자('--화') ? Number(인자('--화')) : null;

  let 대상 = [];
  for (const 편 of 편들) 대상 = 대상.concat(편읽기(편).filter((h) => !한화만 || h.화 === 한화만));

  console.log(`■ 훅 몽골어 짓기 — ${대상.length}화 · 자연스러움 ${회차}회 · 모델 ${모델} · 문 ${용도}`);
  console.log('  🔴 이 자가 내는 것은 «확률»이지 도장이 아니다 — 원어민 감수는 그대로 남는다.\n');

  if (있나('--미리보기')) {
    const h = 대상[0];
    console.log('── 짓기에 보낼 것(첫 화) ──\n' + 짓기프롬프트(h));
    console.log('\n🔑 한국어 훅 문장은 «안» 보낸다 — 보내면 옮기려 든다. 지금 그 값 = ' + JSON.stringify(h.훅한국어));
    return;
  }

  const 낸것 = [];
  for (const h of 대상) {
    process.stdout.write(`  ${h.편}-${h.화} … `);
    try {
      const r = await 한화(h, 회차);
      낸것.push(r);
      console.log(r.고른것 ? `✅ ${r.고른것.몽골어}` : `🟠 통과 0/${r.후보.length} (${(r.후보[0] || {}).왜안됨 || r.오류 || '까닭 미상'})`);
    } catch (e) {
      console.log('🔴 ' + e.message);
      낸것.push({ 편: h.편, 화: h.화, 오류: e.message });
    }
  }

  let 옛 = [];
  try { 옛 = JSON.parse(fs.readFileSync(낼곳, 'utf8')); } catch (e) { /* 없으면 새로 */ }
  fs.mkdirSync(path.dirname(낼곳), { recursive: true });
  fs.writeFileSync(낼곳, JSON.stringify(옛.concat(낸것), null, 2), 'utf8');

  /* 🔴 갈래를 갈라 센다 — 「떨어졌다」와 「못 쟀다」가 같은 수에 들어가면
   *   벽에 닿은 판이 «품질이 나쁜 판»으로 읽힌다([[two-causes-need-a-separating-count]]). */
  const 됨 = 낸것.filter((r) => r.고른것).length;
  const 못잼화 = 낸것.filter((r) => !r.고른것 && (r.후보 || []).some((c) => c.맞춤법 && c.맞춤법.못잼)).length;
  const 진짜떨어짐 = 낸것.length - 됨 - 못잼화 - 낸것.filter((r) => r.오류).length;
  console.log(`\n■ 통과 ${됨}/${낸것.length} · 진짜 떨어짐 ${진짜떨어짐} · 맞춤법을 못 재서 보류 ${못잼화} · 넘어짐 ${낸것.filter((r) => r.오류).length}`);
  if (못잼화) console.log('  🟠 보류는 «품질이 나쁜 것»이 아니다 — 시간당 몫이 풀린 뒤 그 화만 다시 돌린다.');
  console.log(`  → ${path.relative(루트, 낼곳)}`);
  console.log('  🔴 대본은 안 건드렸다 — 넣는 것은 사람이 한 번 보고 하는 별도 걸음이다.');
})().catch((e) => { console.error('🔴 넘어졌다: ' + e.message); process.exit(1); });
