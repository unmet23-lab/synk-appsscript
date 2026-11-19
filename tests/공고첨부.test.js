'use strict';
// 공모 공고 첨부 · 본문 그림 읽기 시험(2026-11-20, 유호님 「다섯 개 다 해」 가운데 둘째).
const test = require('node:test');
const assert = require('node:assert');
const 첨부 = require('../tools/lib/공고첨부.cjs');

const 게시판 = `
<img src="/theme/wering/img/hdft/hd_logo_160.png">
<div id="bo_v_con"><img src="https://www.example.or.kr/data/editor/2609/poster_6827.png"></div>
<a href="https://www.example.or.kr/bbs/download.php?bo_table=w6_1&amp;wr_id=669&amp;no=1&amp;nonce=x">붙임2. 지원서식 일체.hwp</a>
<a href="https://www.example.or.kr/bbs/download.php?bo_table=w6_1&amp;wr_id=669&amp;no=0&amp;nonce=x">붙임1. 모집 공고.pdf</a>
<a href="/files/영상.zip">영상 자료.zip</a>
<a href="javascript:void(0)">인쇄</a>`;

test('첨부 링크와 본문 그림을 찾고, 공고를 서식보다 앞에, 틀 그림과 zip은 뺀다', () => {
  const xs = 첨부.첨부찾기(게시판, 'https://www.example.or.kr/bbs/board.php?bo_table=w6_1&wr_id=669');
  assert.deepStrictEqual(xs.map(x => [x.종류, x.이름]), [
    ['첨부', '붙임1. 모집 공고.pdf'], ['첨부', '붙임2. 지원서식 일체.hwp'], ['그림', 'poster_6827.png'],
  ]);
  assert.match(xs[0].url, /wr_id=669&no=0&nonce=x$/, '&amp;를 푼다');
});

test('파일 머리로 형식을 가린다', () => {
  assert.strictEqual(첨부.형식가리기(Buffer.from('%PDF-1.7')), 'pdf');
  assert.strictEqual(첨부.형식가리기(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0, 0])), 'hwp');
  assert.strictEqual(첨부.형식가리기(Buffer.from([0x89, 0x50, 0x4e, 0x47])), '그림');
  assert.strictEqual(첨부.형식가리기(Buffer.from([0xff, 0xd8, 0xff])), '그림');
  assert.strictEqual(첨부.형식가리기(Buffer.from('<html>오류</html>')), '');
});

test('쪽의 쿠키와 주소를 붙여 받고, 고르는 글이 나오면 멈춘다', async () => {
  const 받은 = [];
  const fetchPage = async (url, 선택) => {
    받은.push({ url, 쿠키: 선택.쿠키, 참조: 선택.참조, 받을형식: 선택.받을형식 });
    return { 됨: true, 바이너리: true, 몸: Buffer.from('%PDF-1.7 ...'), 파일이름: '붙임1. 모집 공고.pdf' };
  };
  const 뽑기 = async () => '응모자격: 만 14세 이상 시민';
  const 쪽 = { 글: 게시판, 쿠키: { 'www.example.or.kr': 'PHPSESSID=abc' } };
  const r = await 첨부.첨부글읽기(쪽, 'https://www.example.or.kr/bbs/board.php?wr_id=669', { fetchPage, 뽑기, 고르기: t => t.includes('응모자격') });
  assert.strictEqual(받은.length, 1, '첫 첨부에서 찾으면 더 받지 않는다');
  assert.deepStrictEqual(받은[0].쿠키, { 'www.example.or.kr': 'PHPSESSID=abc' });
  assert.strictEqual(받은[0].참조, 'https://www.example.or.kr/bbs/board.php?wr_id=669');
  assert.deepStrictEqual(받은[0].받을형식, ['*/*']);
  assert.strictEqual(r.출처.이름, '붙임1. 모집 공고.pdf');
  assert.match(r.글, /만 14세/);
});

test('받지 못하거나 글을 뽑을 수 없는 첨부는 까닭을 남기고 다음으로 간다', async () => {
  let n = 0;
  const fetchPage = async () => (++n === 1 ? { 됨: false, 까닭: '쪽이 없거나 오류다(404)' } : { 됨: true, 바이너리: true, 몸: Buffer.from('<html>잘못된 접근</html>') });
  const r = await 첨부.첨부글읽기({ 글: 게시판 }, 'https://www.example.or.kr/bbs/board.php', { fetchPage, 뽑기: async () => '' });
  assert.strictEqual(r.글, '');
  assert.deepStrictEqual(r.본.map(x => x.까닭), ['쪽이 없거나 오류다(404)', '글을 뽑을 수 없는 형식', '글을 뽑을 수 없는 형식']);
});
