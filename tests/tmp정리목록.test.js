'use strict';

// .tmp 한 달 정리 목록 — 임시 폴더에 가짜 .tmp를 만들어 시각을 되돌려 놓고 확인한다. 실제 .tmp·정리 대기 폴더는 건드리지 않는다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const 정리 = require('../tools/tmp정리목록.js');
const 도구 = path.join(__dirname, '..', 'tools', 'tmp정리목록.js');

const 하루 = 24 * 60 * 60 * 1000;
function 옛날로(p, 일) {
  const 시각 = new Date(Date.now() - 일 * 하루);
  const 돌기 = (q) => { for (const e of fs.readdirSync(q, { withFileTypes: true })) { const r = path.join(q, e.name); if (e.isDirectory()) 돌기(r); fs.utimesSync(r, 시각, 시각); } };
  if (fs.statSync(p).isDirectory()) 돌기(p);
  fs.utimesSync(p, 시각, 시각);
}

test('14일 넘게 손대지 않은 폴더만 후보로 — 최근 파일이 하나라도 있거나 _보존.txt가 있으면 뺀다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-tmp-list-'));
  try {
    const 임시 = path.join(방, '.tmp'), 대기 = path.join(방, '정리대기');
    const 만들기 = (이름, 파일들) => { for (const [f, 크기] of 파일들) { const p = path.join(임시, 이름, f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, Buffer.alloc(크기)); } };
    만들기('옛큰것', [['a.bin', 3 * 1048576], ['안/b.bin', 1048576]]);
    만들기('옛작은것', [['c.txt', 10]]);
    만들기('보존', [['_보존.txt', 1], ['d.txt', 10]]);
    만들기('섞임', [['e.txt', 10]]);
    만들기('보존_작업트리_20261001', [['f.txt', 10]]);
    옛날로(path.join(임시, '옛큰것'), 30); 옛날로(path.join(임시, '옛작은것'), 20); 옛날로(path.join(임시, '보존'), 40); 옛날로(path.join(임시, '섞임'), 30); 옛날로(path.join(임시, '보존_작업트리_20261001'), 30);
    fs.writeFileSync(path.join(임시, '섞임', '새.txt'), '최근');
    fs.writeFileSync(path.join(임시, '맨위.log'), Buffer.alloc(2048)); 옛날로(path.join(임시, '맨위.log'), 15);
    fs.mkdirSync(path.join(대기, '20261001', '지난것'), { recursive: true });
    fs.writeFileSync(path.join(대기, '20261001', '지난것', 'x.bin'), Buffer.alloc(1048576));

    const 목록 = 정리.목록만들기({ 임시, 대기 });
    assert.deepEqual(목록.후보.map((c) => [c.이름, c.MB, c.파일, c.git]), [['옛큰것', 4, 2, null], ['옛작은것', 0, 1, null]]);
    assert.equal(목록.오래된파일, 1);
    assert.equal(목록.대기폴더, 1);
    const 글 = 정리.글로(목록);
    assert.match(글, /폴더 2개/);
    assert.match(글, /- 옛큰것 · 4MB · 2개/);
    assert.match(글, /맨 위 파일 중 14일 넘은 것 1개/);
    assert.match(글, /지우지는 않아요/);

    // 기준 시각은 파일 시각을 만든 「지금」과 같아야 한다 — 11-01로 고정하면 20일 전 폴더가 11-07부터 14일 기준을 못 넘었다(11-07)
    const 지금 = Date.now();
    const 날 = new Date(지금);
    const 날이름 = `${날.getFullYear()}${String(날.getMonth() + 1).padStart(2, '0')}${String(날.getDate()).padStart(2, '0')}`;
    const r = 정리.옮기기(['옛작은것', '섞임', '../밖'], { 임시, 대기, 지금 });
    assert.deepEqual(r.옮김, ['옛작은것']);
    assert.deepEqual(r.남김.map((x) => x.이름), ['섞임', '../밖']);
    assert.ok(fs.existsSync(path.join(대기, 날이름, '옛작은것', 'c.txt')));
    assert.ok(fs.existsSync(path.join(임시, '섞임', '새.txt')), '후보가 아닌 폴더는 그대로');
    assert.equal(정리.글로(정리.목록만들기({ 임시: path.join(방, '없음'), 대기 })).includes('정리할 폴더 없음'), true);
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('최근 작업이 경로로 끌어 쓰는 옛 폴더와 그 폴더가 다시 가리키는 폴더는 후보에서 뺀다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-tmp-refs-'));
  try {
    const 임시 = path.join(방, '.tmp'), 대기 = path.join(방, '정리대기');
    const 쓰기 = (상대, 글) => { const p = path.join(임시, 상대); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, 글); };
    쓰기('release-20261019/deploy/run.cjs', "const h=require('../../platform-ha-20261011/remote.cjs');");
    쓰기('release-20261019/plan.json', '{"evidence":".tmp/old-evidence-20261012/result.json"}');
    쓰기('release-20261019/README.md', '문서에만 적힌 `.tmp/doc-only-20261003/x.png`는 도구를 깨뜨리지 않는다.');
    쓰기('release-20261019/isolated-source/copy.cjs', "require('../../copied-only-20261004/a.cjs')");
    쓰기('platform-ha-20261011/remote.cjs', "require('../server-latency-20261013/common.cjs')");
    쓰기('server-latency-20261013/common.cjs', '// 접속 도우미');
    쓰기('old-evidence-20261012/result.json', '{}');
    쓰기('doc-only-20261003/x.png', 'png');
    쓰기('copied-only-20261004/a.cjs', '//');
    쓰기('unrelated-20261001/a.cjs', "require('../../release-20261019/x.cjs')");
    쓰기('video-20261002/clip.cjs', "// ../../.. 같은 점 경로만 있다");
    for (const 이름 of ['platform-ha-20261011', 'server-latency-20261013', 'old-evidence-20261012', 'doc-only-20261003', 'copied-only-20261004', 'unrelated-20261001', 'video-20261002']) 옛날로(path.join(임시, 이름), 30);

    const 목록 = 정리.목록만들기({ 임시, 대기 });
    assert.deepEqual(목록.후보.map((c) => c.이름).sort(), ['copied-only-20261004', 'doc-only-20261003', 'unrelated-20261001', 'video-20261002'],
      '옛 폴더가 최근 폴더를 가리키는 것·문서·소스 사본 안의 경로는 남길 이유가 아니다');
    assert.deepEqual(목록.참조로남김.map((x) => x.이름), ['old-evidence-20261012', 'platform-ha-20261011', 'server-latency-20261013']);
    assert.deepEqual(목록.참조로남김.find((x) => x.이름 === 'server-latency-20261013').가리킨, ['platform-ha-20261011']);
    assert.match(정리.글로(목록), /최근 작업이 경로로 끌어 써서 목록에서 뺀 폴더 3개/);
    const r = 정리.옮기기(['platform-ha-20261011', 'video-20261002'], { 임시, 대기, 지금: new Date(2026, 10, 1).getTime() });
    assert.deepEqual(r.옮김, ['video-20261002']);
    assert.ok(fs.existsSync(path.join(임시, 'platform-ha-20261011', 'remote.cjs')), '참조되는 폴더는 승인 목록에 있어도 옮기지 않는다');
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('json의 겹 역슬래시 경로 · path.join(…, \'..\', 이름) · 1MiB 안의 큰 기록 · _정리제외.txt도 남길 이유다(10-29 회사 사슬 38)', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-tmp-chain-'));
  try {
    const 임시 = path.join(방, '.tmp'), 대기 = path.join(방, '정리대기');
    const 쓰기 = (상대, 글) => { const p = path.join(임시, 상대); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, 글); };
    쓰기('chain-38-20261029/release-prep/parent-pins.json', JSON.stringify({ path: 'C:\\Users\\me\\SYNK\\.tmp\\pins-20261016\\release.json' }));
    쓰기('chain-38-20261029/make.cjs', "const parent = path.join(task, '..', 'signal-v4-20261010'); require(parent);");
    쓰기('chain-38-20261029/big-record.json', JSON.stringify({ pad: 'x'.repeat(100 * 1024), evidence: '.tmp/evidence-20261012/run.json' }));
    쓰기('pins-20261016/release.json', '{}');
    쓰기('signal-v4-20261010/a.cjs', '//');
    쓰기('evidence-20261012/run.json', '{}');
    쓰기('kept-lineage-20261016/rearm.cjs', "require('../older-20261015/approval.cjs')");
    쓰기('older-20261015/approval.cjs', '//');
    쓰기('plain-old-20261001/a.txt', 'x');
    for (const 이름 of ['pins-20261016', 'signal-v4-20261010', 'evidence-20261012', 'kept-lineage-20261016', 'older-20261015', 'plain-old-20261001']) 옛날로(path.join(임시, 이름), 30);
    fs.writeFileSync(path.join(임시, '_정리제외.txt'), '# 회사 릴리스 계보 — 10-29 되돌림\nkept-lineage-20261016  # 사슬 37 rearm\n');

    const 목록 = 정리.목록만들기({ 임시, 대기 });
    assert.deepEqual(목록.후보.map((c) => c.이름), ['plain-old-20261001']);
    assert.deepEqual(목록.참조로남김.map((x) => x.이름).sort(), ['evidence-20261012', 'older-20261015', 'pins-20261016', 'signal-v4-20261010']);
    assert.deepEqual(정리.옮기기(['kept-lineage-20261016', 'pins-20261016'], { 임시, 대기 }).옮김, [], '제외 목록과 그 계보는 승인 목록에 있어도 옮기지 않는다');
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('참조는 상한 없이 끝까지 훑는다 — 2천 파일 넘는 폴더 뒤쪽·1MiB 넘는 기록도 보고, 상한을 주어 잘리면 목록을 비운다(10-30)', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-tmp-cap-'));
  try {
    const 임시 = path.join(방, '.tmp'), 대기 = path.join(방, '정리대기');
    const 쓰기 = (상대, 글) => { const p = path.join(임시, 상대); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, 글); };
    // 훑기는 쌓기(LIFO)라 b/가 먼저 — 옛 상한(폴더당 2000)이면 b/의 2,100개를 본 뒤 a/를 보지 않았다.
    for (let i = 0; i < 2100; i++) 쓰기(`release-20261029/b/r${String(i).padStart(4, '0')}.json`, '{}');
    쓰기('release-20261029/a/approval-input.json', JSON.stringify({ previous: 'C:\\Users\\me\\SYNK\\.tmp\\deep-chain-20261013\\evidence.json' }));
    쓰기('release-20261029/big.json', JSON.stringify({ pad: 'x'.repeat(2 * 1024 * 1024), evidence: '.tmp/big-ref-20261012/run.json' }));
    쓰기('release-20261029/huge.json', JSON.stringify({ pad: 'x'.repeat(33 * 1024 * 1024), evidence: '.tmp/huge-ref-20261011/run.json' }));
    for (const 이름 of ['deep-chain-20261013', 'big-ref-20261012', 'huge-ref-20261011', 'plain-old-20261001']) { 쓰기(`${이름}/a.json`, '{}'); 옛날로(path.join(임시, 이름), 30); }

    const 목록 = 정리.목록만들기({ 임시, 대기 });
    assert.equal(목록.참조잘림, false);
    assert.deepEqual(목록.참조로남김.map((x) => x.이름), ['big-ref-20261012', 'deep-chain-20261013']);
    assert.deepEqual(목록.후보.map((c) => c.이름).sort(), ['huge-ref-20261011', 'plain-old-20261001'], '32MiB 넘는 파일은 건너뛰고 센다');
    assert.deepEqual(목록.큰파일, ['release-20261029/huge.json']);

    const 잘린 = 정리.목록만들기({ 임시, 대기, 상한: { 폴더당: 2000, 전체: 60000 } });
    assert.equal(잘린.참조잘림, true);
    assert.deepEqual(잘린.후보, [], '덜 훑었으면 쓰는 폴더가 섞였을 수 있어 아무것도 내놓지 않는다');
    assert.match(정리.글로(잘린), /끝까지 훑지 못해/);
    assert.deepEqual(정리.옮기기(['deep-chain-20261013', 'plain-old-20261001'], { 임시, 대기, 상한: { 폴더당: 1, 전체: 1 } }).옮김, []);
    assert.ok(fs.existsSync(path.join(임시, 'deep-chain-20261013')));
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('_정리제외.txt의 「#! 실측 계보」 절은 남기기만 하고 그 폴더 안의 언급은 따라가지 않는다 — 같은 이름이 절 밖에도 있으면 따라간다(10-30)', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-tmp-closed-'));
  try {
    const 임시 = path.join(방, '.tmp'), 대기 = path.join(방, '정리대기');
    const 쓰기 = (상대, 글) => { const p = path.join(임시, 상대); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, 글); };
    쓰기('closed-release-20261020/deployment/validation.json', JSON.stringify({ source: 'C:\\Users\\me\\SYNK\\.tmp\\provenance-candidate-20261019\\candidate' }));
    쓰기('recent-closed-20261029/rearm/approval.cjs', "require('../../recent-mention-20261001/x.cjs')");
    쓰기('both-20261018/a.json', '{"x":".tmp/both-ref-20261017/a.cjs"}');
    쓰기('plain-lineage-20261016/a.cjs', "require('../../plain-ref-20261015/a.cjs')");
    for (const 이름 of ['provenance-candidate-20261019', 'recent-mention-20261001', 'both-ref-20261017', 'plain-ref-20261015']) 쓰기(`${이름}/a.cjs`, '//');
    for (const 이름 of ['closed-release-20261020', 'both-20261018', 'plain-lineage-20261016', 'provenance-candidate-20261019', 'recent-mention-20261001', 'both-ref-20261017', 'plain-ref-20261015']) 옛날로(path.join(임시, 이름), 30);
    fs.writeFileSync(path.join(임시, '_정리제외.txt'), [
      '# 회사 릴리스 계보', 'plain-lineage-20261016  # 따라감',
      '#! 실측 계보 시작 — tools/company-release/lineage.cjs 10-30', 'closed-release-20261020', 'recent-closed-20261029', 'both-20261018', '#! 실측 계보 끝',
      'both-20261018  # 절 밖에도 있다 — 따라가는 쪽이 이긴다', '',
    ].join('\r\n'));

    const 목록 = 정리.목록만들기({ 임시, 대기 });
    assert.deepEqual(목록.후보.map((c) => c.이름).sort(), ['provenance-candidate-20261019', 'recent-mention-20261001'],
      '닫힌 폴더(최근이어도)의 언급은 남길 이유가 아니다');
    assert.deepEqual(목록.참조로남김.map((x) => x.이름), ['both-ref-20261017', 'plain-ref-20261015']);
    assert.deepEqual(정리.옮기기(['closed-release-20261020', 'recent-closed-20261029'], { 임시, 대기 }).옮김, [], '닫힌 폴더 자신은 그대로 남는다');
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('모음 폴더 .tmp/검수는 통째로 남기고 묶음마다 잰다 — 최근 묶음 · _보존 묶음 · 그 다시 검수 사슬의 앞 고리만 언급을 따라간다(11-07)', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-tmp-review-'));
  try {
    const 임시 = path.join(방, '.tmp'), 대기 = path.join(방, '정리대기'), 검수 = path.join(임시, '검수');
    const 쓰기 = (상대, 글) => { const p = path.join(임시, 상대); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, typeof 글 === 'string' ? 글 : JSON.stringify(글)); };
    const 후보 = (이름) => `C:\\Users\\me\\SYNK\\.tmp\\${이름}\\후보.json`;
    // 오늘 만든 묶음 — 배포 관문 --검수가 곧 다시 연다
    쓰기('검수/fresh-20261107/묶음.json', { 판: 2, 이름: 'fresh-20261107', 설정: { 배포후보: 후보('fresh-candidate-20261101') } });
    // 오늘 이은 다시 검수(끝) → 옛 가운데 고리(적힌 폴더) → 옛 처음 고리(폴더가 없어 이름으로) — 검수확인이 고리마다 배포후보 · 사용자지정을 다시 읽는다
    쓰기('검수/chain-end-20261107/묶음.json', { 판: 2, 갈래: '델타', 앞: { 이름: 'chain-mid-20261020', 폴더: path.join(검수, 'chain-mid-20261020') } });
    쓰기('검수/chain-mid-20261020/묶음.json', { 판: 2, 갈래: '델타', 앞: { 이름: 'chain-start-20261018', 폴더: path.join(방, '보관된-워크트리', '.tmp', '검수', 'chain-start-20261018') },
      설정: { 배포후보: 후보('mid-candidate-20261020') } });
    쓰기('검수/chain-start-20261018/묶음.json', { 판: 2, 설정: { 배포후보: 후보('start-candidate-20261018'), 사용자지정: 'C:\\Users\\me\\SYNK\\.tmp\\authority-20261018\\지정.json' } });
    // 모음 밖 고리(GPT GA1) — 오늘 끝 고리 → 다른 작업본 .tmp의 가운데 고리(적힌 폴더가 있으면 그쪽을 연다) → 이 .tmp 옛 보관 폴더 안의 처음 고리
    const 밖가운데 = path.join(방, '다른작업본', '.tmp', '검수', 'chain2-mid-20261020');
    쓰기('검수/chain2-end-20261107/묶음.json', { 판: 2, 갈래: '델타', 앞: { 이름: 'chain2-mid-20261020', 폴더: 밖가운데 } });
    fs.mkdirSync(밖가운데, { recursive: true });
    fs.writeFileSync(path.join(밖가운데, '묶음.json'), JSON.stringify({ 판: 2, 갈래: '델타', 앞: { 이름: 'chain2-start-20261016', 폴더: path.join(임시, 'review-archive-20261015', 'chain2-start-20261016') } }));
    쓰기('review-archive-20261015/chain2-start-20261016/묶음.json', { 판: 2, 설정: { 배포후보: 후보('chain2-start-candidate-20261016') } });
    // 옛 묶음 — 검수 자료 · 내용 사본에 적힌 옛 경로는 남길 이유가 아니다
    쓰기('검수/old-20261027/묶음.json', { 판: 2, 설정: { 배포후보: 후보('old-only-candidate-20261027') } });
    쓰기('검수/old-20261027/내용/tools/run.cjs', "require('../../old-only-tool-20261010/a.cjs')");
    쓰기('검수/old-20261027/페이블자료.json', { diff: '.tmp/old-only-sns-20261012/plan.json', 겹침: '.tmp/fresh-candidate-20261101/후보.json' });
    // 옛 묶음이지만 _보존.txt가 있으면 따라간다
    쓰기('검수/kept-20261015/묶음.json', { 설정: { 배포후보: 후보('kept-candidate-20261015') } });
    쓰기('검수/kept-20261015/_보존.txt', '남김');
    쓰기('검수/_맨위메모.json', { x: '.tmp/loose-ref-20261009/a.json' });
    const 옛폴더 = ['fresh-candidate-20261101', 'mid-candidate-20261020', 'start-candidate-20261018', 'authority-20261018', 'old-only-candidate-20261027', 'old-only-tool-20261010',
      'old-only-sns-20261012', 'kept-candidate-20261015', 'loose-ref-20261009', 'plain-old-20261001', 'chain2-start-candidate-20261016', 'review-archive-20261015'];
    for (const 이름 of 옛폴더) { 쓰기(`${이름}/a.json`, '{}'); 옛날로(path.join(임시, 이름), 30); }
    for (const 이름 of ['chain-mid-20261020', 'chain-start-20261018', 'old-20261027', 'kept-20261015']) 옛날로(path.join(검수, 이름), 20);
    옛날로(path.join(검수, '_맨위메모.json'), 20);

    const 목록 = 정리.목록만들기({ 임시, 대기, 일수: 3 });
    assert.deepEqual(목록.참조로남김.map((x) => [x.이름, x.가리킨]), [
      ['authority-20261018', ['검수/chain-start-20261018']],
      ['chain2-start-candidate-20261016', ['review-archive-20261015/chain2-start-20261016']],
      ['fresh-candidate-20261101', ['검수/fresh-20261107']],
      ['kept-candidate-20261015', ['검수/kept-20261015']],
      ['mid-candidate-20261020', ['검수/chain-mid-20261020']],
      ['review-archive-20261015', ['../다른작업본/.tmp/검수/chain2-mid-20261020']],
      ['start-candidate-20261018', ['검수/chain-start-20261018']],
    ], '옛 묶음(old-20261027)이 함께 가리켜도 가리킨 쪽에는 최근 · 사슬 · _보존 묶음만 적히고, 모음 밖 고리를 거쳐도 사슬이 이어진다');
    assert.deepEqual(목록.후보.map((c) => c.이름).sort(), ['loose-ref-20261009', 'old-only-candidate-20261027', 'old-only-sns-20261012', 'old-only-tool-20261010', 'plain-old-20261001'],
      '옛 묶음만 가리키는 폴더 · 모음 폴더 맨 위 낱 파일의 언급은 후보로 보인다');
    assert.ok(!목록.후보.some((c) => c.이름 === '검수'), '모음 폴더 자신은 후보가 아니다');
    assert.deepEqual(목록.모음, [{ 이름: '검수', 묶음: 7, 뿌리: 8, 최근: 3, 보존: 1, 앞고리: 4 }]);
    assert.match(정리.글로(목록), /검수 폴더는 통째로 남기고 묶음 7개 가운데 3일 안 묶음 3개 · _보존 묶음 1개와 그 다시 검수 사슬의 앞 묶음 4개가 가리킨 폴더만 남겼어요/,
      '오래된 _보존 묶음은 「3일 안」에 세지 않는다(GPT GA2)');
    assert.deepEqual(정리.옮기기(['검수', 'mid-candidate-20261020'], { 임시, 대기, 일수: 3 }).옮김, [], '모음 폴더와 사슬 고리가 가리키는 폴더는 승인 목록에 있어도 옮기지 않는다');

    // 모든 묶음이 옛것이 되어도 검수 폴더는 후보가 아니고, 묶음의 언급은 남길 이유가 되지 않는다
    const 나중 = 정리.목록만들기({ 임시, 대기, 일수: 3, 지금: Date.now() + 10 * 하루 });
    assert.ok(!나중.후보.some((c) => c.이름 === '검수'));
    assert.deepEqual(나중.참조로남김.map((x) => x.이름), ['kept-candidate-20261015'], '_보존.txt 묶음만 남는다');
    assert.deepEqual(나중.모음, [{ 이름: '검수', 묶음: 7, 뿌리: 1, 최근: 0, 보존: 1, 앞고리: 0 }]);
    assert.ok(나중.후보.some((c) => c.이름 === 'review-archive-20261015'), '사슬이 다 옛것이면 모음 밖 고리를 담은 폴더도 후보다');

    // _정리제외.txt에 검수를 적으면 예전처럼 통째로 따라가고, 모음 밖 사슬 고리도 잇는다
    fs.writeFileSync(path.join(임시, '_정리제외.txt'), '검수  # 통째로 따라감\n');
    const 통째 = 정리.목록만들기({ 임시, 대기, 일수: 3, 지금: Date.now() + 10 * 하루 });
    assert.deepEqual(통째.후보.map((c) => c.이름), ['plain-old-20261001']);
    assert.deepEqual(통째.모음, [{ 이름: '검수', 통째: true, 묶음: 7, 밖고리: 2 }]);
    assert.match(정리.글로(통째), /검수 폴더는 _정리제외.txt · _보존.txt에 적혀 묶음 7개를 모두 따라갔어요/);
    // 실측 계보 절(닫힘)에 적으면 남기기만 하고 아무것도 따라가지 않는다
    fs.writeFileSync(path.join(임시, '_정리제외.txt'), '#! 실측 계보 시작\n검수\n#! 실측 계보 끝\n');
    const 닫힘 = 정리.목록만들기({ 임시, 대기, 일수: 3 });
    assert.ok(닫힘.후보.some((c) => c.이름 === 'fresh-candidate-20261101') && !닫힘.후보.some((c) => c.이름 === '검수'));
    assert.deepEqual(닫힘.모음, []);
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('저장소의 추적 코드가 .tmp/<이름>으로 쓰는 폴더는 남기고 그 언급도 따라간다 — 문서 · 추적 안 된 파일 · 생성물 폴더는 아니다(11-07)', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-tmp-repo-'));
  try {
    const 임시 = path.join(방, '.tmp'), 대기 = path.join(방, '정리대기');
    const 쓰기 = (상대, 글) => { const p = path.join(방, 상대); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, 글); };
    쓰기('tools/오마주.js', "const 캐시 = path.join(뿌리, '.tmp', 'tool-cache');\nconst 날 = path.join(REPO, '.tmp', DAILY ? 'daily-scan' : 'weekly-scan', `${오늘}`);\n"
      + "const 색인 = path.join(뿌리, '.tmp', 'nested-ref/index.json');");
    쓰기('tests/지면.test.js', "const 판 = '.tmp/test-fixture-20261030/a.png';");
    쓰기('tools/받기.py', "받을곳 = Path.cwd() / '.tmp' / 'py-cache' / 오늘\n옛곳 = Path(\".tmp\") / \"py-paren\"\n");
    쓰기('experiences/x/qa/공개후보.cjs', "require(String.raw`C:\\SYNK\\.tmp\\qa-bake-20261104\\run.cjs`)");
    쓰기('docs/기록.md', '`.tmp/doc-only-20261001/` 문서에만 적힘');
    쓰기('tools/dist/묶음.js', "'.tmp/generated-only-20261002'");
    쓰기('tools/추적안함.js', "'.tmp/untracked-only-20261003'");
    for (const 이름 of ['tool-cache', 'test-fixture-20261030', 'qa-bake-20261104', 'doc-only-20261001', 'generated-only-20261002', 'untracked-only-20261003', 'chained-20261001',
      'daily-scan', 'weekly-scan', 'nested-ref', 'py-cache', 'py-paren']) 쓰기(`.tmp/${이름}/a.json`, '{}');
    쓰기('.tmp/tool-cache/색인.json', JSON.stringify({ 원본: '.tmp/chained-20261001/a.json' }));
    for (const 이름 of fs.readdirSync(임시)) 옛날로(path.join(임시, 이름), 30);
    const git = (...a) => { const r = spawnSync('git', ['-C', 방, ...a], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); };
    git('init', '-q');
    git('add', 'tools/오마주.js', 'tools/받기.py', 'tests/지면.test.js', 'experiences', 'docs', 'tools/dist');

    const 목록 = 정리.목록만들기({ 임시, 대기 });
    assert.deepEqual(목록.후보.map((c) => c.이름).sort(), ['doc-only-20261001', 'generated-only-20261002', 'untracked-only-20261003']);
    assert.deepEqual(목록.참조로남김.map((x) => [x.이름, x.가리킨]), [
      ['chained-20261001', ['tool-cache']],
      ['daily-scan', ['저장소:tools/오마주.js']],
      ['nested-ref', ['저장소:tools/오마주.js']],
      ['py-cache', ['저장소:tools/받기.py']],
      ['py-paren', ['저장소:tools/받기.py']],
      ['qa-bake-20261104', ['저장소:experiences/x/qa/공개후보.cjs']],
      ['test-fixture-20261030', ['저장소:tests/지면.test.js']],
      ['tool-cache', ['저장소:tools/오마주.js']],
      ['weekly-scan', ['저장소:tools/오마주.js']],
    ], '조건식으로 고르는 이름(DAILY ? … : …) · 한 따옴표 안의 하위 경로(nested-ref/index.json) · 파이썬 pathlib의 / 꼴도 잡는다');
    assert.equal(목록.저장소로남김, 8);
    assert.equal(목록.저장소코드, 4, 'git ls-files의 코드 파일만 — 문서 · 생성물 폴더 · 추적 안 된 파일은 뺀다');
    assert.match(정리.글로(목록), /저장소 코드가 \.tmp\/<이름>으로 쓰는 폴더 8개\(저장소 코드 4개 파일을 봤어요\)/);
    assert.deepEqual(정리.옮기기(['tool-cache', 'doc-only-20261001'], { 임시, 대기 }).옮김, ['doc-only-20261001']);

    // 저장소가 아닌 곳(.git 없음)은 저장소 코드를 보지 않는다 — 앞의 시험들이 그 꼴이다
    fs.rmSync(path.join(방, '.git'), { recursive: true, force: true });
    const 밖 = 정리.목록만들기({ 임시, 대기 });
    assert.equal(밖.저장소코드, null);
    assert.ok(밖.후보.some((c) => c.이름 === 'tool-cache'));
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('릴리스·후보 사본은 갈래마다 새 판 둘만 남기고 옛 판은 날짜와 상관없이 후보 — 남는 판이 끌어 쓰는 옛 판·_보존은 뺀다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-tmp-release-'));
  try {
    const 임시 = path.join(방, '.tmp'), 대기 = path.join(방, '정리대기');
    const 쓰기 = (상대, 글) => { const p = path.join(임시, 상대); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, 글); };
    for (const 판 of ['', '-v2', '-v3']) 쓰기(`post-performance-release${판}-20261018/a.bin`, 'x'.repeat(2048));
    쓰기('company-read-release-20261018/helper.cjs', '//');
    쓰기('company-read-release-v2-20261018/a.cjs', '//');
    쓰기('company-read-release-v3-20261018/run.cjs', "require('../../company-read-release-20261018/helper.cjs')");
    쓰기('push-wake-candidate-20261020/a.cjs', '//');
    쓰기('push-wake-release-20261020/a.cjs', '//');
    쓰기('push-wake-release-20261012/a.cjs', '//');
    쓰기('push-wake-release-20261012/_보존.txt', '남김');
    쓰기('solo-pc-release-20261019/a.bin', 'x');
    쓰기('old-board-release-20261001/a.bin', 'x');
    옛날로(path.join(임시, 'old-board-release-20261001'), 30);

    const 목록 = 정리.목록만들기({ 임시, 대기 });
    const 본것 = Object.fromEntries(목록.후보.map((c) => [c.이름, c.까닭]));
    assert.deepEqual(본것, { 'post-performance-release-20261018': ['릴리스옛판'], 'old-board-release-20261001': ['14일'] },
      '새 판 둘(v3·v2)·끌어 쓰는 옛 판·_보존·한 판짜리 새 사본은 후보가 아니다');
    assert.deepEqual(목록.참조로남김.map((x) => x.이름), ['company-read-release-20261018']);
    assert.deepEqual(목록.남긴판['post-performance'], ['post-performance-release-v3-20261018', 'post-performance-release-v2-20261018']);
    assert.ok(목록.후보.every((c) => c.릴리스));
    const 글 = 정리.글로(목록);
    assert.match(글, /폴더 1개 · 릴리스·후보 사본의 옛 판 1개/);
    assert.match(글, /① 릴리스·후보 사본 2개/);
    assert.match(글, /post-performance: 1개 · [\d.]+MB \(남기는 새 판: post-performance-release-v3-20261018, post-performance-release-v2-20261018\)/);
    assert.match(글, /「릴리스 옛 판 정리」/);
    assert.deepEqual(정리.묶음(목록, '릴리스옛판'), ['post-performance-release-20261018']);
    assert.throws(() => 정리.묶음(목록, '없는묶음'), /모르는 묶음/);
    const r = 정리.옮기기(정리.묶음(목록, '릴리스옛판'), { 임시, 대기, 지금: new Date(2026, 10, 1).getTime() });
    assert.deepEqual(r.옮김, ['post-performance-release-20261018']);
    assert.ok(fs.existsSync(path.join(임시, 'company-read-release-20261018', 'helper.cjs')), '끌어 쓰는 옛 판은 그대로');
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('후보가 서른 개를 넘으면 이름 앞말로 묶어 보이고, 이사 복사 날에 마지막 수정이 몰린 폴더는 따로 센다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-tmp-group-'));
  try {
    const 임시 = path.join(방, '.tmp'), 대기 = path.join(방, '정리대기');
    for (let i = 0; i < 31; i++) {
      const p = path.join(임시, `alpha-${i}-2026090${i % 9 + 1}`);
      fs.mkdirSync(p, { recursive: true }); fs.writeFileSync(path.join(p, 'a.txt'), 'x'); 옛날로(p, 30);
    }
    const p = path.join(임시, 'beta-20260801'); fs.mkdirSync(p, { recursive: true }); fs.writeFileSync(path.join(p, 'a.txt'), 'x'); 옛날로(p, 60);
    const 그날 = new Date(Date.now() - 30 * 하루);
    const 이사날 = [`${그날.getFullYear()}-${String(그날.getMonth() + 1).padStart(2, '0')}-${String(그날.getDate()).padStart(2, '0')}`];
    const 목록 = 정리.목록만들기({ 임시, 대기, 이사날 });
    assert.equal(목록.후보.length, 32);
    const 글 = 정리.글로(목록);
    assert.match(글, /② 마지막 수정이 노트북 이사 복사 날\([^)]+\)인 폴더 31개 · [\d.]+MB — 이름 속 날짜로는 2026-09-01 ~ 2026-09-09/);
    assert.match(글, /③ 그 밖의 폴더 32개/);
    assert.match(글, /· alpha: 31개/);
    assert.doesNotMatch(글, /^- alpha-0-/m, '묶어 보일 때는 하나씩 적지 않는다');
    assert.match(정리.글로(목록, { 자세히: true }), /^- alpha-0-20260901 · .* · 이사 복사 시각\(이름 날짜 2026-09-01\)/m);
    assert.equal(정리.묶음(목록, '이사복사').length, 31);
    assert.deepEqual(정리.묶음(목록, '14일').length, 32);
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

/** 명령 본체에 넣을 가짜 — 화면·기기 확인·텔레그램 보내기를 세기만 한다. 실제 .tmp·output·텔레그램은 건드리지 않는다. */
function 가짜주입(더 = {}) {
  const 셈 = { 기기: 0, 보낸: [], 찍은: [], 알린: [] };
  const 주입 = {
    찍기: (글) => 셈.찍은.push(글), 알리기: (글) => 셈.알린.push(글),
    기기모델: () => { 셈.기기++; return '83F5'; }, 보내기: (글) => 셈.보낸.push(글), ...더,
  };
  return { 셈, 주입 };
}

test('--help · -h는 쓰는 법만 찍고 0으로 끝난다 — 기기 확인 · 훑기 · 기록 파일 · 보내기 없음(10-30 · 11-06 --help가 기본 길로 흘렀다)', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-tmp-help-'));
  try {
    const 임시 = path.join(방, '.tmp'), 대기 = path.join(방, '정리대기'), 기록방 = path.join(방, '기록');
    for (const argv of [['--help'], ['-h'], ['--보내지않기', '--help'], ['--옮기기', '옛것', '-h'], ['--모름', '--help']]) {
      const { 셈, 주입 } = 가짜주입({ 옵션: { 임시, 대기 }, 기록방 });
      assert.equal(정리.실행(argv, 주입), 0, argv.join(' '));
      assert.deepEqual(셈.찍은, [정리.쓰는법]);
      assert.equal(셈.기기, 0);
      assert.deepEqual(셈.보낸, []);
      assert.deepEqual(셈.알린, []);
    }
    assert.ok(!fs.existsSync(기록방));
    for (const 말 of ['--보내지않기', '--자세히', '--json', '--옮기기', '--묶음 릴리스옛판|이사복사|14일|전부', '--일수 N', '--help, -h']) assert.ok(정리.쓰는법.includes(말), 말);
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('모르는 인자 · 값 없는 선택지는 훑기 전에 쓰는 법을 찍고 2 — 기록 파일 없음 · 텔레그램 안 부름 · 옮기지 않음', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-tmp-unknown-'));
  try {
    const 임시 = path.join(방, '.tmp'), 대기 = path.join(방, '정리대기'), 기록방 = path.join(방, '기록');
    fs.mkdirSync(path.join(임시, '옛것'), { recursive: true });
    fs.writeFileSync(path.join(임시, '옛것', 'a.txt'), 'x');
    옛날로(path.join(임시, '옛것'), 30);
    const 틀린것 = [
      ['--모름'], ['--dry-run'], ['--보내지않기', '--모름'], ['--json', '남는낱말'], ['남는낱말'], ['--일수=3'],
      // 11-07 첫 고침은 --옮기기가 맨 앞이면 뒤를 보지 않아 이 꼴이 그대로 옮겼다
      ['--옮기기', '옛것', '--시험'], ['--옮기기', '--묶음', '14일', '--모름'],
      ['--옮기기'], ['--옮기기', '--일수', '3'], ['--옮기기', '--묶음'], ['--옮기기', '--묶음', '없는묶음'], ['--옮기기', '--묶음', '__proto__'],
      ['--옮기기', '옛것', '--묶음', '14일'], ['--묶음', '14일'],
      ['--일수'], ['--일수', '0'], ['--일수', '2.5'], ['--일수', '--json'],
    ];
    for (const argv of 틀린것) {
      const { 셈, 주입 } = 가짜주입({ 옵션: { 임시, 대기 }, 기록방 });
      assert.equal(정리.실행(argv, 주입), 2, argv.join(' '));
      const 알린글 = 셈.알린.join('\n');
      assert.match(알린글, /아무것도 하지 않았다/, argv.join(' '));
      assert.ok(알린글.includes(정리.쓰는법), `${argv.join(' ')}: 쓰는 법을 같이 찍는다`);
      assert.equal(셈.기기, 0, `${argv.join(' ')}: 기기 확인(과 그 뒤의 훑기) 전에 끝난다`);
      assert.deepEqual(셈.보낸, [], argv.join(' '));
      assert.deepEqual(셈.찍은, [], argv.join(' '));
    }
    assert.ok(!fs.existsSync(기록방), '기록 파일을 쓰지 않는다');
    assert.ok(!fs.existsSync(대기), '아무것도 옮기지 않는다');
    assert.ok(fs.existsSync(path.join(임시, '옛것', 'a.txt')));
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('부르는 쪽이 쓰는 꼴은 그대로 받는다 — 매달 기본 · 앱 예약 synk-tmp-monthly-list · 공간 정리(--일수 3)', () => {
  const 빈것 = { 일수: null, 옮기기: null, 묶음: null, json: false, 보내지않기: false, 자세히: false };
  const 꼴 = [
    [[], {}],
    [['--보내지않기'], { 보내지않기: true }],
    [['--보내지않기', '--자세히'], { 보내지않기: true, 자세히: true }],
    [['--json'], { json: true }],
    [['--json', '--일수', '3'], { json: true, 일수: 3 }],
    [['--일수', '3', '--보내지않기'], { 일수: 3, 보내지않기: true }],
    [['--옮기기', '이름1,이름2'], { 옮기기: ['이름1', '이름2'] }],
    [['--옮기기', ' 이름1 , 이름2 ,'], { 옮기기: ['이름1', '이름2'] }],
    [['--옮기기', '--묶음', '릴리스옛판'], { 옮기기: [], 묶음: ['릴리스옛판'] }],
    [['--옮기기', '--묶음', '릴리스옛판,이사복사'], { 옮기기: [], 묶음: ['릴리스옛판', '이사복사'] }],
    [['--옮기기', '--묶음', '14일', '--일수', '3'], { 옮기기: [], 묶음: ['14일'], 일수: 3 }],
    [['--일수', '3', '--옮기기', '--묶음', '전부'], { 옮기기: [], 묶음: ['전부'], 일수: 3 }],
  ];
  for (const [argv, 기대] of 꼴) assert.deepEqual(정리.인자읽기(argv), { ...빈것, ...기대 }, argv.join(' '));
});

test('받는 꼴은 끝까지 돈다 — 기본은 기록 파일을 쓰고 보내고, --보내지않기는 쓰기만, --json은 찍기만, --옮기기는 옮긴다(가짜 보내기)', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-tmp-cli-'));
  try {
    const 임시 = path.join(방, '.tmp'), 대기 = path.join(방, '정리대기'), 기록방 = path.join(방, '기록');
    for (const 이름 of ['옛것', '옛둘', '새것']) { fs.mkdirSync(path.join(임시, 이름), { recursive: true }); fs.writeFileSync(path.join(임시, 이름, 'a.txt'), 'x'); }
    옛날로(path.join(임시, '옛것'), 30); 옛날로(path.join(임시, '옛둘'), 30);
    const 기록파일 = path.join(기록방, `${new Date().toISOString().slice(0, 10)}.md`);
    const 새로 = () => 가짜주입({ 옵션: { 임시, 대기 }, 기록방 });

    let { 셈, 주입 } = 새로();
    assert.equal(정리.실행(['--json'], 주입), 0);
    assert.deepEqual(JSON.parse(셈.찍은[0]).후보.map((c) => c.이름).sort(), ['옛둘', '옛것'].sort());
    assert.equal(셈.기기, 1);
    assert.deepEqual(셈.보낸, []);
    assert.ok(!fs.existsSync(기록방), '--json은 기록 파일을 쓰지 않는다');

    ({ 셈, 주입 } = 새로());
    assert.equal(정리.실행(['--보내지않기', '--일수', '3'], 주입), 0);
    assert.match(셈.찍은[0], /3일 넘게 손대지 않은 폴더 2개/);
    assert.equal(fs.readFileSync(기록파일, 'utf8'), 셈.찍은[0] + '\n');
    assert.deepEqual(셈.보낸, []);
    fs.rmSync(기록방, { recursive: true, force: true });

    ({ 셈, 주입 } = 새로());
    assert.equal(정리.실행([], 주입), 0);
    assert.deepEqual(셈.보낸, [셈.찍은[0]], '기본 길만 보낸다');
    assert.ok(fs.existsSync(기록파일));

    ({ 셈, 주입 } = 새로());
    assert.equal(정리.실행(['--옮기기', '옛것,새것'], 주입), 0);
    assert.match(셈.찍은[0], /^옮긴 폴더 1개 → /);
    assert.match(셈.찍은[0], /남긴 것: 새것\(지금 후보가 아님\)/);
    ({ 셈, 주입 } = 새로());
    assert.equal(정리.실행(['--옮기기', '--묶음', '14일'], 주입), 0);
    assert.match(셈.찍은[0], /^옮긴 폴더 1개 → /);
    assert.deepEqual(셈.보낸, []);
    assert.deepEqual(fs.readdirSync(임시).sort(), ['새것']);

    const 다른 = 가짜주입({ 기기모델: () => 'X1', 옵션: { 임시, 대기 }, 기록방 });
    assert.equal(정리.실행(['--보내지않기'], 다른.주입), 2);
    assert.match(다른.셈.알린[0], /새 노트북\(83F5\)이 아니라서 아무것도 하지 않았다/);
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('명령으로 불러도 같다 — --help는 0 · 쓰는 법, 모르는 인자는 2 · 쓰는 법(기기 확인에 닿으면 멈추는 가드로 실제 훑기 · 보내기를 막고 본다)', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-tmp-spawn-'));
  try {
    // 인자를 읽은 다음 맨 먼저 기기 모델을 powershell로 묻는다 — 거기 닿으면 99로 끝내 그 뒤(훑기 · 기록 · 보내기)를 막는다.
    const 가드 = path.join(방, '가드.cjs');
    fs.writeFileSync(가드, [
      "const cp = require('child_process'); const 원래 = cp.spawnSync;",
      "cp.spawnSync = (명령, ...나머지) => { if (/powershell/i.test(String(명령))) { process.stderr.write('가드: 기기 확인까지 갔다\\n'); process.exit(99); } return 원래(명령, ...나머지); };",
    ].join('\n'));
    const 돌기 = (...argv) => spawnSync(process.execPath, ['-r', 가드, 도구, ...argv],
      { encoding: 'utf8', env: { ...process.env, SYNK_CREDIT_NO_TELEGRAM: '1' }, timeout: 60000, windowsHide: true });
    const 도움 = 돌기('--help');
    assert.equal(도움.status, 0, 도움.stderr);
    assert.equal(도움.stdout.trim(), 정리.쓰는법);
    assert.equal(도움.stderr, '');
    const 모름 = 돌기('--모름');
    assert.equal(모름.status, 2, 모름.stderr);
    assert.match(모름.stderr, /모르는 인자 --모름 — 아무것도 하지 않았다/);
    assert.ok(모름.stderr.includes(정리.쓰는법));
    assert.equal(모름.stdout, '');
    assert.equal(돌기('--json').status, 99, '가드가 제 몫을 한다 — 받는 꼴은 기기 확인에 닿는다');
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});
