'use strict';
// GD4 · GG2 · G2 시험을 master 원천 qa에 더한다.  node edit-tests-small.cjs <qa 폴더>
const fs = require('node:fs'), path = require('node:path');
const dir = process.argv[2];
const add = {
  'life-ui-next.test.mjs': [
    `test('4-3 허브 — 상한 날(§20-3):`,
    `test('4-3 허브 — 쓰기 · 말하기 줄의 포스터 꼬리표는 그 일이다(UP NEXT · WRITING · SPEAKING — 허브 꼬리표는 모든 언어에서 영어 대문자, 검수 s3d GD4)', t0 => {
  t0.mock.timers.enable({ apis: ['Date'], now: START });
  const progress = freshProgress();
  engine(progress);
  let day = null;
  const w = lifeOn({ progress, today: () => day });
  try {
    const row = modality => ({
      kind: 'check',
      activityId: \`world.check.\${modality}\`,
      route: modality,
      title: '이번 주 연습',
      why: { text: '이번 주 계획이에요.' },
      minutes: 8,
      open: { id: \`check.\${modality}\`, route: modality, label: '이번 주 연습', modality },
    });
    for (const [modality, label] of [['writing', 'WRITING'], ['speaking', 'SPEAKING'], ['listening', 'LISTENING'], ['reading', 'READING']]) {
      day = dayOf([row(modality)]);
      w.ui.packs();
      assert.equal(posterLabel(last(w)), \`UP NEXT · \${label}\`, \`\${modality} 줄의 꼬리표\`);
      assert.ok(felt(last(w)) && 'data-life-next' in felt(last(w)), '큰 단추는 홈과 같은 길(education.next)');
    }
  } finally {
    w.ui.dispose();
  }
});

`,
  ],
  'atlas-next-practice-shell.test.mjs': [
    `test('끈질긴 단위 힌트는 듣기 문항이면`,
    `test('「다시 확인」 카드로 연 판(only)의 「새 말 더 배우기」 · 「더 하기」는 다음 판도 그 단위 문항만 낸다(검수 s3d GG2)',async()=>{
 const pool=worldPosition.practice.pool;
 const skillId=pool.find(item=>/^ko\\.reading\\./.test(item.skillId)).skillId;
 const same=pool.filter(item=>item.skillId===skillId);
 assert.ok(same.length>2,'같은 능력의 문항이 여럿이다');
 const only=same.slice(0,2).map(item=>item.itemKey);
 const chain=world([{ending:{kind:'limited'}},{ending:{kind:'done'},fresh:3},{ending:{kind:'done'},fresh:2}]);
 await chain.education.practice(null,{only});
 await until(()=>done(chain));
 chain.box().press('data-practice-more');
 await until(()=>chain.opened.length===2&&done(chain));
 chain.box().press('data-practice-again');
 await until(()=>chain.opened.length===3);
 for(const [index,row] of chain.opened.entries())assert.deepEqual(row.pool.map(item=>item.itemKey).sort(),[...only].sort(),\`\${index+1}번째 판도 그 단위 문항만\`);
 assert.deepEqual(chain.opened.map(row=>row.more),[false,true,true],'더 배우기로 연 뒤의 더 하기는 more를 잇는다(FA1과 같다)');
});

`,
  ],
};
const append = {
  'atlas-next-mock-shell.test.mjs': `
// 검수 s3d G2: 새 길 시험 형식 판이 끝나면(그만둠 포함) 판 끝 수가 올라 이번 주 계획이 묶음 만남을 다시 묻는다 — 짧은 진단 · 짧은 연습(planOnce)과 같다.
// 그대로면 다 쓴 시험 형식 칸이 이번 주 계획 판에 서 있고, 누르면 「열 수 없어요」와 함께 내 위치로 튕긴다.
test('시험 형식 판이 끝나면(그만둠 포함) 이번 주 계획이 묶음 만남을 다시 묻는다 — 판 끝 수가 오른다(검수 s3d G2)', async () => {
  let weekAsked = 0;
  const app = shell({
    wrap: made => ({
      ...made,
      exposures(items) {
        if (/weekNext/.test(new Error().stack ?? '')) weekAsked += 1;
        return made.exposures(items);
      },
    }),
  });
  try {
    await until(() => app.homeCoach(), '홈 코치');
    await app.education.mock();
    app.box().tap('[data-mock-start]');
    assert.match(app.box().html, /data-mock-run/, '첫 문항');
    app.education.refresh();
    const before = weekAsked;
    app.education.refresh();
    assert.equal(weekAsked, before, '판 도중에는 열쇠가 같아 다시 묻지 않는다');
    app.box().press('data-mock-stop');
    await until(() => app.box().html.includes('data-mock-done'), '그만둔 뒤의 끝 한 장');
    app.education.refresh();
    assert.ok(weekAsked > before, '판이 끝났으니 다시 묻는다 — 낸 문항은 이제 처음 보는 문항이 아니다');
  } finally {
    app.dispose();
  }
});
`,
};
for (const [name, [anchor, text]] of Object.entries(add)) {
  const file = path.join(dir, name);
  let s = fs.readFileSync(file, 'utf8');
  const crlf = s.includes('\r\n'), eol = x => (crlf ? x.replace(/\r?\n/g, '\r\n') : x);
  const a = eol(anchor);
  if (s.split(a).length !== 2) throw Error(`${name}: 자리 ${s.split(a).length - 1}`);
  s = s.replace(a, () => eol(text) + a);
  fs.writeFileSync(file, s);
}
for (const [name, text] of Object.entries(append)) {
  const file = path.join(dir, name);
  let s = fs.readFileSync(file, 'utf8');
  const crlf = s.includes('\r\n'), eol = x => (crlf ? x.replace(/\r?\n/g, '\r\n') : x);
  fs.writeFileSync(file, s + eol(text));
}
console.log('더함', [...Object.keys(add), ...Object.keys(append)].join(' · '));
