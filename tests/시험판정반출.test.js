'use strict';
/* [반출] 몽골어 검문 시험의 **판정 파일이 공개 저장소로 나간다** — 거기에 몽골어가 없는지 잰다.
 *
 * ■ 왜 (2026-09-03 · 유호 확정 「깃허브 예약도 세운다」)
 *   시험을 노트북 «밖»(GitHub Actions)에서도 돌리기로 하면서, 두 기계가 같은 몫을 두 번 태우지
 *   않게 «이미 쟀다» 표시를 저장소로 주고받게 됐다(`evals/_판정/<모델>.json`). 그 파일은 **커밋된다.**
 *   그런데 시험 결과 전문에는 몽골어 본문과 모델 답이 그대로 들어 있고 **이 저장소는 PUBLIC 이다.**
 *   그래서 판정에는 «숫자만» 담기로 했는데, 그 약속을 지키는 것이 사람의 주의력뿐이면 언젠가 샌다.
 *
 * ■ 이 파일이 재는 것 넷
 *   ① 판정 객체에 키릴(몽골어 글자)이 **0**  ② 그 자가 **키릴을 찾을 줄 안다**(대조군)
 *   ③ `_결과/`(전문)는 커밋이 «막혀» 있다   ④ `_판정/`(숫자)은 커밋이 «열려» 있다
 *   ②가 없으면 ①의 0 은 「안 샌다」가 아니라 「자가 안 돌았다」일 수 있다 —
 *   09-03 에 실제로 grep 이 유니코드 범위를 거부했는데 화면에는 「키릴 0」이 찍혔다.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const { 의심줄추출 } = require(path.join(ROOT, 'evals', '의심줄.js'));

const 키릴수 = (s) => (String(s).match(/[Ѐ-ӿ]/g) || []).length;

/* 픽스처 — promptfoo 결과의 «모양»만 흉내 낸 최소 벌. 몽골어를 일부러 넣는다:
 * 판정에 그게 안 묻어 나오는 것이 이 시험의 과녁이기 때문이다. */
const 몽골어문장 = 'Та солонгос хэл сурч байна уу?';
const 픽스처 = {
  results: {
    results: [
      {
        provider: { id: 'google:gemini-3.8-flash', label: '3.8 지금쓰는것' },
        testCase: { description: '㉠1 결함이 든 판', vars: { 기대: '어색', 몽골어: 몽골어문장, 근거: '㉠1' } },
        response: { output: JSON.stringify({ 판정: '어색', 이유: `${몽골어문장} 가 어색하다` }) },
        gradingResult: { componentResults: [] },
      },
      {
        provider: { id: 'google:gemini-3.8-flash', label: '3.8 지금쓰는것' },
        testCase: { description: '㉡1 고친 판', vars: { 기대: '정상', 몽골어: 몽골어문장, 근거: '㉡1' } },
        response: { output: JSON.stringify({ 판정: '어색', 이유: `${몽골어문장} 헛경보` }) },
        gradingResult: { componentResults: [] },
      },
    ],
  },
};

/** `돌리기.js` 가 쓰는 것과 **같은 모양**으로 판정을 만든다(그쪽이 바뀌면 여기도 바뀌어야 한다). */
function 판정만들기() {
  const 뽑음 = 의심줄추출(픽스처);
  return {
    모델: 'gemini-3.8-flash', 사고: 'high', 때: new Date().toISOString(), 어디서: '테스트',
    칸수: 뽑음.칸수, 의심줄수: (뽑음.올릴것 || []).length,
    점수: Object.fromEntries([...뽑음.점수.entries()]),
  };
}

test('🔑 판정(커밋되는 파일)에 몽골어가 한 글자도 없다 — 저장소는 PUBLIC 이다', () => {
  const s = JSON.stringify(판정만들기());
  assert.strictEqual(키릴수(s), 0, `판정에 키릴이 섞였다 — 공개 저장소로 몽골어 본문이 나간다:\n${s.slice(0, 300)}`);
});

test('🔑 그 자가 키릴을 «찾을 줄 안다» — 대조군이 없으면 위의 0 은 「안 쟀다」와 구별이 안 된다', () => {
  assert.ok(키릴수(몽골어문장) > 0, '자가 키릴을 못 찾는다 — 앞 시험의 0 은 믿을 수 없다');
  assert.ok(키릴수(JSON.stringify(픽스처)) > 0, '결과 전문에는 키릴이 있어야 한다(픽스처가 과녁을 안 담고 있다)');
});

test('판정은 숫자와 이름만 담는다 — 문항 이름·모델 답·이유가 새어 들어가지 않는다', () => {
  const p = 판정만들기();
  const s = JSON.stringify(p);
  assert.doesNotMatch(s, /이유|헛경보|결함이 든 판|고친 판/, '문항 내용이나 모델의 답이 판정에 실렸다');
  for (const [, v] of Object.entries(p.점수)) {
    for (const k of ['맞음', '틀림', '못잼', '근거흠']) assert.strictEqual(typeof v[k], 'number', `점수 ${k} 가 수가 아니다`);
  }
  assert.strictEqual(typeof p.칸수, 'number');
});

test('🔑 결과 전문(_결과/)은 커밋이 막혀 있고, 판정(_판정/)은 열려 있다', () => {
  const 막히나 = (rel) => {
    try {
      execFileSync('git', ['check-ignore', '-q', '--', rel], { cwd: ROOT, stdio: 'ignore' });
      return true;                       // 종료 0 = 무시된다
    } catch (e) {
      if (e.status === 1) return false;  // 종료 1 = 무시되지 않는다
      throw new Error(`git check-ignore 를 못 돌렸다(${e.status}) — 「막힌다」도 「안 막힌다」도 아니다`);
    }
  };
  assert.ok(막히나('evals/_결과/결과_x.json'), '🔴 결과 전문이 커밋 가능하다 — 몽골어 본문이 공개 저장소로 나간다');
  assert.ok(!막히나('evals/_판정/gemini-x.json'), '판정이 무시되고 있다 — 그러면 두 기계가 같은 시험을 두 번 돌린다');
});

test('🔑 남의 기계 워크플로는 «판정만» 커밋한다 — 전문을 담는 경로를 add 하지 않는다', () => {
  const yml = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'mn-check-eval.yml'), 'utf8');
  assert.match(yml, /git add -- evals\/_판정/, '워크플로가 판정을 커밋하지 않는다');
  assert.doesNotMatch(yml, /git add[^\n]*_결과/, '🔴 워크플로가 결과 전문을 커밋한다 — 몽골어가 공개된다');
  assert.match(yml, /vars\.SYNK_EVAL_GITHUB == 'on'/, '스위치가 없다 — 켜기 전에 도는 워크플로가 된다');
});
