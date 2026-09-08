#!/usr/bin/env node
'use strict';
/* Prism 접점 래칫 — 미등록 소비자와 학생·학부모 갈래 참조를 막는다.
 * 주석·문자열·선언·객체 키·호출을 가리지 않고 prism_ 이름을 모두 센다.
 * 덜 잡아서 조용히 새는 것보다 더 잡아서 사람이 보는 것이 싸기 때문이다.
 * 한글 음절 이름도 센다. 이것은 정적 참조 검사이며 데이터 흐름의 증명이 아니다.
 *
 * node tools/prism래칫.js [--범위 <저장소 상대 glob>]... / --자가시험
 * 기본 범위는 저장소 뿌리의 *.js 전부다(하위 폴더 제외). 추가 glob은 직접 탐색하고 node:path.matchesGlob으로 맞춘다.
 * 설계 정본의 출제 가중치 입구(엔진_콘텐츠AI.js 갈래)가 옛 리포트 엔진 둘 밖이라 범위를 넓혔다.
 * fs.globSync는 탐색 오류를 빈 결과로 숨기므로 쓰지 않는다. 일부만 못 봐도 확인 불가다.
 * 명부·범위는 실제 파일의 상대 경로를 공유한다(Windows 대소문자·링크 별칭 포함).
 * SYNK_PRISM_명부만 바깥 파일 경로를 허용한다 — 동봉 게이트가 커밋될 명부를 임시 파일로 넘긴다.
 * 종료: 0=검사 통과, 1=금지 참조, 2=확인 불가. CI 배선은 별도 작업이다.
 * 검사({루트, 명부, 범위}) / 실행(인자, {루트})는 임시 픽스처용 진입점이다.
 * 자가시험은 실제 범위·명부를 읽지 않고 자체 임시 뿌리를 만든 뒤 지운다.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 저장소 = path.resolve(__dirname, '..');
const 기본범위 = ['*.js'];
const 기본명부 = 'docs/_ops/prism_접점등록.json';
const 갈래들 = new Set(['학생', '학부모', '강사', '내부']);
const 채운문자열 = (값) => typeof 값 === 'string' && 값.trim().length > 0;
const 객체 = (값) => 값 !== null && typeof 값 === 'object' && !Array.isArray(값);
const 한줄 = (값) => String(값).replace(/[\r\n\u2028\u2029]/g, ' ');
const 못잼 = (사유) => ({ 종료코드: 2, 출력: [`확인 불가: ${한줄(사유)}`], 셈: null });

function 상대경로(값, 자리) {
  if (!채운문자열(값) || /[\0\r\n\u2028\u2029]/.test(값)) {
    throw new Error(`${자리}: 비어 있거나 올바르지 않은 경로`);
  }
  const 고른 = 값.replace(/\\/g, '/').replace(/^(?:\.\/)+/, '');
  // glob의 대안 안에 숨은 ../ 및 절대 경로도 펼치기 전에 거절한다.
  if (/(^|[{,(|])(?:\/|[A-Za-z]:)/.test(고른)
      || 고른.split(/[/{},()|]+/).includes('..')) {
    throw new Error(`${자리}: 저장소 밖 경로는 받지 않는다 — ${값}`);
  }
  const 결과 = path.posix.normalize(고른);
  if (결과 === '.' || 결과 === '') throw new Error(`${자리}: 파일 경로가 필요하다 — ${값}`);
  return 결과;
}

function 안쪽인가(뿌리, 대상) {
  const 상대 = path.relative(뿌리, 대상);
  return 상대 !== '..' && !상대.startsWith(`..${path.sep}`) && !path.isAbsolute(상대);
}

function 실제경로(뿌리, 상대) {
  const 실제 = fs.realpathSync(path.resolve(뿌리, 상대));
  if (!안쪽인가(뿌리, 실제)) throw new Error('저장소 밖으로 이어진 경로');
  // Windows의 realpathSync는 입력 대소문자를 남길 수 있다. native가 실제 표기를 돌려준다.
  const 정본 = fs.realpathSync.native(실제);
  if (!안쪽인가(뿌리, 정본)) throw new Error('저장소 밖으로 이어진 경로');
  return 정본;
}

function 파일열쇠(뿌리, 경로, 없는경로허용 = false) {
  try { return path.relative(뿌리, 실제경로(뿌리, 경로)).replace(/\\/g, '/'); }
  catch (오류) {
    // 명부에는 아직 없는 소비자도 올릴 수 있다. 권한 오류나 바깥 링크는 예외가 아니다.
    if (없는경로허용 && 오류.code === 'ENOENT') {
      return process.platform === 'win32' ? 경로.toLowerCase() : 경로;
    }
    throw 오류;
  }
}

function 명부읽기(뿌리, 명부, 외부명부 = false) {
  let 내용;
  try {
    내용 = fs.readFileSync(외부명부 ? 명부 : 실제경로(뿌리, 명부), 'utf8');
  } catch (_) {
    throw new Error(`명부를 읽을 수 없다 — ${명부}`);
  }
  let 자료;
  try { 자료 = JSON.parse(내용); }
  catch (_) { throw new Error(`명부 JSON이 깨졌다 — ${명부}`); }
  if (!객체(자료) || !Object.hasOwn(자료, '소비자') || !Array.isArray(자료.소비자)) {
    throw new Error('명부 최상위 소비자 배열이 필요하다');
  }
  const 등록 = new Map();
  for (const [번호, 항목] of 자료.소비자.entries()) {
    const 자리 = `명부 항목 ${번호 + 1}/${자료.소비자.length}`;
    if (!객체(항목)) throw new Error(`${자리}: 객체가 아니다`);
    const 경로 = 상대경로(항목.경로, `${자리} 경로`);
    if (!갈래들.has(항목.갈래)) throw new Error(`${자리}: 갈래가 올바르지 않다`);
    if (!채운문자열(항목.사유)) throw new Error(`${자리}: 사유가 비었다`);
    let 열쇠;
    try { 열쇠 = 파일열쇠(뿌리, 경로, true); }
    catch (_) { throw new Error(`${자리}: 명부 경로를 확인할 수 없다 — ${경로}`); }
    if (등록.has(열쇠)) throw new Error(`${자리}: 같은 경로가 두 번 등록됐다 — ${경로}`);
    등록.set(열쇠, 항목.갈래);
  }
  return 등록;
}

function* glob대안(패턴) {
  // 슬래시를 가로지르는 {파일,폴더/*.js}도 먼저 가지로 나눈다.
  // 숫자·문자 범위와 문자 집합은 그대로 두어 Node의 낱토막 매처가 해석한다.
  const 여는곳 = [];
  let 문자집합 = false;
  for (let i = 0; i < 패턴.length; i++) {
    if (패턴[i] === '[') 문자집합 = true;
    else if (패턴[i] === ']') 문자집합 = false;
    if (문자집합) continue;
    if (패턴[i] === '{') 여는곳.push(i);
    else if (패턴[i] === '}' && 여는곳.length) {
      const 시작 = 여는곳.pop();
      const 내용 = 패턴.slice(시작 + 1, i);
      if (!내용.includes(',')) continue;
      for (const 대안 of 내용.split(',')) {
        yield* glob대안(패턴.slice(0, 시작) + 대안 + 패턴.slice(i + 1));
      }
      return;
    }
  }
  yield 패턴;
}

function glob찾기(뿌리, 패턴) {
  const 후보 = new Set();
  const 디렉터리들 = new Map();
  const 목록들 = new Map();
  function 디렉터리(경로) {
    if (!디렉터리들.has(경로)) {
      try {
        const 실제 = 실제경로(뿌리, 경로 || '.');
        디렉터리들.set(경로, fs.statSync(실제).isDirectory() ? 실제 : null);
      } catch (_) { throw new Error(`범위 디렉터리를 확인할 수 없다 — ${경로 || '.'}`); }
    }
    return 디렉터리들.get(경로);
  }
  function 목록(경로) {
    const 실제 = 디렉터리(경로);
    if (!목록들.has(실제)) {
      try { 목록들.set(실제, fs.readdirSync(실제, { withFileTypes: true })); }
      catch (_) { throw new Error(`범위 디렉터리를 탐색할 수 없다 — ${경로 || '.'}`); }
    }
    return 목록들.get(실제);
  }
  function 탐색(부모, 토막들, 번호) {
    if (번호 === 토막들.length) {
      if (부모) 후보.add(부모);
      return;
    }
    if (!디렉터리(부모)) return;
    const 토막 = 토막들[번호];
    const 끝 = 번호 === 토막들.length - 1;
    if (토막 === '**') {
      탐색(부모, 토막들, 번호 + 1);
      const 다음 = 토막들.slice(번호 + 1).find((값) => 값 !== '**');
      for (const 항목 of 목록(부모)) {
        // 뒤 토막이 숨김 이름을 명시한 경우에는 그 디렉터리 안쪽도 범위다.
        if (항목.name.startsWith('.') && (!다음 || !path.matchesGlob(항목.name, 다음))) continue;
        const 경로 = path.posix.join(부모, 항목.name);
        // globSync의 기본 동작처럼 **는 디렉터리 링크를 재귀 추적하지 않는다.
        if (항목.isDirectory()) 탐색(경로, 토막들, 번호);
        else if (끝) 후보.add(경로);
      }
      return;
    }
    if (토막 === '.' || 토막 === '') {
      탐색(부모, 토막들, 번호 + 1);
      return;
    }
    const 무늬 = /[*?\[\]{}()]/.test(토막);
    let 항목들;
    if (무늬) {
      항목들 = 목록(부모).filter((항목) => path.matchesGlob(항목.name, 토막));
    } else {
      const 경로 = path.posix.join(부모, 토막);
      try { 항목들 = [fs.lstatSync(path.resolve(뿌리, 경로))]; }
      catch (오류) {
        // 없는 고정 이름은 무일치다. EACCES 등은 다른 대안이 맞아도 검사 실패다.
        if (오류.code === 'ENOENT') return;
        throw new Error(`범위 경로를 확인할 수 없다 — ${경로}`);
      }
    }
    for (const 항목 of 항목들) {
      const 경로 = path.posix.join(부모, 무늬 ? 항목.name : 토막);
      if (끝) 후보.add(경로);
      else if (항목.isDirectory() || (!무늬 && 항목.isSymbolicLink())) {
        탐색(경로, 토막들, 번호 + 1);
      }
    }
  }
  for (const 대안 of glob대안(패턴)) {
    탐색('', 상대경로(대안, '범위 대안').split('/'), 0);
  }
  return 후보;
}

function 범위찾기(뿌리, 범위) {
  if (!Array.isArray(범위)) throw new Error('범위 배열이 필요하다');
  const 파일들 = new Set();
  for (const 원형 of 범위) {
    const 패턴 = 상대경로(원형, '범위');
    let 후보;
    try { 후보 = glob찾기(뿌리, 패턴); }
    catch (오류) { throw new Error(`범위를 펼칠 수 없다 — ${원형}: ${오류.message}`); }
    let 찾은수 = 0;
    for (const 값 of 후보) {
      const 경로 = 상대경로(값, '범위 파일');
      let 열쇠;
      try {
        const 실제 = 실제경로(뿌리, 경로);
        const 상태 = fs.statSync(실제);
        if (상태.isDirectory()) continue;
        if (!상태.isFile()) throw new Error('일반 파일이 아니다');
        열쇠 = 파일열쇠(뿌리, 경로);
      } catch (_) {
        throw new Error(`범위 파일을 확인할 수 없다 — ${경로}`);
      }
      파일들.add(열쇠);
      찾은수++;
    }
    if (찾은수 === 0) throw new Error(`범위 패턴에 맞는 파일이 없다 — ${원형}`);
  }
  if (파일들.size === 0) throw new Error('범위 파일이 없다');
  return [...파일들].sort();
}

function 검사({ 루트 = 저장소, 명부, 범위 = 기본범위 } = {}) {
  try {
    let 뿌리;
    try { 뿌리 = fs.realpathSync(루트); }
    catch (_) { throw new Error('검사 루트를 읽을 수 없다'); }
    const 외부명부 = 명부 === undefined && Boolean(process.env.SYNK_PRISM_명부);
    const 명부경로 = 외부명부
      ? process.env.SYNK_PRISM_명부
      : 상대경로(명부 === undefined ? 기본명부 : 명부, '명부');
    const 등록 = 명부읽기(뿌리, 명부경로, 외부명부);
    const 파일들 = 범위찾기(뿌리, 범위);
    const 출력 = [];
    let 참조수 = 0;
    let 학생학부모수 = 0;
    for (const 경로 of 파일들) {
      let 내용;
      try { 내용 = fs.readFileSync(실제경로(뿌리, 경로), 'utf8'); }
      catch (_) { throw new Error(`범위 파일을 읽을 수 없다 — ${경로}`); }
      const 갈래 = 등록.get(경로);
      const 금지갈래 = 갈래 === '학생' || 갈래 === '학부모';
      for (const [번호, 줄] of 내용.split(/\r\n|[\n\r\u2028\u2029]/).entries()) {
        for (const [이름] of 줄.matchAll(/\bprism_[A-Za-z0-9_가-힣]+/g)) {
          참조수++;
          if (금지갈래) 학생학부모수++;
          if (갈래 === undefined || 금지갈래) 출력.push(`${경로}:${번호 + 1}: ${이름}`);
        }
      }
    }
    const 종료코드 = 출력.length ? 1 : 0;
    const 셈 = { 범위파일수: 파일들.length, 참조수, 등록소비자수: 등록.size, 학생학부모참조수: 학생학부모수 };
    출력.push(`범위 파일 ${셈.범위파일수} · 참조 ${셈.참조수} · 등록 소비자 ${셈.등록소비자수} · 학생·학부모 참조 ${셈.학생학부모참조수}`);
    return { 종료코드, 출력, 셈 };
  } catch (오류) {
    return 못잼(오류.message);
  }
}

function 자가시험() {
  let 임시;
  let 결과;
  const 임시부모 = fs.realpathSync(os.tmpdir());
  try {
    임시 = fs.mkdtempSync(path.join(임시부모, 'synk-prism-self-'));
    fs.writeFileSync(path.join(임시, '견본.js'), 'prism_시험용();\n', 'utf8');
    fs.writeFileSync(path.join(임시, '명부.json'), JSON.stringify({ 소비자: [
      { 경로: '견본.js', 갈래: '학생', 사유: '양성 대조 견본' },
    ] }), 'utf8');
    const 측정 = 검사({ 루트: 임시, 명부: '명부.json', 범위: ['견본.js'] });
    const 잡힘 = 측정.종료코드 === 1 && 측정.출력.includes('견본.js:1: prism_시험용')
      && 측정.출력.at(-1) === '범위 파일 1 · 참조 1 · 등록 소비자 1 · 학생·학부모 참조 1';
    결과 = 잡힘
      ? { 종료코드: 0, 출력: ['자가시험 통과: 심은 학생 갈래 참조 1/1을 잡았다.'], 셈: null }
      : 못잼('자가시험에서 심은 학생 갈래 참조를 잡지 못했다');
  } catch (_) {
    결과 = 못잼('자가시험 임시 파일을 준비하거나 검사할 수 없다');
  } finally {
    if (임시) {
      try {
        // 재귀 삭제 전에 mkdtemp가 만든 임시 자식 경로인지 다시 확인한다.
        const 실제 = fs.realpathSync(임시);
        if (path.dirname(실제) !== 임시부모 || !path.basename(실제).startsWith('synk-prism-self-')) {
          throw new Error('임시 경로 이탈');
        }
        fs.rmSync(실제, { recursive: true, force: true });
      } catch (_) { 결과 = 못잼('자가시험 임시 폴더를 정리할 수 없다'); }
    }
  }
  return 결과;
}

function 실행(인자 = [], { 루트 = 저장소 } = {}) {
  const 범위 = [...기본범위];
  let 자체검사 = false;
  for (let i = 0; i < 인자.length; i++) {
    if (인자[i] === '--자가시험') 자체검사 = true;
    else if (인자[i] === '--범위') {
      const 패턴 = 인자[++i];
      if (!채운문자열(패턴) || 패턴.startsWith('--')) return 못잼('--범위 뒤에 glob이 필요하다');
      try { 상대경로(패턴, '범위'); }
      catch (오류) { return 못잼(오류.message); }
      범위.push(패턴);
    } else return 못잼(`알 수 없는 인자 — ${인자[i]}`);
  }
  return 자체검사 ? 자가시험() : 검사({ 루트, 범위 });
}

module.exports = { 검사, 실행, 자가시험 };

if (require.main === module) {
  let 결과;
  try { 결과 = 실행(process.argv.slice(2)); }
  catch (_) { 결과 = 못잼('래칫을 실행할 수 없다'); }
  for (const 줄 of 결과.출력) console.log(줄);
  process.exitCode = 결과.종료코드;
}
