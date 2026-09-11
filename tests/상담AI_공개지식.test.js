'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ROOT } = require('./_engine-source');

function 지식로드() {
  const ctx = { console };
  vm.createContext(ctx);
  const 지식 = fs.readFileSync(path.join(ROOT, 'contents_상담AI.js'), 'utf8');
  const 엔진 = fs.readFileSync(path.join(ROOT, '상담AI.js'), 'utf8');
  new vm.Script(지식 + '\nthis.__지식=상담_지식;this.__금칙=상담_금칙;this.__공개=상담_봇공개;this.__인계=상담_인계문;').runInContext(ctx);
  new vm.Script(엔진).runInContext(ctx);
  return ctx;
}

test('공개 상담 지식은 확정 전 날짜·정원·가격을 약속하지 않는다', () => {
  const ctx = 지식로드();
  const 공개지식 = ctx.__지식.filter(x => x.확정).map(x => x.내용).join('\n');
  assert.doesNotMatch(공개지식, /2027년\s*2월\s*(11|25)일|정원\s*16명|월\s*42만/);
  assert.equal(ctx.__지식.find(x => x.주제 === '수강료').확정, false);
  assert.match(ctx.__지식.find(x => x.주제 === '개원 시기').내용, /준비하고 있습니다/);
  assert.match(ctx.__지식.find(x => x.주제 === '정원과 소그룹').내용, /확정된 뒤/);

  const 운영FAQ = fs.readFileSync(path.join(ROOT, 'docs', '자주묻는질문_정본.md'), 'utf8');
  const 대외FAQ = fs.readFileSync(path.join(ROOT, 'docs', '정본', 'SYNK', 'SYNK FAQ.txt'), 'utf8');
  assert.match(운영FAQ, /2026-09-11 공개 상담 기준/);
  assert.match(대외FAQ, /확정되는 대로 공식 홈페이지와 @synk\.mn/);
  assert.doesNotMatch(대외FAQ, /2027년\s*2월\s*(11|25)일|월\s*42만|정원은\s*16명/);
});

test('상담 요청은 개인정보를 먼저 요구하지 않고 같은 대화창으로 인계한다', () => {
  const ctx = 지식로드();
  const 시스템 = ctx.상담_시스템_();
  assert.match(시스템, /같은 대화창/);
  assert.match(시스템, /먼저 (요구|묻)지 않는다/);
  assert.doesNotMatch(시스템, /이름과 연락처를 정중히/);
  assert.match(ctx.__공개 + '\n' + ctx.__인계, /선생님|багш/);
});

test('자체 관리 Instagram 계정은 고급 액세스를 선행조건으로 말하지 않는다', () => {
  const src = fs.readFileSync(path.join(ROOT, '상담AI.js'), 'utf8');
  const 연결점검 = src.slice(src.indexOf('function 상담AI_연결경고_'), src.indexOf('// 실측 비용 집계'));
  assert.match(연결점검, /Standard Access/);
  assert.doesNotMatch(연결점검, /고급 액세스 승인 뒤/);
});

test('Claude 비정상 응답의 자유문장을 상담로그로 옮기지 않는다', () => {
  const src = fs.readFileSync(path.join(ROOT, '상담AI.js'), 'utf8');
  const 호출 = src.slice(src.indexOf('function 상담_호출_'), src.indexOf('// 시스템 프롬프트 조립'));
  const 비200 = 호출.slice(호출.indexOf('if (res.getResponseCode() !== 200)'), 호출.indexOf('const j = JSON.parse'));
  assert.match(비200, /Claude HTTP/);
  assert.doesNotMatch(비200, /getContentText/);
});
