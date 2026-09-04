#!/usr/bin/env node
'use strict';
/* 밖의 사실 장부 — 「돈이 걸린 바깥 사실」이 **반박을 받았는지**를 세는 한 곳.
 *
 * ■ 왜 있나 (2026-09-01 · 유호님 「셋 다 지어줘」)
 *   마누스 폐지(08-31)로 ㉠«밖의 사실 적대 반박» 자리가 비었고, 답은 「이미 결제 중인 조사원 둘
 *   (제미나이 DR · ChatGPT DR)을 손으로 쓴다」로 닫혔다(`docs/AI_스택_가이드.md` §1-5).
 *   그런데 **부르는 것도 결과를 접는 것도 사람 기억에 걸려 있었다** — 장부가 0줄이라
 *   「반박을 안 받았다」와 「받아서 통과했다」가 **같은 모양**이었다. 코드는 두 번 보는데
 *   법령·업종코드·FDI·상표·시세는 한 번도 안 보는 상태로 되돌아가 있던 것이다.
 *
 * ■ 이 도구가 하지 «않는» 것
 *   🚫 **DR(딥리서치)을 자동화하지 않는다** — 유호님 확정 08-31(이유 셋: ㉠화면 자동화는 조용히 죽는데
 *      DR 은 20~40분 비동기라 「죽었는데 도는 척」이 가장 쉽다 ㉡그 구글 계정에 학생 음성 원본 2TB 가
 *      산다 ㉢진짜 자동에는 유호님 로그인이 없어 「자동 같은 수동」이 된다).
 *      그래서 여기는 **DR 을 부르지 않는다.** 부르는 것은 세션이 그 자리에서 손으로 한다.
 *   ✅ **Codex 라이브 검색 반박 패스는 더했다**(2026-09-02 · 유호 「전부 진행해줘」 · 정찰 지면
 *      `docs/교차검수_재설계_정찰_2026-09-02.html`): `--반박 <키> --조사원 codex` 에 `--결과` 가 없으면
 *      codex CLI(ChatGPT 구독 · 읽기 전용 울타리 · `web_search="live"`)가 검색해 반박하고 그 답을 «반박 행»으로
 *      적는다. 08-31 의 근거 셋에 하나도 안 걸린다 — 화면 자동화가 아니고(CLI 동기 호출 · 죽으면 종료 2),
 *      구글 계정이 아니며(OpenAI 구독), 로그인은 노트북의 codex 로그인 그대로다. 세션이 «명시로 부를 때만»
 *      돈다(상시·무인 아님).
 *   🚫 **판정하지 않는다** — DR 답도 codex 답도 자료지 판정이 아니다(§1-5). 판정은 세션이 기억·정본과
 *      대조해 내리고, 이 장부는 그 판정이 «있었는지»만 센다.
 *   ⇒ 즉 이 파일이 파는 것은 **「안 물어봤다」가 눈에 보이게 되는 것**과, 그 물음 하나를 기계가 대신 던지는 것이다.
 *
 * ■ 발주문은 여기 안 적는다
 *   골격 다섯의 정본은 `docs/AI_스택_가이드.md` §1-5 이고, `--발주문` 은 그 절을 **읽어서** 낸다.
 *   여기 복사하면 둘째 정본이 되고, 갈라지는 쪽은 언제나 조용하다(constant-known-in-two-places).
 *   못 읽으면 지어내지 않고 그 사실을 말한다.
 *
 * 사용:
 *   node tools/밖의사실.js                                   # 목록(열린 것부터)
 *   node tools/밖의사실.js --세움 "명제" --걸린것 "무엇이 걸렸나" --내답 "지금 믿는 답" [--기한 2026-09-30]
 *   node tools/밖의사실.js --발주문 <키>                       # DR 에 붙여넣을 발주문(§1-5 골격 다섯)
 *   node tools/밖의사실.js --반박 <키> --조사원 <이름> --결과 "요약" [--링크 URL]
 *   node tools/밖의사실.js --반박 <키> --조사원 codex [--timeout 초]   # 결과 없이 부르면 codex 가 라이브 검색으로 반박한다
 *   node tools/밖의사실.js --판정 <키> --결론 "..." --사유 "왜"
 *   node tools/밖의사실.js --접음 <키> --사유 "왜"
 *   node tools/밖의사실.js --json
 * 종료코드: 0=정상 · 1=실행 오류(인자 부족·장부 파손). **판정 상태로는 종료코드를 바꾸지 않는다**
 *   — 우는 자리는 `tools/ai스택점검.js` 하나다(자가 둘이면 반드시 갈린다).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
/* 집안 표(누가 누구와 남남인가)는 여기서 안 쥔다 — 정본은 `tools/모델정책.js` 하나다. */
const 정책 = require('./모델정책.js');

