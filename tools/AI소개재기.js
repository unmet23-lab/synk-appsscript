#!/usr/bin/env node
'use strict';
/**
 * AI소개재기 — «우리가 그 자리에 없을 때 AI 가 우리를 어떻게 소개하는가»를 잰다.
 *   정본 = `docs/명품마케팅_회사별_v1.md` §⑦ SYNK-4 ③ (유호 확정 09-08 · 걸음 1-㉠)
 *
 * ══ 왜 이 도구가 있나 ═══════════════════════════════════════
 *   명품의 기둥 여섯 중 가장 자주 빠뜨리는 것이 이것이다. 우리가 정본을 아무리 잘 써도,
 *   손님이 우리 지면 대신 AI 에게 물으면 그 답이 첫인상이 된다.
 *   🔴 **첫 값이 없으면 나중에 좋아져도 우리 덕인지 원래 그랬는지 못 가른다.**
 *
 * ══ 재는 법(문서가 정한 것 그대로) ═══════════════════════════
 *   물음 셋 × 2회 · 검색 끔 · 「둘 다 나온 것」만 통과.
 *   🔴 프롬프트에 저장소 내용을 한 글자도 안 싣는다 — 그래야 «모델이 아는 것»을 잰다.
 *      (문서를 첨부하면 그 문서를 되읽어 주고, 그건 측정이 아니라 메아리다.)
 *
 * ══ 밟은 함정 셋(09-08 첫 회차) ═════════════════════════════
 *   ① 자가 「SYNK LAB 이라는 글자가 답에 있나」였다 → 제미나이가 그 이름을 «다른 회사»
 *      (Sync Labs 립싱크 스타트업 · 에스파 세계관)로 알고 있어서 글자만 세면 초록이 뜬다.
 *      ⇒ 자를 셋으로 갈랐다: 우리로 안다 / 남과 헷갈린다 / 모른다.
 *   ② 무료 문은 분당 5회·하루 20회다 → 안 쉬면 429 가 «답»인 척 돌아온다(169자 오류를
 *      「맞은 것 0」으로 세면 «모른다»와 구분이 안 된다). ⇒ 못물었다 칸을 따로 둔다.
 *   ③ 무료등급 픽을 Vertex(돈) 문으로 부르면 404 다. 픽의 등급이 문을 정한다.
 *
 * ══ 통로 ═══════════════════════════════════════════════
 *   node tools/AI소개재기.js                 # 정책 기본 픽으로 잰다(무료 문)
 *   node tools/AI소개재기.js --문 돈 --모델 gemini-3.1-pro-preview
 *   node tools/AI소개재기.js --장부없이      # 화면만 · 장부 안 건드림
 */
const fs = require('node:fs');
const path = require('node:path');
const 루트 = path.resolve(__dirname, '..');
const { 제미나이 } = require('./lib/제미나이호출.js');
const 정책 = require('./모델정책.js');

const 장부길 = path.join(루트, 'docs/_ops/AI소개.jsonl');

function 인자읽기(v) {
  const a = {};
  for (let i = 0; i < v.length; i++) {
    if (!v[i].startsWith('--')) continue;
    const k = v[i].slice(2);
    a[k] = (v[i + 1] && !v[i + 1].startsWith('--')) ? v[++i] : true;
  }
  return a;
}

/** 물음 셋 — 손님이 실제로 칠 말이다(우리 이름을 아는 사람 둘 · 모르는 사람 하나). */
const 물음들 = [
  'SYNK LAB이 뭐야?',
  '몽골에서 한국어 배울 곳 알려줘',
  'SYNK LAB 수업료가 얼마야?',
];

/** 자 — 「글자가 있나」가 아니라 「무엇으로 아나」를 가른다. */
const 자 = {
  못물었다: (답) => /^❌/.test(답),
  우리로안다: (답) => /(울란바토르|몽골)/.test(답) && /한국어/.test(답) && /SYNK\s*LAB|싱크\s*랩/i.test(답),
  남과헷갈린다: (답) => /Sync\s*Labs|립싱크|에스파|aespa|SMCU/i.test(답),
  슬로건: (답) => /정원은\s*16\s*명.{0,8}선생님은\s*17\s*명/.test(답),
  네급문구: (답) => /1년.{0,14}(TOPIK|토픽).{0,8}4급|4급.{0,12}(1년|일\s*년)/.test(답),
  옛슬로건: (답) => /점수를\s*넘어/.test(답),
};

