'use strict';
/* 인쇄본은 저장소 «밖»에 산다 — 「낡았나」가 아니라 **「있나」**를 잰다.
 *   (유호 픽 2026-08-17 「ㄷ,ㄹ,ㅁ」 = 회귀 + 분모 축소 + 저장소에서 제거 · 장부 F563)
 *
 * ■ 왜 과녁이 「낡았나」가 아닌가 — 셋을 겹치니 그쪽이 스스로 사라졌다
 *   처음 설계는 「PDF 커밋시각 < 정본 커밋시각이면 빨간불」이었다. 그런데 같은 판정에서
 *   PDF 를 저장소에서 빼기로 했으므로, **낡을 대상 자체가 없다.** 증상을 재던 검사를
 *   불변식을 지키는 검사로 바꾼다 — 「PDF 가 다시 추적되면 빨간불」. 더 강하다:
 *   낡은 PDF 는 낡은 뒤에야 잡히지만, 이건 **낡을 수 있게 되는 순간** 잡는다.
 *
 * ■ 🔴 이 검사가 존재하는 실측 근거 (2026-08-17)
 *   인쇄본 16벌 중 **9벌이 정본보다 낡아 있었다.** 굽는 도구(`tools/인쇄본빌드.js`)는
 *   완성돼 있었는데 **부르는 자리가 훅·CI·테스트 어디에도 0** 이었다. 즉 「사람이 부르면
 *   갱신되는 사본」이었고, 그런 손잡이는 안 부르면 낡는다(철학 «하지 않는 것» ㉡).
 *   그리고 낡았다는 사실은 **아무 데도 안 빨갰다** — 바탕화면 `_지금상태` 는 「🔴3」이라
 *   말했는데 그건 «바탕화면에 닿은 것»만 센 분모였다(0은 분모와 함께 쓴다 · 유호 확정 08-14).
 *
 * ■ 이 검사의 대가 (새 장치엔 대가를 함께 적는다 — CLAUDE.md 신뢰성)
 *   · 틀릴 때의 모습 = **거짓 적색** 쪽이다. 누군가 인쇄본을 일부러 추적하려 하면 빨개진다.
 *     그 방향은 눈에 보이므로 안전한 쪽이고, 처방은 「왜 추적해야 하는지」를 여기 적는 것이다.
 *   · 닫는 것 1개 = 「인쇄본이 정본보다 낡지 않았나」를 **사람이 기억해서** 보던 자리.
 *     08-09부터 08-17까지 아무도 안 봤고 9벌이 쌓였다. 그 기억을 기계가 대신 진다.
 *
 * ■ ⚠ 이 검사가 «안» 지는 것
 *   git 밖에 실제로 구워진 PDF 가 낡는 것은 못 본다 — 그건 원리적으로 못 잡고, 잡을 필요도 없다.
 *   굽는 순간이 곧 최신이고, 안 구우면 파일 자체가 없다. **없는 것은 낡을 수 없다.**
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const 대상 = 'docs/인쇄본';

/** 추적 목록 → 위반 목록. **순수 함수**라 실저장소가 깨끗해도 탐지력을 값으로 잴 수 있다
 *  (실저장소 초록만으로는 탐지력 0인 검사와 구분이 안 된다 — CLAUDE.md 신뢰성 맹점 ②). */
function 위반들(추적목록) {
  return (추적목록 || []).map((s) => String(s).trim()).filter((s) => s.startsWith(대상 + '/'));
}

