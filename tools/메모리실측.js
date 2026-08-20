#!/usr/bin/env node
'use strict';
/**
 * 메모리실측 — repo «밖» 메모리 정본이 실제로 얼마나 되는지 **재기만** 한다 (2026-08-19 · 유호 픽 ④).
 *
 * ■ 🔴 이 도구는 아무것도 지우지 않는다
 *   유호님 지시는 「과감히 압축 및 삭제하자」였지만, 그날 판정은 **「안 재본 것을 지우지 않는다」**로
 *   갈렸다. 이유가 둘이다:
 *     ① 클라우드 세션은 메모리를 **볼 수가 없다** — `~/.claude/projects/<슬러그>/memory` 가
 *        그 판에 아예 없다(2026-08-19 직접 열어 확인 · 세션 전사 jsonl 1개뿐). 안 보이는 것에
 *        삭제 판정을 낼 수 없다(F348 — 「없다」는 열 대상이 없다).
 *     ② 병은 **양이 아니라 자리**였다. 메모리를 반으로 줄여도 클라우드 세션의 확정은 여전히 0건이다.
 *        그 자리는 `docs/_ops/결정.md`(git 안)가 이미 가져갔다.
 *   ⇒ 그래서 이 도구는 **목록과 수를 낼 뿐**이고, 지울지는 그 화면을 보고 유호님이 정한다.
 *      대량 삭제는 검증 결정표의 비가역 승인 게이트를 그대로 지난다.
 *
 * ■ 어디서 도나 — **유호님 PC(로컬 세션)에서만** 값이 나온다
 *   클라우드·CI 에서는 메모리 디렉터리가 없어 「못 쟀다」를 낸다. **「0건」이라 말하지 않는다**
 *   (미실행과 통과는 같은 모양이면 안 된다 · F207).
 *
 * ■ 무엇을 재나
 *   ① 파일 수·총 바이트 — 「비대하다」가 실측인지 인상인지 가른다
 *   ② 낡음 분포 — 마지막 수정으로부터 며칠 (30·60·90일)
 *   ③ 🚫·기각·재제안 금지 건수 — 지금 나를 막고 있는 것이 메모리에 몇 줄인지
 *   ④ 압축 후보 — 낡음 × 크기 상위. **후보일 뿐이다**
 *   ⑤ 인덱스 대조 — MEMORY.md·지도.md 에 줄이 있는데 파일이 없는 것(유령) / 그 반대(누락)
 *
 * ■ 쓰기
 *   node tools/메모리실측.js               요약
 *   node tools/메모리실측.js --전량         파일 전량을 낡음순으로
 *   node tools/메모리실측.js --json        기계 판독용
 *   SYNK_MEMORY_DIR=... 로 대상을 덮어쓸 수 있다(회귀·다른 기계용)
 *   종료 코드 0 — 계기판이다. 2 = 못 쟀다(디렉터리 없음).
 */

const fs = require('fs');
const path = require('path');
const { 인자게이트 } = require('./lib/인자게이트.js');
const { memoryDir, INDEX_FILES } = require('./memory-graph.js');

/** 지금 나를 막는 것들의 표기 — `docs/_ops/결정.md` 가 대체하려는 바로 그 낱말들이다. */
const 금지어 = ['🚫', '재제안 금지', '기각'];

const 일 = 86400000;

function 잰다(디렉터리) {
  let 목록;
  try {
    목록 = fs.readdirSync(디렉터리).filter((f) => f.endsWith('.md'));
  } catch (e) {
    return { 못쟀다: true, 디렉터리, 이유: e.code === 'ENOENT' ? '디렉터리가 없다' : e.message };
  }

  const 지금 = Date.now();
  const 파일들 = [];
  for (const 이름 of 목록) {
    const 자리 = path.join(디렉터리, 이름);
    let st; let 본문;
    try {
      st = fs.statSync(자리);
      본문 = fs.readFileSync(자리, 'utf8');
    } catch {
      continue;   // 읽는 사이 사라진 파일 — 세지 않는다
    }
    const 금지 = {};
    for (const w of 금지어) 금지[w] = (본문.split(w).length - 1);
    파일들.push({
      이름,
      바이트: st.size,
      줄: 본문.split('\n').length,
      낡음: Math.floor((지금 - st.mtimeMs) / 일),
      금지,
      금지합: Object.values(금지).reduce((a, b) => a + b, 0),
      인덱스: INDEX_FILES.includes(이름),
    });
  }

  /* 인덱스 대조 — 유령(줄은 있는데 파일 없음)과 누락(파일은 있는데 줄 없음) */
  const 인덱스본문 = INDEX_FILES
    .map((f) => { try { return fs.readFileSync(path.join(디렉터리, f), 'utf8'); } catch { return ''; } })
    .join('\n');
  const 인덱스걸린것 = new Set([...인덱스본문.matchAll(/\]\(([^)]+\.md)\)/g)].map((m) => path.basename(m[1])));
  const 실제 = new Set(파일들.map((f) => f.이름));
  const 유령 = [...인덱스걸린것].filter((n) => !실제.has(n));
  const 누락 = 파일들.filter((f) => !f.인덱스 && !인덱스걸린것.has(f.이름)).map((f) => f.이름);

  return {
    디렉터리,
    파일수: 파일들.length,
    바이트: 파일들.reduce((a, f) => a + f.바이트, 0),
    줄합: 파일들.reduce((a, f) => a + f.줄, 0),
    금지합: 파일들.reduce((a, f) => a + f.금지합, 0),
    금지별: 금지어.reduce((o, w) => (o[w] = 파일들.reduce((a, f) => a + f.금지[w], 0), o), {}),
    낡음: {
      '30일+': 파일들.filter((f) => f.낡음 >= 30).length,
      '60일+': 파일들.filter((f) => f.낡음 >= 60).length,
      '90일+': 파일들.filter((f) => f.낡음 >= 90).length,
    },
    유령,
    누락,
    파일들,
  };
}

