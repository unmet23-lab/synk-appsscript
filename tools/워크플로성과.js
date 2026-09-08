#!/usr/bin/env node
'use strict';
// 기존 장부를 읽기만 한다. 제목·원문·학생 자료는 출력하지 않고 집계만 낸다.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const 검수 = require('./codex-review.js');

function 장부(p) {
  try {
    const lines = fs.readFileSync(p, 'utf8').split('\n').filter((s) => s.trim());
    let 깨짐 = 0;
    const rows = [];
    for (const line of lines) {
      try { const r = JSON.parse(line); if (!r || typeof r !== 'object' || Array.isArray(r)) throw new Error(); rows.push(r); }
      catch (_) { 깨짐++; }
    }
    return { rows, 전체줄: lines.length, 깨짐, 못읽음: false };
  } catch (_) { return { rows: [], 전체줄: null, 깨짐: 0, 못읽음: true }; }
}

const 시간 = (r) => Date.parse(r && r.시각) || 0;
const 저장소 = (r) => r.저장소 || 'SYNK-appsscript';
function 집계(검수행들, 처분행들, 실행행들) {
  const 처분 = new Map(), 지적 = new Map(), 실행 = new Map();
  const 무효 = new Set(검수행들.filter((r) => r.종류 === '무효' && r.무효행).map((r) => `${저장소(r)}\0${r.무효행}`));
  const key = (r, k) => `${저장소(r)}\0${k}`;
  for (const r of 처분행들) {
    if (!r.키) continue;
    const k = key(r, r.키), old = 처분.get(k);
    if (!old || 시간(r) >= 시간(old)) 처분.set(k, r);
  }
  // 같은 저장소·같은 지적 키의 최신 관측만 센다. 오래된 처분으로 새 관측을 판정하지 않는다.
  for (const r of 검수행들) {
    if (!검수.검수행인가(r) || 무효.has(`${저장소(r)}\0${r.시각}`) || !Array.isArray(r.지적)) continue;
    for (const f of r.지적) {
      const k = key(r, f.키 || 검수.키(f)), old = 지적.get(k);
      if (!old || 시간(r) >= 시간(old.행)) 지적.set(k, { 행: r, 지적: f });
    }
  }
  const 벤더 = {};
  for (const [k, { 행, 지적: f }] of 지적) {
    const d = 처분.get(k);
    const 상태 = d && 시간(d) >= 시간(행) ? 검수.처분of(d) : '미처분';
    const 후보 = f.발견벤더들 || ((행.벤더들 || ['codex']).length === 1 ? (행.벤더들 || ['codex']) : ['미기록']);
    const names = [...new Set(후보.length ? 후보 : ['미기록'])];
    for (const raw of names) {
      const name = ['codex', 'gemini', 'claude'].includes(raw) ? raw : '미기록';
      const b = 벤더[name] ||= { 지적: 0, 채택수리: 0, 기각: 0, 대상제외: 0, 미처분: 0, 단독채택: 0, 교차채택: 0 };
      b.지적++;
      if (상태 === '채택수리') {
        b.채택수리++;
        if (f.비교벤더수 > 1) { b.교차채택++; if (names.length === 1 && name !== '미기록') b.단독채택++; }
      }
      else if (상태 === '기각') b.기각++;
      else if (상태 === '범위밖' || 상태 === '대상아님') b.대상제외++;
      else b.미처분++;
    }
  }
  for (const r of 실행행들) {
    if (!r.발주 || !r.발주.지문) continue;
    const k = key(r, r.발주.지문), old = 실행.get(k);
    if (!old || 시간(r) >= 시간(old)) 실행.set(k, r);
  }
  const jobs = [...실행.values()];
  const 소요 = jobs.map((r) => r.소요ms).filter((x) => Number.isFinite(x) && x >= 0).sort((a, b) => a - b);
  const 중간 = Math.floor(소요.length / 2);
  const 중앙ms = !소요.length ? null : 소요.length % 2 ? 소요[중간] : (소요[중간 - 1] + 소요[중간]) / 2;
  return { 검수: { 고유지적: 지적.size, 벤더 }, 실행: { 발주: jobs.length, 완주: jobs.filter((r) => r.상태 === '완주').length,
    소요측정: 소요.length, 마지막호출중앙ms: 중앙ms,
    수리라운드: jobs.reduce((n, r) => n + Math.max(0, (r.라운드들 || []).length - 1), 0),
    수용재개: jobs.filter((r) => (r.라운드들 || []).some((x) => x.재개원본)).length } };
}

function 읽어집계() {
  const 입력 = [
    장부(process.env.SYNK_REVIEW_LEDGER || path.join(ROOT, 'docs/_ops/검수기록.jsonl')),
    장부(process.env.SYNK_REVIEW_DISPOSITIONS || path.join(ROOT, 'docs/_ops/검수기각.jsonl')),
    장부(process.env.SYNK_BUILD_LEDGER || path.join(ROOT, 'docs/_ops/실행기록.jsonl')),
  ];
  return { ...집계(...입력.map((x) => x.rows)), 자료: 입력.map(({ rows, ...r }) => r) };
}
function 화면(r = 읽어집계()) {
  const e = r.실행;
  const lines = ['📏 워크플로 성과 — 기존 기록 집계(모델 순위가 아니다)'];
  const 문제 = r.자료.filter((x) => x.못읽음 || x.깨짐);
  if (문제.length) lines.push(`확인 불가: 장부 ${문제.length}/${r.자료.length}벌에 누락·깨진 줄이 있어 아래 집계는 일부다.`);
  lines.push(`실행: 마지막 상태가 완주 ${e.완주}/${e.발주}발주 · 마지막 호출의 수리 라운드 ${e.수리라운드} · 수용 재개 ${e.수용재개}/${e.발주}발주`);
  lines.push(`시간: 측정 ${e.소요측정}/${e.발주}발주 · 마지막 호출 중앙값 ${e.마지막호출중앙ms == null ? '확인 불가' : Math.round(e.마지막호출중앙ms / 1000) + '초'} (전체 작업 완료 시간과 다르다)`);
  for (const [name, b] of Object.entries(r.검수.벤더)) {
    lines.push(`${name}: 채택수리 ${b.채택수리}/${b.채택수리 + b.기각}판정 · 교차 비교의 단독 채택 ${b.단독채택}/${b.교차채택}채택 · 대상 제외 ${b.대상제외}/${b.지적}지적 · 미처분 ${b.미처분}/${b.지적}지적`);
  }
  lines.push('대상 제외는 오판으로 세지 않는다. 옛 복수 벤더 기록의 발견자는 추정하지 않는다. 채택수리는 처분 기록이며 수리 검증 자체는 아니다.');
  return lines.join('\n');
}
if (require.main === module) {
  const r = 읽어집계();
  console.log(process.argv.includes('--json') ? JSON.stringify(r, null, 2) : 화면(r));
  process.exitCode = r.자료.some((x) => x.못읽음 || x.깨짐) ? 1 : 0;
}
module.exports = { 장부, 집계, 읽어집계, 화면 };
