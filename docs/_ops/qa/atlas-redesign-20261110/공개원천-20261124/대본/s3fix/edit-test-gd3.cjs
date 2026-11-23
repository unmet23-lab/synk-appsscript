'use strict';
const fs = require('node:fs'), path = require('node:path');
const file = path.join(process.argv[2], 'life-ui-next.test.mjs');
let s = fs.readFileSync(file, 'utf8');
const crlf = s.includes('\r\n'), eol = x => (crlf ? x.replace(/\r?\n/g, '\r\n') : x);
s += eol(`
// 검수 s3d GD3: 레슨 결과의 「새 장면으로 다시 보기」 등으로 연 복습 판을 답을 남긴 채 나간 학생이, 판정을 확인하는 중에 배우기 허브를 연다.
// 돌아온 수는 0이지만 하던 판은 이어 할 수 있다(startReview가 하던 판을 그대로 연다) — 포스터 「이어 하기」가 그 판을 열고, 복습 화면에도 이어 하기 단추가 있다.
test('확인 중에 하던 복습 — 허브 포스터는 「이어 하기」로 하던 판을 열고 복습 화면에도 이어 하기 단추가 있다(「0개가 돌아왔어요」로 막히지 않는다 · 검수 s3d GD3)', t0 => {
  t0.mock.timers.enable({ apis: ['Date'], now: START });
  const progress = freshProgress();
  engine(progress);
  let day = null;
  const w = lifeOn({ progress, today: () => day });
  try {
    const lesson = lessonById('greetings-expressions');
    playLesson(w, lesson, { wrong: [0] });
    goHome(w);
    t0.mock.timers.tick(MINUTE);
    w.ui.reviewStart();
    assert.equal(w.ui.metrics().phase, 'review', '복습 판을 열었다');
    const run = progress.exportSnapshot().activeReview;
    assert.ok(run && run.ids.some(id => !run.answers[id]), '답하지 않은 문항이 남은 판');
    // 판정 확인 중 — 돌아온 수는 0이다
    checking(progress);
    assert.equal(w.ui.summary().dueCount, 0);
    day = dayOf([{ kind: 'review', activityId: 'world.life.review', route: 'review', title: '복습', why: { text: '돌아온 표현이에요.' }, minutes: 3, open: { id: 'world.life.review', route: 'review', label: '복습' } }]);
    w.ui.packs();
    let html = last(w);
    assert.equal(posterLabel(html), 'CONTINUE · REVIEW', '하던 판은 이어 하기 포스터');
    assert.ok(!html.includes(t('life.backSub', { n: 0 })), '「0개가 돌아왔어요」가 아니다');
    assert.ok(felt(html) && 'data-life-review-start' in felt(html), '큰 단추는 하던 판을 잇는다');
    press(felt(html));
    assert.equal(w.ui.metrics().phase, 'review', '하던 판이 열린다');
    assert.equal(progress.exportSnapshot().activeReview.id, run.id, '같은 판');
    // 복습 화면 — 확인 중 글은 그대로 두고 이어 하기 단추를 둔다
    w.ui.review();
    html = last(w);
    assert.ok(html.includes(t('life.reviewChecking')), '확인 중 글');
    assert.ok(felt(html) && 'data-life-review-start' in felt(html), '복습 화면에도 이어 하기 단추');
    assert.ok(html.includes(t('life.continue')), '이어 하기 글(이미 있는 문구)');
  } finally {
    w.ui.dispose();
  }
});
`);
fs.writeFileSync(file, s);
console.log('GD3 시험 더함');
