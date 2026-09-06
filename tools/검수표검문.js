#!/usr/bin/env node
'use strict';
/**
 * 검수표 몽골어를 **한 벌씩 검문에 태우는 자** (2026-09-07 · 유호 「87줄 검문 태워줘」).
 *
 * ■ 왜 있나
 *   감수자에게 넘길 초벌이 검수표 다섯 벌에 흩어져 있는데, 검문(`tools/몽골어대조.js`)은 한 번에
 *   **한 쌍**(한국어 하나 · 몽골어 하나)만 받는다. 백 쌍을 손으로 백 번 부르는 것은 사람 일이 아니고,
 *   무엇보다 **어느 줄이 검문을 지났는지 아무도 안 세고 있었다.**
 *   🔑 사람이 오기 «전»에 기계가 할 몫을 끝내 두면, 감수자가 보는 양이 준다.
 *
 * ■ 이 자가 «못» 세는 것 — 먼저 밝힌다
 *   검수표는 표 꼴이 파일마다 다르고 한 파일 안에도 여러 벌이다(칸 이름·칸 수가 다 다르다).
 *   그래서 이 자는 **「한국어 원문」 칸과 «몽골어가 든» 칸이 둘 다 있는 표**만 고른다.
 *   못 고른 표는 조용히 넘기지 않고 `--세기` 가 이름을 대며 말한다 — 「0건」이 「없다」가 아니라
 *   「자가 못 봤다」일 수 있기 때문이다.
 *
 * ■ 쓰기
 *   node tools/검수표검문.js --세기          몇 쌍인가 · 몇이 이미 검문을 지났나 (호출 0)
 *   node tools/검수표검문.js                 안 지난 것만 태운다
 *   node tools/검수표검문.js --다시          이미 지난 것도 다시 태운다(흔들림을 보려면)
 *   node tools/검수표검문.js --한도 20       앞에서 스무 쌍만
 *   node tools/검수표검문.js --글            옛 문(공짜 몫)으로 — 하루 20발 벽이 선다
 *
 * ■ 「이미 지났다」를 무엇으로 아나
 *   장부(`docs/_ops/몽골어검문.jsonl`)의 `번역지문` 이다 — 몽골어 본문의 지문(sha256 앞 12자리).
 *   🔴 그래서 **몽골어가 한 글자라도 바뀌면 다시 태운다.** 그게 맞다(고친 판은 다른 글이다).
 *   🔴 그리고 「한 번 지났다」가 도장이 아니다 — 같은 글에 답이 갈린 실측이 있다
 *      (memory `machine-verdict-not-repeatable`). 그래서 `--다시` 가 있다.
 *
 * 🔑 이 파일은 검문을 «부르기»만 한다. 판정도 장부 쓰기도 `tools/몽골어대조.js` 가 한다(자는 하나다).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const 루트 = path.join(__dirname, '..');
const 검문자 = path.join(__dirname, '몽골어대조.js');
const 장부 = path.join(루트, 'docs', '_ops', '몽골어검문.jsonl');

const 인자 = process.argv.slice(2);
const 있나 = (f) => 인자.includes(f);
const 값 = (f) => { const i = 인자.indexOf(f); return i < 0 ? null : 인자[i + 1]; };

/* 검수표 — 이름을 여기 적는다. 새 표가 생기면 이 배열에 한 줄 붙인다. */
const 검수표 = [
  'AI활용문안_몽골어_검수표.md',
  'G1문항팩_몽골어_검수표.md',
  '릴대본_몽골어_검수표.md',
  '주간리포트_몽골어_검수표.md',
  '함께한날_몽골어_검수표.md',
];

const 지문 = (s) => crypto.createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex').slice(0, 12);
const 키릴수 = (s) => (String(s).match(/[Ѐ-ӿ]/g) || []).length;
const 한글있나 = (s) => /[가-힣]/.test(String(s));

