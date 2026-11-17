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
// 서버 읽기처럼 앞 TITLE_MAX 코드 포인트만 남긴다(파이썬 str[:160])
const cut = s => [...s].slice(0, TITLE_MAX).join('');

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
  };
  fs.mkdirSync(path.join(repo, 'docs', '마케팅'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'docs/마케팅/sns-계정.json'), JSON.stringify({ accounts: ledgerAccounts }));
  const accounts = Object.entries(ledgerAccounts).map(([key, a]) => ({ key, platform: a.platform, handle: a.handle || '', ...(a.apiPageId ? { apiPageId: a.apiPageId } : {}) }));
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
  ];
  const entry = (id, channelId, url, title, publishedAt = '2026-11-15T04:00:51Z') => ({ id, channelId, url, title, publishedAt, origin: 'auto', checkpoints: [] });
  const serverOf = entries => ({ channels, entries, posts: [], snapshots: [] });
  const now = Date.parse('2026-11-16T00:00:00Z');
  const indexOf = (connections = new Map()) => 편.buildIndex(path.join(repo, 'docs/마케팅'), connections);
  return { repo, accounts, episode, entry, serverOf, now, indexOf };
}

test('같은 글: 띄어쓰기 · 줄바꿈만 빼고 같거나, 서버가 잘랐으면 앞부분이 같다 — 짧은 글 · 다른 글은 아니다', () => {
  assert.equal(캡션.같은글('a  b\n\nc 둘셋넷다섯여섯', 'a b c 둘셋넷다섯여섯').ok, true);
  assert.equal(캡션.같은글(cut(CAPTION_A), CAPTION_A).ok, true, '160자에서 잘린 서버 글은 앞부분 대조');
  assert.equal(캡션.같은글(cut(CAPTION_A).replace(/\n/g, ' '), CAPTION_A).ok, true, '틱톡처럼 줄바꿈이 띄어쓰기로 바뀌어도');
  assert.equal(캡션.같은글('짧은 글', '짧은 글').ok, false, `${캡션.MIN}자보다 짧으면 잇지 않는다`);
  assert.equal(캡션.같은글(CAPTION_B.slice(0, 40), CAPTION_B).ok, false, '안 잘린 서버 글은 전체가 같아야 한다');
  assert.equal(캡션.같은글(cut(CAPTION_A), CAPTION_A.replace('졸려', '졸리다')).ok, false);
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
