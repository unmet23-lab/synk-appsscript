#!/usr/bin/env node
'use strict';
/**
 * 절차 가드 10개를 미개원 동안 안 돌게 한다 (유호 확정 2026-08-19).
 *
 * 왜: 마찰 F608~F642 스무 건이 전부 「장치 자신의 결함」이었고, 가드가 실제로 막은 사고를
 *     세는 장부(docs/_ops/게이트장부.jsonl(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다))에는 08-15 자기 시험 6줄뿐이다. 학생 0명인 동안
 *     절차 가드가 내는 값은 마찰뿐이라, 되돌림 비용이 학생 수와 무관한 셋만 남기고 재운다.
 *
 * 어떻게: 등록도 파일도 안 건드리고, 각 훅 명령 앞에 스위치 한 조각만 끼운다 —
 *     `.claude/개원.json` 이 없으면 그 훅은 즉시 종료한다(exit 0 = 통과).
 *     · 등록을 빼지 않는 이유: tests/훅등록.test.js(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다) 가 「파일이 있는데 등록이 없으면 fail」을 강제한다.
 *     · 파일을 지우지 않는 이유: 되켜야 하고, 삭제는 비가역 승인 게이트를 지나야 한다.
 *     · stdin 을 읽은 **뒤**에 끼우는 이유: 앞에 두면 하네스가 쓰는 도중 파이프가 깨진다.
 *
 * 되켜기: 저장소 루트에 `.claude/개원.json` 을 만들면 그 순간 10개가 전부 되돌아온다.
 *         (`node tools/가드강등.js --개원` 이 그 파일을 만든다)
 *         스위치를 명령에서 아예 빼려면 `--되돌리기`.
 *
 * ⚠ 틀릴 때의 모습: 개원했는데 `.claude/개원.json` 을 안 만들면, 가드 10개가 **꺼진 채로 정상
 *   얼굴을 한다** — 학생이 온 뒤 첫 주에 이 파일부터 확인한다. 그래서 --상태 를 뒀다.
 */

const fs = require('fs');
const path = require('path');
const { 인자게이트 } = require('./lib/인자게이트.js');

/* 🔴 뿌리는 **이 스크립트가 사는 체크아웃**이다 — `CLAUDE_PROJECT_DIR` 을 앞에 두지 않는다.
 *   [08-26 실측] 워크트리 세션에서 그 env 는 워크트리를 가리키는데 스크립트는 다른 트리의 것일 수
 *   있어, 「어느 체크아웃이 정본인가」가 호출 방식마다 갈렸다. 자리를 아는 것은 스크립트 자신이다
 *   (`tools/인용검사.js:43`·`tools/대장동봉검사.js:36` 이 이미 쓰는 규약). */
const 루트 = path.resolve(__dirname, '..');
const 설정경로 = path.join(루트, '.claude', 'settings.json');
const 개원경로 = path.join(루트, '.claude', '개원.json');

/* 안 건드리는 셋 — 되돌림 비용이 학생 수와 무관하다.
 *   clasp-guard(라이브 배포) · git-scope-guard(커밋 범위·데이터 파괴) · credential-guard(자격증명) */
const 대상 = [
  'shell-inline-guard', 'code-edit-guard', 'board-guard', 'track-collision',
  'memory-index-guard', 'screenshot-budget', 'read-budget', 'voice-guard',
  'design-guard', 'memory-status-guard',
];

const 접두 = '"command": "IFS= read -r -d \'\' IN || true; ';
const 스위치 = '[ -f \\"${CLAUDE_PROJECT_DIR:-$PWD}/.claude/개원.json\\" ] || exit 0; ';

function 읽기() {
  if (!fs.existsSync(설정경로)) {
    console.error(`settings.json 을 못 찾았다: ${설정경로}`);
    console.error('저장소 루트에서 돌리거나 CLAUDE_PROJECT_DIR 를 지정한다.');
    process.exit(1);
  }
  return fs.readFileSync(설정경로, 'utf8');
}

/* 쓰기 전에 반드시 파싱한다 — 문법이 깨지면 훅 전체가 죽고, 그건 조용히 죽는다. */
function 검사후쓰기(새문) {
  try {
    JSON.parse(새문);
  } catch (e) {
    console.error(`JSON 이 깨졌다 — 쓰지 않았다: ${e.message}`);
    process.exit(1);
  }
  fs.writeFileSync(설정경로, 새문, 'utf8');
}

function 적용() {
  const 원문 = 읽기();
  if (원문.includes(스위치)) {
    console.log('이미 적용돼 있다 — 아무것도 안 했다.');
    상태();
    return;
  }

  const 줄들 = 원문.split('\n');
  const 바꾼것 = [];
  줄들.forEach((줄, i) => {
    if (!줄.includes(접두)) return;
    const 맞는것 = 대상.find((t) => 줄.includes(`/hooks/${t}.js`));
    if (!맞는것) return;
    줄들[i] = 줄.replace(접두, 접두 + 스위치);
    바꾼것.push(맞는것);
  });

  /* 하나라도 못 찾으면 쓰지 않는다 — 부분 적용은 「일부만 꺼진」 상태를 만들고,
   * 그건 전부 켜진 것도 전부 꺼진 것도 아니라 나중에 아무도 못 읽는다. */
  const 빠진것 = 대상.filter((t) => !바꾼것.includes(t));
  if (빠진것.length) {
    console.error(`대상인데 명령을 못 찾은 훅 — 쓰지 않았다: ${빠진것.join(', ')}`);
    console.error('settings.json 의 명령 형태가 바뀌었을 수 있다. 직접 확인한다.');
    process.exit(1);
  }

  검사후쓰기(줄들.join('\n'));
  console.log(`스위치 삽입 ${바꾼것.length}개:`);
  바꾼것.forEach((t) => console.log(`  · ${t}`));
  console.log('\n이제 이 10개는 안 돈다. 안 건드린 셋은 그대로 막는다:');
  console.log('  · clasp-guard(라이브 배포) · git-scope-guard(커밋 범위) · credential-guard(자격증명)');
}

