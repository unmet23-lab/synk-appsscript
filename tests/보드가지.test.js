/* 미머지 가지에 앉은 보드 선언 — 점유 판정의 «분모» 회귀 (F521 · F524).
 *
 * 이 검사가 지키는 것: **「지금 집을 수 있는 것」이 메인 보드 안에서만 참이 되지 않게.**
 * 2026-08-17 실측(세션 `52393118`) — 대기열이 🟢 「지금 집을 수 있는 것 2건」으로 #Q99·#Q100 을
 * 불렀는데 **둘 다 이미 잡혀 있었다**(`93a2d32e`·`24b6c036`). 초록 2 = 빈 자리 0 + 가려진 것 2.
 * 기전: 08-15 확정 「코드 트랙은 워크트리+PR」의 순서가 ①EnterWorktree ②보드 선언 커밋 이라
 * 선언이 가지 안에 앉는데, `줄들(root)` 은 한 디렉터리만 읽는다. 규약이 바뀌면서 기존 장치의
 * 분모가 조용히 줄어든 자리다(CLAUDE.md 가드 맹점 ④ — 맞는 얼굴로 틀린 값).
 *
 * 탐지력은 **픽스처가 진다** — 파싱은 순수 함수라 git 없이 전부 재고, 실저장소는 계약만 본다
 * (F296: repo 밖 환경에 기대는 검사는 CI 에서 깨진다 · 못 재면 fail 아니라 skip 으로 드러낸다).
 */
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const 보드 = require(path.join(ROOT, 'tools', 'lib', '보드.js'));

/** 실행층이 내는 모양 그대로 — 모양 정본은 `가지끝줄()` 하나다(손으로 베끼면 파서를 안 잰다). */
const 가지출력 = (가지, 파일, ...줄들) => 줄들.map((l) => 보드.가지끝줄(가지, 파일, l)).join('\n');

const 표줄 = (트랙, 파일칸 = '`tools/x.js`', 상태 = '▶착수') =>
  `| 2026-08-17 | **${트랙}** | ${파일칸} | ${상태} |`;

// ───────────────────────────────── 탐지력 (픽스처 · git 0)

