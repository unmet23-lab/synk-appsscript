'use strict';
// 캡션 연결(11-18) — 주소 없이 걸린 판의 게시물을 계정 · 게시글지문 · 같은 글로 잇는다. 실제 게시장부 postTextSha로 지문을 적어 쓰는 쪽과 같은 셈인지도 본다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const 캡션 = require('../tools/lib/게시성과캡션.js');
const 연결 = require('../tools/lib/게시성과연결.js');
const 편 = require('../tools/lib/게시성과편.js');
const 장부 = require('../tools/게시장부.js');
const 도구 = require('../tools/게시성과.js');
const { TITLE_MAX } = require('../tools/lib/게시성과읽기.cjs');

const CAPTION_A = 'Ядарсан үедээ хэлдэг 4 үг 😴\n\n졸려 (жоллё) — Нойр хүрч байна\n힘들어 (химдырө) — Ядарч байна\n' + '피곤해 — Ядарсан. '.repeat(12);
const CAPTION_B = 'Найз, дүүдээ 잘 자 (жал жа) гэдэг бол байрны эзэн эгч, багш, томчуудад 안녕히 주무세요 гэнэ.';
// 서버처럼 JS 글자(UTF-16) 앞 TITLE_MAX자만 남긴다(회사 서버가 등록 제목을 200자에서 자른다)
// 서버 등록은 제목을 TITLE_MAX자에서 자른다. 잘라 낸 원문은 FULLS에 남겨, 시험 서버의 수집 목록(posts)이 같은 게시물의 완결 제목을 갖게 한다(5회차 — 완결 글끼리 대조)
const FULLS = [];
const cut = s => { FULLS.push(s); return s.slice(0, TITLE_MAX); };

function fixture(t) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-caption-link-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  fs.mkdirSync(path.join(repo, 'tools'), { recursive: true });
  const ledgerAccounts = {
    'lab-instagram': { platform: 'instagram', handle: '@synk.mn' },
    'lab-facebook': { platform: 'facebook', handle: 'facebook.com/synkworld' },
    'lab-lk-facebook': { platform: 'facebook', handle: null, apiPageId: '1322127544319220' },
    'lab-tiktok': { platform: 'tiktok', handle: '@synk.mn' },
    'yuhobuilds-youtube': { platform: 'youtube', handle: '@yuhobuilds' },
    'lab-mx-youtube': { platform: 'youtube', handle: null, expectedChannelId: 'UCmxchannel0000000000000' },
  };
  fs.mkdirSync(path.join(repo, 'docs', '마케팅'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'docs/마케팅/sns-계정.json'), JSON.stringify({ accounts: ledgerAccounts }));
  const accounts = Object.entries(ledgerAccounts).map(([key, a]) => ({ key, platform: a.platform, handle: a.handle || '', ...(a.apiPageId ? { apiPageId: a.apiPageId } : {}), ...(a.expectedChannelId ? { expectedChannelId: a.expectedChannelId } : {}) }));
  /** 편 하나 — 판마다 캡션 파일, 걸 때 지문을 실제 postTextSha로 적는다(booked: false면 지문 없이) */
  const episode = (folder, plates, { booked = true, extraRows = [] } = {}) => {
    const dir = path.join(repo, 'docs/마케팅', folder);
    fs.mkdirSync(path.join(dir, '게시'), { recursive: true });
    const 판 = plates.map(([account, text, kind = 'caption']) => {
      const file = path.join(dir, '게시', `${account}.txt`);
      fs.writeFileSync(file, kind === 'title' ? `[제목]\n${text}\n[설명]\n설명란 글\n` : text);
      return { 계정: account, 게시글: `docs/마케팅/${folder}/게시/${account}.txt`, 시각: '2026-11-15T13:00:00+09:00' };
    });
    fs.writeFileSync(path.join(dir, '게시', '준비.json'), JSON.stringify({ 브랜드: 'LAB', 판 }));
    const rows = 판.map(p => ({ 계정: p.계정, 상태: '예약됨', 시각: p.시각, ...(booked ? { 게시글지문: 장부.postTextSha(dir, p.계정) } : {}) }));
    fs.writeFileSync(path.join(dir, '게시', '게시결과.json'), JSON.stringify({ 판: [...rows, ...extraRows] }, null, 2));
    return dir;
  };
  const channels = [
    { id: 'ig', platform: 'instagram', handle: 'synk.mn' },
    { id: 'fb', platform: 'facebook', handle: 'synkworld', externalId: '1140051542527584' },
    { id: 'lk', platform: 'facebook', handle: null, name: 'SYNK LAB Sri Lanka', externalId: '1322127544319220' },
    { id: 'tt', platform: 'tiktok', handle: 'synk.mn' },
    { id: 'yt', platform: 'youtube', handle: 'yuhobuilds' },
    { id: 'other', platform: 'instagram', handle: 'someoneelse' },
    { id: 'mx', platform: 'youtube', handle: null, name: 'SYNK LAB México', externalId: 'UCmxchannel0000000000000' },
  ];
  const entry = (id, channelId, url, title, publishedAt = '2026-11-15T04:00:51Z') => ({ id, channelId, url, title, publishedAt, origin: 'auto', checkpoints: [] });
  // posts를 주지 않으면, 잘린 등록마다 cut으로 자른 원문을 제목으로 가진 수집 목록 줄을 만든다(수집기가 1000자까지 저장하는 것과 같게)
  const 수집목록 = entries => entries.filter(e => String(e.title ?? '').length >= TITLE_MAX).flatMap(e => {
    const full = FULLS.find(x => x.slice(0, TITLE_MAX) === e.title);
    return full ? [{ id: `p-${e.id}`, channelId: e.channelId, url: e.url, publishedAt: e.publishedAt, title: full }] : [];
  });
  const serverOf = (entries, posts = null) => ({ channels, entries, posts: posts ?? 수집목록(entries), snapshots: [] });
  const now = Date.parse('2026-11-16T00:00:00Z');
  const indexOf = (connections = new Map()) => 편.buildIndex(path.join(repo, 'docs/마케팅'), connections);
  return { repo, accounts, episode, entry, serverOf, now, indexOf };
}

test('같은 글: 띄어쓰기 · 줄바꿈만 빼고 통째로 같아야 한다 — 잘린 글 · 짧은 글 · 다른 글은 아니다 · 잘린 등록은 수집 목록에서 완결 글을 얻는다', () => {
  assert.equal(캡션.같은글('a  b\n\nc 둘셋넷다섯여섯', 'a b c 둘셋넷다섯여섯').ok, true);
  assert.equal(캡션.같은글(cut(CAPTION_A), CAPTION_A).ok, false, '잘린 글은 같은 글이 아니다(5회차 — 완결 글끼리만)');
  assert.equal(캡션.같은글(CAPTION_A.replace(/\n/g, ' '), CAPTION_A).ok, true, '틱톡처럼 줄바꿈이 띄어쓰기로 바뀌어도');
  assert.equal(캡션.같은글('짧은 글', '짧은 글').ok, false, `${캡션.MIN}자보다 짧으면 잇지 않는다`);
  assert.equal(캡션.같은글(CAPTION_B.slice(0, 40), CAPTION_B).ok, false, '안 잘린 서버 글은 전체가 같아야 한다');
  assert.equal(캡션.같은글(CAPTION_A, CAPTION_A.replace('졸려', '졸리다')).ok, false);
  const url = 'https://www.instagram.com/reel/DfFULLTEXT01/';
  assert.deepEqual(캡션.완결글({ url, title: CAPTION_B }), { text: CAPTION_B, 출처: '등록' });
  assert.deepEqual(캡션.완결글({ url, title: cut(CAPTION_A) }, new Map([['instagram:DfFULLTEXT01', { url, title: CAPTION_A }]])), { text: CAPTION_A, 출처: '수집' });
  assert.equal(캡션.완결글({ url, title: cut(CAPTION_A) }), null, '수집 목록에 없으면 모른다');
  assert.equal(캡션.완결글({ url, title: cut(CAPTION_A) }, new Map([['instagram:DfFULLTEXT01', { url, title: CAPTION_B }]])), null, '등록 제목으로 시작하지 않는 수집 제목은 쓰지 않는다');
});

