'use strict';
/* 이어하기 꾸러미 회귀 — 2026-09-05
 *
 * 무엇을 지키나: **자격증명이 클라우드 사본으로 새지 않는가.**
 *   이 도구는 저장소 파일을 원드라이브·구글드라이브로 복사한다. 두 곳 다 «남과 공유할 수 있는»
 *   자리이고, 한 번 올라간 것은 동기화가 여러 기기로 퍼뜨린다 — 되돌릴 수 없다.
 *   지금은 `git ls-files` 만 담아서 안전하지만, 담을 목록이 넓어지는 날(깃 밖 파일을 더하는 날)
 *   그 안전은 사라진다. 그때 «가드가 이미 서 있어야» 한다.
 *
 * 🔴 왜 «금지 목록»이 아니라 «가드 함수»를 재나: 목록을 재면 목록이 자기를 지킬 뿐이다.
 *   여기서 재는 것은 「이 이름을 넣었을 때 실제로 막히는가」다 — 자가 결함을 지키지 못하게.
 *   (기억 `test-guards-the-defect` 의 09-03 사고와 같은 통로)
 */
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const { 금지인가, 문서인가 } = require(path.join(__dirname, '..', 'tools', '이어하기꾸러미.js'));

test('자격증명 무늬는 담을 목록에 못 든다', () => {
  const 막혀야하는것 = [
    'SYNK_보안/로그인.txt',
    'C:\\Users\\q1212\\SYNK_보안\\제미나이.txt',
    'docs/로그인.txt',
    'tools/비밀번호모음.md',
    'config/password.json',
    'PASSWORD.txt',
    '.env',
    '.env.local',
    'apps/.clasprc.json',
    'secrets/api.json',
    '구글_백업코드_unmet23.txt',
  ];
  for (const p of 막혀야하는것) {
    assert.equal(금지인가(p), true, `막혔어야 한다: ${p}`);
  }
});

test('보통 파일은 안 막힌다 — 가드가 넓어져 꾸러미를 비우지 않는다', () => {
  const 통과해야하는것 = [
    'docs/_ops/결정.md',
    'docs/_ops/트랙.md',
    'Code.js',
    'docs/캐릭터/정본_4K/몽글_본체.png',
    'docs/디자인_토큰.json',
    'tools/이어하기꾸러미.js',
    'docs/환경설정_안내.md',     // '환경'·'설정' 이 들어가도 자격증명이 아니다
    'docs/발음데이터_규격.md',
  ];
  for (const p of 통과해야하는것) {
    assert.equal(금지인가(p), false, `통과했어야 한다: ${p}`);
  }
});

test('글과 자산을 가르는 자 — 원드라이브에 무엇이 가는지를 정한다', () => {
  // 글(원드라이브+구글 양쪽)
  assert.equal(문서인가('docs/_ops/결정.md'), true);
  assert.equal(문서인가('CLAUDE.md'), true);
  assert.equal(문서인가('docs/디자인_토큰.json'), true);
  assert.equal(문서인가('docs/_ops/검수기록.jsonl'), true);   // _ops 아래는 꼴을 안 가린다
  // 자산(구글만)
  assert.equal(문서인가('docs/캐릭터/정본_4K/몽글_본체.png'), false);
  assert.equal(문서인가('Code.js'), false);
  assert.equal(문서인가('package.json'), false);              // 저장소 뿌리 json 은 글이 아니다
});