/** repo 밖 환경(git 없음·저장소 아님)에서는 **fail 이 아니라 skip** 으로 드러낸다(F296). */
function git(인자) {
  return execFileSync('git', 인자, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
}

test('🔴 탐지력 — 추적된 인쇄본이 있으면 잡는다 (버그가 아직 있을 것을 요구하지 않는다)', () => {
  assert.deepEqual(위반들(['docs/인쇄본/SYNK_철학.pdf']), ['docs/인쇄본/SYNK_철학.pdf'],
    '추적된 PDF 를 못 잡으면 이 검사는 영원히 초록이다');
  assert.deepEqual(위반들(['docs/제품방향.md', '', 'docs/인쇄본_설계.md']), [],
    '엉뚱한 경로를 잡으면 거짓양성이 검사를 통째로 죽인다(`인쇄본_설계.md` 는 폴더가 아니다)');
});

test('인쇄본 PDF 는 git 이 추적하지 않는다 — 추적되는 순간 «낡을 수 있게» 된다', (t) => {
  let out;
  try { out = git(['ls-files', '--', 대상]); }
  catch (e) { return void t.skip('git 을 못 돌렸다 — 미실행이지 통과가 아니다: ' + (e.message || e)); }
  const 위반 = 위반들(out.split('\n'));
  assert.deepEqual(위반, [],
    `인쇄본이 다시 추적되고 있다(${위반.length}벌). 굽는 것은 생성물이라 git 밖에 둔다 — `
    + '정본이 바뀌면 사본은 낡고, 낡은 사본이 유호님 화면에 간다(F563 실측 9벌). '
    + '정말 추적해야 하면 `.gitignore` 의 그 절에 «왜»를 적고 이 검사에 예외를 둔다.');
});

test('`.gitignore` 가 실제로 막는다 — 규칙이 «적혀 있다»와 «먹는다»는 다르다', (t) => {
  try {
    git(['check-ignore', '-q', '--', 대상 + '/아무거나.pdf']);
  } catch (e) {
    if (e.status === 1) assert.fail('`.gitignore` 가 인쇄본을 안 막는다 — 다음에 구우면 그대로 커밋에 딸린다');
    return void t.skip('git check-ignore 를 못 돌렸다: ' + (e.message || e));
  }
});

test('매니페스트가 가리키는 정본이 전부 실재한다 — 없으면 «필요할 때» 못 굽는다', () => {
  const fs = require('node:fs');
  const { MANIFEST } = require('../tools/인쇄본빌드.js');
  const 없는것 = MANIFEST.filter((d) => !fs.existsSync(path.join(ROOT, d.src))).map((d) => d.src);
  assert.deepEqual(없는것, [],
    '정본이 사라진 매니페스트 줄이 있다 — 저장소에 PDF 를 안 두는 대신 «언제든 굽을 수 있다»가 전제다. '
    + '그 전제가 깨지면 이 설계 전체가 무너진다(문서가 통째로 사라진 것과 같다).');
});

test('«무엇을 굽나»가 실제로 갈린다 — 전량은 11벌, 지목은 뺀 것까지 굽는다', () => {
  const { MANIFEST, 굽을것 } = require('../tools/인쇄본빌드.js');
  const 전량 = 굽을것();
  assert.ok(전량.length < MANIFEST.length,
    '이름을 안 댔는데 매니페스트 전량을 굽는다 — 유호 픽 「ㄹ」(분모 축소)이 «행동»에는 안 걸려 있다');
  assert.equal(전량.filter((d) => d.기본 === false).length, 0, '기본 갈래에 뺀 것이 섞였다');
  /* 🔑 반대 방향 — 뺀 것도 «이름을 대면» 나와야 한다. 이게 없으면 「빼기」가 「지우기」가 된다. */
  const 지목 = 굽을것('철학');
  assert.ok(지목.some((d) => d.src === 'docs/SYNK_철학.md'),
    '기본에서 뺀 문서를 이름으로도 못 굽는다 — 그건 빼는 게 아니라 없애는 것이다');
});

test('기본 굽기에서 빠진 것은 «유호님 혼자 읽는» 갈래뿐이다 — 분모 둘이 갈려 있다', () => {
  const { MANIFEST } = require('../tools/인쇄본빌드.js');
  const 기본분모 = MANIFEST.filter((d) => d.기본 !== false);
  const 뺀것 = MANIFEST.filter((d) => d.기본 === false);
  assert.ok(뺀것.length > 0, '유호 픽 「ㄹ」(분모 축소)이 사라졌다 — 경영 정본이 기본 굽기로 되돌아왔다');
  assert.ok(기본분모.length > 0, '기본 분모가 0이면 전량 재굽기가 아무것도 안 굽는다(미실행이 초록으로 보이는 자리)');
  assert.equal(기본분모.length + 뺀것.length, MANIFEST.length, '두 분모의 합이 전체와 다르다 — 어느 쪽에도 안 든 줄이 있다');
  for (const d of 뺀것) {
    assert.equal(d.group, '경영 정본',
      `기본에서 뺀 것은 «유호님 혼자 읽는» 갈래여야 한다 — ${d.src} 는 ${d.group} 이라 남에게 건네거나 인쇄한다`);
  }
  /* 🔑 반대 방향도 못박는다 — 위 for 만 있으면 「경영 정본 하나를 기본으로 되돌리는」 변이가
   *    통째로 안 잡힌다(변이 검사가 실제로 그 구멍을 냈다). 축소가 «반쪽»이 되는 자리다. */
  const 경영 = MANIFEST.filter((d) => d.group === '경영 정본');
  assert.equal(경영.filter((d) => d.기본 === false).length, 경영.length,
    '경영 정본인데 기본 굽기에 남은 줄이 있다 — 분모 축소가 반쪽이면 그 한 벌만 계속 낡는다');
});