test('계정 대조: 원장 핸들 꼴(@ · facebook.com/)을 맞추고, 핸들 없는 페북은 apiPageId로만 — 이름은 보지 않는다', () => {
  assert.equal(연결.channelMatches({ platform: 'facebook', handle: 'facebook.com/synkworld' }, { platform: 'facebook', handle: 'synkworld' }), true);
  assert.equal(연결.channelMatches({ platform: 'instagram', handle: '@synk.mn' }, { platform: 'tiktok', handle: 'synk.mn' }), false, '플랫폼이 다르면 아니다');
  assert.equal(연결.channelMatches({ platform: 'facebook', handle: '', apiPageId: '13' }, { platform: 'facebook', handle: null, externalId: '13' }), true);
  assert.equal(연결.channelMatches({ platform: 'facebook', handle: '', apiPageId: '13' }, { platform: 'facebook', handle: null, externalId: '14', name: 'SYNK LAB Sri Lanka' }), false);
});

test('계정 · 걸 때 지문 · 같은 글이 맞으면 그 편으로 잇고, 근거에 게시결과와 판 글 파일을 남긴다', t => {
  const f = fixture(t);
  f.episode('LAB_피곤할때_mn_20261109', [['lab-instagram', CAPTION_A], ['lab-facebook', CAPTION_A], ['lab-tiktok', CAPTION_A]]);
  f.episode('LAB_잘자_mn_20261112', [['lab-instagram', CAPTION_B], ['lab-facebook', CAPTION_B]]);
  const server = f.serverOf([
    f.entry('e1', 'ig', 'https://www.instagram.com/reel/Dfv33Y2jZPR/', cut(CAPTION_A)),
    f.entry('e2', 'fb', 'https://www.facebook.com/reel/1880095013200860/', cut(CAPTION_A)),
    // 틱톡은 줄바꿈을 띄어쓰기로 바꾼 글을 준다 — 서버 읽기가 그 글을 160자에서 자른다
    f.entry('e3', 'tt', 'https://www.tiktok.com/@synk.mn/video/7707525382291016967', cut(CAPTION_A.replace(/\n+/g, ' '))),
    f.entry('e4', 'ig', 'https://www.instagram.com/reel/DftTJ1IGfW5/', CAPTION_B),
  ]);
  const { requests } = 캡션.요청들({ repo: f.repo, server, accounts: f.accounts, index: f.indexOf() });
  assert.deepEqual(requests.map(r => [r.편, r.계정]).sort(), [
    ['LAB_잘자_mn_20261112', 'lab-instagram'],
    ['LAB_피곤할때_mn_20261109', 'lab-facebook'], ['LAB_피곤할때_mn_20261109', 'lab-instagram'], ['LAB_피곤할때_mn_20261109', 'lab-tiktok'],
  ]);
  const r = requests.find(x => x.계정 === 'lab-facebook');
  assert.equal(r.방법, '캡션'); assert.equal(r.구분, '콘텐츠');
  assert.deepEqual(r.근거, ['docs/마케팅/LAB_피곤할때_mn_20261109/게시/게시결과.json', 'docs/마케팅/LAB_피곤할때_mn_20261109/게시/lab-facebook.txt']);
  // 연결.prepare를 그대로 지나 장부 줄이 된다(how 캡션)
  const { plans, failed } = 캡션.준비(f.repo, requests, server, f.accounts, [], f.now);
  assert.deepEqual(failed, []);
  assert.equal(plans.length, 4);
  assert.ok(plans.every(p => p.line.kind === '게시연결' && p.line.how === '캡션' && p.line.evidence.every(e => e.sha256.length === 64)));
});

test('걸 뒤에 판 글을 고쳤거나(지문 다름) 걸 때 지문이 없는 판은 글이 같아도 잇지 않는다', t => {
  const f = fixture(t);
  const dir = f.episode('LAB_고친편_20261110', [['lab-instagram', CAPTION_A]]);
  f.episode('LAB_지문없음_20261105', [['lab-facebook', CAPTION_B]], { booked: false });
  fs.appendFileSync(path.join(dir, '게시', 'lab-instagram.txt'), '\n#덧붙임');
  const server = f.serverOf([
    f.entry('e1', 'ig', 'https://www.instagram.com/reel/DfAAAAA111/', cut(CAPTION_A)),
    f.entry('e2', 'fb', 'https://www.facebook.com/reel/1111111111/', CAPTION_B),
  ]);
  const { requests, skipped } = 캡션.요청들({ repo: f.repo, server, accounts: f.accounts, index: f.indexOf() });
  assert.deepEqual(requests, []);
  assert.equal(skipped.length, 2);
});

test('여러 편에 같은 글이 있거나, 한 편 · 계정에 같은 글의 게시물이 둘이면 어느 것도 잇지 않는다', t => {
  const f = fixture(t);
  f.episode('LAB_같은글1_20261110', [['lab-instagram', CAPTION_A]]);
  f.episode('LAB_같은글2_20261111', [['lab-instagram', CAPTION_A]]);
  f.episode('LAB_두번_20261112', [['lab-facebook', CAPTION_B]]);
  const server = f.serverOf([
    f.entry('e1', 'ig', 'https://www.instagram.com/reel/DfAAAAA111/', cut(CAPTION_A)),
    f.entry('e2', 'fb', 'https://www.facebook.com/reel/1111111111/', CAPTION_B),
    f.entry('e3', 'fb', 'https://www.facebook.com/reel/2222222222/', CAPTION_B, '2026-11-16T04:00:00Z'),
  ]);
  const { requests, skipped } = 캡션.요청들({ repo: f.repo, server, accounts: f.accounts, index: f.indexOf() });
  assert.deepEqual(requests, []);
  assert.match(skipped.find(s => /DfAAAAA111/.test(s.url)).why, /여럿/);
  assert.equal(skipped.filter(s => /같은 편 · 계정/.test(s.why)).length, 2);
});

