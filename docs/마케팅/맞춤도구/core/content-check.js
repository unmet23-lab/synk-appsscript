/* SYNK 맞춤 도구 — 제작 절차 검사기.
 * 원본: SYNK-appsscript/docs/마케팅/맞춤도구/core/content-check.js
 * 제작절차.md의 약속을 코드로 확인한다. build.mjs가 빌드 전에 돌리고, 각 도구의 시험도 부른다.
 * 빠진 것이 있으면 문장 목록을 돌려준다. 빈 목록이어야 빌드된다.
 */
'use strict';

const KINDS = ['what', 'why', 'price', 'skip', 'trap', 'check'];
const KIND_LABEL = { what: '무엇인가', why: '왜 필요한가', price: '왜 비싼가·값을 정하는 것', skip: '필요 없는 경우', trap: '함정·광고 용어', check: '직접 확인하는 법' };
const sentences = text => String(text || '').split(/(?<=[.?!요다])\s+/).filter(s => s.trim().length > 3);

function checkContent(content) {
  const problems = [];
  const src = content.SOURCES || {};
  const need = (cond, msg) => { if (!cond) problems.push(msg); };

  need(/^\d{4}-\d{2}-\d{2}$/.test(content.checked || ''), '확인 날짜(checked)가 YYYY-MM-DD가 아니에요.');
  need(src.synk, 'SOURCES에 SYNK 판단(synk) 설명이 없어요.');
  for (const [id, s] of Object.entries(src)) {
    need(['official', 'community', 'synk', 'seen'].includes(s.kind), `출처 ${id}의 종류가 official·community·synk·seen이 아니에요.`);
    need(s.label && s.label.length > 8, `출처 ${id}의 설명이 비어 있어요.`);
    if (s.kind !== 'synk' && s.kind !== 'seen') need(/^https:\/\//.test(s.url || ''), `출처 ${id}에 https 주소가 없어요.`);
  }

  // 질문마다 '왜 묻는지' 팁, 선택지마다 고른 뒤 한 줄
  for (const step of content.steps || []) {
    need(step.tip && step.tip.title && (step.tip.body || []).length >= 1, `질문 ${step.id}에 ‘알아 두면 좋은 팁’이 없어요.`);
    if (step.tip && step.tip.src) need(src[step.tip.src], `질문 ${step.id}의 팁 출처 ${step.tip.src}가 SOURCES에 없어요.`);
    if (step.type === 'single' || step.type === 'multi') {
      for (const o of step.options) need(o.tip || o.noTip, `질문 ${step.id}의 선택지 ${o.id}에 고른 뒤 보일 한 줄이 없어요.`);
    }
    if (step.type === 'group') {
      for (const f of step.fields) need(f.options.some(o => o.tip), `질문 ${step.id}의 ${f.id} 칸에 설명이 달린 선택지가 하나도 없어요.`);
    }
  }

  // 부품마다 여섯 종류 팁 중 약속한 것을 모두 채웠는지
  const tips = content.TIPS || {};
  const comps = content.COMPONENTS || {};
  need(Object.keys(comps).length > 0, 'COMPONENTS(추천에 들어가는 부품 목록)가 없어요.');
  for (const [id, t] of Object.entries(tips)) {
    need(comps[t.component], `팁 ${id}의 부품 ${t.component}가 COMPONENTS에 없어요.`);
    need(t.title && t.title.length > 4, `팁 ${id}에 제목이 없어요.`);
    need((t.body || []).length >= 2 && sentences((t.body || []).join(' ')).length >= 3, `팁 ${id}의 설명이 너무 짧아요(두 문단, 세 문장 이상).`);
    need((t.covers || []).length && t.covers.every(k => KINDS.includes(k)), `팁 ${id}의 covers가 비었거나 모르는 종류가 있어요.`);
    need((t.src || []).length && t.src.every(s => src[s]), `팁 ${id}의 출처가 없거나 SOURCES에 없어요.`);
    if (/[0-9]/.test((t.body || []).join(' '))) need((t.src || []).some(s => s !== 'synk'), `팁 ${id}에 숫자가 있는데 공식·커뮤니티 출처가 없어요.`);
  }
  for (const [comp, kinds] of Object.entries(comps)) {
    const covered = new Set(Object.values(tips).filter(t => t.component === comp).flatMap(t => t.covers || []));
    for (const k of kinds) need(covered.has(k), `부품 ${comp}의 팁에 ‘${KIND_LABEL[k] || k}’가 없어요.`);
  }
  return problems;
}

// 계산 결과가 고른 팁 id가 모두 팁 은행에 있는지(도구 시험에서 부른다)
function checkTipIds(ids, content) {
  return ids.filter(id => !(content.TIPS || {})[id]).map(id => `결과가 고른 팁 ${id}가 TIPS에 없어요.`);
}

module.exports = { checkContent, checkTipIds, KINDS, KIND_LABEL };