/* 🔴 «몽골어 칸»과 «몽골어를 인용한 한국어 해설 칸»을 가른다 (09-07 첫 회차에 밟았다).
 *   처음에는 「키릴이 세 자 이상」으로 골랐는데, 그러자 G1문항팩의 **한국어 해설문**이 몽골어 칸으로
 *   뽑혔다 — 그 표는 「몽골어에서 무엇이 필요한가」를 한국어로 적고 그 안에 몽골어 낱말을 인용한다.
 *   검문이 「몽골어가 아니라 한국어가 들어왔다」고 정확히 되잡아 줘서 알았다.
 *   ⇒ 글자 «비율»로 가른다. 인용이 섞인 한국어 문장은 키릴이 절반을 못 넘는다. */
function 몽골어인가(s) {
  const 글자 = String(s).replace(/[^\p{L}]/gu, '');
  if (글자.length < 3) return false;
  return 키릴수(s) / 글자.length >= 0.5;
}
const 잠깐 = (ms) => new Promise((r) => setTimeout(r, ms));

/** 마크다운 표 한 줄을 칸 배열로. 바깥 파이프는 걷는다. */
function 칸가르기(줄) {
  return 줄.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
}
const 구분선인가 = (줄) => /^\s*\|[\s:|-]+\|\s*$/.test(줄) || /^[\s:|-]+$/.test(줄.replace(/^\s*\|/, '').replace(/\|\s*$/, ''));

/**
 * 파일 하나에서 (한국어, 몽골어) 짝을 뽑는다.
 * @returns {{짝:Array, 건너뛴표:Array}}
 */
function 표에서뽑기(파일이름) {
  const p = path.join(루트, 'docs', 파일이름);
  if (!fs.existsSync(p)) return { 짝: [], 건너뛴표: [`${파일이름}(파일이 없다)`] };
  const 줄들 = fs.readFileSync(p, 'utf8').split(/\r?\n/);

  const 짝 = [];
  const 건너뛴표 = [];
  let i = 0;
  let 표번호 = 0;
  while (i < 줄들.length) {
    if (!/^\s*\|/.test(줄들[i]) || !줄들[i + 1] || !구분선인가(줄들[i + 1])) { i++; continue; }
    표번호++;
    const 머리 = 칸가르기(줄들[i]);
    // 몸통을 먼저 모은다 — 어느 칸에 몽골어가 사는지는 «머리 이름»이 아니라 «실물»이 안다
    const 몸통 = [];
    let j = i + 2;
    for (; j < 줄들.length && /^\s*\|/.test(줄들[j]); j++) {
      const c = 칸가르기(줄들[j]);
      if (c.length >= 2) 몸통.push(c);
    }
    i = j;
    if (!몸통.length) { 건너뛴표.push(`${파일이름} 표${표번호}(줄 0)`); continue; }

    /* 🔴 **칸은 «머리 이름»이 고른다** (09-07 둘째 회차에 뒤집었다).
     *   처음에는 「한글이 가장 많이 든 칸 · 키릴이 가장 많이 든 칸」이라는 실물 자로 골랐다. 그러자
     *   주간리포트의 **«무엇이 다른가»를 한국어로 적은 해설 표**에서도 짝이 뽑혔다 — 해설문을 원문
     *   자리에 넣고 번역과 대조했으니 검문이 「뜻이 크게 다르다」고 답한 것이 당연했다.
     *   실물 자는 «이 표가 번역표인가»를 못 가른다. 이름은 가른다. 그래서 이름을 먼저 본다.
     *   🔑 이름으로 못 찾은 표는 «조용히 실물로 추측하지 않고» 건너뛴 표로 이름을 댄다 —
     *     그래야 「자가 못 봤다」가 「없다」로 접히지 않는다. */
    const 칸수 = Math.max(...몸통.map((c) => c.length));
    const 이름찾기 = (재) => 머리.findIndex((h) => 재.test(h.replace(/\*\*/g, '')));
    const 한칸 = 이름찾기(/한국어/);
    /* 몽골어 쪽은 「AI 초안」이 먼저다 — 「몽골어 확정」은 검수자가 채울 «빈» 칸이라 지금은 비어 있다. */
    let 키칸 = 이름찾기(/AI 초안|기계 번역/);
    if (키칸 < 0) 키칸 = 이름찾기(/몽골어/);
    if (한칸 < 0 || 키칸 < 0 || 한칸 === 키칸 || 한칸 >= 칸수 || 키칸 >= 칸수) {
      건너뛴표.push(`${파일이름} 표${표번호}(줄 ${몸통.length} · ${한칸 < 0 ? '「한국어」 칸 이름 없음' : 키칸 < 0 ? '「AI 초안」·「몽골어」 칸 이름 없음' : '두 이름이 한 칸에'})`);
      continue;
    }
    // 이름은 맞는데 몽골어가 실제로 안 든 표(릴대본의 빈 확정 칸)도 여기서 걸러진다
    if (!몸통.some((c) => 몽골어인가(c[키칸] || ''))) {
      건너뛴표.push(`${파일이름} 표${표번호}(줄 ${몸통.length} · 「${(머리[키칸] || '').replace(/\*\*/g, '')}」 칸이 비어 있다)`);
      continue;
    }
    const 이름 = (머리[한칸] || `칸${한칸}`) + ' → ' + (머리[키칸] || `칸${키칸}`);
    for (const c of 몸통) {
      const ko = (c[한칸] || '').replace(/\*\*/g, '').trim();
      const mn = (c[키칸] || '').replace(/\*\*/g, '').trim();
      if (!한글있나(ko) || !몽골어인가(mn)) continue;   // 짝이 안 서는 줄은 검문할 것이 없다
      짝.push({ 파일: 파일이름, 표: 표번호, 칸: 이름, ko, mn, 지문: 지문(mn) });
    }
  }
  return { 짝, 건너뛴표 };
}

