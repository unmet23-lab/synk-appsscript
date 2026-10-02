// 실행: node --test "docs/마케팅/맞춤도구/computer/rules.test.js"
// 추천기준.md §12의 약속과 제작절차.md의 검사를 지킨다.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const R = require('./rules.js');
const C = require('./content.js');
const { checkContent, checkTipIds } = require('../core/content-check.js');

const base = { owned: 'new', multitask: 'normal', os: 'any', budget: '150_250' };
const run = extra => R.compute({ ...base, ...extra });
const allReasons = rec => [
  ...rec.form.reasons, ...rec.form.portable, ...rec.form.fallback,
  ...rec.ram.reasons, ...rec.storage.reasons, ...rec.gpu.reasons, ...rec.cpu.reasons, ...rec.os.reasons, ...rec.os.conflicts,
  ...rec.npu.yes, ...rec.npu.no, ...(rec.npu.note ? [rec.npu.note] : []), ...rec.money,
  ...(rec.current ? [...rec.current.reasons, ...rec.current.actions] : []), ...rec.budget.tips, ...rec.budget.alternatives,
];

test('제작 절차: 탐색노트·추천기준이 있고 질문·팁 은행이 검사를 통과한다', () => {
  for (const doc of ['탐색노트.md', '추천기준.md']) assert.ok(fs.existsSync(path.join(__dirname, doc)), `${doc} 없음`);
  assert.deepEqual(checkContent(C), []);
});

test('웹만 쓰고 자주 들고 다니면 노트북 16GB, 여유를 권하지 않는다', () => {
  const rec = run({ uses: ['web'], place: 'carry', multitask: 'light' });
  assert.equal(rec.form.pick, 'laptop');
  assert.equal(rec.ram.value, 16);
  assert.equal(rec.ram.roomy, 16);
  assert.match(rec.ram.roomyNote, /16GB면 충분해요/);
  assert.equal(rec.storage.value, 512);
  assert.equal(rec.gpu.kind, 'integrated');
  assert.ok(rec.tips.includes('gpu-none'));
});

test('웹만 쓰고 책상에서만 쓰면 데스크톱(미니 PC도 충분) 16GB', () => {
  const rec = run({ uses: ['web'], place: 'home', os: 'win' });
  assert.equal(rec.form.pick, 'desktop');
  assert.equal(rec.product, '데스크톱(작은 미니 PC도 충분)');
  assert.equal(rec.ram.value, 16);
});

test('4K 프리미어는 자주 들고 다녀도 데스크톱 32GB(여유 64GB)·그래픽 8GB, 노트북은 권하지 않는 대안으로만', () => {
  const rec = run({ uses: ['web', 'video'], video: { app: 'premiere', res: '4k', load: 'light' }, place: 'carry', os: 'win' });
  assert.equal(rec.form.pick, 'desktop');
  assert.equal(rec.form.notLaptop, true);
  assert.equal(rec.ram.value, 32);
  assert.equal(rec.ram.roomy, 64);
  assert.equal(rec.gpu.vram, 8);
  assert.ok(rec.form.portable.length >= 1, '밖에서는 이렇게');
  assert.ok(rec.form.fallback.some(x => /권하지 않아요/.test(x.t)));
  assert.ok(rec.form.reasons.some(x => x.src === 'pcworld-5070'), '노트북용 그래픽이 약한 근거');
  assert.ok(rec.tips.includes('laptop-gpu') && rec.tips.includes('gpu-price'));
  assert.match(rec.prompt, /노트북은 제외/);
});

test('캡컷 FHD를 들고 다니면 노트북 16GB(여유 32GB)·SSD 512GB', () => {
  const rec = run({ uses: ['web', 'video'], video: { app: 'capcut', res: 'fhd', load: 'light' }, place: 'carry' });
  assert.equal(rec.form.pick, 'laptop');
  assert.equal(rec.ram.value, 16);
  assert.equal(rec.ram.roomy, 32);
  assert.equal(rec.storage.value, 512);
});

test('중간 대화 AI를 운영체제 상관없이 고르면 맥 미니 24GB(여유 32GB)', () => {
  const rec = run({ uses: ['localai'], localai: ['mid'], place: 'home' });
  assert.equal(rec.os.pick, 'mac');
  assert.equal(rec.product, '맥 미니');
  assert.equal(rec.ram.value, 24);
  assert.equal(rec.ram.roomy, 32);
  assert.equal(rec.npu.verdict, 'no');
  assert.ok(rec.tips.includes('npu-llm'));
});

test('이미지 생성은 윈도우 데스크톱 · 램 32GB · 그래픽 12GB 이상(가성비 예: 16GB 카드)', () => {
  const rec = run({ uses: ['localai'], localai: ['image'], place: 'carry' });
  assert.equal(rec.os.pick, 'win');
  assert.equal(rec.form.pick, 'desktop');
  assert.equal(rec.ram.value, 32);
  assert.equal(rec.gpu.vram, 12);
  assert.match(rec.gpu.example, /5060 Ti 16GB/);
  assert.ok(rec.gpu.reasons.some(x => x.src === 'wccftech-gpu'));
});