test('다른 계정의 같은 글 · 이미 이어진 게시물 · 사람이 붙인 등록 제목은 잇지 않고, 핸들 없는 페북과 유튜브 제목은 잇는다', t => {
  const f = fixture(t);
  f.episode('LAB_화날때_mn_20261031', [['lab-lk-facebook', CAPTION_B]]);
  f.episode('yuhobuilds_한도인수인계_20261113', [['yuhobuilds-youtube', 'AI가 일하다 한도로 멈췄다 — 답은 멈춘 대화 안에 있었다 #Shorts', 'title']]);
  f.episode('LAB_이어짐_20261101', [['lab-instagram', CAPTION_A]], { extraRows: [] });
  const linked = 'https://www.instagram.com/reel/LINKED/';
  const result = path.join(f.repo, 'docs/마케팅/LAB_이어짐_20261101/게시/게시결과.json');
  const data = JSON.parse(fs.readFileSync(result, 'utf8'));
  data.판[0].주소 = linked;
  fs.writeFileSync(result, JSON.stringify(data));
  const server = f.serverOf([
    f.entry('e1', 'lk', 'https://www.facebook.com/reel/2296236005107499/', CAPTION_B),
    f.entry('e2', 'yt', 'https://www.youtube.com/watch?v=SL54CN7HBQI', 'AI가 일하다 한도로 멈췄다 — 답은 멈춘 대화 안에 있었다 #Shorts'),
    f.entry('e3', 'other', 'https://www.instagram.com/reel/OTHER/', cut(CAPTION_A)),
    f.entry('e4', 'ig', linked, cut(CAPTION_A)),
    f.entry('e5', 'ig', 'https://www.instagram.com/reel/LABEL/', '영상통화까지 한 그 사람, 없는 사람이었어요(B43 · 새 방향 다섯째 편)'),
  ]);
  const { requests, skipped } = 캡션.요청들({ repo: f.repo, server, accounts: f.accounts, index: f.indexOf() });
  assert.deepEqual(requests.map(r => [r.계정, r.편]).sort(), [['lab-lk-facebook', 'LAB_화날때_mn_20261031'], ['yuhobuilds-youtube', 'yuhobuilds_한도인수인계_20261113']]);
  assert.ok(!skipped.some(s => /LINKED/.test(s.url)), '이미 주소로 이어진 게시물은 보지도 않는다');
  assert.equal(skipped.find(s => /OTHER/.test(s.url)).why, '계정을 못 찾음');
  assert.match(skipped.find(s => /LABEL/.test(s.url)).why, /글이 맞는 편 없음/);
});

test('판정 미리 보기는 캡션 연결로 편을 찾고 장부를 쓰지 않는다 · 편을 못 찾아도 원장 핸들 꼴로 계정을 안다', async t => {
  const f = fixture(t);
  f.episode('LAB_피곤할때_mn_20261109', [['lab-facebook', CAPTION_A]]);
  const server = f.serverOf([
    f.entry('e1', 'fb', 'https://www.facebook.com/reel/1880095013200860/', cut(CAPTION_A), '2026-11-15T04:00:32Z'),
    f.entry('e2', 'fb', 'https://www.facebook.com/reel/9999999999/', '어느 편에도 없는 글입니다 정말로요', '2026-11-15T12:00:35Z'),
  ]);
  const got = await 도구.run({ 저장소: f.repo, 쇼츠안읽음: true }, { now: f.now, data: server, shorts: new Map() });
  assert.deepEqual(got.캡션연결, [{ post: 'facebook:1880095013200860', 편: 'LAB_피곤할때_mn_20261109', 계정: 'lab-facebook' }]);
  assert.equal(got.미연결.length, 1);
  assert.equal(fs.existsSync(path.join(f.repo, 'docs/_ops/게시성과.jsonl')), false);
  const meta = 도구.metaOf({ record: { postKey: 'facebook:9999999999', platform: 'facebook' }, channel: server.channels[1] }, f.indexOf(), f.accounts);
  assert.equal(meta.folder, null);
  assert.equal(meta.account, 'lab-facebook', '「facebook.com/synkworld」 원장 핸들도 채널 synkworld와 맞춘다');
});

// ── GPT 검수(11-18) 지적 ─────────────────────────────────────────────

test('이미 게시물이 이어진 편 · 계정에는 같은 글의 다른 게시물을 잇지 않는다(GA5)', t => {
  const f = fixture(t);
  f.episode('LAB_이어진편_20261110', [['lab-instagram', CAPTION_A]]);
  const result = path.join(f.repo, 'docs/마케팅/LAB_이어진편_20261110/게시/게시결과.json');
  const data = JSON.parse(fs.readFileSync(result, 'utf8'));
  data.판[0].주소 = 'https://www.instagram.com/reel/DfFIRSTPOST1/';
  fs.writeFileSync(result, JSON.stringify(data));
  const server = f.serverOf([
    f.entry('e1', 'ig', 'https://www.instagram.com/reel/DfFIRSTPOST1/', cut(CAPTION_A)),
    f.entry('e2', 'ig', 'https://www.instagram.com/reel/DfREPOSTED22/', cut(CAPTION_A), '2026-11-16T04:00:00Z'),
  ]);
  const { requests, skipped } = 캡션.요청들({ repo: f.repo, server, accounts: f.accounts, index: f.indexOf() });
  assert.deepEqual(requests, []);
  // 양방향 유일(설계 검토 C1)에서는 이미 이어진 첫 게시물도 그 판의 이음선으로 세니, 판 쪽 이음선이 둘이라 먼저 빠진다
  assert.match(skipped.find(s => /DfREPOSTED22/.test(s.url)).why, /이미 이어진 게시물|맞는 게시물이 여럿/);
});

test('실패 · 보류 · 지움 · 거는 중 줄의 지문으로는 잇지 않는다(GA7) — 예약됨 · 게시됨 줄만', t => {
  const f = fixture(t);
  const dir = f.episode('LAB_실패한판_20261110', [['lab-instagram', CAPTION_A]]);
  const server = f.serverOf([f.entry('e1', 'ig', 'https://www.instagram.com/reel/DfAAAAA111/', cut(CAPTION_A))]);
  const result = path.join(dir, '게시', '게시결과.json');
  for (const 상태 of ['실패', '보류', '지움', '거는 중', '취소됨']) {
    const data = JSON.parse(fs.readFileSync(result, 'utf8'));
    data.판[0].상태 = 상태;
    fs.writeFileSync(result, JSON.stringify(data));
    assert.deepEqual(캡션.요청들({ repo: f.repo, server, accounts: f.accounts, index: f.indexOf() }).requests, [], 상태);
  }
  const data = JSON.parse(fs.readFileSync(result, 'utf8'));
  data.판[0].상태 = '게시됨';
  fs.writeFileSync(result, JSON.stringify(data));
  assert.equal(캡션.요청들({ repo: f.repo, server, accounts: f.accounts, index: f.indexOf() }).requests.length, 1);
});

test('지문은 한 번 읽은 판 글로 센다 — 그 셈이 게시장부 postTextSha와 같고, 다른 글을 주면 잇지 않는다(GA8)', t => {
  const f = fixture(t);
  const dir = f.episode('LAB_한번읽기_20261110', [['lab-instagram', CAPTION_A]]);
  const plate = 캡션.판글(dir, 'lab-instagram');
  assert.equal(장부.textShaOf(plate.texts), 장부.postTextSha(dir, 'lab-instagram'));
  const server = f.serverOf([f.entry('e1', 'ig', 'https://www.instagram.com/reel/DfAAAAA111/', cut(CAPTION_A))]);
  let reads = 0;
  // 글을 두 번 읽는다면 두 번째에 바뀐 글이 나온다 — 한 번만 읽으니 그 바뀐 글의 지문이 걸 때 지문과 달라 잇지 않는다
  const 바뀐글 = () => { reads += 1; return { ...plate, texts: { ...plate.texts, firstComment: '걸 뒤에 고친 첫 댓글' } }; };
  const { requests } = 캡션.요청들({ repo: f.repo, server, accounts: f.accounts, index: f.indexOf(), 글: 바뀐글 });
  assert.deepEqual(requests, []);
  assert.equal(reads, 1);
});