test('🔑 [F521] 가지 안의 선언을 뽑는다 — 이게 0이면 코드 트랙 전부가 「빈 자리」로 불린다', () => {
  const 출력 = 가지출력('worktree-q99-talk-index-reach', '93a2d32e.md',
    '<!-- 세션 보드 정본 조각 -->', '', 표줄('#Q99 시트층 도달 0인 5종 갚기'));
  const r = 보드.가지줄들('.', { 출력 });
  assert.strictEqual(r.모름, false);
  assert.strictEqual(r.줄들.length, 1, `표줄 하나를 못 뽑았다: ${JSON.stringify(r.줄들)}`);
  assert.match(r.줄들[0].줄, /#Q99/);
  assert.strictEqual(r.줄들[0].출처.가지, 'worktree-q99-talk-index-reach');
  assert.strictEqual(r.줄들[0].출처.파일, '93a2d32e.md', '지문(=1차 신원)이 안 실렸다');
});

test('☠️ [F521] 표 머리글·구분선은 안 뽑는다 — `줄들()` 과 **같은 잣대**여야 한다', () => {
  const 출력 = 가지출력('가지A', 'aaaaaaaa.md',
    '| 날짜 | 트랙 | 만질 파일 | 상태/다음 |', '|---|---|---|---|', 표줄('진짜 줄'));
  const 줄들 = 보드.가지줄들('.', { 출력 }).줄들;
  assert.strictEqual(줄들.length, 1, `머리글·구분선이 섞였다: ${줄들.map((r) => r.줄).join(' // ')}`);
  assert.match(줄들[0].줄, /진짜 줄/);
});

test('☠️ [F521] 같은 줄이 여러 가지에 실려 와도 한 번만', () => {
  const 한줄 = 표줄('같은 선언');
  const 출력 = [가지출력('가지A', 'aaaaaaaa.md', 한줄), 가지출력('가지B', 'aaaaaaaa.md', 한줄)].join('\n');
  assert.strictEqual(보드.가지줄들('.', { 출력 }).줄들.length, 1);
});

test('🔑 [F521] 가지 귀속은 **줄마다** 갈린다 — 뭉치면 남의 가지 이름이 붙는다(실측 17줄 중 2줄)', () => {
  const 출력 = [
    가지출력('가지A', 'aaaaaaaa.md', 표줄('A 의 선언')),
    가지출력('가지B', 'bbbbbbbb.md', 표줄('B 의 선언')),
  ].join('\n');
  const 줄들 = 보드.가지줄들('.', { 출력 }).줄들;
  assert.strictEqual(줄들.length, 2);
  const 짝 = Object.fromEntries(줄들.map((r) => [r.출처.파일, r.출처.가지]));
  assert.strictEqual(짝['aaaaaaaa.md'], '가지A');
  assert.strictEqual(짝['bbbbbbbb.md'], '가지B', '두 번째 줄이 첫 가지 이름을 물려받았다');
});

test('☠️ 내용 안의 `:` 가 칸을 밀지 않는다 — 앞 둘만 떼야 한다(보드 줄엔 `http://`·`시각 12:18` 이 흔하다)', () => {
  const 한줄 = 표줄('12:18 에 겹쳤다 — https://example.test/x 참고');
  const 줄들 = 보드.가지줄들('.', { 출력: 가지출력('가지A', 'aaaaaaaa.md', 한줄) }).줄들;
  assert.strictEqual(줄들.length, 1, `내용의 콜론에서 잘렸다: ${JSON.stringify(줄들)}`);
  assert.strictEqual(줄들[0].줄, 한줄, '줄이 잘려 들어왔다 — 파일 칸이 내용 조각을 먹었다');
  assert.strictEqual(줄들[0].출처.가지, '가지A');
});

test('🔑 [F521] 실행층이 못 부르면 `모름: true` — 「없다」로 접으면 분모가 조용히 좁아진다(F207)', () => {
  const r = 보드.가지줄들('.', { 실행: () => null });
  assert.strictEqual(r.모름, true, '🔴 못 본 것을 「가지 선언 0」으로 접었다');
  assert.deepStrictEqual(r.줄들, []);
  const 던짐 = 보드.가지줄들('.', { 실행: () => { throw new Error('git 없음'); } });
  assert.strictEqual(던짐.모름, true, '예외도 「모름」이다 — 삼키고 빈손을 내면 같은 모양이 된다');
});

test('🔑 [F521] `출력` 주입구를 주면 git 을 **안 부른다** — 회귀가 저장소 상태에 안 기댄다', () => {
  let 불렀나 = false;
  const r = 보드.가지줄들('.', { 출력: 가지출력('가지A', 'aaaaaaaa.md', 표줄('X')), 실행: () => { 불렀나 = true; return null; } });
  assert.strictEqual(불렀나, false);
  assert.strictEqual(r.줄들.length, 1);
});

// ─────────────────── 실행층 — 「이력」이 아니라 「순변화」를 재나 (2026-08-17 · 이 함수의 두 번째 판)
//
// 🔴 왜 픽스처 문자열로는 못 잡나: 결함이 **어느 git 명령을 부르나**에 있었다. 첫 판은 `log -p` 로
//    커밋 이력을 훑어, 가지 안에서 `▶착수`→`✅종결` 로 고쳐 쓴 줄의 **두 판을 다 냈다**. 파서는
//    아무 잘못이 없어서 순수 함수 픽스처는 끝까지 초록이었다. 그래서 이 둘만 진짜 저장소를 세운다.
//    실측이 부른 값 — 이 저장소 활성 13줄 = 참 5 + 낡은 판 8(62%가 유령).

const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const g = (인자, cwd) => spawnSync('git', 인자, { cwd, encoding: 'utf8' });
const 보드파일 = (root, 지문) => path.join(root, 'docs', '_ops', '보드', `${지문}.md`);
const 쓰기 = (root, 지문, ...줄들) => {
  const p = 보드파일(root, 지문);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, ['<!-- 세션 보드 정본 조각 -->', '', ...줄들].join('\n'), 'utf8');
};