/** 장부에 이미 있는 번역지문 모음. */
function 잰것들() {
  const 셋 = new Set();
  if (!fs.existsSync(장부)) return 셋;
  for (const l of fs.readFileSync(장부, 'utf8').split(/\r?\n/)) {
    if (!l.trim()) continue;
    try { const j = JSON.parse(l); if (j.번역지문) 셋.add(j.번역지문); } catch { /* 깨진 줄은 넘긴다 */ }
  }
  return 셋;
}

function 모으기() {
  const 짝 = [];
  const 건너뛴표 = [];
  for (const f of 검수표) {
    const r = 표에서뽑기(f);
    짝.push(...r.짝);
    건너뛴표.push(...r.건너뛴표);
  }
  /* 같은 몽골어가 두 표에 있으면 한 번만 태운다(같은 글을 두 번 재는 것은 몫 낭비다). */
  const 본것 = new Set();
  const 고른것 = [];
  for (const s of 짝) {
    if (본것.has(s.지문)) continue;
    본것.add(s.지문);
    고른것.push(s);
  }
  return { 짝: 고른것, 겹침: 짝.length - 고른것.length, 건너뛴표 };
}

function 세기() {
  const { 짝, 겹침, 건너뛴표 } = 모으기();
  const 잰 = 잰것들();
  const 지난것 = 짝.filter((s) => 잰.has(s.지문));
  console.log('■ 검수표에서 뽑은 (한국어 · 몽골어) 짝');
  const 파일별 = new Map();
  for (const s of 짝) 파일별.set(s.파일, (파일별.get(s.파일) || 0) + 1);
  for (const f of 검수표) console.log(`  ${f}: ${파일별.get(f) || 0}쌍`);
  console.log(`\n  합계 ${짝.length}쌍 = 이미 지난 것 ${지난것.length} + 안 지난 것 ${짝.length - 지난것.length}`
    + (겹침 ? ` (겹쳐서 뺀 것 ${겹침})` : ''));
  if (건너뛴표.length) {
    console.log(`\n🟠 이 자가 «못 본» 표 ${건너뛴표.length}벌 — 「없다」가 아니라 「자가 못 봤다」다:`);
    for (const t of 건너뛴표) console.log(`   · ${t}`);
  }
  return 0;
}