test('「주소 없음」 경고는 이어진 게시물 수만큼만 덜 띄운다 — 원 게시만 이어졌으면 주소 없는 재게시 경고는 남는다(GA9)', t => {
  const f = fixture(t);
  const folder = 'LAB_재게시_20261110';
  f.episode(folder, [['lab-instagram', CAPTION_A]], { booked: false, extraRows: [] });
  const result = path.join(f.repo, 'docs/마케팅', folder, '게시', '게시결과.json');
  const at = new Date(f.now - 3600_000).toISOString();
  fs.writeFileSync(result, JSON.stringify({ 판: [
    { 계정: 'lab-instagram', 상태: '게시됨', 시각: at, 주소: 'https://www.instagram.com/reel/DfORIGINAL1/' },
    { 계정: 'lab-instagram', 상태: '게시됨', 시각: at },
  ] }));
  const index = f.indexOf();
  const original = { kind: '게시연결', post: 'instagram:DfORIGINAL1', folder, account: 'lab-instagram', group: '콘텐츠' };
  const keys = new Set(['instagram:DfORIGINAL1']);
  assert.equal(도구.unregisteredOf(index, keys, f.now, new Map([[original.post, original]])).filter(u => u.주소없음).length, 1, '원 게시 연결은 재게시 경고를 지우지 않는다');
  const repost = { ...original, post: 'instagram:DfREPOST222' };
  assert.equal(도구.unregisteredOf(index, keys, f.now, new Map([[original.post, original], [repost.post, repost]])).filter(u => u.주소없음).length, 0, '주소 없는 게시물을 이은 연결은 경고 하나를 덮는다');
});

// ── 설계 검토(11-18, .tmp/검수/설계검토_게시성과편연결_20261118.md) — 양방향 유일 · 넓힌 taken · 「모름」 판 ──────────
const IG = n => `https://www.instagram.com/reel/Df${n}/`;
const 판글로 = (dir, account) => 캡션.판글(dir, account);

test('여러 편에 맞아 빠진 게시물도 그 편의 경쟁 게시물로 센다 — 다른 게시물이 홀로 남아 이어지지 않는다(설계 검토 캡션 1 · GA2)', t => {
  const f = fixture(t);
  // 꼭 200자(줄바꿈 둘)인 앞부분 P를 A(예약 판)와 B(초안)가 함께 쓴다. X는 P에서 잘려 A · B 모두에 맞고, Y는 줄바꿈이 하나 적어 A의 첫 글자까지 담겨 A에만 맞는다.
  const P = '첫 줄\n\n' + '가'.repeat(195);
  assert.equal(P.length, 200);
  f.episode('LAB_예약판A_20261110', [['lab-instagram', P + 'A 고유 꼬리입니다']]);
  f.episode('LAB_초안B_20261111', [['lab-instagram', P + 'B 초안 꼬리입니다']], { booked: false });
  const server = f.serverOf([
    f.entry('x', 'ig', IG('XPOSTXPOST1'), P),
    f.entry('y', 'ig', IG('YPOSTYPOST2'), '첫 줄\n' + '가'.repeat(195) + 'A'),
  ]);
  const { requests, skipped } = 캡션.요청들({ repo: f.repo, server, accounts: f.accounts, index: f.indexOf() });
  assert.deepEqual(requests, [], '이전 판은 X를 빼고 Y를 A에 이었다');
  assert.match(skipped.find(s => /XPOST/.test(s.url)).why, /맞는 편이 여럿/);
  assert.match(skipped.find(s => /YPOST/.test(s.url)).why, /LAB_예약판A_20261110\)에 맞는 게시물이 여럿/);
});

test('계정이 여럿으로 맞아 빠진 게시물도 그 계정들 판의 경쟁 게시물로 센다(설계 검토 캡션 2)', t => {
  const f = fixture(t);
  f.episode('LAB_한판_20261110', [['lab-instagram', CAPTION_A]]);
  const accounts = [...f.accounts, { key: 'lab-instagram-옛', platform: 'instagram', handle: '@다른이름', apiPageId: 'IGDUAL' }];
  const server = f.serverOf([
    f.entry('x', 'ig-dual', IG('XDUALDUAL01'), cut(CAPTION_A)),
    f.entry('y', 'ig', IG('YSINGLE0002'), cut(CAPTION_A)),
  ]);
  server.channels = [...server.channels, { id: 'ig-dual', platform: 'instagram', handle: 'synk.mn', externalId: 'IGDUAL' }];
  const { requests, skipped } = 캡션.요청들({ repo: f.repo, server, accounts, index: f.indexOf() });
  assert.deepEqual(requests, []);
  assert.equal(skipped.find(s => /XDUAL/.test(s.url)).why, '계정이 여럿으로 맞는다');
  assert.match(skipped.find(s => /YSINGLE/.test(s.url)).why, /맞는 게시물이 여럿/);
});

test('편 색인이 찾는 게시물이 서버 수집 목록(posts)에만 있어도 그 편 · 계정은 이미 이어졌다 · 여러 편으로 갈린 주소는 그 편들 모두(설계 검토 캡션 4 · 5 · GA5)', t => {
  const f = fixture(t);
  const a = f.episode('LAB_수집만_20261110', [['lab-instagram', CAPTION_A]]);
  fs.writeFileSync(path.join(a, '게시', '게시글.md'), `올린 주소: ${IG('POSTONLY001')}\n`);
  const server = f.serverOf([f.entry('y', 'ig', IG('YNEWPOST003'), cut(CAPTION_A))], [{ channelId: 'ig', url: IG('POSTONLY001'), publishedAt: '2026-11-15T04:00:00Z' }, { channelId: 'ig', url: IG('YNEWPOST003'), publishedAt: '2026-11-16T04:00:00Z', title: CAPTION_A }]);
  const r1 = 캡션.요청들({ repo: f.repo, server, accounts: f.accounts, index: f.indexOf() });
  assert.deepEqual(r1.requests, [], '이전 판은 entries만 보아 Y를 이었다');
  assert.match(r1.skipped[0].why, /이미 이어진 게시물/);
  // 같은 주소가 두 편에 같은 세기로 적혀 색인이 갈리면 두 편 모두 이어진 것으로 본다
  fs.rmSync(path.join(a, '게시', '게시글.md'));
  const c = f.episode('LAB_다른편_20261111', [['lab-instagram', CAPTION_B]]);
  for (const dir of [a, c]) fs.writeFileSync(path.join(dir, '게시', '메모.md'), `${IG('POSTONLY001')}\n`);
  assert.ok(f.indexOf().resolve('instagram:DfPOSTONLY001')?.ambiguous, '시험 전제: 색인이 갈린다');
  const r2 = 캡션.요청들({ repo: f.repo, server, accounts: f.accounts, index: f.indexOf() });
  assert.deepEqual(r2.requests, []);
  assert.match(r2.skipped[0].why, /이미 이어진 게시물/);
});

test('기획.md에 적은 남의 채널 주소는 그 편을 막지 않는다(설계 검토 캡션 6)', t => {
  const f = fixture(t);
  const a = f.episode('LAB_참고쇼츠_20261110', [['lab-instagram', CAPTION_A]]);
  fs.writeFileSync(path.join(a, '기획.md'), `# 참고\n- ${IG('FOREIGN0001')}\n`);
  const server = f.serverOf([f.entry('o', 'other', IG('FOREIGN0001'), '남의 채널 글입니다 아주 길게 적었어요'), f.entry('y', 'ig', IG('YOURPOST004'), cut(CAPTION_A))]);
  const { requests } = 캡션.요청들({ repo: f.repo, server, accounts: f.accounts, index: f.indexOf() });
  assert.deepEqual(requests.map(r => [r.편, r.계정]), [['LAB_참고쇼츠_20261110', 'lab-instagram']]);
});