const ROOT = path.resolve(__dirname, '..');
const 장부경로 = () => process.env.SYNK_OUTSIDE_LEDGER || path.join(ROOT, 'docs', '_ops', '밖의사실.jsonl');
const 가이드경로 = () => path.join(ROOT, 'docs', 'AI_스택_가이드.md');

/* 키 = 명제의 지문. 같은 명제를 두 번 세우면 같은 키로 떨어져 이어 붙는다 —
 * 새 줄이 생기는 대신 「이미 세워져 있다」가 보인다. */
function 키만들기(명제) {
  const norm = String(명제).replace(/\s+/g, ' ').trim();
  return crypto.createHash('sha256').update(norm, 'utf8').digest('hex').slice(0, 12);
}

function 읽기() {
  let raw;
  try { raw = fs.readFileSync(장부경로(), 'utf8'); }
  catch (_) { return []; }                       // 장부가 없다 = 세운 명제 0 (파손 아님)
  const 행 = [];
  raw.split('\n').filter(Boolean).forEach((l, i) => {
    try { 행.push(JSON.parse(l)); }
    // 못 읽은 줄을 조용히 버리면 「0건」이 성공 얼굴이 된다 — 그 사실을 표식으로 남긴다.
    catch (_) { 행.push({ 파손: true, 줄번호: i + 1 }); }
  });
  return 행;
}

function 붙이기(줄) {
  const p = 장부경로();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.appendFileSync(p, JSON.stringify(줄) + '\n', 'utf8');
}

/* 사건 로그를 키별로 접는다(검수기록·심문기록과 같은 append-only 꼴).
 * 상태 넷: 열림(반박 0) · 반박받음(반박 ≥1 · 판정 없음) · 판정완료 · 접음.
 * 🔑 **「열림」과 「판정완료」를 가르는 것이 이 파일의 전부다** — 그 둘이 같은 모양이던 것이
 *   09-01 에 발견된 구멍이다. */
