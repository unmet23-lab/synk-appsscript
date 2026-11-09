'use strict';

// ⑱ 미학 맹검 관문(11-08 유호님 「내 피드백도 … 검수, 검토작업에 적용해줬으면 해」) — 올리기 전 검사(tools/올리기전검사.js)와
// 예약 큐(tools/예약큐.js — 14시 「오늘 편 게시」가 이것으로 걸 편을 고른다)가 같이 쓴다. 매시 도는 예약 큐 알림이 무거운 검사 도구를
// 불러오지 않게 판정만 여기에 둔다.
//
// 보여 드리기 · 게시 전에 대표 프레임 · 카드를 tools/미학맹검.js(아르곤 그림 맹검, 슬롭 점검표의 유호님 말씀을 붙여 묻는다)로 보고
// 그 결과를 편 폴더 게시/미학맹검.json에 둔다(--편 <편 폴더>). 11-08부터 모든 편에 묻는다 — 만든 날 상관없이, 이미 만들어 둔 비축 편도
// (유호님 「오늘 회차부터 걸지 왜 내일부터 … 그냥 지금부터 걸어」). 맹검 뒤 영상이 바뀌었거나 답이 빠졌거나 「기각」이면 고칠 것 —
// 고쳐 다시 맹검하거나, 그래도 낼 까닭(빈 날 없음 · 지적이 이 자리와 무관 등)을 준비.json 「맹검판단」에 적으면 확인할 것으로 내린다.
// 아르곤이 막혀 맹검을 못 했으면 준비.json 「맹검못함」에 까닭을 적는다(확인할 것). 판정이 한 장도 없는 결과(모든 화면 답 빠짐)가
// 남아 있어도 「맹검못함」은 받는다(11-10: 11-09 15:34 아르곤 줄이 막힌 뒤 다시 렌더한 LAB 두 편이 결과 파일 탓에 다시 맹검할 길
// 없이 막혔다). 「맹검판단」은 그 결과를 낸 판에만 통한다 — 다시 렌더한 판은 다시 맹검하거나, 그때도 막혔으면 「맹검못함」.
const fs = require('node:fs');
const path = require('node:path');
const { FIX, LOOK } = require('./게시글규칙.js');

const AESTHETIC_FROM = '20261108'; // 관문을 건 날(기록용 — 날짜로 거르지 않는다)

// bundle = { dir: 편 폴더, prep: 준비.json }, videoFiles = 그 편의 영상 판(맹검 뒤에 바뀌었는지 본다)
function aestheticFindings(bundle, videoFiles) {
  const findings = [];
  const add = (level, code, message) => findings.push({ level, code, where: '미학 맹검', message });
  const 글칸 = k => (typeof bundle.prep[k] === 'string' ? bundle.prep[k].trim() : '');
  const 판단 = 글칸('맹검판단'), 못함 = 글칸('맹검못함');
  const file = path.join(bundle.dir, '게시', '미학맹검.json');
  let 결과 = null;
  try { 결과 = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* 없다 */ }
  if (!결과) {
    if (못함) add(LOOK, 'aesthetic-skipped', `미학 맹검을 못 했다 — 「맹검못함」: ${못함}`);
    else add(FIX, 'aesthetic-missing', '보여 드리기 · 게시 전 미학 맹검이 없다(11-08부터 모든 편, 제작 절차 3 관문) — node tools/미학맹검.js <대표 프레임 · 카드…> --편 <편 폴더>. 아르곤이 막혔으면 준비.json 「맹검못함」에 까닭');
    return findings;
  }
  const 낱장 = Array.isArray(결과.낱장) ? 결과.낱장 : [];
  const 만든때 = Date.parse(결과.만든때 || '') || (() => { try { return fs.statSync(file).mtimeMs; } catch { return 0; } })();
  const 새영상 = videoFiles.filter(v => { try { return fs.statSync(v).mtimeMs > 만든때 + 1000; } catch { return false; } });
  const 바뀜글 = () => `맹검 뒤 영상이 바뀌었다(${새영상.map(v => path.basename(v)).join(', ')}) — 바뀐 판의 대표 프레임으로 다시 맹검한다`;
  if (!낱장.length) {
    // 판정이 한 장도 없는 결과(모든 화면 답 빠짐 — 아르곤이 막힌 날): 「맹검못함」은 받고, 「맹검판단」은 그 판(영상이 그대로일 때)에만
    if (못함) add(LOOK, 'aesthetic-skipped', `미학 맹검 판정이 없다(모든 화면 답 빠짐) — 「맹검못함」: ${못함}`);
    else if (새영상.length) add(FIX, 'aesthetic-stale', `${바뀜글()}. 그때도 아르곤이 막혔으면 준비.json 「맹검못함」에 까닭`);
    else add(판단 ? LOOK : FIX, 'aesthetic-incomplete', `맹검 답을 한 장도 못 받았다${판단 ? ` · 「맹검판단」: ${판단}` : ' — 다시 맹검하거나, 아르곤이 막혔으면 준비.json 「맹검못함」에 까닭'}`);
    return findings;
  }
  if (새영상.length) add(FIX, 'aesthetic-stale', 바뀜글());
  const 빠짐 = Array.isArray(결과.빠짐) ? 결과.빠짐 : [];
  if (빠짐.length) add(판단 ? LOOK : FIX, 'aesthetic-incomplete', `맹검 답을 못 받은 화면 ${빠짐.join(', ')} — 통과로 치지 않는다${판단 ? ` · 「맹검판단」: ${판단}` : ''}`);
  const 짧게 = x => `${x.번호}(${x.점수 ?? '—'}점) ${String((x.약점 || [])[0] || '').slice(0, 70)}`;
  const 기각 = 낱장.filter(x => x.판정 === '기각');
  if (기각.length) add(판단 ? LOOK : FIX, 'aesthetic-reject', `아르곤 맹검 「기각」 ${기각.length}장 — ${기각.slice(0, 3).map(짧게).join(' · ')}${판단 ? ` · 「맹검판단」: ${판단}` : ' — 지적대로 고쳐 다시 맹검하거나, 그래도 낼 까닭을 준비.json 「맹검판단」에 적는다'}`);
  const 고쳐 = 낱장.filter(x => x.판정 === '고쳐서 냄');
  if (고쳐.length) add(LOOK, 'aesthetic-fix', `아르곤 맹검 「고쳐서 냄」 ${고쳐.length}장 — ${고쳐.slice(0, 3).map(짧게).join(' · ')}`);
  return findings;
}

// 예약 큐 · 게시 작업이 한 줄로 보이는 까닭 — 고칠 것만, 없으면 null
const 짧은까닭 = { 'aesthetic-missing': '미학 맹검 없음', 'aesthetic-stale': '맹검 뒤 영상 바뀜', 'aesthetic-incomplete': '맹검 답 빠짐', 'aesthetic-reject': '맹검 기각' };
function aestheticBlock(bundle, videoFiles) {
  const fix = aestheticFindings(bundle, videoFiles).filter(f => f.level === FIX);
  return fix.length ? fix.map(f => 짧은까닭[f.code] || f.code).join(' · ') : null;
}

module.exports = { aestheticFindings, aestheticBlock, AESTHETIC_FROM };