test('판 글을 못 읽은 편이 있는 계정은 이번 회차에 잇지 않고 알린다 — 다른 계정은 잇는다(설계 검토 캡션 7)', t => {
  const f = fixture(t);
  f.episode('LAB_읽힘_20261110', [['lab-instagram', CAPTION_A], ['lab-facebook', CAPTION_B]]);
  f.episode('LAB_못읽음_20261111', [['lab-instagram', CAPTION_B]]);
  const 글 = (dir, account) => { if (path.basename(dir) === 'LAB_못읽음_20261111' && account === 'lab-instagram') throw new Error('게시글 파일을 읽지 못함'); return 판글로(dir, account); };
  const server = f.serverOf([f.entry('y', 'ig', IG('YIGPOST0005'), cut(CAPTION_A)), f.entry('z', 'fb', 'https://www.facebook.com/reel/1880095013200861/', CAPTION_B)]);
  const { requests, skipped } = 캡션.요청들({ repo: f.repo, server, accounts: f.accounts, index: f.indexOf(), 글 });
  assert.deepEqual(requests.map(r => r.계정), ['lab-facebook']);
  assert.match(skipped.find(s => s.account === 'lab-instagram').why, /판 글을 못 읽은 편이 있어\(LAB_못읽음_20261111\)/);
});

test('게시물 · 편 순서를 뒤섞어도 결과가 같고, 한 게시물은 한 편에 · 한 판에는 한 게시물만 잇는다(설계 검토 캡션 8 · 9)', t => {
  const f = fixture(t);
  f.episode('LAB_가_20261110', [['lab-instagram', CAPTION_A]]);
  f.episode('LAB_나_20261111', [['lab-instagram', CAPTION_B], ['lab-facebook', CAPTION_A]]);
  f.episode('LAB_다_20261112', [['lab-tiktok', CAPTION_B]]);
  const entries = [
    f.entry('1', 'ig', IG('ONEPOST0001'), cut(CAPTION_A)),
    f.entry('2', 'ig', IG('TWOPOST0002'), CAPTION_B),
    f.entry('3', 'fb', 'https://www.facebook.com/reel/1880095013200862/', cut(CAPTION_A)),
    f.entry('4', 'ig', IG('FOURPOST004'), cut(CAPTION_A), '2026-11-16T04:00:00Z'),
    f.entry('5', 'tt', 'https://www.tiktok.com/@synk.mn/video/7570000000000000005', CAPTION_B.replace(/\n+/g, ' ')),
  ];
  const index = f.indexOf();
  const key = r => r.requests.map(x => `${x.주소}>${x.편}|${x.계정}`).sort().join('\n');
  const base = 캡션.요청들({ repo: f.repo, server: f.serverOf(entries), accounts: f.accounts, index });
  assert.deepEqual(base.requests.map(x => x.편 + '|' + x.계정).sort(), ['LAB_나_20261111|lab-facebook', 'LAB_나_20261111|lab-instagram', 'LAB_다_20261112|lab-tiktok'],
    '1 · 4는 같은 판(가)에 둘이라 어느 것도 잇지 않는다');
  let seed = 7;
  const rand = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  const shuffle = list => list.map(x => [rand(), x]).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
  for (let i = 0; i < 20; i += 1) {
    const mixed = { folders: new Map(shuffle([...index.folders.entries()])), resolve: index.resolve };
    const got = 캡션.요청들({ repo: f.repo, server: f.serverOf(shuffle(entries)), accounts: f.accounts, index: mixed });
    assert.equal(key(got), key(base), `${i}번째 뒤섞기`);
    assert.equal(new Set(got.requests.map(x => x.주소)).size, got.requests.length, '한 게시물은 한 편에');
    assert.equal(new Set(got.requests.map(x => `${x.편}|${x.계정}`)).size, got.requests.length, '한 판에는 한 게시물');
  }
});


test('핸들 없는 유튜브 채널은 원장 expectedChannelId = 채널 externalId로 계정을 안다(설계 검토 캡션 11 · C4)', t => {
  assert.equal(연결.channelMatches({ platform: 'youtube', handle: '', expectedChannelId: 'UCmx' }, { platform: 'youtube', handle: null, externalId: 'UCmx' }), true);
  assert.equal(연결.channelMatches({ platform: 'youtube', handle: '', expectedChannelId: 'UCmx' }, { platform: 'youtube', handle: null, externalId: 'UCother' }), false);
  assert.equal(연결.channelMatches({ platform: 'youtube', handle: '', expectedChannelId: 'UCmx' }, { platform: 'youtube', handle: null }), false, 'externalId가 없으면 아니다');
  const f = fixture(t);
  const title = '¿Cómo se dice estoy cansado en coreano? 피곤해요';
  f.episode('LAB_멕시코_mx_20261110', [['lab-mx-youtube', title, 'title']]);
  const server = f.serverOf([f.entry('v', 'mx', 'https://www.youtube.com/shorts/mxShort0001', title)]);
  const { requests } = 캡션.요청들({ repo: f.repo, server, accounts: f.accounts, index: f.indexOf() });
  assert.deepEqual(requests.map(r => [r.편, r.계정]), [['LAB_멕시코_mx_20261110', 'lab-mx-youtube']]);
});

// ── GPT 4회차(게시성과편연결-20261118-4) ──────────────────────────────

test('같은 게시물이 서버에 다른 채널로 두 번 등록돼도 그 판의 경쟁 게시물로 세고, 그 게시물은 잇지 않는다 — 등록 순서와 상관없이(4회차 GA2)', t => {
  const f = fixture(t);
  f.episode('LAB_두번등록_20261110', [['lab-instagram', CAPTION_A]]);
  const unknown = f.entry('x1', 'ghost', IG('XTWICE00001'), cut(CAPTION_A));
  const known = f.entry('x2', 'ig', IG('XTWICE00001'), cut(CAPTION_A));
  const other = f.entry('y', 'ig', IG('YALONE00002'), cut(CAPTION_A));
  for (const entries of [[unknown, known, other], [known, unknown, other], [other, known, unknown]]) {
    const server = f.serverOf(entries);
    server.channels = [...server.channels, { id: 'ghost', platform: 'instagram', handle: 'unregistered.page' }];
    const { requests, skipped } = 캡션.요청들({ repo: f.repo, server, accounts: f.accounts, index: f.indexOf() });
    assert.deepEqual(requests, [], entries.map(e => e.id).join(','));
    assert.match(skipped.find(s => /YALONE/.test(s.url)).why, /맞는 게시물이 여럿/);
  }
});


// ── 설계 검토 다시 보기(4회차 뒤) ──────────────────────────────────────

test('같은 게시물인가는 한 함수로 — 주소, 없으면 게시물ID + 플랫폼으로 견주고 플랫폼이 다르면 다른 게시물이다', () => {
  const 판정 = 연결;
  const ig = { 주소: 'https://www.instagram.com/reel/DfzTnYHiUuc/' };
  assert.equal(판정.samePost(ig, { 주소: 'https://www.instagram.com/p/DfzTnYHiUuc/' }), true, '/p/ · /reel/');
  assert.equal(판정.samePost(ig, { 게시물ID: 'DfzTnYHiUuc', 플랫폼: 'instagram' }), true, '게시물ID만');
  assert.equal(판정.samePost(ig, { 게시물ID: 'DfzTnYHiUuc' }), true, '플랫폼을 모르면 게시물ID로');
  assert.equal(판정.samePost(ig, { 게시물ID: 'DfzTnYHiUuc', 플랫폼: 'youtube' }), false, '플랫폼이 다르면 다른 게시물');
  assert.equal(판정.samePost(ig, { 주소: 'https://www.youtube.com/shorts/DfzTnYHiUuc' }), false);
  assert.equal(판정.samePost(ig, { 주소: 'https://www.instagram.com/synkbrief/' }), false, '게시물로 안 읽히는 주소');
  assert.equal(판정.postOfRow({ 상태: '예약됨' }), null);
});