function 요약() {
  const 행들 = 읽기();
  const 파손 = 행들.filter((r) => r.파손).length;
  const 건 = new Map();
  for (const r of 행들) {
    if (r.파손 || !r.키) continue;
    if (!건.has(r.키)) 건.set(r.키, { 키: r.키, 명제: '', 걸린것: '', 내답: '', 기한: null, 세운때: null, 반박: [], 판정: null, 접음: null });
    const b = 건.get(r.키);
    if (r.종류 === '세움') {
      // 같은 명제를 다시 세우면 최신 것이 앞선다 — 걸린 것·기한은 바뀔 수 있다.
      b.명제 = r.명제 || b.명제; b.걸린것 = r.걸린것 || b.걸린것; b.내답 = r.내답 || b.내답;
      b.기한 = r.기한 || b.기한; b.세운때 = b.세운때 || r.시각;
    } else if (r.종류 === '반박') {
      b.반박.push({ 조사원: r.조사원 || '(미상)', 결과: r.결과 || '', 링크: r.링크 || null, 시각: r.시각 });
    } else if (r.종류 === '판정') {
      b.판정 = { 결론: r.결론 || '', 사유: r.사유 || '', 시각: r.시각 };
    } else if (r.종류 === '접음') {
      b.접음 = { 사유: r.사유 || '', 시각: r.시각 };
    }
  }
  /* 🔑 «둘에게 물었다»가 뜻을 가지려면 그 둘이 남남이어야 한다(2026-09-05 · 유호 「조사원도 정리하자」).
   *   집안 표는 `tools/모델정책.js` 하나가 쥔다 — 여기 복사하면 둘째 정본이 되고, 갈리는 쪽은 늘 느슨한 쪽이다.
   *   ⚠ 집안을 모르는 조사원은 «남남»으로 세지 않는다. 모르는 것을 「다르다」로 세면 한 벌이 둘로 부푼다. */
  const 목록 = [...건.values()].map((b) => {
    const 집안들 = [...new Set(b.반박.map((r) => 정책.집안가르기(r.조사원)).filter(Boolean))];
    return {
      ...b,
      집안들,
      집안모름: b.반박.filter((r) => !정책.집안가르기(r.조사원)).map((r) => r.조사원),
      남남인가: 집안들.length >= 2,
      상태: b.접음 ? '접음' : b.판정 ? '판정완료' : b.반박.length ? '반박받음' : '열림',
    };
  });
  return {
    목록,
    파손,
    열림: 목록.filter((b) => b.상태 === '열림'),
    반박받음: 목록.filter((b) => b.상태 === '반박받음'),
    판정완료: 목록.filter((b) => b.상태 === '판정완료'),
  };
}

