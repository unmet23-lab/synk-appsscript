#!/usr/bin/env node
'use strict';
/* Prism 접점 래칫 — 미등록 소비자와 학생·학부모 갈래 참조를 막는다.
 * 주석·문자열·선언·객체 키·호출을 가리지 않고 prism_ 이름을 모두 센다.
 * 덜 잡아서 조용히 새는 것보다 더 잡아서 사람이 보는 것이 싸기 때문이다.
 * 한글 음절 이름도 센다. 이것은 정적 참조 검사이며 데이터 흐름의 증명이 아니다.
 *
 * node tools/prism래칫.js [--범위 <저장소 상대 glob>]... / --자가시험
 * 기본 범위는 리포트 엔진 둘. 추가 glob은 Node의 node:fs.globSync로 푼다.
 * 종료: 0=검사 통과, 1=금지 참조, 2=확인 불가. CI 배선은 별도 작업이다.
 * 검사({루트, 명부, 범위}) / 실행(인자, {루트})는 임시 픽스처용 진입점이다.
 * 자가시험은 실제 범위·명부를 읽지 않고 자체 임시 뿌리를 만든 뒤 지운다.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 저장소 = path.resolve(__dirname, '..');
const 기본범위 = ['엔진_운영배치.js', '엔진_폼리포트.js'];
const 기본명부 = 'docs/_ops/prism_접점등록.json';
const 갈래들 = new Set(['학생', '학부모', '강사', '내부']);
const 채운문자열 = (값) => typeof 값 === 'string' && 값.trim().length > 0;
const 객체 = (값) => 값 !== null && typeof 값 === 'object' && !Array.isArray(값);
const 한줄 = (값) => String(값).replace(/[\r\n\u2028\u2029]/g, ' ');
const 못잼 = (사유) => ({ 종료코드: 2, 출력: [`확인 불가: ${한줄(사유)}`] });

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
  return 실제;
}

function 명부읽기(뿌리, 명부) {
  let 내용;
  try {
    내용 = fs.readFileSync(실제경로(뿌리, 명부), 'utf8');
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
    if (등록.has(경로)) throw new Error(`${자리}: 같은 경로가 두 번 등록됐다 — ${경로}`);
    등록.set(경로, 항목.갈래);
  }
  return 등록;
}

function 범위찾기(뿌리, 범위) {
  if (!Array.isArray(범위)) throw new Error('범위 배열이 필요하다');
  const 파일들 = new Set();
  for (const 원형 of 범위) {
    const 패턴 = 상대경로(원형, '범위');
    let 후보;
    try { 후보 = fs.globSync(패턴, { cwd: 뿌리 }); }
    catch (_) { throw new Error(`범위를 펼칠 수 없다 — ${원형}`); }
    let 찾은수 = 0;
    for (const 값 of 후보) {
      const 경로 = 상대경로(값, '범위 파일');
      try {
        const 실제 = 실제경로(뿌리, 경로);
        if (fs.statSync(실제).isDirectory()) continue;
        if (!fs.statSync(실제).isFile()) throw new Error('일반 파일이 아니다');
      } catch (_) {
        throw new Error(`범위 파일을 확인할 수 없다 — ${경로}`);
      }
      파일들.add(경로);
      찾은수++;
    }
    if (찾은수 === 0) throw new Error(`범위 패턴에 맞는 파일이 없다 — ${원형}`);
  }
  if (파일들.size === 0) throw new Error('범위 파일이 없다');
  return [...파일들].sort();
}

function 검사({ 루트 = 저장소, 명부 = 기본명부, 범위 = 기본범위 } = {}) {
  try {
    let 뿌리;
    try { 뿌리 = fs.realpathSync(루트); }
    catch (_) { throw new Error('검사 루트를 읽을 수 없다'); }
    const 등록 = 명부읽기(뿌리, 상대경로(명부, '명부'));
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
    출력.push(`범위 파일 ${파일들.length} · 참조 ${참조수} · 등록 소비자 ${등록.size} · 학생·학부모 참조 ${학생학부모수}`);
    return { 종료코드, 출력 };
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
      ? { 종료코드: 0, 출력: ['자가시험 통과: 심은 학생 갈래 참조 1/1을 잡았다.'] }
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
