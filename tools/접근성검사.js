#!/usr/bin/env node
'use strict';
/**
 * 접근성검사 — 지면을 크롬에 띄우고 axe-core 를 부어, «누가 못 읽는가»를 센다.
 *
 * ■ 왜 있나 (2026-09-03 · 유호 지시 「접근성 검사기를 우리 지면에 붙여라」)
 *   우리 지면은 코랄·크림처럼 «연한» 색을 많이 쓴다. 눈으로는 예쁜데 대비가 모자라면
 *   나이 든 학부모나 밝은 데서 보는 사람이 글자를 못 읽는다. 그건 디자인 취향이 아니라
 *   «안 읽힘»이라 눈으로만 판정할 수 없다 — 숫자로 재야 한다.
 *
 * ■ 무엇을 못 재나 (자의 한계를 먼저 적는다)
 *   axe 가 잡는 것은 «기계가 확실히 아는» 것뿐이다(대비·대체글·제목 순서·표 머리 …).
 *   글이 쉬운지, 그림이 뜻을 옮기는지는 못 잰다. 초록이 「누구나 읽는다」는 뜻이 아니다.
 *
 * ■ 딸린 프로그램 0 — axe-core 는 tools/vendor 에 파일로 들어 있고, 크롬은 공용 조종 통로가 몬다.
 *
 * 쓰는 법: node tools/접근성검사.js <html...> [--전부]
 *          --전부 = 가벼운 것(minor)까지 낸다. 기본은 무거운 것부터 셋(critical·serious·moderate).
 */
const fs = require('node:fs');
const path = require('node:path');
const { 지면열기 } = require('./lib/크롬조종.js');

const 뿌리 = path.resolve(__dirname, '..');
const AXE = path.join(뿌리, 'tools', 'vendor', 'axe.min.js');

/** 무거운 순 — 이 차례로 낸다. */
const 무게순 = ['critical', 'serious', 'moderate', 'minor'];
const 무게말 = {
  critical: '치명 — 그 자리를 아예 못 쓴다',
  serious: '심각 — 못 읽거나 못 누르는 사람이 생긴다',
  moderate: '보통 — 불편하다',
  minor: '가벼움',
};

/** 규칙 이름을 우리말로 — 실제로 나온 것만 적는다(안 본 규칙을 미리 지어내지 않는다). */
const 우리말 = {
  'color-contrast': '글자와 바탕의 밝기 차이가 모자라다',
  'image-alt': '그림에 «무엇을 그린 그림인지» 글이 없다',
  'html-has-lang': '지면이 무슨 말로 쓰였는지 안 밝혔다',
  'document-title': '지면에 제목이 없다(탭에 이름이 안 뜬다)',
  'heading-order': '제목 층이 건너뛴다(2 다음에 4)',
  'landmark-one-main': '본문이 어디부터인지 표시가 없다',
  'region': '지면의 어떤 글이 «어느 구역에도» 안 들어 있다',
  'page-has-heading-one': '지면에 제일 큰 제목이 없다',
  'link-name': '링크에 «어디로 가는지» 글이 없다',
  'list': '목록 안에 목록 항목이 아닌 것이 섞였다',
  'listitem': '목록 항목이 목록 밖에 있다',
  'meta-viewport': '손가락으로 키워 볼 수 없게 막았다',
  'aria-allowed-attr': '역할에 안 맞는 표시를 달았다',
  'empty-heading': '제목인데 글이 비었다',
  'duplicate-id': '같은 이름표를 둘이 나눠 갖고 있다',
};

const 부을것 = () => {
  if (!fs.existsSync(AXE)) {
    throw new Error(`axe-core 가 없다: ${path.relative(뿌리, AXE)}\n   (tools/vendor/출처.md 가 어디서 왔는지 적고 있다)`);
  }
  return fs.readFileSync(AXE, 'utf8');
};

/* 🔴 axe 가 «못 보는» 자리 하나 — Loom 번호 원판.
 *   원판은 어두운 바닥을 ::before 로 깔고 그 위에 연한 글자를 얹는다. axe 는 그 바닥을
 *   못 읽고 «줄 바탕»으로 계산해 1.13대1 이라고 운다. 09-03 에 나는 그 적색을 믿고
 *   덱을 고쳤다가 인쇄물의 강조 띠를 끊었고, 저장소의 tests/룸잉크.test.js 가
 *   「원판 위에 어두운 잉크를 얹었다(대비 1.11)」로 되받아 물러섰다.
 *   ⇒ 이 자리는 axe 가 아니라 «룸잉크» 가 임자다. 여기서는 갈라서 «못 잰 것»으로 적는다. */
const 물음 = `(async () => {
  const 원판인가 = (t) => /[.]번호|[.]잔번호/.test(String(t));
  const r = await axe.run(document, { resultTypes: ['violations'] });
  let 원판못잼 = 0;
  const 것 = r.violations.map((v) => {
    if (v.id !== 'color-contrast') return v;
    const 남길 = v.nodes.filter((n) => !원판인가(n.target[0]));
    원판못잼 += v.nodes.length - 남길.length;
    return Object.assign({}, v, { nodes: 남길 });
  }).filter((v) => v.nodes.length);
  return { 원판못잼, 어긴것: 것.map((v) => ({
    id: v.id, impact: v.impact, help: v.help, n: v.nodes.length,
    자리: v.nodes.slice(0, 3).map((x) => String(x.target[0]).slice(0, 80)),
    대비: v.id !== 'color-contrast' ? null : (() => {
      const 잰것 = v.nodes.map((x) => (x.any || []).map((y) => y.data).filter((d) => d && d.contrastRatio))
        .flat().filter(Boolean);
      if (!잰것.length) return null;
      잰것.sort((a, b) => a.contrastRatio - b.contrastRatio);
      const w = 잰것[0];
      return { 최악: w.contrastRatio, 있어야: w.expectedContrastRatio,
               글자색: w.fgColor, 바탕색: w.bgColor, 잰곳: 잰것.length };
    })(),
    말: v.nodes[0] ? String(v.nodes[0].failureSummary || '').split(String.fromCharCode(10)).filter(Boolean).slice(1, 2).join(' ') : '',
  })) };
})()`;

