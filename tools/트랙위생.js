#!/usr/bin/env node
'use strict';
/* 트랙 위생 — 색인이 «일기»가 되는 것을 잰다. (2026-09-06 · 유호 확정)
 *
 * ■ 왜 자를 갈았나
 *   옛 자는 「절 하나 ≤ 5KB」 하나뿐이었다. 그런데 절에는 성격이 둘이다:
 *     · 색인 절 — 현황 한 줄 + 포인터(§0-재설계 처럼)
 *     · 일감 절 — 남은 일감 불릿이 본체(§6 기술 부채는 불릿이 서른 개다)
 *   같은 자로 재니 「일감이 많다」와 「한 불릿이 부풀었다」가 같은 빨강이 됐다.
 *   09-06 에 규칙·자 블록을 **한 줄도 안 남기고** 정본 문서로 다 뺐는데도
 *   5KB 넘은 절이 스물 → 열여덟에서 더 안 줄었다. 그 실측이 자를 갈아야 한다고 말했다.
 *   ⇒ **일감이 많아 절이 큰 것은 죄가 아니다.** 재야 할 것은 «한 불릿이 부푸는 것»이다.
 *
 * ■ 자 (전부 09-06 실측 분포에서 뽑았다 — 불릿 333개)
 *   중간값 256B · 75% 448B · 90% 893B · 95% 1193B · 최대 3188B · 곁줄 0개가 289(87%)
 *   ① 불릿 하나 ≤ 900바이트          ← 90 백분위. 넘는 10% 가 «부푼 것»이다
 *   ② 불릿의 곁줄 ≤ 3줄              ← 87% 가 곁줄 0 이다. 넷째 줄부터는 재료지 색인이 아니다
 *   ③ 절의 «비-불릿» 부분 ≤ 1500바이트 ← 제목·현황·포인터. 색인 머리가 일기가 되는 자리
 *   🚫 절 «전체» 바이트에는 상한을 두지 않는다 — 남은 일감이 서른 개면 절은 커야 맞다.
 *
 * ■ 넘으면 무엇을 하나
 *   그 불릿의 «재료»(왜 그런가·처방·실측)를 정본 문서로 옮기고 트랙엔 한 줄 + 포인터를 남긴다.
 *   🔑 걷는 것이 아니라 **옮기는 것**이다 — 재료를 지우면 다음 사람이 그 일감을 못 읽는다.
 *
 * 사용:
 *   node tools/트랙위생.js              # 한 장
 *   node tools/트랙위생.js --json
 *   node tools/트랙위생.js --훅          # 넘은 것이 있을 때만 짧게
 * 종료코드: 0 = 정상(넘어도 0 — 알림이다) · 1 = 자 자신이 못 돈 것
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.env.SYNK_TRACK_ROOT || path.resolve(__dirname, '..');
const 트랙경로 = () => process.env.SYNK_TRACK_MD || path.join(ROOT, 'docs', '_ops', '트랙.md');

/** 09-06 실측 분포에서 뽑은 값. 고칠 때는 «다시 재고» 고친다(눈대중 금지). */
const 자판 = Object.freeze({
  판: 1,
  불릿최대: 900,        // 바이트 · 90 백분위
  곁줄최대: 3,          // 줄 · 87% 가 0 이다
  머리최대: 1500,       // 바이트 · 제목+현황+포인터
});