test('32B 대화 AI를 윈도우로 하면 램 32GB·그래픽 24GB 경고와 대안, 맥이면 맥 미니(M5 Pro) 48GB', () => {
  const win = run({ uses: ['localai'], localai: ['large'], place: 'home', os: 'win' });
  assert.equal(win.ram.value, 32, '윈도우는 모델이 그래픽 메모리에 올라가 램은 32GB');
  assert.equal(win.gpu.vram, 24);
  assert.equal(win.budget.warn, true);
  assert.ok(win.gpu.reasons.some(x => /맥 미니\(M5 Pro\) 48GB/.test(x.t)));
  const mac = run({ uses: ['localai'], localai: ['large'], place: 'home', os: 'mac' });
  assert.equal(mac.product, '맥 미니(M5 Pro)');
  assert.equal(mac.ram.value, 48);
});

test('70B급을 맥으로 하면 맥 스튜디오 128GB', () => {
  const rec = run({ uses: ['localai'], localai: ['huge'], place: 'home', os: 'mac', budget: 'gt250' });
  assert.equal(rec.product, '맥 스튜디오');
  assert.equal(rec.ram.value, 128);
});

test('무거운 작업인데 지금 컴퓨터가 노트북이면 데스크톱을 더하고 노트북은 밖에서', () => {
  const rec = run({ owned: 'have', uses: ['video'], video: { app: 'resolve', res: '4k', load: 'light' }, place: 'carry', os: 'win', current: { ram: '16', os: 'win11', kind: 'laptop', feel: 'ok' } });
  assert.ok(rec.form.portable.some(x => /지금 쓰는 노트북은 밖에서/.test(x.t)));
  assert.ok(rec.current.actions.some(x => /데스크톱을 더하세요/.test(x.t)));
});

test('지금 컴퓨터가 느리다고 하면 ‘그대로 쓰기’를 내지 않는다', () => {
  // 무거운 작업 + 느린 노트북: 새 데스크톱을 더하는 추천이 제목이 된다.
  const heavy = run({ owned: 'have', uses: ['video'], video: { app: 'capcut', res: '4k', load: 'light' }, place: 'both', os: 'win', current: { ram: '16', os: 'win11', kind: 'laptop', feel: 'slow' } });
  assert.equal(heavy.headline.keep, false);
  assert.match(heavy.headline.title, /^데스크톱 · 램 32GB · 그래픽 8GB$/);
  assert.match(heavy.headline.sub, /이 데스크톱을 더하세요/);
  assert.ok(heavy.current.actions.some(x => /데스크톱을 더하세요/.test(x.t)));
  // 가벼운 작업 + 램 충분 + 느림: 원인 확인부터.
  const light = run({ owned: 'have', uses: ['web'], place: 'home', os: 'win', current: { ram: '16', os: 'win11', kind: 'laptop', feel: 'slow' } });
  assert.equal(light.headline.title, '램은 충분해요. 느린 원인부터 확인해 보세요');
  // 느리지 않으면 그대로 쓰기. GB 뒤에는 ‘예요’(기가).
  const ok = run({ owned: 'have', uses: ['web'], place: 'home', os: 'win', current: { ram: '16', os: 'win11', kind: 'laptop', feel: 'ok' } });
  assert.equal(ok.headline.title, '지금 컴퓨터로 시작해도 돼요');
  assert.match(ok.headline.sub, /GB예요\.$/);
  assert.doesNotMatch(ok.headline.sub + heavy.headline.sub, /GB이에요|TB이에요/);
});

test('지금 데스크톱 램이 모자라면 램만 더 꽂는 길을 먼저 알려 준다', () => {
  const rec = run({ owned: 'have', uses: ['web', 'video'], video: { app: 'capcut', res: 'fhd', load: 'light' }, place: 'home', os: 'win', current: { ram: '8', os: 'win10', kind: 'desktop', feel: 'slow' } });
  assert.equal(rec.current.verdict, 'tight');
  assert.ok(rec.current.actions.some(x => /램만 더 꽂는 게 가장 싸요/.test(x.t)));
  assert.ok(rec.current.actions.some(x => x.src === 'ms-win10'));
});

test('NPU: 윈도우 노트북 회의·포토샵이면 조금 유리, 웹·설치형 AI·게임·데스크톱이면 차이 없음, 번역 자막 함정 안내', () => {
  const meet = run({ uses: ['web', 'meeting'], place: 'both', os: 'win' });
  assert.equal(meet.npu.verdict, 'some');
  assert.ok(meet.npu.yes.some(x => /화상회의 효과/.test(x.t)));
  assert.ok(meet.npu.no.some(x => /한국어로 번역되지는 않아요/.test(x.t)));
  const llm = run({ uses: ['localai'], localai: ['small'], place: 'carry', os: 'win' });
  assert.equal(llm.npu.verdict, 'no');
  assert.ok(llm.npu.no.some(x => x.src === 'npu-llm'));
  const desk = run({ uses: ['web', 'meeting'], place: 'home', os: 'win' });
  assert.equal(desk.npu.verdict, 'no');
  const mac = run({ uses: ['localai'], localai: ['small'], place: 'carry', os: 'mac' });
  assert.ok(mac.npu.no.some(x => x.src === 'ane-llm'));
});

