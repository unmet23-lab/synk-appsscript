'use strict';
// 작업 원문의 짧은 발췌. 검색어가 비슷하다는 이유로 다른 작업의 승인이나 과거 결정을 적용하지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { 공용작업본 } = require('./공용작업본.js');

const 정규화 = 글 => 글.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
const 지문 = 글 => crypto.createHash('sha256').update(글).digest('hex');
const 맞음 = (글, 낱말) => 낱말.every(x => 글.toLowerCase().includes(x.toLowerCase()));
function 안에(기준, 파일) {
  const 차이 = path.relative(기준, 파일);
  return !path.isAbsolute(차이) && 차이 !== '..' && !차이.startsWith('..' + path.sep);
}

// 받은 원격판이 새로 만든 파일은 디스크에 아직 없을 수 있다. 있는 부모까지 실제 경로를 확인한다.
function 실제경로(파일) {
  try { return fs.realpathSync(파일); }
  catch (e) {
    if (e.code !== 'ENOENT' || 파일 === path.dirname(파일)) throw e;
    return path.join(실제경로(path.dirname(파일)), path.basename(파일));
  }
}

function 원문읽기(뿌리, 파일) {
  let 내용;
  try { 내용 = 정규화(fs.readFileSync(파일, 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  const 로컬 = 판 => {
    if (내용 === undefined) throw Error('지정한 원문 파일이 없습니다: ' + 파일);
    return { 내용, 판 };
  };
  if (!안에(뿌리, 파일)) return 로컬('명시한 외부 로컬 파일');
  const 판 = '공용 작업본 파일';
  if (!fs.existsSync(path.join(뿌리, '.git'))) return 로컬(판);
  const git = (...args) => execFileSync('git', ['--literal-pathspecs', '-c', 'core.quotepath=false', ...args], {
    cwd: 뿌리, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, timeout: 60000,
  });
  const [지금, 받은] = git('rev-parse', '--revs-only', 'HEAD', 'refs/remotes/origin/master').trim().split(/\r?\n/);
  if (!지금) throw Error('공용 작업본의 Git 판을 확인할 수 없습니다.');
  if (!받은 || 지금 === 받은) return 로컬(판);
  const 공통 = git('merge-base', 지금, 받은).trim();
  const 상대 = path.relative(뿌리, 파일).split(path.sep).join('/');
  if (공통 === 받은) return 로컬(판);
  const 변경 = git('diff', '--name-status', '-z', '--no-renames', 공통, 받은, '--', 상대).split('\0')[0];
  if (!변경) return 로컬(판);
  const 원격 = 변경 === 'D' ? undefined : 정규화(git('show', 받은 + ':' + 상대));
  if (내용 !== 원격) {
    const 바탕 = 변경 === 'A' ? undefined : 정규화(git('show', 공통 + ':' + 상대));
    if (내용 !== 바탕) throw Error('공용 수정과 받은 원격 수정이 겹칩니다. 두 원문을 함께 확인하세요.');
  }
  if (원격 === undefined) throw Error('받은 원격판에서 지정한 원문을 삭제했습니다: ' + 상대);
  return { 내용: 원격, 판: '받은 원격 ' + 받은, 상대 };
}

function 제목들(줄) {
  const 목록 = []; let 블록 = '', 앞앵커 = [];
  for (const [i, 글] of 줄.entries()) {
    const 구분 = /^\s*(`{3,}|~{3,})/.exec(글)?.[1];
    if (구분 && (!블록 || (구분[0] === 블록[0] && 구분.length >= 블록.length))) { 블록 = 블록 ? '' : 구분; continue; }
    if (블록) continue;
    const 앵커 = /^\s*<a\s+(?:id|name)=["']([^"']+)["'][^>]*>\s*<\/a>\s*$/i.exec(글);
    if (앵커) { 앞앵커.push(앵커[1]); continue; }
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(글);
    if (m) {
      const 이름 = m[2].trim(), 주소 = 이름.toLowerCase().replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '').replace(/\s/g, '-');
      목록.push({ 이름, 주소: [...앞앵커, 주소], 층: m[1].length, 줄: i + 1 });
    }
    if (글.trim()) 앞앵커 = [];
  }
  return 목록;
}

function 원문발췌(뿌리, 지정, 낱말) {
  const [경로, ...나머지] = 지정.split('#');
  const 앵커 = 나머지.join('#');
  let 대상경로 = path.resolve(뿌리, 경로);
  if (path.isAbsolute(경로)) {
    for (let d = path.dirname(대상경로); d !== path.dirname(d); d = path.dirname(d)) {
      if (!fs.existsSync(path.join(d, '.git'))) continue;
      if (fs.realpathSync(공용작업본(d)) === 뿌리) 대상경로 = path.join(뿌리, path.relative(d, 대상경로));
      break;
    }
  }
  const 파일 = 실제경로(대상경로);
  if (path.extname(파일).toLowerCase() !== '.md' || (!안에(뿌리, 파일) && !path.isAbsolute(경로))) throw Error('공용 저장소의 Markdown 원문을 지정하세요. 외부 원문은 절대경로로 직접 지정합니다.');
  const { 내용, 판, 상대 } = 원문읽기(뿌리, 파일);
  const 줄 = 내용.split('\n'), 제목 = 제목들(줄);
  const 대상 = 앵커 ? 제목.filter(x => x.주소.includes(앵커) || x.이름 === 앵커) : 제목.slice(0, 1);
  if (대상.length !== 1) throw Error(대상.length ? '같은 제목이나 앵커가 둘 이상입니다. 고유한 원문 앵커를 지정하세요.' : '지정한 제목이나 앵커가 원문에 없습니다.');
  const 절 = 대상[0], 다음 = 제목.find(x => x.줄 > 절.줄 && (앵커 ? x.층 <= 절.층 : true));
  const 끝 = 다음 ? 다음.줄 - 1 : 줄.length;
  const 본문 = 줄.slice(절.줄, 끝).map((글, i) => ({ 줄: 절.줄 + i + 1, 글 }))
    .filter(x => x.글.trim() && !/^\s*<a\s/.test(x.글));
  // 완결된 줄만 보인다. 부정이나 조건이 긴 문장의 뒤에 있으면 중간에서 자르지 않는다.
  const 순서 = [...본문.filter(x => 맞음(x.글, 낱말)), ...본문.filter(x => !맞음(x.글, 낱말))];
  const 발췌 = []; let 남음 = 1100;
  for (const x of 순서) if (발췌.length < 6 && x.글.length <= 남음) { 발췌.push(x); 남음 -= x.글.length; }
  발췌.sort((a, b) => a.줄 - b.줄);
  const 첫본문 = 줄.findIndex((s, i) => i >= 제목[0].줄 && s.trim() && !/^\s*<a\s/.test(s));
  const 안내 = 앵커 && 첫본문 >= 0 && 첫본문 < 절.줄 - 1 && !줄[첫본문].startsWith('#') && 줄[첫본문].length <= 400
    ? { 줄: 첫본문 + 1, 글: 줄[첫본문] } : null;
  return { 파일: 상대 ? 상대 + ' @ ' + 판 : 파일, 판, 제목: 절.이름, 첫줄: 절.줄, 끝줄: 끝, 안내,
    지문: 지문([안내?.글 || '', ...줄.slice(절.줄 - 1, 끝)].join('\n')), 발췌, 생략줄: 본문.length - 발췌.length,
    ...(!앵커 ? { 절후보: 제목.slice(1, 8).map(x => ({ 제목: x.이름, 앵커: x.주소[0], 줄: x.줄 })), 더있는절: Math.max(0, 제목.length - 8) } : {}) };
}

function 현재찾기(작업본, 낱말, 명시 = []) {
  const 뿌리 = fs.realpathSync(공용작업본(작업본));
  const 결과 = { 낱말, 기준폴더: 뿌리, 상태: '원문 발췌', 승인판정: '자동 판정하지 않음', 원문: [], 후보: [] };
  let 지정 = 명시;
  if (!지정.length) {
    const 지도 = path.join(뿌리, 'docs', '문서_지도.md');
    const 줄 = 원문읽기(뿌리, 지도).내용.split('\n');
    const 발견 = new Map(), 제목일치 = new Map();
    const 검색제목 = 낱말.join(' ').toLowerCase();
    for (const [i, 행] of 줄.entries()) {
      if (!행.startsWith('|') || !맞음(행, 낱말)) continue;
      for (const m of 행.matchAll(/\[([^\]]+)\]\(([^)]+?\.md(?:#[^)]*)?)\)/gi)) {
        if (/^(?:[\w+.-]+:|\/|\\)/.test(m[2])) continue;
        const [대상, 앵커] = decodeURIComponent(m[2]).split('#');
        const 파일 = path.resolve(path.dirname(지도), 대상);
        if (!안에(뿌리, 파일)) continue;
        const 위치 = path.relative(뿌리, 파일).split(path.sep).join('/') + (앵커 ? '#' + 앵커 : '');
        const 항목 = { 위치, 이름: m[1], 지도줄: i + 1 };
        발견.set(위치, 항목);
        if (m[1].toLowerCase() === 검색제목) 제목일치.set(위치, 항목);
      }
    }
    const 후보 = 제목일치.size ? 제목일치 : 발견;
    if (후보.size !== 1) return { ...결과, 상태: 후보.size ? '원문 선택 필요' : '지정된 원문 없음',
      후보: [...후보.values()].slice(0, 6), 더있는후보: Math.max(0, 후보.size - 6) };
    지정 = [...후보.keys()];
  }
  결과.원문 = 지정.map(x => 원문발췌(뿌리, x, 낱말));
  return 결과;
}

function 현재화면(r) {
  const out = [`「${r.낱말.join(' ')}」 ${r.상태}. 사용자 승인과 적용 범위는 원문에서 확인합니다.`];
  for (const x of r.원문) {
    out.push(`${x.파일}:${x.첫줄}  ${x.제목}  [${x.판} · ${x.지문.slice(0, 12)}]`,
      ...(x.안내 ? ['  ' + x.안내.줄 + '  ' + x.안내.글] : []), ...x.발췌.map(l => '  ' + l.줄 + '  ' + l.글));
    if (x.생략줄) out.push(`  이 절에서 ${x.생략줄}줄을 생략했습니다. 원문 ${x.첫줄}~${x.끝줄}행에서 전문을 읽을 수 있습니다.`);
    if (x.절후보?.length) out.push('  하위 제목  ' + x.절후보.map(h => '#' + h.앵커).join('  ') + (x.더있는절 ? `  (외 ${x.더있는절}개)` : ''));
  }
  for (const x of r.후보) out.push(`  ${x.위치}  (${x.이름}, 문서 지도 ${x.지도줄}행)`);
  if (r.더있는후보) out.push('  다른 후보 ' + r.더있는후보 + '개가 있습니다.');
  if (!r.원문.length) out.push('담당 원문을 --원문 "경로#앵커"로 지정하세요. 결정·보관·수정 이력은 --현재 없이 같은 낱말로 찾습니다.');
  return out.join('\n');
}
module.exports = { 현재찾기, 현재화면 };