const 일감꼴 = /^-\s*[^\[]*\[(유호|기계|사람)\]/;

function 잰다(본문) {
  const 줄 = 본문.split('\n');
  const 절 = [];
  let 지금 = null;
  줄.forEach((l, i) => {
    if (/^## /.test(l)) { if (지금) 절.push(지금); 지금 = { 제목: l.slice(3), 시작: i, 줄들: [] }; }
    else if (지금) 지금.줄들.push({ l, i });
  });
  if (지금) 절.push(지금);

  const 부푼불릿 = [];
  const 무거운머리 = [];
  let 불릿수 = 0;

  for (const s of 절) {
    let 머리바이트 = Buffer.byteLength(`## ${s.제목}`, 'utf8');
    for (let k = 0; k < s.줄들.length; k++) {
      const { l, i } = s.줄들[k];
      if (!일감꼴.test(l)) {
        // 불릿 «밖»의 줄만 머리로 센다(곁줄은 아래에서 불릿에 붙는다).
        if (!/^\s+\S/.test(l)) 머리바이트 += Buffer.byteLength(l, 'utf8') + 1;
        continue;
      }
      let m = k + 1;
      while (m < s.줄들.length && /^\s+\S/.test(s.줄들[m].l)) m++;
      const 본 = s.줄들.slice(k, m).map((x) => x.l);
      const 바이트 = Buffer.byteLength(본.join('\n'), 'utf8');
      const 곁줄 = m - k - 1;
      불릿수++;
      if (바이트 > 자판.불릿최대 || 곁줄 > 자판.곁줄최대) {
        부푼불릿.push({ 절: s.제목.slice(0, 34), 줄: i + 1, 바이트, 곁줄, 머리: l.slice(0, 64) });
      }
      k = m - 1;
    }
    if (머리바이트 > 자판.머리최대) 무거운머리.push({ 절: s.제목.slice(0, 34), 바이트: 머리바이트 });
  }
  부푼불릿.sort((a, b) => b.바이트 - a.바이트);
  무거운머리.sort((a, b) => b.바이트 - a.바이트);
  return { 절수: 절.length, 불릿수, 부푼불릿, 무거운머리, 전체: Buffer.byteLength(본문, 'utf8') };
}

function main() {
  const argv = process.argv.slice(2);
  let 본문;
  try { 본문 = fs.readFileSync(트랙경로(), 'utf8'); }
  catch (e) { console.error(`🔴 트랙을 못 읽었다(${e.message}) — «확인 불가»다.`); return 1; }
  const r = 잰다(본문);

  if (argv.includes('--json')) { console.log(JSON.stringify({ 자판, ...r }, null, 2)); return 0; }

  const 넘음 = r.부푼불릿.length + r.무거운머리.length;
  if (argv.includes('--훅')) {
    if (!넘음) return 0;
    console.log(`📏 [트랙 위생] 부푼 불릿 ${r.부푼불릿.length} · 무거운 절 머리 ${r.무거운머리.length} — 재료를 정본 문서로 옮길 자리다.`);
    for (const b of r.부푼불릿.slice(0, 3)) console.log(`   ${b.바이트}B·곁줄 ${b.곁줄} · [${b.절.slice(0, 16)}] ${b.머리.slice(0, 44)}`);
    console.log('   전부 보기: node tools/트랙위생.js');
    return 0;
  }

  console.log(`📏 트랙 위생 — 절 ${r.절수} · 일감 불릿 ${r.불릿수} · 전체 ${(r.전체 / 1024).toFixed(0)}KB`);
  console.log(`   자(v${자판.판}) = 불릿 ≤ ${자판.불릿최대}B · 곁줄 ≤ ${자판.곁줄최대}줄 · 절 머리 ≤ ${자판.머리최대}B · 🚫 절 «전체»에는 상한이 없다\n`);

  console.log(`■ 부푼 불릿 ${r.부푼불릿.length}개`);
  if (!r.부푼불릿.length) console.log('   ✅ 없음');
  for (const b of r.부푼불릿) {
    console.log(`   ${String(b.바이트).padStart(5)}B · 곁줄 ${String(b.곁줄).padStart(2)} · ${b.줄}줄 · [${b.절.slice(0, 20)}]`);
    console.log(`         ${b.머리}`);
  }
  console.log(`\n■ 무거운 절 머리 ${r.무거운머리.length}개(제목·현황·포인터)`);
  if (!r.무거운머리.length) console.log('   ✅ 없음');
  for (const h of r.무거운머리) console.log(`   ${String(h.바이트).padStart(5)}B · ${h.절}`);

  console.log('\n🔑 넘은 것은 «걷는» 것이 아니라 «옮기는» 것이다 — 재료를 정본 문서로 보내고 트랙엔 한 줄 + 포인터.');
  return 0;
}

module.exports = { 잰다, 자판 };

if (require.main === module) {
  try { process.exit(main()); }
  catch (e) { console.error('🔴 트랙 위생이 못 돌았다:', (e && e.message) || e); process.exit(1); }
}
