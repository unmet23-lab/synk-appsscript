// 마크다운 — md 를 HTML 로 바꾸는 **공용 통로**.
//
// 왜 있나: 이 저장소에는 같은 초소형 md 렌더러가 이미 두 벌 있었다.
//   · tools/인쇄본빌드.js  `renderMd`  — 코드 펜스·중첩 목록·문단 접기까지 있는 **완전한** 판
//   · tools/철학열람빌드.js(⚠삭제됨 04344ff5 2026-08-14 — 지금 없다) `mdToHtml` — 같은 문법 목록인데 **코드 펜스 처리가 없다**
// 두 판의 차이는 눈에 안 띄는데 새는 방향은 조용하다 — 펜스 없는 판에 지면 목업(```…```)이 든
// 문서를 물리면 오류 없이 **박스 그림이 문단으로 풀려** 나온다(교재 원고가 정확히 그 모양이다).
// 세 번째 소비자가 생기는 자리라, 사본을 하나 더 만드는 대신 통로를 하나 판다(CLAUDE.md 「3번째」).
//
// 🔴 아직 수렴 안 된 것: 위 두 파일은 자기 렌더러를 그대로 쓴다.
//    인쇄본빌드.js 는 다른 세션(`e4c9f97c`)이 편집 중이라 이번에 못 건드렸다 — 대기열에 남긴다.
//
// 다루는 문법 = 이 저장소 문서가 실제로 쓰는 것만: 제목 h1~h4 · 코드 펜스 · 인용 · 표 ·
// 목록(중첩·이어지는 줄) · 수평선 · 문단 · 인라인(굵게·취소선·코드·링크).
'use strict';

const { 칸나누기 } = require('./표.js');   // 날 split 은 백틱 안 파이프에서 칸을 민다(F119·F253)

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 인라인 서식.
 * @param {string} s
 * @param {{링크:'a'|'글자'}} [opt] 링크를 진짜 <a> 로 낼지(화면), 글자만 남길지(인쇄물·열람 사본).
 */
function inline(s, opt) {
  const 링크 = (opt && opt.링크) || 'a';
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, (m, c) => '<code>' + c + '</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,
    링크 === 'a' ? '<a href="$2">$1</a>' : '<span class="lnk">$1</span>');
  return s;
}

/**
 * md → HTML 조각(문서 껍데기는 부르는 쪽이 씌운다).
 * @param {string} md
 * @param {{링크?:'a'|'글자', 제목id?:(글자:string, 층:number)=>string}} [opt]
 *        제목id 를 주면 h 태그에 id 를 박는다 — 목차 앵커용.
 */
function 렌더(md, opt) {
  opt = opt || {};
  md = String(md).replace(/<!--[\s\S]*?-->/g, '');       // 주석 제거
  const lines = md.split(/\r?\n/);
  const out = [];
  let i = 0;
  const listStack = [];
  const closeLists = (depth) => { while (listStack.length > depth) out.push('</' + listStack.pop() + '>'); };
  const 인라인 = (s) => inline(s, opt);

  while (i < lines.length) {
    const line = lines[i];

    // 코드 펜스 — 교재 지면 목업이 전부 여기 산다. 안쪽은 손대지 않는다.
    if (/^```/.test(line)) {
      closeLists(0);
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push('<pre>' + esc(buf.join('\n')) + '</pre>');
      continue;
    }
    if (/^\s*$/.test(line)) { closeLists(0); i++; continue; }
    if (/^(---|\*\*\*|___)\s*$/.test(line)) { closeLists(0); out.push('<hr/>'); i++; continue; }

    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) {
      closeLists(0);
      const n = h[1].length;
      const 속 = 인라인(h[2]);
      const id = opt.제목id ? opt.제목id(h[2], n) : null;
      out.push(`<h${n}${id ? ` id="${esc(id)}"` : ''}>${속}</h${n}>`);
      i++;
      continue;
    }

    if (/^>/.test(line)) {                                // 인용 콜아웃(연속 줄 묶음)
      closeLists(0);
      const buf = [];
      while (i < lines.length && /^>/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push('<blockquote>' + 렌더(buf.join('\n'), opt) + '</blockquote>');
      continue;
    }

    if (/^\s*\|/.test(line)) {                            // 표
      closeLists(0);
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => 칸나누기(r).map(인라인);
      let html = '<table>';
      let headDone = false;
      for (const r of rows) {
        if (/^\s*\|[\s:|-]+\|\s*$/.test(r)) { headDone = true; continue; }
        const tag = headDone ? 'td' : 'th';
        html += '<tr>' + cells(r).map((c) => `<${tag}>${c}</${tag}>`).join('') + '</tr>';
        if (!headDone) headDone = true;                   // 구분줄 없는 표 방어 — 첫 줄만 머리
      }
      out.push(html + '</table>');
      continue;
    }

    const li = line.match(/^(\s*)([-*+·]|\d+[.)])\s+(.*)/);
    if (li) {
      const depth = Math.floor(li[1].replace(/\t/g, '  ').length / 2) + 1;
      const kind = /^\d/.test(li[2]) ? 'ol' : 'ul';
      while (listStack.length > depth) out.push('</' + listStack.pop() + '>');
      while (listStack.length < depth) { out.push('<' + kind + '>'); listStack.push(kind); }
      // 다음 줄이 이어지는 본문(들여쓴 연속)이면 같은 항목으로 붙인다
      let body = li[3];
      let j = i + 1;
      while (j < lines.length && /^\s{2,}\S/.test(lines[j])
             && !/^\s*([-*+·]|\d+[.)])\s/.test(lines[j]) && !/^\s*\|/.test(lines[j])
             && !/^\s*```/.test(lines[j])) {
        body += ' ' + lines[j].trim();
        j++;
      }
      i = j;
      out.push('<li>' + 인라인(body) + '</li>');
      continue;
    }

    closeLists(0);
    // 문단 — 소프트 줄바꿈은 공백으로 접고(md 규칙) 인라인은 문단 전체에 1회(굵게가 줄을 넘어도 산다)
    let body = line.trim();
    let j = i + 1;
    while (j < lines.length && !/^\s*$/.test(lines[j])
           && !/^(#{1,4}\s|>|```|\s*\||\s*([-*+·]|\d+[.)])\s|---\s*$)/.test(lines[j])) {
      body += ' ' + lines[j].trim();
      j++;
    }
    i = j;
    out.push('<p>' + 인라인(body) + '</p>');
  }
  closeLists(0);
  return out.join('\n');
}

module.exports = { esc, inline, 렌더 };