async function 한장(html) {
  /* 쪽번호판은 Paged.js 가 지면을 «다시 짜므로» 다 짜기 전에 재면 옛 지면을 재게 된다.
     폴리필이 실린 판에서만 그 신호까지 기다린다 — 안 실린 판은 그대로 지나간다. */
  const 기다림 = 'document.readyState==="complete" && (!window.PagedPolyfill || window.__SYNK_PAGED_DONE===true)';
  const { c, 닫기 } = await 지면열기(html, { 기다림, 최대초: 90 });
  try {
    /* 🔴 재기 «전에» 지면을 끝까지 훑는다 — 09-03 실측: 홈페이지가 대비 29곳 적색으로 나왔는데
       그건 화면에 «나타나기 전»(opacity 0) 상태를 잰 것이었다. 자가 틀린 적색이다.
       스크롤로 나타나는 지면이 흔하므로 이 훑기는 특정 지면용 손질이 아니라 자의 일부다. */
    await c.보냄('Runtime.evaluate', {
      expression: `(async () => {
        const 끝 = document.body.scrollHeight;
        for (let y = 0; y <= 끝; y += Math.max(200, window.innerHeight * 0.8)) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 60));
        }
        window.scrollTo(0, 0);
        await new Promise((r) => setTimeout(r, 900));
        return true;
      })()`,
      awaitPromise: true, returnByValue: true,
    });
    const 부음 = await c.보냄('Runtime.evaluate', { expression: 부을것(), returnByValue: false });
    if (부음.exceptionDetails) throw new Error(`axe 를 못 부었다: ${부음.exceptionDetails.text}`);
    const r = await c.보냄('Runtime.evaluate', { expression: 물음, awaitPromise: true, returnByValue: true });
    /* 오류는 «설명»까지 낸다 — 「Uncaught」만 오면 어디가 틀렸는지 알 길이 없다(09-03 실측). */
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error(`axe 가 못 돌았다: ${(d.exception && d.exception.description) || d.text}`);
    }
    return r.result.value || { 원판못잼: 0, 어긴것: [] };
  } finally { 닫기(); }
}

async function 본다(argv) {
  const 전부 = argv.includes('--전부');
  const 지면들 = argv.filter((a) => !a.startsWith('--'));
  if (!지면들.length) {
    console.error('용법: node tools/접근성검사.js <html...> [--전부]');
    return 2;
  }
  const 볼무게 = 전부 ? 무게순 : 무게순.slice(0, 3);
  let 무거움 = 0; let 잰것 = 0;

  console.log('■ 접근성 — 기계가 «확실히 아는» 것만 센다(글이 쉬운지는 못 잰다)\n');
  for (const p of 지면들) {
    잰것 += 1;
    let 잰것값;
    try { 잰것값 = await 한장(p); } catch (e) {
      console.log(`  🔴 ${path.relative(뿌리, p)} — 못 쟀다: ${e.message}`);
      무거움 += 1; continue;
    }
    const 어긴것 = 잰것값.어긴것 || [];
    const 볼것 = 어긴것.filter((v) => 볼무게.includes(v.impact));
    const 센것 = 볼것.reduce((a, v) => a + v.n, 0);
    const 무거운것 = 볼것.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    무거움 += 무거운것.length;

    console.log(`  ${볼것.length ? '🔴' : '✅'} ${path.relative(뿌리, p)}`
      + `  — 어긴 규칙 ${볼것.length}가지 · 자리 ${센것}곳`
      + (잰것값.원판못잼 ? `  (번호 원판 ${잰것값.원판못잼}곳은 이 자가 못 잰다 → tests/룸잉크.test.js 가 본다)` : ''));
    for (const 무게 of 볼무게) {
      for (const v of 볼것.filter((x) => x.impact === 무게)) {
        console.log(`     [${무게말[무게].split(' —')[0]}] ${우리말[v.id] || v.help}  (${v.n}곳)`);
        if (v.대비) {
          console.log(`         가장 나쁜 곳 ${v.대비.최악}대1 — ${v.대비.있어야} 은 돼야 한다`
            + ` (글자 ${v.대비.글자색} / 바탕 ${v.대비.바탕색})`);
        }
        console.log(`         규칙 이름 ${v.id} · 예: ${v.자리.join(' , ')}`);
      }
    }
    console.log('');
  }
  /* 0 은 분모와 함께 — 몇 장을 봤는지 안 밝히면 미실행이 통과와 같은 모양이다. */
  console.log(`  분모 ${잰것}장 · 무거운 것(치명·심각) ${무거움}가지`);
  if (!전부) console.log('  (가벼운 것까지 보려면 --전부)');
  return 무거움 ? 1 : 0;
}

if (require.main === module) {
  본다(process.argv.slice(2)).then((c) => process.exit(c)).catch((e) => {
    console.error(`🔴 ${e.message}`); process.exit(1);
  });
}
module.exports = { 한장, 우리말 };