const KB = (n) => `${(n / 1024).toFixed(0)}KB`;

function 화면(r, 전량) {
  if (r.못쟀다) {
    return [
      `📏 메모리를 **못 쟀다** — ${r.이유}`,
      `   과녁: ${r.디렉터리}`,
      '   이건 「메모리가 0건」이 아니라 **이 판에 메모리가 없다**는 뜻이다(F207).',
      '   메모리 정본은 유호님 PC 에만 산다 — **로컬 세션에서 이 명령을 다시 돌린다.**',
      '   (SYNK_MEMORY_DIR 로 과녁을 직접 줄 수도 있다)',
    ].join('\n');
  }

  const 낸다 = [];
  낸다.push(`📏 메모리 실측 — ${r.디렉터리}`);
  낸다.push('   🔴 이 도구는 **아무것도 지우지 않는다.** 아래는 전부 「재 본 것」이다.');
  낸다.push('');
  낸다.push(`■ 덩치 — 파일 ${r.파일수}개 · ${KB(r.바이트)} · ${r.줄합.toLocaleString()}줄`);
  낸다.push(`■ 낡음 — 30일+ ${r.낡음['30일+']}개 · 60일+ ${r.낡음['60일+']}개 · 90일+ ${r.낡음['90일+']}개`);
  낸다.push(`■ 지금 나를 막는 표기 — 합 ${r.금지합}건 ` +
    `(${금지어.map((w) => `${w} ${r.금지별[w]}`).join(' · ')})`);
  낸다.push(`     ↳ 이 표기의 «권한»은 이제 docs/_ops/결정.md 가 진다 — 여기 있는 것은 참고다.`);

  if (r.유령.length || r.누락.length) {
    낸다.push('');
    낸다.push(`■ 인덱스 어긋남 — 유령 ${r.유령.length}(줄은 있는데 파일 없음) · 누락 ${r.누락.length}(파일은 있는데 줄 없음)`);
    if (r.유령.length) 낸다.push(`     유령: ${r.유령.slice(0, 8).join(' · ')}${r.유령.length > 8 ? ` … 외 ${r.유령.length - 8}` : ''}`);
    if (r.누락.length) 낸다.push(`     누락: ${r.누락.slice(0, 8).join(' · ')}${r.누락.length > 8 ? ` … 외 ${r.누락.length - 8}` : ''}`);
  }

  /* 압축 «후보» — 낡음 × 크기. 순서를 매길 뿐 처분을 정하지 않는다. */
  const 후보 = r.파일들
    .filter((f) => !f.인덱스 && f.낡음 >= 30)
    .sort((a, b) => (b.낡음 * b.바이트) - (a.낡음 * a.바이트));
  낸다.push('');
  낸다.push(`■ 압축 후보 — 30일 넘게 안 건드린 것 ${후보.length}개 (낡음 × 크기 순)`);
  낸다.push('     ⚠ **후보일 뿐이다.** 안 건드렸다는 것과 안 쓴다는 것은 다르다 — 라이브 배포·');
  낸다.push('        자격증명·계약처럼 «가만히 있는 것이 정상»인 토픽이 여기 섞인다. 한 줄씩 열어 본다.');
  for (const f of (전량 ? 후보 : 후보.slice(0, 15))) {
    낸다.push(`     ${String(f.낡음).padStart(4)}일  ${KB(f.바이트).padStart(6)}  🚫${String(f.금지합).padStart(3)}  ${f.이름}`);
  }
  if (!전량 && 후보.length > 15) 낸다.push(`     … 외 ${후보.length - 15}개 — 전량: node tools/메모리실측.js --전량`);

  낸다.push('');
  낸다.push('■ 다음 — 지울지는 이 화면을 보고 **유호님이 정한다.**');
  낸다.push('     대량 삭제는 비가역 승인 게이트를 지난다(실행 직전 목록을 다시 보여 드린다).');
  낸다.push('     그리고 지우기 전에 커밋한다 — 미추적은 유일한 무보호 상태다(F025).');
  return 낸다.join('\n');
}

const 아는플래그 = ['--전량', '--json'];

function main() {
  const args = process.argv.slice(2);
  const 오류 = 인자게이트('메모리실측', args, 아는플래그);
  if (오류) { console.error(오류); process.exit(1); }

  const r = 잰다(process.env.SYNK_MEMORY_DIR || memoryDir());
  if (args.includes('--json')) {
    console.log(JSON.stringify(r, null, 2));
  } else {
    console.log(화면(r, args.includes('--전량')));
  }
  process.exit(r.못쟀다 ? 2 : 0);
}

if (require.main === module) main();

module.exports = { 잰다, 화면, 금지어, 아는플래그 };