test('윈도우에서 파이널 컷을 고르면 충돌, 모바일 앱 개발이면 아이폰 앱 안내', () => {
  assert.ok(run({ uses: ['video'], video: { app: 'fcp', res: 'fhd', load: 'light' }, os: 'win', place: 'carry' }).os.conflicts.some(x => /맥 전용/.test(x.t)));
  assert.ok(run({ uses: ['code'], code: 'mobile', os: 'win', place: 'carry' }).os.conflicts.some(x => x.src === 'apple-xcode'));
});

test('프리미어 FHD를 가끔 들고 다니며 운영체제 상관없으면 맥북 에어 16GB(여유 32GB)', () => {
  const rec = run({ uses: ['video'], video: { app: 'premiere', res: 'fhd', load: 'light' }, place: 'both' });
  assert.equal(rec.product, '맥북 에어');
  assert.equal(rec.ram.value, 16);
  assert.equal(rec.ram.roomy, 32);
});

test('모르는 값은 버리고, 빠진 답이 있어도 계산이 멈추지 않는다', () => {
  const clean = R.sanitize({ owned: 'x', uses: ['web', 'hack'], video: { app: 'evil' }, budget: 9, current: { kind: 'tablet' } });
  assert.equal(clean.owned, undefined);
  assert.deepEqual(clean.uses, ['web']);
  assert.equal(clean.video.app, undefined);
  assert.equal(clean.current.kind, undefined);
  assert.equal(R.compute({ uses: ['web'] }).ram.value, 16);
});

test('프롬프트와 매장 문장에 가성비 사양이 들어가고 조사가 맞다', () => {
  const rec = run({ uses: ['web', 'video'], video: { app: 'premiere', res: '4k', load: 'light' }, os: 'win', place: 'carry' });
  assert.match(rec.prompt, /가성비/);
  assert.match(rec.prompt, /램: 32GB \(여유가 되면 64GB\)/);
  assert.match(rec.store, /데스크톱을 가성비 좋게 찾고 있어요/);
  const laptop = run({ uses: ['web'], place: 'carry', os: 'win' });
  assert.match(laptop.store, /노트북을 가성비 좋게/);
  assert.match(run({ uses: ['web'], budget: 'unknown', place: 'carry' }).store, /예산은 아직 정하지 않았어요/);
  // 괄호로 덧붙인 이름은 괄호 앞말에 조사를 맞춘다.
  assert.match(run({ uses: ['web', 'video'], video: { app: 'premiere', res: '4k', load: 'heavy' }, place: 'carry' }).store, /데스크톱\(윈도우 PC·맥 미니\)을 가성비/);
  assert.match(run({ uses: ['web'], place: 'carry' }).store, /노트북\(윈도우·맥북 에어\)을 가성비/);
  assert.match(run({ uses: ['localai'], localai: ['large'], place: 'home', os: 'mac' }).store, /맥 미니\(M5 Pro\)를 가성비/);
});

test('모든 이유의 출처와 결과가 고른 팁은 content.js에 있다', () => {
  const cases = [
    run({ uses: ['web', 'meeting', 'photo', 'video', 'code', 'localai', 'game'], photo: '3d', video: { app: 'resolve', res: '4k', load: 'heavy' }, code: 'server', localai: ['mid', 'image'], os: 'mac', place: 'both', budget: 'lt100', owned: 'extra', current: { ram: 'unknown', os: 'mac_intel', kind: 'laptop', feel: 'untried' } }),
    run({ uses: ['video'], video: { app: 'capcut', res: '4k', load: 'light' }, os: 'win', place: 'home' }),
    run({ uses: ['photo', 'meeting'], photo: 'heavy', os: 'win', place: 'carry' }),
    run({ uses: ['localai'], localai: ['huge'], os: 'win', place: 'home', budget: 'lt100' }),
  ];
  for (const rec of cases) {
    for (const x of allReasons(rec)) assert.ok(C.SOURCES[x.src], `출처 없음: ${x.src} (${x.t})`);
    assert.deepEqual(checkTipIds(rec.tips, C), []);
  }
  for (const n of R.TIER_NOTES) assert.ok(C.SOURCES[n.src], `출처 없음: ${n.src}`);
});

test('질문의 선택지 id가 규칙이 아는 값과 맞는다', () => {
  const valid = {
    owned: ['have', 'new', 'extra'], uses: ['web', 'meeting', 'photo', 'video', 'code', 'localai', 'game'], photo: ['web', 'adobe', 'heavy', '3d'], code: ['web', 'mobile', 'server'],
    localai: ['small', 'mid', 'large', 'huge', 'image', 'unsure'], multitask: ['light', 'normal', 'heavy'], place: ['home', 'both', 'carry'], os: ['mac', 'win', 'any'], budget: ['lt100', '100_150', '150_250', 'gt250', 'unknown'],
  };
  for (const s of C.steps) {
    if (s.type === 'group') continue;
    assert.deepEqual(s.options.map(o => o.id).sort(), [...valid[s.id]].sort(), s.id);
  }
});
