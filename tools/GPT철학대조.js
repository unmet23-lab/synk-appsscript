#!/usr/bin/env node
'use strict';

// 블록 생성 여부가 아니라, 기존 조립 경로가 실제로 만든 프롬프트를 잰다.
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const 런 = require('./lib/검수런.js');

const ROOT = path.resolve(__dirname, '..');
const 발주경로 = path.join(ROOT, 'docs', '_ops', '발주', 'GPT철학대조.md');
const 역할정의 = [
  ['실행자', '자식프로세스'],
  ['발주검토자', '자식프로세스'],
  ['검수자', '함수호출'],
  ['심문자', '함수호출'],
];

function 한줄(오류) {
  return String(오류?.message || 오류 || '까닭을 알 수 없다')
    .split(/\r?\n/).find((줄) => 줄.trim())?.trim().slice(0, 300) || '까닭을 알 수 없다';
}

function 잰역할(이름, 잰법, 글자수) {
  return { 이름, 글자수, 실렸나: 글자수 > 0, 잰법, 쟀나: true };
}

function 못잰역할(이름, 잰법, 까닭) {
  return { 이름, 글자수: null, 실렸나: null, 잰법, 쟀나: false, 까닭: 한줄(까닭) };
}

function 집계(역할들, 검수경로들 = [], 반쪽 = false) {
  const 모두쟀나 = 역할들.every((역할) => 역할.쟀나);
  const 모두실렸나 = 모두쟀나 && !반쪽 && 역할들.every((역할) => 역할.실렸나);
  return {
    결과: { 역할들, 모두실렸나, 모두쟀나 },
    종료코드: !모두쟀나 ? 2 : 모두실렸나 ? 0 : 1,
    검수경로들,
    반쪽,
  };
}

function 실행쪽측정(기대글자수) {
  const 못잼 = (까닭) => 역할정의.slice(0, 2).map(([이름, 잰법]) => 못잰역할(이름, 잰법, 까닭));
  let 자식;
  try {
    // 두 역할을 한 번에 재는 읽기 전용 통로. 셸·모델·워크트리 생성은 호출하지 않는다.
    // 조립 예외가 나도 자식의 마감이 부모 런 상태를 덮지 않도록 격리한다.
    자식 = spawnSync(process.execPath, [
      path.join(__dirname, 'codex-build.js'), '--발주', 발주경로, '--프롬프트확인',
    ], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024, env: 런.자식환경() });
  } catch (오류) {
    return 못잼(`자식 프로세스 실행 실패: ${한줄(오류)}`);
  }
  if (자식.error) return 못잼(`자식 프로세스 실행 실패: ${한줄(자식.error)}`);
  if (자식.signal || 자식.status === null) return 못잼(`자식 프로세스가 중단됐다: ${자식.signal || '종료코드 없음'}`);

  // 일반 안내의 숫자는 읽지 않는다. 두 측정행이 모두 있어야 이 통로를 쟀다고 한다.
  const 행들 = [...(자식.stdout || '').matchAll(
    /^\s*(실행자|발주검토자)\s+프롬프트\s+[\d,]+자\s*·\s*판단 정본\s+([\d,]+)자\s*[✅❌]\s*$/gm,
  )];
  const 역할들 = [];
  for (const [이름, 잰법] of 역할정의.slice(0, 2)) {
    const 해당행 = 행들.filter((행) => 행[1] === 이름);
    if (해당행.length !== 1) return 못잼(`${이름} 측정행을 하나로 확인하지 못했다 (자식 종료코드 ${자식.status})`);
    const 숫자 = 해당행[0][2];
    const 글자수 = Number(숫자.replace(/,/g, ''));
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(숫자) || !Number.isSafeInteger(글자수)) {
      return 못잼(`${이름} 측정행의 글자수를 읽지 못했다 (자식 종료코드 ${자식.status})`);
    }
    const 역할 = 잰역할(이름, 잰법, 글자수);
    // 일부만 도착한 것도 0자보다 크다. 완전한 원문에서 뽑은 길이와 같아야 전달 성공이다.
    if (글자수 !== 기대글자수) 역할.실렸나 = false;
    역할들.push(역할);
  }
  // 자식의 종료 1은 정상적으로 0자를 잰 결과일 수 있다. 판정은 측정행으로 한다.
  return 역할들;
}

function 게이트없음(오류) {
  return /^판단 정본에서 게이트를 못 뽑았다(?:\s|:|$)/.test(한줄(오류));
}

function 프롬프트측정(이름, 본문, 호출) {
  try {
    const 프롬프트 = 호출();
    if (typeof 프롬프트 !== 'string') throw new TypeError('조립 결과가 프롬프트 문자열이 아니다');
    return 잰역할(이름, '함수호출', 본문 && 프롬프트.includes(본문) ? 본문.length : 0);
  } catch (오류) {
    return 게이트없음(오류)
      ? 잰역할(이름, '함수호출', 0)
      : 못잰역할(이름, '함수호출', 오류);
  }
}

