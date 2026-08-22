'use strict';
/**
 * `GRAMMAR_BANK` · `LEVEL_TOPIK_BAND` 를 엔진 소스에서 **값으로** 꺼내는 유일한 통로.
 *
 * ■ 왜 통로가 하나여야 하나
 *   Apps Script 는 JSON 을 import 못 해 뱅크는 **소스 안 배열 리터럴**로만 존재한다
 *   (`tests/계약.test.js(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다)` 의 SCHEMA_VER 절이 적어 둔 같은 제약). 그래서 값을 쓰려는 쪽은
 *   전부 소스를 잘라 `new Function` 으로 편다 — 그 자르는 규칙이 두 곳에 적히는 순간
 *   한쪽만 낡고, **낡은 쪽은 「표식을 못 찾음」이 아니라 「엉뚱한 구간을 조용히 통과」로 샌다**
 *   (`tests/_engine-source.js` 머리말이 실측한 그 실패 모양). 회귀와 생성기가 같은 자를
 *   쓰게 두는 것이 이 파일의 전부다.
 *
 * ■ 기본 읽기 대상은 `엔진_콘텐츠AI.js` 하나다 — 못 찾으면 **던진다**
 *   회귀는 엔진 전량(`engineSource()`)을 넘겨 받으므로 파일이 쪼개져도 산다. 생성기는
 *   자기가 이름 댄 파일만 본다 — 뱅크가 다른 파일로 옮겨 가면 **소리 내며 죽는 것**이
 *   맞다(조용히 빈 계약을 뱉으면 형제 저장소가 그 빈 값을 정본으로 믿는다).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const 엔진파일 = '엔진_콘텐츠AI.js';

/* 끝 표식은 주석 문구가 아니라 **코드 심볼**로 잡는다 — 문구 앵커는 그 문구를 다듬는
 * 순간 죽는다(`tests/문법급수.test.js(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다)` 가 먼저 적어 둔 규칙 · 여기가 그 규칙의 집이다). */
const 시작표식 = 'const GRAMMAR_BANK = [';
const 끝표식 = 'function grammarStageOf_';

/**
 * @param {string} [소스] 엔진 소스 전문. 없으면 `엔진_콘텐츠AI.js` 를 읽는다.
 * @returns {{GRAMMAR_BANK: any[][], LEVEL_TOPIK_BAND: Record<string, number[]>}}
 */
function 뱅크읽기(소스) {
  const code = 소스 != null ? String(소스) : fs.readFileSync(path.join(ROOT, 엔진파일), 'utf8');
  const s = code.indexOf(시작표식);
  if (s === -1) throw new Error(`GRAMMAR_BANK 선언을 못 찾았다(${엔진파일}) — 상수명이 바뀌었으면 tools/lib/문법뱅크.js 부터 고쳐라`);
  const e = code.indexOf(끝표식, s);
  if (e === -1) throw new Error(`GRAMMAR_BANK 블록 끝 표식(${끝표식})을 못 찾았다 — 뱅크와 게이트 사이에 다른 것이 끼었는지 본다`);
  return new Function(`${code.slice(s, e)}\n return { GRAMMAR_BANK, LEVEL_TOPIK_BAND };`)();
}

module.exports = { ROOT, 엔진파일, 시작표식, 끝표식, 뱅크읽기 };
