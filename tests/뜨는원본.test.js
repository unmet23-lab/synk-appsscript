'use strict';

// 뜨는 원본(tools/수요스캔/뜨는원본.js) — 네트워크 없이 본다. API는 가짜 부르개, 영상 숫자는 모두 합성이다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const 뜨는 = require('../tools/수요스캔/뜨는원본.js');

const vid = (글자, n) => `${글자}${String(n).padStart(10, '0')}`.slice(0, 11);

/** 가짜 API부르개 — search 인자를 모으고, 검색어마다 영상 하나를 돌려준다 */
function 가짜api() {
  const 검색들 = [];
  const api = {
    셈: { 호출: 0, 실패: 0, 멈춤: false, 까닭: '' },
    async 부르기(자원, 값) {
      this.셈.호출 += 1;
      검색들.push({ 자원, ...값 });
      return { 상태: '됨', 몸: { items: [{ id: { videoId: vid('v', 검색들.length) } }] } };
    },
    async 영상들(ids) {
      this.셈.호출 += Math.ceil(ids.length / 50);
      return { 상태: '됨', 상세: new Map(ids.map(id => [id, { id, 조회: 4000, 좋아요: 400, 댓글수: 10, 길이: 30, 날짜: '2026-11-01', 채널id: 'UC' + id, 채널이름: '가', 제목: '합성' }])) };
    },
    async 채널들(ids) { this.셈.호출 += 1; return new Map(ids.map(id => [id, { 구독: 1000 }])); },
    async 쇼츠목록() { this.셈.호출 += 1; return { 상태: '됨', ids: [] }; },
  };
  return { api, 검색들 };
}

const 설정 = () => ({
  회차당: 12, 하루몫: 3500, 검색뒤여유: 300, 기본지역: 'KR', 기본언어: 'ko',
  갈래: {
    'AI 활용': { 몫: 2, 어: ['클로드', 'AI 활용', 'AI 프롬프트'] },
    '옛 모양': ['엑셀 자동화'],
    'LAB 영어': { 몫: 2, 지역: null, 언어: 'en', 최소: 3000, 어: ['learn korean', 'living in korea', 'korean slang'] },
    'LAB 몽골': { 몫: 1, 지역: null, 언어: 'mn', 최소: 1000, 어: ['Солонгост сурах'] },
  },
  누적: [],
});

const 임시 = () => fs.mkdtempSync(path.join(os.tmpdir(), '뜨는원본-'));
const 서울정오 = Date.parse('2026-11-02T12:00:00+09:00');

test('갈래별 지역 · 언어가 search.list 인자로 간다 — 한국 갈래는 KR · ko, LAB은 지역 제한 없이 en · mn', async () => {
  const 폴더 = 임시();
  const { api, 검색들 } = 가짜api();
  const r = await 뜨는.돌리기({ ...뜨는.인자(['--출력', 폴더]) }, { api, 설정: 설정(), 장부: path.join(폴더, '단위.json'), 지금: () => 서울정오 });
  const 찾기 = q => 검색들.find(s => s.q === q);
  assert.equal(찾기('클로드').regionCode, 'KR');
  assert.equal(찾기('클로드').relevanceLanguage, 'ko');
  assert.equal(찾기('엑셀 자동화').regionCode, 'KR', '옛 배열 모양 갈래는 설정 기본 지역');
  assert.equal(찾기('엑셀 자동화').relevanceLanguage, 'ko');
  assert.ok(!('regionCode' in 찾기('learn korean')), 'LAB 영어는 regionCode를 보내지 않는다');
  assert.equal(찾기('learn korean').relevanceLanguage, 'en');
  assert.ok(!('regionCode' in 찾기('Солонгост сурах')));
  assert.equal(찾기('Солонгост сурах').relevanceLanguage, 'mn');
  for (const s of 검색들) {
    assert.equal(s.자원, 'search');
    assert.equal(s.order, 'viewCount');
    assert.equal(s.videoDuration, 'short');
  }
  // 몫: AI 활용 2 · 옛 모양 전부(1) · LAB 영어 2 · LAB 몽골 1 = 6, 몫 밖 검색어는 부르지 않는다
  assert.deepEqual(검색들.map(s => s.q), ['클로드', '엑셀 자동화', 'learn korean', 'Солонгост сурах', 'AI 활용', 'living in korea']);
  assert.equal(r.검색.length, 6);
  // 갈래 최소 조회 — 합성 영상은 모두 4,000회라 한국 갈래(기본 5,000)에선 빠지고 LAB(3,000 · 1,000)에서만 남는다(배수는 쇼츠 목록이 없어 판정 밖)
  const 결과 = JSON.parse(fs.readFileSync(path.join(폴더, '뜨는원본.json'), 'utf8'));
  assert.equal(결과.api.단위, 6 * 100 + (결과.api.호출 - 6));
  assert.match(fs.readFileSync(path.join(폴더, '뜨는원본.md'), 'utf8'), /LAB 영어 2번\(지역 제한 없이 · en\)/);
});