/** master 하나에 커밋 한 개가 있는 저장소. 세울 수 없으면 `null` — 통과로 위장하지 않는다. */
function 저장소세우기() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '보드가지-'));
  if (g(['init', '-q', '-b', 'master'], root).status !== 0) return null;
  g(['config', 'user.email', 't@t'], root);
  g(['config', 'user.name', 't'], root);
  쓰기(root, '00000000');
  g(['add', '-A'], root);
  if (g(['commit', '-qm', 'init'], root).status !== 0) return null;
  return root;
}

test('🔴 [핵심] 가지 안에서 고쳐 쓴 줄은 **최종판 하나**다 — 이게 깨지면 끝난 트랙이 자리를 계속 문다', (t) => {
  const root = 저장소세우기();
  if (!root) return t.skip('이 환경에선 git 저장소를 못 세운다 — 통과로 위장하지 않는다');
  g(['checkout', '-q', '-b', 'worktree-어떤트랙'], root);
  쓰기(root, 'aaaa1111', 표줄('내 트랙', '`tools/x.js`', '▶착수'));
  g(['add', '-A'], root); g(['commit', '-qm', '선언'], root);
  쓰기(root, 'aaaa1111', 표줄('내 트랙', '`tools/x.js`', '✅종결 — 다 했다'));
  g(['add', '-A'], root); g(['commit', '-qm', '종결'], root);

  const r = 보드.가지줄들(root);
  assert.strictEqual(r.모름, false, `git 을 못 불렀다: ${JSON.stringify(r)}`);
  assert.strictEqual(r.줄들.length, 1,
    `🔴 한 줄의 여러 판이 다 나왔다(=이력을 재고 있다): ${r.줄들.map((x) => x.줄).join(' // ')}`);
  assert.match(r.줄들[0].줄, /✅종결/, '낡은 판이 이겼다 — 최종 상태를 재야 한다');
  assert.strictEqual(보드.활성행(r.줄들[0].줄), false, '끝난 줄이 활성으로 세어진다 — 그 자리가 계속 잡혀 있게 된다');
});

test('☠️ master 가 그 사이 아카이브한 **남의 옛 줄**은 안 딸려 온다 — 가지 끝 전문을 읽으면 13→55 로 부푼다', (t) => {
  const root = 저장소세우기();
  if (!root) return t.skip('이 환경에선 git 저장소를 못 세운다');
  // master: 남의 옛 줄이 있는 상태에서 가지를 뗀다
  쓰기(root, 'bbbb2222', 표줄('남의 옛 트랙', '`tools/남.js`', '작업중'));
  g(['add', '-A'], root); g(['commit', '-qm', '남의 줄'], root);
  g(['checkout', '-q', '-b', 'worktree-내트랙'], root);
  쓰기(root, 'aaaa1111', 표줄('내 트랙', '`tools/x.js`', '▶착수'));
  g(['add', '-A'], root); g(['commit', '-qm', '내 선언'], root);
  // master 는 그 사이 남의 줄을 아카이브로 옮겼다(=파일에서 사라졌다)
  g(['checkout', '-q', 'master'], root);
  쓰기(root, 'bbbb2222');
  g(['add', '-A'], root); g(['commit', '-qm', '이관'], root);

  const 줄들 = 보드.가지줄들(root).줄들;
  assert.strictEqual(줄들.length, 1, `아카이브된 남의 옛 줄이 「가지 선언」으로 딸려 왔다: ${줄들.map((x) => x.줄).join(' // ')}`);
  assert.match(줄들[0].줄, /내 트랙/);
});