// ── GPT 5회차(게시성과편연결-20261118-5) ──────────────────────────────

test('잘린 등록은 수집 목록의 완결 제목으로 통째로 견준다 — 완결 글을 못 얻으면 잇지 않고, 꼭 200자인 완결 캡션은 더 긴 판 글과 맞지 않는다(5회차 GA3 · GA6)', t => {
  const f = fixture(t);
  f.episode('LAB_긴글_20261110', [['lab-instagram', CAPTION_A]]);
  f.episode('LAB_짧은글_20261111', [['lab-facebook', CAPTION_B]]);
  const ok = 캡션.요청들({ repo: f.repo, server: f.serverOf([f.entry('a', 'ig', IG('LONGPOST001'), cut(CAPTION_A)), f.entry('b', 'fb', 'https://www.facebook.com/reel/1880095013200863/', CAPTION_B)]), accounts: f.accounts, index: f.indexOf() });
  const long = ok.requests.find(r => r.계정 === 'lab-instagram'), short = ok.requests.find(r => r.계정 === 'lab-facebook');
  assert.equal(long.완결글, '수집');
  assert.match(long.이유, /수집 목록 글 \d+자가 판 캡션과 통째로 같음/);
  assert.equal(short.완결글, '등록');
  // 수집 목록에 없으면(또는 1000자를 넘으면) 잇지 않는다
  const none = 캡션.요청들({ repo: f.repo, server: f.serverOf([f.entry('a', 'ig', IG('LONGPOST001'), cut(CAPTION_A))], []), accounts: f.accounts, index: f.indexOf() });
  assert.deepEqual(none.requests, []);
  assert.match(none.skipped[0].why, /200자에서 잘렸고 수집 목록에서 완결 글을 못 얻었다/);
  const over = 캡션.요청들({ repo: f.repo, server: f.serverOf([f.entry('a', 'ig', IG('LONGPOST001'), cut(CAPTION_A))], [{ id: 'p', channelId: 'ig', url: IG('LONGPOST001'), publishedAt: '2026-11-15T04:00:51Z', title: CAPTION_A + ' '.repeat(10) + '가'.repeat(1000) }]), accounts: f.accounts, index: f.indexOf() });
  assert.deepEqual(over.requests, [], '수집 목록 제목도 잘렸으면 잇지 않는다');
  // 판 글의 앞 200자와 같은 「꼭 200자 완결 캡션」 — 수집 목록에도 200자(완결)라 더 긴 판 글과 통째로 같지 않다
  const exact = CAPTION_A.slice(0, TITLE_MAX);
  const r = 캡션.요청들({ repo: f.repo, server: f.serverOf([f.entry('x', 'ig', IG('EXACT200001'), exact)], [{ id: 'p', channelId: 'ig', url: IG('EXACT200001'), publishedAt: '2026-11-15T04:00:51Z', title: exact }]), accounts: f.accounts, index: f.indexOf() });
  assert.deepEqual(r.requests, []);
  assert.match(r.skipped[0].why, /글이 맞는 편 없음/);
});

test('완결 글을 모르는 잘린 등록도 앞부분이 맞는 판의 경쟁 게시물로 센다 — 그 판의 다른 게시물을 잇지 않는다(5회차)', t => {
  const f = fixture(t);
  f.episode('LAB_경쟁_20261110', [['lab-instagram', CAPTION_A]]);
  const full = f.entry('y', 'ig', IG('YFULLPOST01'), cut(CAPTION_A));
  const unknown = f.entry('x', 'ig', IG('XNOFULL0001'), CAPTION_A.slice(0, TITLE_MAX));
  const server = f.serverOf([full, unknown], [{ id: 'p', channelId: 'ig', url: IG('YFULLPOST01'), publishedAt: '2026-11-15T04:00:51Z', title: CAPTION_A }]);
  const { requests, skipped } = 캡션.요청들({ repo: f.repo, server, accounts: f.accounts, index: f.indexOf() });
  assert.deepEqual(requests, []);
  assert.match(skipped.find(s => /YFULL/.test(s.url)).why, /맞는 게시물이 여럿/);
});

test('게시결과에 주소 없이 게시물ID로만 적힌 판의 바로 그 게시물은 게시물ID로 잇는다 — 다른 게시물은 막는다(5회차 GA1)', t => {
  const f = fixture(t);
  f.episode('LAB_아이디로잇기_20261110', [['lab-instagram', CAPTION_A]], { extraRows: [{ 계정: 'lab-instagram', 상태: '게시됨', 게시물ID: 'DfIDONLY0001', 플랫폼: 'instagram' }] });
  const server = f.serverOf([f.entry('own', 'ig', IG('IDONLY0001'), cut(CAPTION_A)), f.entry('other', 'ig', IG('OTHERPOST09'), '전혀 다른 글입니다 아주 길게 적었어요')]);
  const { requests, skipped } = 캡션.요청들({ repo: f.repo, server, accounts: f.accounts, index: f.indexOf() });
  assert.deepEqual(requests.map(r => [r.주소, r.편, r.계정, r.방법]), [[IG('IDONLY0001'), 'LAB_아이디로잇기_20261110', 'lab-instagram', '게시물ID']]);
  assert.match(requests[0].이유, /게시물ID DfIDONLY0001가 서버 게시물과 같음/);
  assert.match(skipped.find(s => /OTHERPOST/.test(s.url)).why, /글이 맞는 편 없음/);
  // 계정 원장의 플랫폼으로도 안다(줄에 플랫폼이 없을 때)
  const f2 = fixture(t);
  f2.episode('LAB_플랫폼없음_20261110', [['lab-instagram', CAPTION_A]], { extraRows: [{ 계정: 'lab-instagram', 상태: '게시됨', 게시물ID: 'DfIDONLY0002' }] });
  const r2 = 캡션.요청들({ repo: f2.repo, server: f2.serverOf([f2.entry('own', 'ig', IG('IDONLY0002'), '짧지만 열두 자는 넘는 글입니다')]), accounts: f2.accounts, index: f2.indexOf() });
  assert.deepEqual(r2.requests.map(r => r.방법), ['게시물ID']);
});

test('게시물로 안 읽히는 같은 주소 글자는 한쪽에만 게시물ID가 있어도 같은 게시물이다(5회차 GA2)', () => {
  const share = 'https://www.facebook.com/share/r/1AbCdEfGh/';
  assert.equal(연결.samePost({ 주소: share, 플랫폼: 'facebook', 게시물ID: '1880095013200865' }, { 주소: share }), true);
  assert.equal(연결.samePost({ 주소: share }, { 주소: 'https://www.facebook.com/share/r/2Other/' }), false);
});