function 대조() {
  let 검수;
  let 본문;
  try {
    검수 = require('./codex-review.js');
    본문 = 검수.철학텍스트();
    if (typeof 본문 !== 'string') throw new TypeError('철학텍스트 결과가 문자열이 아니다');
  } catch (오류) {
    return 집계(역할정의.map(([이름, 잰법]) => 게이트없음(오류)
      ? 잰역할(이름, 잰법, 0)
      : 못잰역할(이름, 잰법, `판단 정본 측정 준비 실패: ${한줄(오류)}`)));
  }
  // 정본을 못 읽거나 게이트가 전부 비면, 담길 본문 자체가 없으므로 네 역할 모두 0자다.
  if (!본문) return 집계(역할정의.map(([이름, 잰법]) => 잰역할(이름, 잰법, 0)));

  const 역할들 = 실행쪽측정(본문.length);
  const 검수경로들 = [
    프롬프트측정('제안', 본문, () => 검수.제안프롬프트조립('diff --git a/x b/x', [])),
    프롬프트측정('기능체크', 본문, () => 검수.기능체크프롬프트조립(
      'diff --git a/x b/x', [], 검수.기능렌즈(1), { 줄들: [] },
    )),
  ];
  const 못잰경로 = 검수경로들.filter((경로) => !경로.쟀나);
  역할들.push(못잰경로.length
    ? 못잰역할('검수자', '함수호출', 못잰경로.map((경로) => `${경로.이름}: ${경로.까닭}`).join(' · '))
    : 잰역할('검수자', '함수호출', 검수경로들.every((경로) => 경로.실렸나) ? 본문.length : 0));
  역할들.push(프롬프트측정('심문자', 본문, () => 검수.심문프롬프트(
    발주경로, undefined, undefined, 검수.철학경로,
  )));
  return 집계(역할들, 검수경로들, 본문.includes('이 게이트는 **반쪽이다**'));
}

function 표(측정) {
  const { 결과, 검수경로들, 반쪽 } = 측정;
  const 줄들 = [결과.모두쟀나
    ? '판단 정본이 GPT 역할에 실리나 — docs/SYNK_철학.md'
    : '확인 불가 — 재지 못한 역할이 있다 (docs/SYNK_철학.md)'];
  for (const 역할 of 결과.역할들) {
    const 수 = 역할.쟀나 ? `${역할.글자수.toLocaleString('ko-KR')}자` : '미측정';
    const 표시 = !역할.쟀나 ? '?' : 역할.실렸나 ? '✅' : '❌';
    const 경로표 = 역할.이름 === '검수자' && 검수경로들.length
      ? ' · ' + 검수경로들.map((경로) => `${경로.이름}${!경로.쟀나 ? '?' : 경로.실렸나 ? '✅' : '❌'}`).join(' ')
      : '';
    줄들.push(`  ${역할.이름.padEnd(8)} ${수.padStart(8)}  ${표시}  (${역할.잰법}${경로표})${역할.쟀나 ? '' : ` — ${역할.까닭}`}`);
  }
  if (반쪽) 줄들.push('⚠ 게이트가 반쪽이다');
  const 누락 = 결과.역할들.filter((역할) => 역할.쟀나 && !역할.실렸나);
  if (누락.length) 줄들.push(`🔴 판단 정본이 안 실리는 역할: ${누락.map((역할) => 역할.이름).join(' · ')}`);
  if (!결과.모두쟀나) 줄들.push('🔴 재지 못한 역할이 있어 전체 판정을 완료하지 못했다.');
  if (결과.모두실렸나) 줄들.push('넷 다 실렸다 (4/4).');
  return 줄들.join('\n');
}

function main(argv = process.argv.slice(2)) {
  const 모르는인자 = argv.filter((인자) => 인자 !== '--json');
  const 측정 = 모르는인자.length
    ? 집계(역할정의.map(([이름, 잰법]) => 못잰역할(이름, 잰법, '지원하지 않는 인자다. 사용법: node tools/GPT철학대조.js [--json]')))
    : 대조();
  if (argv.includes('--json')) {
    console.log(JSON.stringify(측정.결과));
    // stdout은 JSON 하나만 유지한다. 경로별 누락과 반쪽 경고는 stderr로도 식별할 수 있다.
    const 빠진경로 = 측정.검수경로들.filter((경로) => 경로.쟀나 && !경로.실렸나);
    if (빠진경로.length) console.error(`🔴 검수자 판단 정본 누락 경로: ${빠진경로.map((경로) => 경로.이름).join(' · ')}`);
    if (측정.반쪽) console.error('⚠ 게이트가 반쪽이다');
  } else {
    console.log(표(측정));
  }
  return 측정.종료코드;
}

module.exports = { 대조, main };
if (require.main === module) process.exitCode = main();