function 되돌리기() {
  const 원문 = 읽기();
  if (!원문.includes(스위치)) {
    console.log('적용된 적이 없다 — 아무것도 안 했다.');
    return;
  }
  const 샌수 = 원문.split(스위치).length - 1;
  검사후쓰기(원문.split(스위치).join(''));
  console.log(`스위치 제거 ${샌수}개 — 가드가 전부 원래대로 막는다.`);
}

function 개원() {
  if (fs.existsSync(개원경로)) {
    console.log(`이미 있다: ${개원경로}`);
    return;
  }
  fs.writeFileSync(개원경로, JSON.stringify({
    적은날: new Date().toISOString().slice(0, 10),
    뜻: '개원했다 — 절차 가드 10개를 다시 켠다. 이 파일을 지우면 도로 잠든다.',
  }, null, 2) + '\n', 'utf8');
  console.log(`만들었다: ${개원경로}\n가드 10개가 이 순간부터 다시 막는다.`);
}

function 상태() {
  const 원문 = 읽기();
  const 적용됨 = 원문.includes(스위치);
  const 갯수 = 적용됨 ? 원문.split(스위치).length - 1 : 0;
  const 개원됨 = fs.existsSync(개원경로);

  console.log(`스위치   : ${적용됨 ? `삽입됨 (${갯수}개)` : '없음'}`);
  console.log(`개원.json: ${개원됨 ? '있음' : '없음'}`);
  console.log(`→ 절차 가드 10개는 지금 ${적용됨 && !개원됨 ? '**안 돈다**' : '돈다'}`);
  console.log('→ 안전 가드 셋(배포·커밋범위·자격증명)은 언제나 돈다');
}

/* 🔴 인자 게이트 — 모르는 낱말은 **공용 판정**으로 거절한다. 손으로 쓴 판정은 `--키=값`·`--` 종결자
 *   에서 갈라진다. 🔑 이 도구는 그 사각의 급소다: 오타 하나가 「재웠다」와 「안 재웠다」를 가르는데
 *   **둘 다 조용하다.** 손 판정은 `process.argv[2]` 하나만 봐서 `--상태 --개원` 처럼 둘을 주면 뒤를
 *   통째로 삼켰다 — 이 도구가 되돌리는 것은 가드 10개의 발동 여부라, 안 되돌아간 것을 되돌아갔다고
 *   읽으면 **가드가 죽은 채 초록**이 된다(새는 방향이 언제나 「통과」인 그 형태 · 등록층 ③).
 *   ⚠ 틀릴 때의 모습 = **거짓양성** — 아는 낱말을 빠뜨리면 되던 명령이 죽고, 그건 따를 수 없는
 *     처방이 된다(F103). 그래서 목록을 분기문 **바로 위**에 두어 한 자리에서 같이 고치게 한다.
 *   회귀: `tests/도구인자게이트.test.js(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다)`. (`인자게이트` 는 파일 머리에서 한 번만 부른다) */
const 아는플래그 = ['--상태', '--개원', '--되돌리기'];
const 인자들 = process.argv.slice(2);

const 플래그오류 = 인자게이트('가드강등', 인자들, 아는플래그);
if (플래그오류) {
  console.error(`\n🔴 ${플래그오류}`);
  console.error('   ▶ 낱말 없이 부르면 «적용»이다 — 오타면 재운 줄 알고 안 재워진다.\n');
  process.exit(1);
}

/* 🔑 게이트는 «모르는» 낱말만 본다 — 아는 낱말을 **둘** 준 자리는 여기가 진다.
 *   `--상태 --개원` 은 게이트를 통과하는데 `인자들[0]` 만 실행돼 뒤가 그대로 삼켜진다.
 *   이 도구는 상태를 바꾸므로 「둘 중 어느 쪽을 시킨 것인지」가 애매한 채로 실행하면 안 된다. */
if (인자들.length > 1) {
  console.error(`한 번에 하나만 받는다 — 받은 것: ${인자들.join(' ')}`);
  console.error('쓰는 법: node tools/가드강등.js [--상태|--개원|--되돌리기]');
  process.exit(1);
}

const 인자 = 인자들[0];
if (인자 === '--되돌리기') 되돌리기();
else if (인자 === '--개원') 개원();
else if (인자 === '--상태') 상태();
else if (!인자) 적용();
else {
  /* `--` 로 시작하지 않는 위치 인자 — 게이트가 안 보는 갈래라 여기가 진다.
   *   `적용()` 으로 흘려보내면 오타 한 번이 **말 없이 10개를 재우는** 실행이 된다. */
  console.error(`모르는 인자: ${인자}`);
  console.error('쓰는 법: node tools/가드강등.js [--상태|--개원|--되돌리기]');
  process.exit(1);
}
