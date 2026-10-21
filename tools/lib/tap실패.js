'use strict';
/* TAP 실패 읽기 — `node --test` TAP에서 «실제로 깨진» 시험(잎)을 이름 길과 함께 뽑는다 (2026-10-22).
 * ci빨간불(CI 로그)·관련시험(push 전)·ci넓은시험(기준선 래칫)이 같이 쓴다.
 *
 * 왜 있나: describe·t.test 안의 하위 시험은 들여 써서 찍히고, 그 부모도 failureType 'subtestsFailed'로 함께 not ok가 된다.
 *   맨 앞 not ok만 세면 같은 묶음 안에서 새로 깨진 시험이 「이미 아는 실패(부모)」에 묻힌다(아르곤 10-22 P1).
 *   그래서 잎만 세고, 이름은 「부모 › 잎」으로 짓는다. 파일째 죽은 시험(모듈 없음·최상위 예외)은 이름이 시험 파일 경로이고
 *   location이 없을 수 있다 — 그때는 그 이름으로 파일을 잡는다.
 * 돌려주는 것: { 시험, 통과, 실패수, 취소, 건너뜀, 실패: [{ 시험(이름 길), 잎, 파일, 위치(파일:줄), 오류(첫 줄), 안내[] }] }
 *   파일·위치는 root를 주면 그 저장소 기준이고, 아니면 경로 안의 tests/·tools/·docs/·desktop/·experiences/부터 자른다(CI 로그).
 */
const path = require('node:path');

const 앞자리 = /((?:tests|tools|docs|desktop|experiences|atlas)\/[^':]+?)(?::(\d+))?(?::\d+)?$/;

function 줄이기(경로, root) {
  if (!경로) return null;
  const 바른 = String(경로).replace(/\\\\/g, '\\');
  if (root) {
    const rel = path.relative(root, path.resolve(root, 바른));
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) return rel.split(path.sep).join('/');
  }
  const m = 바른.replace(/\\/g, '/').match(앞자리);
  return m ? m[1] : null;
}

function 위치읽기(값, root) {
  const m = String(값).match(/^(.*?)(?::(\d+))?(?::\d+)?$/);
  const 파일 = 줄이기(m ? m[1] : 값, root);
  return 파일 ? { 파일, 위치: m && m[2] ? `${파일}:${m[2]}` : 파일 } : { 파일: null, 위치: null };
}

function tap실패(글, { root = null } = {}) {
  const 줄들 = String(글 || '').replace(/\r/g, '').split('\n');
  const 들여 = (l) => l.match(/^ */)[0].length;
  const 수 = (k) => Number((줄들.find((l) => l.startsWith(`# ${k} `)) || '').split(' ')[2] || 0);
  const 쌓임 = []; // { 깊이, 이름 } — 지금 열린 하위 시험들
  const 모음 = new Map();
  const 부모이름 = new Set(); // subtestsFailed로 건너뛴 부모 — 요약 칸에 블록 없이 다시 찍혀도 세지 않는다
  for (let i = 0; i < 줄들.length; i++) {
    const l = 줄들[i];
    const 하위 = l.match(/^( *)# Subtest: (.*)$/);
    if (하위) {
      const d = 하위[1].length;
      while (쌓임.length && 쌓임[쌓임.length - 1].깊이 >= d) 쌓임.pop();
      쌓임.push({ 깊이: d, 이름: 하위[2].trim() });
      continue;
    }
    const 결과 = l.match(/^( *)(not ok|ok) \d+ - (.+?)\s*(?:# (?:TODO|SKIP)\b.*)?$/i);
    if (!결과) continue;
    const d = 결과[1].length;
    while (쌓임.length && 쌓임[쌓임.length - 1].깊이 > d) 쌓임.pop();
    const 부모들 = 쌓임.filter((x) => x.깊이 < d).map((x) => x.이름);
    if (쌓임.length && 쌓임[쌓임.length - 1].깊이 === d) 쌓임.pop();
    if (결과[2] !== 'not ok') continue;
    // 진단 블록: 다음 줄부터, 이 결과 줄보다 깊게 들여 쓴 줄들(빈 줄 포함) — '...'에서 끝난다.
    let 종류 = null, 위치값 = null, 오류 = null;
    const 안내 = [];
    for (let j = i + 1; j < 줄들.length && j < i + 400; j++) {
      const b = 줄들[j];
      if (b.trim() && 들여(b) <= d) break;
      if (b.trim() === '...' ) break;
      const 종 = b.match(/^\s*failureType: '?([^']+)'?\s*$/);
      if (종) 종류 = 종[1];
      const 위 = b.match(/^\s*location: '(.+)'\s*$/);
      if (위 && !위치값) 위치값 = 위[1];
      const 오 = b.match(/^\s*error: (.*)$/);
      if (오 && !오류) {
        const v = 오[1].trim();
        오류 = /^[|>][-+]?$/.test(v) ? (줄들.slice(j + 1).find((x) => x.trim()) || '').trim() : v.replace(/^['"]|['"]$/g, '');
      }
      const 화 = b.match(/^\s*→\s*(.+)$/);
      if (화 && 안내.length < 3 && !안내.includes(화[1])) 안내.push(화[1].slice(0, 300));
    }
    const 잎 = 결과[3].trim();
    if (종류 === 'subtestsFailed') { 부모이름.add([...부모들, 잎].join(' › ')); continue; } // 부모 — 깨진 잎이 따로 찍힌다
    let { 파일, 위치 } = 위치값 ? 위치읽기(위치값, root) : { 파일: null, 위치: null };
    if (!파일 && /\.test\.[cm]?js$/.test(잎)) { 파일 = 줄이기(잎, root) || 잎.replace(/\\/g, '/'); 위치 = 파일; }
    // 파일째 죽은 시험의 이름은 그 파일 경로다(Windows는 역슬래시) — OS와 상관없이 같은 이름이 되게 저장소 기준 경로로 쓴다.
    const 이름길 = /\.test\.[cm]?js$/.test(잎) && 파일 ? 파일 : [...부모들, 잎].join(' › ');
    const 열쇠 = `${파일 || ''}\0${이름길}`;
    if (!모음.has(열쇠)) 모음.set(열쇠, { 시험: 이름길.slice(0, 300), 잎: 잎.slice(0, 200), 파일, 위치, ...(오류 ? { 오류: 오류.slice(0, 200) } : {}), 안내 });
  }
  // 위치 없이 다시 찍힌 줄(CI 단계의 「--- not ok ---」 요약 따위)은 같은 이름의 위치 있는 실패가 있으면 버린다.
  const 위치있는이름 = new Set([...모음.values()].filter((x) => x.파일).map((x) => x.시험));
  const 실패 = [...모음.values()].filter((x) => x.파일 || (!위치있는이름.has(x.시험) && !부모이름.has(x.시험)));
  return { 시험: 수('tests'), 통과: 수('pass'), 실패수: 수('fail'), 취소: 수('cancelled'), 건너뜀: 수('skipped'), 실패 };
}

module.exports = { tap실패, 줄이기 };