// ───────────────────────────────── 머리형 비켜남 (F524)

test('🔴 [F524] `무접촉=#Q99` 는 점유가 아니다 — 비켜난 쪽이 그 줄의 주인으로 적혔다(실측)', () => {
  const 파일칸 = 'talk `lib/이벤트검증.js` (⛔시트층 무접촉=#Q99 PR #23 남의 트랙 · 운영 DB 0)';
  const 텍스트 = 보드.만지는텍스트(파일칸);
  assert.ok(!보드.큐표식(텍스트).has('#Q99'), `비켜남 선언이 점유로 읽혔다: ${텍스트}`);
  assert.ok(보드.파일자리(텍스트).has('lib/이벤트검증.js'), '진짜 만지는 파일까지 같이 지웠다 — 반대로 샌 것이다');
});

test('🔴 [F524] 머리형은 **구절 경계를 넘는다** — `읽기만=A·B` 의 B 도 읽기만이다(실측 4건 중 2건이 이 모양)', () => {
  const 자리 = 보드.파일자리(보드.만지는텍스트('읽기만=엔진_셋업확장.js·Code.js'));
  assert.strictEqual(자리.size, 0, `구절에서 멈춰 절반만 닫혔다: ${[...자리].join(' · ')}`);
});

test('☠️ [F524] 부정어가 없으면 그대로 산다 — 넓히다 반대로 새면 겹침이 통째로 안 잡힌다', () => {
  const 자리 = 보드.파일자리(보드.만지는텍스트('`tools/a.js`·`tools/b.js` (회귀 신설)'));
  assert.ok(자리.has('tools/a.js') && 자리.has('tools/b.js'), `만지는 파일이 사라졌다: ${[...자리].join(' · ')}`);
});

test('☠️ [F524] 꼬리형은 그대로 산다 — 머리형을 넣느라 옛 규칙을 깨면 F384 가 되돌아온다', () => {
  const 텍스트 = 보드.만지는텍스트('`tools/a.js` · 남의 산 작업본 `tools/b.js` 무접촉');
  const 자리 = 보드.파일자리(텍스트);
  assert.ok(자리.has('tools/a.js'));
  assert.ok(!자리.has('tools/b.js'), `꼬리형 비켜남이 죽었다: ${텍스트}`);
});

test('🔑 [F384·F524] 안내문이 머리형을 **말한다** — 말 안 하는 표기는 없는 표기다', () => {
  const 안내 = 보드.비켜남표기안내();
  assert.match(안내, /읽기만=/, '가드가 자기가 읽는 형태를 안 말한다 — 세션에게 남는 길은 정보를 지우는 것뿐이다');
  for (const w of 보드.부정어휘) {
    assert.ok(안내.includes(w.보기), `목록에 있는데 안내문에 없다: ${w.보기}`);
  }
});

// ───────────────────────────────── 실저장소 (계약만 · 못 재면 skip)

test('🔑 [F521] 실저장소 — `가지줄들` 계약: 줄들은 배열이고 모름은 boolean', (t) => {
  let r;
  try { r = 보드.가지줄들(ROOT); } catch (e) { return t.skip(`git 을 못 불렀다: ${e.message}`); }
  assert.ok(Array.isArray(r.줄들), '줄들이 배열이 아니다');
  assert.strictEqual(typeof r.모름, 'boolean');
  if (r.모름) return t.skip('이 환경에선 git 이 안 돈다 — 탐지력은 위 픽스처가 진다');
  for (const 행 of r.줄들) {
    assert.ok(보드.표줄(행.줄), `표줄이 아닌 것이 섞였다: ${행.줄.slice(0, 60)}`);
    assert.strictEqual(typeof 행.출처.가지, 'string');
  }
});