async function 태우기() {
  const { 짝, 건너뛴표 } = 모으기();
  const 잰 = 잰것들();
  const 다시 = 있나('--다시');
  let 대상 = 다시 ? 짝 : 짝.filter((s) => !잰.has(s.지문));
  const 한도 = Number(값('--한도')) || 0;
  if (한도 > 0) 대상 = 대상.slice(0, 한도);

  /* 🔴 **쉬는 시간을 반드시 준다** (09-07 첫 회차에 밟았다).
   *   사이 없이 69쌍을 던졌더니 28번째까지만 답이 오고 **41개가 연속 타임아웃**이었다. 검문 하나가
   *   제미나이를 두 번 부르므로, 사이가 없으면 순식간에 분당 수십 발이 된다. 429 가 아니라 «응답 없음»
   *   꼴로 벽이 서서 더 헷갈렸다. 10초면 분당 열두 발쯤이라 그 아래에 선다.
   *   ⚠ Vertex 의 분당 상한이 얼마인지는 여전히 **안 재봤다** — 이 값은 「모른다」 위에 선 보수적 값이다. */
  const 사이ms = Math.max(0, Number(값('--사이') || 10) * 1000);

  const 문플래그 = 있나('--글') ? ['--글'] : [];
  console.log(`■ 검수표 검문 — ${대상.length}쌍을 태운다${다시 ? '(이미 지난 것 포함)' : ''}`
    + `${문플래그.length ? ' · 옛 문(공짜 몫)' : ''} · 사이 ${사이ms / 1000}초`);
  if (건너뛴표.length) console.log(`  🟠 자가 못 본 표 ${건너뛴표.length}벌은 여기 안 들어 있다(--세기 가 이름을 댄다)`);
  if (!대상.length) { console.log('  태울 것이 없다.'); return 0; }
  console.log('');

  const 임시 = path.join(os.tmpdir(), `synk_검수표검문_${process.pid}.txt`);
  const 결과 = [];
  let 벽 = false;
  let 연속실패 = 0;
  for (let n = 0; n < 대상.length; n++) {
    const s = 대상[n];
    if (n > 0 && 사이ms) await 잠깐(사이ms);
    fs.writeFileSync(임시, `${s.ko}\n---\n${s.mn}\n`, 'utf8');
    const r = spawnSync(process.execPath, [검문자, '--파일', 임시, ...문플래그], {
      cwd: 루트, encoding: 'utf8', windowsHide: true, timeout: 300_000,
    });
    const 글 = `${r.stdout || ''}${r.stderr || ''}`;
    /* 종료코드 = 검문자의 자다: 0 통과 · 2 검수 필요 · 1 실행 실패(= 확인 불가). */
    const 얼굴 = r.status === 0 ? '✅' : r.status === 2 ? '🔴' : '🟠';
    const 판정 = (/판정:\s*(\S+)/.exec(글) || [])[1] || '(못 읽음)';
    /* 🔴 **왜 실패했는지를 반드시 찍는다** (09-07 둘째 회차에 밟았다).
     *   처음에는 `status === 1` 일 때만 사유를 찍었는데, 실제로 막힌 칸들은 그 코드가 아니어서
     *   화면에 🟠 만 뜨고 «까닭이 한 줄도 없었다». 원인을 못 보면 다음 판도 같은 자리에서 멈춘다.
     *   status 가 null 이면 이 자가 죽인 것이다(시간 초과) — 그 사실도 얼굴이 달라야 한다. */
    const 끝줄 = String(글.trim().split('\n').filter(Boolean).pop() || '(아무 말 없이 죽었다)').slice(0, 150);
    const 사유 = r.status === null ? `이 자가 끊었다(${r.signal || '시간 초과'}) · ${끝줄}` : `종료 ${r.status} · ${끝줄}`;
    결과.push({ ...s, 코드: r.status, 판정, 글 });
    console.log(`${얼굴} [${n + 1}/${대상.length}] ${s.파일.replace('_몽골어_검수표.md', '')} · ${s.ko.slice(0, 34)}`);
    if (r.status === 2) {
      // 사람이 볼 자리 — 「무엇이 걸렸나」를 그 자리에서 편다(뒤에 몰아 보면 안 본다)
      for (const l of 글.split('\n')) {
        if (/판정:|의심 낱말|큰 차이|원문에 없던 말투 위반 있음|🔴|⚠/.test(l) && !/✅/.test(l)) {
          console.log(`     ${l.trim().slice(0, 150)}`);
        }
      }
    }
    if (r.status !== 0 && r.status !== 2) console.log(`     확인 불가 — ${사유}`);

    /* 🔴 **셋이 잇달아 막히면 그만둔다** — 벽에 대고 계속 던지면 벽이 길어진다
     *   (memory `retry-into-429-holds-the-wall`). 09-07 첫 회차에 41발을 벽에 대고 던졌다. */
    연속실패 = (r.status === 0 || r.status === 2) ? 0 : 연속실패 + 1;
    if (연속실패 >= 3) {
      벽 = true;
      console.error(`\n🔴 셋이 잇달아 막혔다 — 남은 ${대상.length - n - 1}쌍은 던지지 않는다. 이 결과는 반쪽이다.`);
      console.error('   벽에 대고 계속 던지면 벽이 길어진다. 좀 쉬었다 같은 명령을 다시 돌린다(지난 것은 건너뛴다).');
      break;
    }
    if (/429|RESOURCE_EXHAUSTED|quota|Rate limit/i.test(글)) {
      벽 = true;
      console.error('\n🔴 몫 벽을 만났다 — 남은 것은 던지지 않는다. 이 결과는 반쪽이다.');
      break;
    }
  }
  try { fs.unlinkSync(임시); } catch { /* 임시 파일은 지워지면 좋고 아니면 그만 */ }

  const 통과 = 결과.filter((x) => x.코드 === 0).length;
  const 검수필요 = 결과.filter((x) => x.코드 === 2).length;
  const 확인불가 = 결과.filter((x) => x.코드 !== 0 && x.코드 !== 2).length;
  console.log(`\n■ 셈 — 태운 ${결과.length} = 통과 ${통과} + 검수 필요 ${검수필요} + 확인 불가 ${확인불가}`);
  console.log(`  남은 것 ${대상.length - 결과.length}${벽 ? ' (몫 벽에 막혔다)' : ''}`);
  console.log(`  장부 = docs/_ops/몽골어검문.jsonl (검문자가 직접 적는다)`);
  if (검수필요) {
    console.log('\n🔴 검수 필요로 걸린 줄:');
    for (const x of 결과.filter((y) => y.코드 === 2)) {
      console.log(`   · ${x.파일.replace('_몽골어_검수표.md', '')} · ${x.ko.slice(0, 40)}  →  ${x.판정}`);
    }
    console.log('  ⚠ 「검수 필요」가 「틀렸다」는 아니다 — 같은 글에 답이 갈린 실측이 있다(--다시 로 한 번 더 잰다).');
  }
  return 확인불가 || 벽 ? 2 : 0;
}

if (require.main === module) {
  (async () => {
    try {
      process.exit(있나('--세기') ? 세기() : await 태우기());
    } catch (e) {
      console.error('🔴 ' + (e && e.message));
      process.exit(1);
    }
  })();
}

module.exports = { 표에서뽑기, 모으기, 잰것들 };
