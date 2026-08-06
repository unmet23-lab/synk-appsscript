/**
 * 승인키(tools/승인.js) — 트레일러 파싱과 「승인 소멸」 판정
 *
 * 왜 있나 — 이 도구의 값은 **승인이 스스로 죽는 것**이다. 안 죽으면 도구가 있으나 마나가 아니라
 *   「승인됐다」는 거짓 초록을 하나 더 만드는 것이라 없느니만 못하다.
 *
 * 🔴 실저장소 git 이력에 기대지 않는다 — CI 는 얕은 클론이라 `sha..HEAD` 가 통째로 다르다
 *   (CLAUDE.md: repo 밖 환경에 기대는 검사는 CI에서 깨진다 · git 이력 포함).
 *   그래서 탐지력은 **임시 저장소 픽스처**로 못박는다.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { 트레일러파싱, 소멸판정 } = require('../tools/승인.js');

test('트레일러 파싱 — 세 종류를 잡고, 종류가 아닌 것·산문은 안 잡는다', () => {
  const 본문 = [
    'Approves-semantic: 1234abc 의미 보존 확인',
    'Approves-TECHNICAL: 0d9485aa11bb22cc33dd44ee55ff66aa77bb88cc',
    'Approves-owner: deadbee',
    'Approves-마케팅: 1234abc',              // 종류가 아니다
    'Approves-semantic: 안녕하세요',          // sha 가 아니다
    '`Approves-semantic:` 는 트레일러다',      // 산문 속 백틱 표기
    'Session-Id: 9fa4ede1',
  ].join('\n');

  const 결과 = 트레일러파싱(본문);
  assert.equal(결과.length, 3, '세 종류만 잡혀야 한다');
  assert.deepEqual(결과.map((r) => r.종류), ['semantic', 'technical', 'owner']);
  assert.equal(결과[0].사유, '의미 보존 확인');
  assert.equal(결과[1].사유, '', '사유가 없으면 빈 문자열이지 undefined 가 아니다');
  assert.deepEqual(트레일러파싱(''), []);
  assert.deepEqual(트레일러파싱(undefined), [], '본문 없는 커밋에서 터지지 않는다');
});

test('승인 소멸 — 승인 뒤 같은 경로가 바뀌면 죽고, 안 바뀌면 산다', () => {
  const 원래 = process.cwd();
  const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-승인-'));
  const g = (...a) => execFileSync('git', a, { cwd: 임시, encoding: 'utf8' }).trim();
  try {
    g('init', '-q', '-b', 'main');
    g('config', 'user.email', 't@t'); g('config', 'user.name', 't');
    g('config', 'commit.gpgsign', 'false');

    // 🔑 파일명이 **한글**인 것은 우연이 아니다 — quotepath 기본값이면 `git show --name-only` 가
    //    경로를 이스케이프해 돌려주고, 그 문자열로는 `git log -- <경로>` 가 아무것도 못 찾아
    //    **모든 승인이 조용히 「유효」가 된다.** 이 픽스처가 실제로 그 결함을 잡았다(2026-08-06).
    //    ASCII 이름으로 바꾸면 이 검사는 통과하면서 탐지력만 사라진다.
    // 승인 대상 커밋은 `계약.md` **하나만** 만진다 — 승인이 묶이는 범위가 그 경로뿐임을 재려면
    // 대상 커밋에 다른 파일이 섞이면 안 된다(섞이면 ②가 무엇을 쟀는지 알 수 없다).
    fs.writeFileSync(path.join(임시, '계약.md'), 'v1');
    g('add', '계약.md'); g('commit', '-q', '-m', '계약 v1');
    const 승인대상 = g('rev-parse', 'HEAD');

    // ① 아직 아무것도 안 바뀌었다 → 유효
    process.chdir(임시);
    assert.equal(소멸판정(승인대상, 'zzz').상태, '유효');

    // ② 승인 범위 밖 파일만 바뀌었다 → 여전히 유효 (거짓 경보를 내는 가드는 곧 꺼진다)
    fs.writeFileSync(path.join(임시, '무관.md'), 'x');
    g('add', '무관.md'); g('commit', '-q', '-m', '무관 추가');
    assert.equal(소멸판정(승인대상, 'zzz').상태, '유효', '범위 밖 변경으로 승인이 죽으면 거짓 경보가 된다');

    // ③ 승인한 그 파일이 바뀌었다 → 소멸
    fs.writeFileSync(path.join(임시, '계약.md'), 'v2');
    g('add', '계약.md'); g('commit', '-q', '-m', '계약 v2');
    const 판정 = 소멸판정(승인대상, 'zzz');
    assert.equal(판정.상태, '소멸', '승인 뒤 대상 파일이 바뀌었는데 살아 있으면 이 도구는 거짓 초록이다');
    assert.match(판정.사유, /1회/);

    // ④ 없는 커밋은 「유효」가 아니라 「불명」이다 (모름이 통과가 되면 안 된다)
    assert.equal(소멸판정('0'.repeat(40), 'zzz').상태, '불명');
  } finally {
    process.chdir(원래);
    fs.rmSync(임시, { recursive: true, force: true });
  }
});
