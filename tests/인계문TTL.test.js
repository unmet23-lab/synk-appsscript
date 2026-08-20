/* 인계문 TTL 회귀 — 「지우는 쪽」이 모르면 멈추는가 (F641 · 2026-08-18).
 *
 * 왜 있나: `writeHandoffFile` ②의 TTL 청소가 **클라우드 세션에서 인계문 43개를 지웠다.**
 *   `at` 은 파일 **안**에 적힌 쓴 시각이라, 갓 클론한 저장소에서는 커밋돼 내려온 인계문 전부가
 *   12시간을 넘긴 것으로 읽힌다. 하필 지문 없는 계정은 **인계가 유일한 통로**라
 *   (F096) 그 자리를 인계 도구가 스스로 지운 셈이다.
 *
 * 🔑 이 파일은 **두 쪽을 같은 무게로** 고정한다(CLAUDE.md 「가드·회귀의 네 맹점 ②」) —
 *   ①안 지우는 쪽(모를 때·갓 내려온 파일)뿐 아니라 ②**여전히 지우는 쪽**(지문 있고 mtime 도
 *   낡음)까지 픽스처로 못박는다. 안 그러면 「청소를 통째로 껐다」가 초록으로 보인다.
 *
 * 검사 방식 — 임시 디렉터리 픽스처만. 실저장소·git·시간대에 안 기댄다(F296).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const report = require(path.resolve(__dirname, '..', '.claude', 'hooks', 'lib', 'session-report.js'));

const 폴더이름 = path.join('docs', '_ops', '인계문');

const 임시들 = [];
function 픽스처() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-인계TTL-'));
  임시들.push(root);
  fs.mkdirSync(path.join(root, 폴더이름), { recursive: true });
  return root;
}
test.after(() => { for (const d of 임시들) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* 진행 */ } } });

/** 인계문 하나를 놓는다. `at분전` = 파일 **안**의 시각 · `mtime분전` = 디스크 시각(생략하면 같이 간다). */
function 인계문두기(root, 이름, at분전, mtime분전) {
  const p = path.join(root, 폴더이름, `${이름}.md`);
  const at = Date.now() - at분전 * 60000;
  fs.writeFileSync(p, `<!-- at:${at} -->\n## 세션 ${이름}\n\n\`\`\`\n다음 할 일\n\`\`\`\n`);
  const t = new Date(Date.now() - (mtime분전 === undefined ? at분전 : mtime분전) * 60000);
  fs.utimesSync(p, t, t);
  return p;
}
const 남은것 = (root) => fs.readdirSync(path.join(root, 폴더이름)).filter((f) => f.endsWith('.md')).sort();

test('지문을 모르면 낡은 인계문을 안 지운다 — 목차에도 링크로 남는다 (F641)', () => {
  const root = 픽스처();
  for (const n of ['aaaa1111', 'bbbb2222', 'cccc3333', 'dddd4444']) 인계문두기(root, n, 13 * 60);

  const 목차 = report.writeHandoffFile(root, '내 인계문', { sessionId: '' });

  const 남음 = 남은것(root);
  for (const n of ['aaaa1111', 'bbbb2222', 'cccc3333', 'dddd4444']) {
    assert.ok(남음.includes(`${n}.md`), `${n} 이 지워졌다 — F641 재발`);
  }
  // 버리지 않는다 = 펴지 못한 것도 목차에서 열린다. 넷 중 셋만 펴지므로 링크 절이 서야 한다.
  const t = fs.readFileSync(목차, 'utf8');
  assert.match(t, /그 밖의 세션/, '밀려난 인계문이 목차에서 사라졌다');
});

test("`'?'` 도 모른다다 — /close 통로가 `_.md` 한 칸에 겹쳐 쓰지 않는다 (F641 곁가지)", () => {
  const root = 픽스처();
  // tools/인계문.js 가 실제로 부르는 모양: `sessionId: sid || '?'`
  report.writeHandoffFile(root, '첫 세션', { sessionId: '?' });
  report.writeHandoffFile(root, '둘째 세션', { sessionId: '?' });

  const 남음 = 남은것(root);
  assert.ok(!남음.includes('_.md'), '`_.md` 로 접혔다 — 지문 없는 세션끼리 서로를 덮는다');
  assert.strictEqual(남음.length, 2, `지문 없는 두 세션이 각자 파일을 못 가졌다: ${남음.join(' ')}`);
  const 본문 = 남음.map((f) => fs.readFileSync(path.join(root, 폴더이름, f), 'utf8')).join('\n');
  assert.match(본문, /첫 세션/);
  assert.match(본문, /둘째 세션/);
});

test('지문을 알고 파일도 낡았으면 **여전히 걷는다** — 청소를 통째로 끄지 않았다', () => {
  const root = 픽스처();
  인계문두기(root, 'eeee5555', 13 * 60);           // at·mtime 둘 다 13시간 전
  인계문두기(root, 'ffff6666', 30, 30);            // 살아있는 남의 것 — 손대면 안 된다

  report.writeHandoffFile(root, '내 인계문', { sessionId: 'aaaabbbb' });

  const 남음 = 남은것(root);
  assert.ok(!남음.includes('eeee5555.md'), '낡은 것을 안 걷었다 — 탐지력이 죽었다');
  assert.ok(남음.includes('ffff6666.md'), '살아있는 남의 인계문을 걷었다');
});

test('갓 클론한 저장소는 지문이 있어도 안 걷는다 — mtime 이 방금이다 (F641 두 번째 입구)', () => {
  const root = 픽스처();
  인계문두기(root, 'gggg7777', 13 * 60, 1);        // 안의 시각은 낡았고, 디스크에 놓인 것은 1분 전
  인계문두기(root, 'hhhh8888', 40 * 60, 2);

  report.writeHandoffFile(root, '내 인계문', { sessionId: 'ccccdddd' });

  const 남음 = 남은것(root);
  assert.ok(남음.includes('gggg7777.md'), '갓 내려온 인계문을 지웠다 — F641 의 두 번째 입구');
  assert.ok(남음.includes('hhhh8888.md'), '갓 내려온 인계문을 지웠다 — F641 의 두 번째 입구');
});