const 쉬기 = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const 인자 = 인자읽기(process.argv.slice(2));
  const 픽 = 정책.제미나이[정책.제미나이.기본];
  const model = 인자['모델'] || process.env.GEMINI_MODEL || 픽.model;
  /* 🔴 픽의 등급이 문을 정한다 — 무료 픽을 Vertex 로 부르면 404. */
  const 용도 = 인자['문'] || (픽.무료등급 ? '글' : '돈');
  let key = '';
  try { key = 정책.제미나이키(용도); } catch (e) {
    try { key = fs.readFileSync(정책.제미나이키경로(용도), 'utf8').trim(); } catch (_) { key = ''; }
  }

  console.log('■ AI 소개 재기 — 제미나이 ' + model + ' · 문 ' + 용도);
  console.log('  물음 ' + 물음들.length + '개 × 2회 · 호출 사이 15초 · 저장소 내용 0글자\n');

  const 결과 = [];
  let 첫번 = true;
  for (const q of 물음들) {
    for (let 회 = 1; 회 <= 2; 회++) {
      if (!첫번) await 쉬기(15000);
      첫번 = false;
      let 답 = '';
      try { 답 = await 제미나이(key, model, q, { 용도, timeoutMs: 90000 }); }
      catch (e) { 답 = '❌ 못 물었다: ' + (e && e.message ? e.message : String(e)).slice(0, 200); }
      const 판 = {};
      for (const k of Object.keys(자)) 판[k] = 자[k](답);
      결과.push({ 물음: q, 회, 글자수: 답.length, 판, 답 });
      const 한줄 = 판.못물었다 ? '❌ 못 물었다'
        : (판.우리로안다 ? '우리로 안다' : (판.남과헷갈린다 ? '🔴 남과 헷갈린다' : '모른다'))
          + (판.슬로건 ? ' + 슬로건' : '') + (판.네급문구 ? ' + 4급 문구' : '') + (판.옛슬로건 ? ' + ⚠옛 슬로건' : '');
      console.log('· 「' + q + '」 ' + 회 + '회 — ' + 한줄 + ' (' + 답.length + '자)');
    }
  }

  console.log('\n■ 판정 — 같은 물음 2회에 «둘 다» 나온 것만 통과로 센다');
  const 칸 = ['우리로안다', '남과헷갈린다', '슬로건', '네급문구', '옛슬로건'];
  const 판정 = {};
  for (const q of 물음들) {
    const 둘 = 결과.filter((r) => r.물음 === q);
    const 물은것 = 둘.filter((r) => !r.판.못물었다).length;
    const 통과 = 칸.filter((k) => 물은것 === 2 && 둘.every((r) => r.판[k]));
    판정[q] = { 물은회차: 물은것, 통과 };
    console.log('  「' + q + '」 → ' + (통과.length ? 통과.join(', ') : '통과 0') + '  (실제로 물어진 회차 ' + 물은것 + '/2)');
  }

  const 다물었나 = Object.values(판정).every((v) => v.물은회차 === 2);
  if (!다물었나) console.log('\n⚠ 못 물은 회차가 있다 — 이 판은 «값»이 아니다. 몫이 돌아온 뒤 다시 잰다.');

  if (!인자['장부없이']) {
    const 줄 = JSON.stringify({
      잰날: new Date().toISOString().slice(0, 10),
      모델: model, 문: 용도, 다물었나, 판정,
      요약: 결과.map((r) => ({ 물음: r.물음, 회: r.회, 글자수: r.글자수, 판: r.판 })),
    });
    fs.appendFileSync(장부길, 줄 + '\n');
    console.log('\n장부 한 줄 = docs/_ops/AI소개.jsonl (원문은 안 담는다 — 길고, 다음에 또 물으면 된다)');
  }
})();