test('게시물ID가 적힌 판에는 캡션으로 다른 게시물을 잇지 않는다 — 그 번호가 서버에 있으면 그것을 게시물ID로 잇고, 없어도 그 판은 이어진 판이다(설계 검토 다시 보기 2 N2 · 6회차 GA1 · 14회차)', t => {
  const f = fixture(t);
  f.episode('LAB_번호와캡션_20261110', [['lab-instagram', CAPTION_B]], { extraRows: [{ 계정: 'lab-instagram', 상태: '게시됨', 게시물ID: 'DfAAAAAAAAAA', 플랫폼: 'instagram' }] });
  const server = f.serverOf([f.entry('x', 'ig', IG('AAAAAAAAAA'), '편 F 작업실 제목입니다 열두 자 넘게'), f.entry('y', 'ig', IG('BBBBBBBBBB'), CAPTION_B)]);
  const { requests, skipped } = 캡션.요청들({ repo: f.repo, server, accounts: f.accounts, index: f.indexOf() });
  assert.deepEqual(requests.map(r => [r.주소, r.방법]), [[IG('AAAAAAAAAA'), '게시물ID']]);
  assert.match(skipped.find(s => /BBBBBBBBBB/.test(s.url)).why, /이미 이어진 게시물/);
  // 인스타는 게시결과 번호가 서버에 없어도 그 판은 이미 이어진 판이다 — 다른 번호는 다른 게시물(6회차 GA1)
  const g = fixture(t);
  g.episode('LAB_다른번호_20261110', [['lab-instagram', CAPTION_B]], { extraRows: [{ 계정: 'lab-instagram', 상태: '게시됨', 게시물ID: 'DfIDONLY0001' }] });
  const r2 = 캡션.요청들({ repo: g.repo, server: g.serverOf([g.entry('other', 'ig', IG('SECOND0002'), CAPTION_B)]), accounts: g.accounts, index: g.indexOf() });
  assert.deepEqual(r2.requests, []);
  assert.match(r2.skipped[0].why, /게시물ID DfIDONLY0001가 적혀 있어 이미 이어진 판으로 본다/);
  // 페북은 게시결과에 페이지 게시물 번호가 남는다 — 수집 목록 externalId(「페이지번호_페이지게시물번호」)로는 그 릴스와 짝짓지 않는다(유호님 11-20 「니 추천대로」 — 14회차)
  const h = fixture(t);
  h.episode('LAB_페북번호_20261110', [['lab-facebook', CAPTION_B]], { extraRows: [{ 계정: 'lab-facebook', 상태: '게시됨', 게시물ID: '122128674231475802' }] });
  const reel = h.entry('reel', 'fb', 'https://www.facebook.com/reel/2296236005107499/', CAPTION_B);
  const alias = [{ id: 'p', channelId: 'fb', url: reel.url, publishedAt: reel.publishedAt, externalId: '1322127544319220_122128674231475802', title: CAPTION_B }];
  const r3 = 캡션.요청들({ repo: h.repo, server: h.serverOf([reel], alias), accounts: h.accounts, index: h.indexOf() });
  assert.deepEqual(r3.requests, []);
  assert.match(r3.skipped[0].why, /게시물ID 122128674231475802가 적혀 있어 이미 이어진 판으로 본다 — 그 번호가 서버 등록 주소의 번호와 달라 자동으로 잇지 않는다\(같은 게시물이면 사람이 --연결목록 요청의 「같은게시물」에 그 게시물ID를 적어 잇는다\)/);
  // 수집 목록 줄이 없거나 적힌 번호가 다른 릴스 번호여도(다시 올린 릴스) 그 판은 이미 이어진 판이라 캡션이 같은 릴스를 잇지 않는다(8회차 GA1)
  for (const [rowId, posts] of [['122128674231475802', []], ['1880095013200860', alias]]) {
    const k = fixture(t);
    k.episode('LAB_페북번호_20261110', [['lab-facebook', CAPTION_B]], { extraRows: [{ 계정: 'lab-facebook', 상태: '게시됨', 게시물ID: rowId }] });
    const r4 = 캡션.요청들({ repo: k.repo, server: k.serverOf([reel], posts), accounts: k.accounts, index: k.indexOf() });
    assert.deepEqual(r4.requests, [], rowId);
    assert.match(r4.skipped[0].why, /이미 이어진 판으로 본다/);
  }
});

// ── GPT 6회차(게시성과편연결-20261118-6) ──────────────────────────────

test('짧은 캡션에 첫 댓글을 붙여 200자를 넘긴 등록 — 완결 글을 모르는 쪽도 「캡션 + 첫 댓글」의 앞부분이면 경쟁 게시물로 센다(6회차 GA2)', t => {
  const f = fixture(t);
  // 캡션을 MIN(12자)보다 짧게 둔다 — 캡션만으로는 경쟁을 셀 수 없어, 「캡션 + 첫 댓글」 꼴을 빠뜨리면 이 시험이 걸린다(7회차 GA3)
  const caption = '안녕하세요!';
  const comment = '🎮 Солонгос хэлний сонсгол, уншлагын тоглоом: synk.im/try/learning-hub/ ' + '자세한 안내는 여기에서 봅니다. '.repeat(8);
  f.episode('LAB_짧은캡션_20261110', [['lab-instagram', `[캡션]\n${caption}\n[첫 댓글]\n${comment}`]]);
  const posted = `${caption}\n${comment}`;
  assert.ok(posted.length > TITLE_MAX && caption.length < 캡션.MIN, '시험 전제');
  const server = f.serverOf([
    f.entry('x', 'ig', IG('XNOPOST0001'), posted.slice(0, TITLE_MAX)),
    f.entry('y', 'ig', IG('YWITHPOST01'), posted.slice(0, TITLE_MAX)),
  ], [{ id: 'p', channelId: 'ig', url: IG('YWITHPOST01'), publishedAt: '2026-11-15T04:00:51Z', title: posted }]);
  const { requests, skipped } = 캡션.요청들({ repo: f.repo, server, accounts: f.accounts, index: f.indexOf() });
  assert.deepEqual(requests, [], '이전 판은 X를 캡션 앞부분으로만 견줘 빼고 Y를 이었다');
  assert.match(skipped.find(s => /YWITHPOST/.test(s.url)).why, /맞는 게시물이 여럿/);
  // X가 없으면 Y는 「캡션 + 첫 댓글」로 잇는다
  const alone = 캡션.요청들({ repo: f.repo, server: f.serverOf([server.entries[1]], server.posts), accounts: f.accounts, index: f.indexOf() });
  assert.equal(alone.requests.length, 1);
  assert.match(alone.requests[0].이유, /판 캡션\(\+첫 댓글\)과 통째로 같음/);
});

// ── GPT 7회차(게시성과편연결-20261118-7) ──────────────────────────────

test('완결 글을 아는 등록은 통째로 같은 판에만 이음선을 긋는다 — 짧은 캡션 판과 그 뒤에 안내 문장을 덧붙인 판은 각자 잇는다(7회차 GA2)', t => {
  const f = fixture(t);
  const short = 'Найз, дүүдээ 잘 자 гэдэг — 짧은 캡션 판입니다';
  const longer = short + ' 자세한 안내는 프로필 링크에서 봅니다.';
  f.episode('LAB_짧은판_20261110', [['lab-instagram', short]]);
  f.episode('LAB_긴판_20261111', [['lab-instagram', longer]]);
  const server = f.serverOf([f.entry('x', 'ig', IG('SHORTPOST01'), short), f.entry('y', 'ig', IG('LONGPOST002'), longer)]);
  const { requests } = 캡션.요청들({ repo: f.repo, server, accounts: f.accounts, index: f.indexOf() });
  assert.deepEqual(requests.map(r => [r.주소, r.편]).sort(), [[IG('LONGPOST002'), 'LAB_긴판_20261111'], [IG('SHORTPOST01'), 'LAB_짧은판_20261110']]);
});

// ── 14회차(게시성과편연결-20261118-14) · 유호님 11-20 「니 추천대로」 — 수집 목록 짝을 빼고 번호가 같을 때만 ──────────

