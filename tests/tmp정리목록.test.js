'use strict';

// .tmp 한 달 정리 목록 — 임시 폴더에 가짜 .tmp를 만들어 시각을 되돌려 놓고 확인한다. 실제 .tmp·정리 대기 폴더는 건드리지 않는다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 정리 = require('../tools/tmp정리목록.js');

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
    옛날로(path.join(임시, '옛큰것'), 30); 옛날로(path.join(임시, '옛작은것'), 20); 옛날로(path.join(임시, '보존'), 40); 옛날로(path.join(임시, '섞임'), 30);
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

    const r = 정리.옮기기(['옛작은것', '섞임', '../밖'], { 임시, 대기, 지금: new Date(2026, 10, 1).getTime() });
    assert.deepEqual(r.옮김, ['옛작은것']);
    assert.deepEqual(r.남김.map((x) => x.이름), ['섞임', '../밖']);
    assert.ok(fs.existsSync(path.join(대기, '20261101', '옛작은것', 'c.txt')));
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