test('--어 --갈래는 그 갈래의 지역 · 언어로 찾는다', async () => {
  const 폴더 = 임시();
  const { api, 검색들 } = 가짜api();
  await 뜨는.돌리기(뜨는.인자(['--출력', 폴더, '--어', 'moving to seoul', '--갈래', 'LAB 영어', '--이름', '시험']), { api, 설정: 설정(), 장부: path.join(폴더, '단위.json'), 지금: () => 서울정오 });
  assert.equal(검색들.length, 1);
  assert.equal(검색들[0].q, 'moving to seoul');
  assert.ok(!('regionCode' in 검색들[0]));
  assert.equal(검색들[0].relevanceLanguage, 'en');
  assert.ok(fs.existsSync(path.join(폴더, '뜨는원본_시험.md')));
  await assert.rejects(뜨는.돌리기(뜨는.인자(['--출력', 폴더, '--갈래', '없는 갈래']), { api, 설정: 설정(), 장부: path.join(폴더, '단위.json') }), /설정에 없는 갈래/);
});

test('회차당이 몫 합보다 작으면 갈래마다 고르게 빠진다', () => {
  const 차례 = 뜨는.검색차례(설정().갈래, 4, 설정());
  assert.deepEqual(차례.map(c => c.갈래), ['AI 활용', '옛 모양', 'LAB 영어', 'LAB 몽골']);
  assert.equal(차례[2].지역, null);
  assert.equal(차례[2].최소, 3000);
});

test('하루 몫 — 같은 태평양 날짜에 이미 쓴 단위가 있으면 넘기 전에 검색을 그치고, 장부에 더한다', async () => {
  const 폴더 = 임시();
  const 장부 = path.join(폴더, '단위.json');
  const 오늘 = 뜨는.태평양날짜(서울정오);
  assert.equal(오늘, '2026-11-01', '서울 11-02 정오는 태평양 11-01(한도는 서울 17시에 풀린다)');
  fs.writeFileSync(장부, JSON.stringify({ [오늘]: 3050, '2026-10-01': 900 }));
  const { api, 검색들 } = 가짜api();
  const r = await 뜨는.돌리기(뜨는.인자(['--출력', 폴더]), { api, 설정: 설정(), 장부, 지금: () => 서울정오 });
  // 3,050 + 100 + 여유 300 = 3,450 ≤ 3,500 → 한 번, 두 번째는 3,050 + 100 + 100 + 300 > 3,500
  assert.equal(검색들.length, 1);
  assert.ok(r.못잼.some(s => /하루 몫 3500단위/.test(s) && /검색 5번을 건너뜀/.test(s)));
  const 뒤 = JSON.parse(fs.readFileSync(장부, 'utf8'));
  assert.equal(뒤[오늘], 3050 + r.api.단위);
  assert.ok(!('2026-10-01' in 뒤), '14일 넘은 날은 버린다');
  // 다른 태평양 날(서울 17시 뒤)은 새 몫
  const 다음 = 가짜api();
  await 뜨는.돌리기(뜨는.인자(['--출력', 폴더]), { api: 다음.api, 설정: 설정(), 장부, 지금: () => Date.parse('2026-11-02T18:00:00+09:00') });
  assert.equal(다음.검색들.length, 6);
});

test('실제 설정 — 회차 14번 안, 갈래마다 지역 · 언어, LAB은 지역 제한 없이, 하루 몫이 LAB 한도 안', () => {
  const 실제 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tools', '수요스캔', '설정', '뜨는원본.json'), 'utf8'));
  const 차례 = 뜨는.검색차례(실제.갈래, 실제.회차당, 실제);
  assert.ok(차례.length <= 14);
  assert.ok(실제.회차당 * 100 + 실제.검색뒤여유 <= 실제.하루몫, '기본 한 회차는 하루 몫 안');
  assert.ok(실제.하루몫 <= 5000, 'LAB 프로젝트 10,000단위 가운데 업로드 · 자막 몫을 남긴다');
  const 갈래들 = new Set(차례.map(c => c.갈래));
  for (const g of ['AI 활용', '1인 창업', '업무 자동화', 'AI 사고', 'LAB 영어', 'LAB 몽골']) assert.ok(갈래들.has(g), `${g} 갈래가 회차에 든다`);
  for (const c of 차례.filter(c => c.갈래.startsWith('LAB'))) assert.equal(뜨는.검색값(c, 'x').regionCode, undefined);
  assert.equal(뜨는.검색값(차례.find(c => c.갈래 === 'LAB 영어'), 'x').relevanceLanguage, 'en');
  assert.equal(뜨는.검색값(차례.find(c => c.갈래 === 'AI 활용'), 'x').regionCode, 'KR');
});