/* 골격 다섯을 **문서에서 읽는다.** 못 읽으면 null — 부르는 쪽이 「지어내지 않았다」고 말한다. */
function 골격읽기() {
  let md;
  try { md = fs.readFileSync(가이드경로(), 'utf8'); }
  catch (_) { return null; }
  const 시작 = md.indexOf('발주문 골격 다섯');
  if (시작 < 0) return null;
  const 꼬리 = md.slice(시작);
  // 골격은 번호 목록 다섯 줄이다. 목록이 끝나는 곳(▶ 또는 #### 또는 빈 줄 둘)에서 자른다.
  const 끝 = 꼬리.search(/\n(?:▶|####|---)/);
  return 꼬리.slice(0, 끝 > 0 ? 끝 : 1200).trim();
}

function 인자(argv, 이름) {
  const i = argv.indexOf(이름);
  if (i < 0) return null;
  const v = argv[i + 1];
  // 값이 없거나 다음 플래그를 집으면 조용히 접지 않는다 — 「적었다」는 착각을 만든다.
  if (!v || /^--/.test(v)) return { 오류: `${이름} 뒤에 값이 없다` };
  return v;
}

function 값(argv, 이름, 필수) {
  const v = 인자(argv, 이름);
  if (v && v.오류) { console.error(`실행 오류: ${v.오류}`); process.exit(1); }
  if (필수 && !v) { console.error(`실행 오류: ${이름} 이 필요하다`); process.exit(1); }
  return v;
}

function 목록출력(s) {
  if (s.파손) console.log(`⚠ 장부에 못 읽은 줄 ${s.파손}개 — 아래 셈의 분모에서 빠졌다.`);
  if (!s.목록.length) {
    console.log('밖의 사실 장부가 비어 있다 — 세운 명제 0건.');
    console.log('  🔑 이건 「반박이 다 끝났다」가 아니라 **아무것도 안 물어봤다**는 뜻이다.');
    console.log('  세우기: node tools/밖의사실.js --세움 "명제" --걸린것 "무엇이 걸렸나" --내답 "지금 믿는 답"');
    return;
  }
  const 표 = [
    ['🔴 열림 — 반박을 **안 받았다**', s.열림],
    ['🟠 반박받음 — 답은 왔고 판정이 없다', s.반박받음],
    ['✅ 판정완료', s.판정완료],
    ['🗄 접음', s.목록.filter((b) => b.상태 === '접음')],
  ];
  for (const [머리, 것들] of 표) {
    if (!것들.length) continue;
    console.log(`\n${머리} — ${것들.length}건`);
    for (const b of 것들) {
      console.log(`  · [${b.키}] ${b.명제}`);
      if (b.걸린것) console.log(`      걸린 것: ${b.걸린것}${b.기한 ? ` · 기한 ${b.기한}` : ''}`);
      if (b.내답) console.log(`      내 답:   ${b.내답}`);
      for (const r of b.반박) console.log(`      ↩ ${r.조사원}: ${r.결과}${r.링크 ? ` (${r.링크})` : ''}`);
      if (b.반박.length && !b.남남인가) {
        const 본것 = b.집안들.join('·') || `집안 미상(${b.집안모름.join('·')})`;
        console.log(`      ⚠ 조사원이 «한 집안»뿐이다(${본것}) — 같은 집안 둘은 같은 사각을 두 번 본다. 정본 §1-5 는 남남 둘이다`);
      }
      if (b.판정) console.log(`      ⚖ ${b.판정.결론} — ${b.판정.사유}`);
      if (b.접음) console.log(`      🗄 ${b.접음.사유}`);
    }
  }
  console.log(`\n합계 ${s.목록.length}건 = 열림 ${s.열림.length} + 반박받음 ${s.반박받음.length} + 판정완료 ${s.판정완료.length} + 접음 ${s.목록.filter((b) => b.상태 === '접음').length}`);
  if (s.열림.length) console.log('발주문: node tools/밖의사실.js --발주문 <키>');
}

function main() {
  const argv = process.argv.slice(2);
  const 이제 = () => new Date().toISOString();

  if (argv.includes('--json')) { console.log(JSON.stringify(요약(), null, 2)); return; }

  if (argv.includes('--세움')) {
    const 명제 = 값(argv, '--세움', true);
    const 키 = 키만들기(명제);
    const 이미 = 요약().목록.find((b) => b.키 === 키);
    if (이미) {
      console.log(`이미 세워져 있다 [${키}] — 상태: ${이미.상태}`);
      console.log('  같은 명제를 다시 세우는 대신 --반박 · --판정 으로 이어 붙인다.');
      return;
    }
    붙이기({
      종류: '세움', 시각: 이제(), 키, 명제,
      걸린것: 값(argv, '--걸린것', true), 내답: 값(argv, '--내답', true), 기한: 값(argv, '--기한', false) || null,
    });
    console.log(`✅ 세웠다 [${키}] — 상태: 🔴 열림(반박을 아직 안 받았다)`);
    console.log(`   발주문: node tools/밖의사실.js --발주문 ${키}`);
    return;
  }

  if (argv.includes('--발주문')) {
    const 키 = 값(argv, '--발주문', true);
    const b = 요약().목록.find((x) => x.키 === 키);
    if (!b) { console.error(`실행 오류: 그런 키가 없다 — ${키}`); process.exit(1); }
    const 골격 = 골격읽기();
    console.log('════ 아래를 DR(제미나이 · ChatGPT 둘 다)에 붙여넣는다 ════\n');
    console.log(`1. 판정할 명제: ${b.명제}`);
    console.log(`2. 내가 지금 믿는 답과 근거: ${b.내답}\n   → 이것을 **반박**해 달라. 조사가 아니라 심문이다.`);
    console.log(`3. 틀리면 무슨 일이 나나: ${b.걸린것}${b.기한 ? ` · 기한 ${b.기한}` : ''}`);
    console.log('4. 1차 출처만 — 법령 원문·관보·기관 공식 페이지. 블로그·요약 기사 금지.');
    console.log('5. 출력 넷: 결론 · 근거 URL · **내 답과 갈리는 지점** · **확인 못 한 것**.');
    console.log('\n──── 골격 정본(docs/AI_스택_가이드.md §1-5) ────');
    console.log(골격 || '⚠ 골격 절을 못 읽었다 — 여기서 지어내지 않는다. 문서를 직접 연다: docs/AI_스택_가이드.md §1-5');
    console.log('\n▶ 받은 결과는 자료지 판정이 아니다. 돌아오면: --반박 <키> --조사원 <이름> --결과 "요약"');
    return;
  }

  /* Codex 라이브 검색 반박 — `--조사원 codex` 인데 `--결과` 가 없으면 기계가 던진다(위 머리말).
   * 읽기 전용 울타리 + 도구 차단은 검수 러너의 `잠금플래그` 그대로이고, 거기에 `web_search="live"` 만 더한다
   * (호스팅 검색 도구라 울타리 밖 셸 네트워크와 별개 · 09-02 실측). 모델·효력은 러너의 분석 픽을 빌린다. */
  if (argv.includes('--반박') && 값(argv, '--조사원', false) === 'codex' && !argv.includes('--결과')) {
    const 키 = 값(argv, '--반박', true);
    const b = 요약().목록.find((x) => x.키 === 키);
    if (!b) { console.error(`실행 오류: 그런 키가 없다 — ${키} (목록: node tools/밖의사실.js)`); process.exit(1); }
    const 검수 = require('./codex-review.js');
    const os = require('os');
    const 초 = Number(값(argv, '--timeout', false)) || 600;
    const 스키마 = path.join(__dirname, '밖의사실.schema.json');
    const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'synk-outside-')), 'out.json');
    const 골격 = 골격읽기();
    const 프롬프트 = [
      '너는 «밖의 사실»(법령·업종코드·상표·시세처럼 돈이 걸린 바깥 사실)을 적대적으로 검증하는 조사원이다.',
      '반드시 웹 검색(live)을 써서 1차 출처(법령 원문·관보·기관 공식 페이지)를 찾아라. 블로그·요약 기사는 근거로 쓰지 않는다.',
      '아래 「내 답」을 반박해 달라 — 조사가 아니라 심문이다. 동의하더라도 근거 URL 과 함께. 확인 못 한 것은 지어내지 말고 그 사실을 적어라.',
      '',
      `1. 판정할 명제: ${b.명제}`,
      `2. 내가 지금 믿는 답과 근거: ${b.내답}`,
      `3. 틀리면 무슨 일이 나나: ${b.걸린것}${b.기한 ? ` · 기한 ${b.기한}` : ''}`,
      '4. 1차 출처만.',
      '5. 출력은 스키마대로: 결론 · 근거URL · 내 답과 갈리는 지점 · 확인 못 한 것.',
      골격 ? `\n--- 골격 정본(docs/AI_스택_가이드.md §1-5) ---\n${골격}` : '',
    ].join('\n');
    const 픽 = 검수.모델설정.분석;
    console.log(`codex 라이브 검색 반박 중… [${키}] ${b.명제.slice(0, 60)} (${픽.model}/${픽.effort} · 최대 ${초}초)`);
    try {
      검수.codex(['exec', ...검수.잠금플래그, ...검수.모델플래그(픽), '-c', 'web_search="live"',
        '--output-schema', 스키마, '--ephemeral', '-o', out, '-'], 프롬프트, 초 * 1000, `밖의사실 반박(${키})`);
    } catch (e) {
      console.error(`🔴 확인 불가 — 반박이 **안 돌았다**(장부에 아무것도 안 적는다): ${e.message}`);
      process.exit(2);
    }
    let r;
    try { r = JSON.parse(fs.readFileSync(out, 'utf8')); if (!r || typeof r.결론 !== 'string') throw new Error('결론이 없다'); }
    catch (e) { console.error(`🔴 확인 불가 — 반박 결과가 스키마와 다르다(${e.message}) · 장부에 안 적는다.`); process.exit(2); }
    const 근거 = Array.isArray(r.근거URL) ? r.근거URL.filter((u) => typeof u === 'string' && u.trim()) : [];
    붙이기({
      종류: '반박', 시각: 이제(), 키, 조사원: 'codex(live)',
      결과: `${r.결론}${r.갈리는지점 && r.갈리는지점 !== '없음' ? ` · 갈리는 지점: ${r.갈리는지점}` : ''}`,
      링크: 근거[0] || null, 근거URL: 근거, 갈리는지점: r.갈리는지점 || '', 확인못한것: r.확인못한것 || '',
      모델: { model: 픽.model, effort: 픽.effort },
    });
    console.log(`✅ 반박 적었다 [${키}] — codex(live)`);
    console.log(`   결론: ${r.결론}`);
    if (r.갈리는지점 && r.갈리는지점 !== '없음') console.log(`   갈리는 지점: ${r.갈리는지점}`);
    console.log(`   근거 URL ${근거.length}건${근거.length ? ' — ' + 근거.slice(0, 3).join(' · ') : ' (⚠ 1차 출처를 못 댔다 — 결론을 믿지 마라)'}`);
    if (r.확인못한것 && r.확인못한것 !== '없음') console.log(`   확인 못 한 것: ${r.확인못한것}`);
    console.log('   ▶ 자료지 판정이 아니다: --판정 <키> --결론 "..." --사유 "왜"');
    return;
  }

  for (const [플래그, 종류, 필수들] of [
    ['--반박', '반박', [['--조사원', true], ['--결과', true], ['--링크', false]]],
    ['--판정', '판정', [['--결론', true], ['--사유', true]]],
    ['--접음', '접음', [['--사유', true]]],
  ]) {
    if (!argv.includes(플래그)) continue;
    const 키 = 값(argv, 플래그, true);
    const b = 요약().목록.find((x) => x.키 === 키);
    if (!b) { console.error(`실행 오류: 그런 키가 없다 — ${키} (목록: node tools/밖의사실.js)`); process.exit(1); }
    const 줄 = { 종류, 시각: 이제(), 키 };
    for (const [이름, 필수] of 필수들) {
      const v = 값(argv, 이름, 필수);
      if (v) 줄[이름.replace(/^--/, '')] = v;
    }
    붙이기(줄);
    const 뒤 = 요약().목록.find((x) => x.키 === 키);
    console.log(`✅ ${종류} 적었다 [${키}] — 상태: ${뒤.상태}`);
    if (뒤.상태 === '반박받음') console.log('   아직 판정이 없다: --판정 <키> --결론 "..." --사유 "왜"');
    /* 🚫 막지 않는다 — 「조용히 접지 않는다」의 반대편 실수를 하지 않기 위해서다. 급할 때 한 벌로 판정하는 것은
     *   유호님 몫이고, 이 자가 파는 것은 그렇게 내린 판정이 «장부에서 그렇게 보이는 것» 하나다. */
    if (뒤.반박.length && !뒤.남남인가) {
      const 본것 = 뒤.집안들.join('·') || `집안 미상(${뒤.집안모름.join('·')})`;
      console.log(`   ⚠ 아직 «한 집안»만 봤다(${본것}) — 정본(docs/AI_스택_가이드.md §1-5)은 남남 둘을 요구한다.`);
      console.log(`      다른 집안 한 벌: ${뒤.집안들.includes('openai') ? '제미나이 Deep Research' : 'ChatGPT Deep Research 또는 --조사원 codex'}`);
    }
    return;
  }

  목록출력(요약());
}

module.exports = { 키만들기, 읽기, 요약, 골격읽기, 장부경로 };

if (require.main === module) {
  try { main(); }
  catch (e) { console.error('실행 오류:', e.message); process.exit(1); }
}