test('게시물ID 연결: 게시결과 번호가 서버 등록 주소의 번호와 같을 때만 잇고, 수집 목록(externalId · pagePostId · videoId)으로는 짝짓지 않는다 — 그 판은 이어진 판으로 남는다(14회차 GA1 · GA2)', t => {
  const reel = 'https://www.facebook.com/reel/2296236005107499/';
  const feed802 = 'https://www.facebook.com/synkworld/posts/122128674231475802';
  const page802 = '1322127544319220_122128674231475802';
  const post = (id, url, fields) => ({ id, channelId: 'fb', url, publishedAt: '2026-11-15T04:00:51Z', title: CAPTION_B, ...fields });
  const run = (rows, posts, entries = [['e2296', reel]]) => {
    const f = fixture(t);
    for (const [folder, 게시물ID] of rows) f.episode(folder, [['lab-facebook', CAPTION_B]], { extraRows: [{ 계정: 'lab-facebook', 상태: '게시됨', 게시물ID }] });
    return 캡션.요청들({ repo: f.repo, server: f.serverOf(entries.map(([id, url]) => f.entry(id, 'fb', url, CAPTION_B)), posts), accounts: f.accounts, index: f.indexOf() });
  };
  // 페이지 게시물 번호만 적힌 판: 게시물 줄 · 영상 줄의 pagePostId · 첨부 videoId · 피드 주소 줄 어느 것으로도 릴스 등록에 잇지 않는다.
  // 그 판은 이어진 판이라 같은 글의 릴스를 캡션으로도 잇지 않는다(판정 요약의 「주소 없이 건 판」으로 사람이 잇는다)
  for (const posts of [
    [post('p802', reel, { externalId: page802, pagePostId: page802, videoId: '2296236005107499' })],
    [post('v2296', reel, { externalId: '2296236005107499', pagePostId: page802, videoId: '2296236005107499' })],
    [post('p802', feed802, { externalId: page802, pagePostId: page802, videoId: '2296236005107499' })],
    [post('p802', feed802, { externalId: page802, pagePostId: page802, videoId: null }), post('v2296', reel, { externalId: '2296236005107499', pagePostId: page802, videoId: '2296236005107499' })],
  ]) {
    const r = run([['LAB_페이지번호_20261110', '122128674231475802']], posts);
    assert.deepEqual(r.requests, [], posts.map(p => p.id).join(','));
    assert.match(r.skipped.map(x => x.why).join('\n'), /게시물ID 122128674231475802가 적혀 있어 이미 이어진 판으로 본다/, posts.map(p => p.id).join(','));
  }
  // 릴스 번호가 적힌 판은 그 릴스 등록에 잇는다
  const r2 = run([['LAB_릴스번호_20261110', '2296236005107499']], []);
  assert.deepEqual(r2.requests.map(x => [x.주소, x.편, x.방법]), [[reel, 'LAB_릴스번호_20261110', '게시물ID']]);
  assert.match(r2.requests[0].이유, /게시물ID 2296236005107499가 서버 게시물과 같음/);
  // 등록 주소가 피드(게시물 번호)면 「페이지번호_게시물번호」 꼴로 적힌 번호도 뒤 번호로 견주어 잇는다
  const r3 = run([['LAB_피드등록_20261110', page802]], [], [['e802', feed802]]);
  assert.deepEqual(r3.requests.map(x => [x.주소, x.편]), [[feed802, 'LAB_피드등록_20261110']]);
  // 다른 게시물(피드 803)이 같은 릴스를 첨부했어도, 그 번호로 적힌 판은 릴스 등록에 잇지 않는다(10 · 11 · 12회차 꼴)
  const r4 = run([['LAB_첨부만_20261111', '122128674231475803']], [post('p803', reel, { externalId: '1322127544319220_122128674231475803', pagePostId: '1322127544319220_122128674231475803', videoId: '2296236005107499', urlFromAttachment: true })]);
  assert.deepEqual(r4.requests, []);
});

test('게시물ID 연결: 한 판에 페이지 게시물 번호와 릴스 번호가 함께 적히면 줄 순서와 상관없이 등록 주소와 같은 번호의 근거를 남긴다(11회차 GA2)', t => {
  const reel = 'https://www.facebook.com/reel/2296236005107499/';
  const page802 = '1322127544319220_122128674231475802';
  for (const order of [['122128674231475802', '2296236005107499'], ['2296236005107499', '122128674231475802']]) {
    const f = fixture(t);
    f.episode('LAB_두번호_20261110', [['lab-facebook', CAPTION_B]], { extraRows: order.map(게시물ID => ({ 계정: 'lab-facebook', 상태: '게시됨', 게시물ID })) });
    const posts = [{ id: 'v2296', channelId: 'fb', url: reel, publishedAt: '2026-11-15T04:00:51Z', title: CAPTION_B, externalId: '2296236005107499', pagePostId: page802, videoId: '2296236005107499' }];
    const r = 캡션.요청들({ repo: f.repo, server: f.serverOf([f.entry('e2296', 'fb', reel, '등록 글은 판 글과 다릅니다 열두 자 넘게')], posts), accounts: f.accounts, index: f.indexOf() });
    assert.deepEqual(r.requests.map(x => [x.주소, x.방법]), [[reel, '게시물ID']], order.join(','));
    assert.match(r.requests[0].이유, /게시물ID 2296236005107499가 서버 게시물과 같음/, order.join(','));
  }
});

test('읽기: 수집 목록 줄에 urlFromAttachment(true일 때만 참)를 가져온다 — 캡션 길의 완결 글 색인이 쓴다', () => {
  const py = require('../tools/lib/게시성과읽기.cjs').파이썬({ days: 7, perChannel: 3 });
  assert.match(py, /'urlFromAttachment':p\.get\('urlFromAttachment'\) is True/);
  assert.doesNotMatch(py, /pagePostId|'videoId'/);
});

test('캡션 연결: 수집기가 첨부 릴스 주소로 채운 줄(urlFromAttachment)은 잘린 등록의 완결 글 출처로 쓰지 않는다 — 줄 순서와 상관없이 원래 편에 잇는다(설계 검토 6 조건 1)', t => {
  const reel = 'https://www.facebook.com/reel/2296236005107499/';
  const page802 = '1322127544319220_122128674231475802', page803 = '1322127544319220_122128674231475803';
  const HEAD = '가나다라마바사아자차카타파하 '.repeat(15);
  const T802 = HEAD + '원래 릴스 게시물의 끝 문장', T803 = HEAD + '다시 첨부한 피드의 끝 문장';
  const post = (id, fields, title, publishedAt) => ({ id, channelId: 'fb', url: reel, publishedAt, title, ...fields });
  const l802 = post('p802', { externalId: page802, pagePostId: page802, videoId: '2296236005107499' }, T802, '2026-11-15T04:00:51Z');
  const l803 = post('p803', { externalId: page803, pagePostId: page803, videoId: '2296236005107499', urlFromAttachment: true }, T803, '2026-11-16T04:00:00Z');
  for (const posts of [[l803, l802], [l802, l803]]) {
    const f = fixture(t);
    f.episode('LAB_원래_20261110', [['lab-facebook', T802]]);
    f.episode('LAB_첨부만_20261111', [['lab-facebook', T803]]);
    const r = 캡션.요청들({ repo: f.repo, server: f.serverOf([f.entry('e2296', 'fb', reel, T802.slice(0, TITLE_MAX))], posts), accounts: f.accounts, index: f.indexOf() });
    assert.deepEqual(r.requests.map(x => [x.주소, x.편, x.방법]), [[reel, 'LAB_원래_20261110', '캡션']], posts.map(p => p.id).join(','));
  }
});
