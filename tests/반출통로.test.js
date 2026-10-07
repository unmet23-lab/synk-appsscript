'use strict';
/* 반출 통로 — Apps Script에서 밖으로 나가는 호출(UrlFetchApp.fetch) 자리를 센다.
 *
 * 2026-10-02 학원 운영 시스템을 지운 뒤 라이브에 남은 파일은 Code.js와 엔진_synkbrief.js다.
 * 옛 판에 있던 음성 전사·동의·AI 프롬프트 검사는 그 코드와 함께 지웠다(git 이력에 있다).
 * 새 호출 자리가 생기면 아래 표에 무엇이 나가는지 적어야 통과한다. 줄 번호는 일부러 적지 않는다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, liveFiles } = require('./_engine-source');

const 소스 = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/** 벤더 판정 — `UrlFetchApp.fetch(` 바로 뒤 인자에 보이는 호스트 리터럴로 가른다. */
const 벤더표_ = [
  ['anthropic', /api\.anthropic\.com/],
  ['GoogleSTT', /speech\.googleapis\.com/],
  ['GoogleOAuth', /oauth2\.googleapis\.com/],
  ['GoogleSlides', /docs\.google\.com/],
  ['MetaGraph', /graph\.facebook\.com/],
  ['InstagramGraph', /graph\.instagram\.com/],
  ['SupabaseOps', /qiwxeddwwnzkwalpsuty\.supabase\.co/],
  ['GitHub', /api\.github\.com/],
  ['GoogleDrive', /drive\.google\.com/],
];

/** 선언표 — 이 수가 사는 유일한 자리다. 늘리거나 줄일 때는 같은 커밋에서 여기를 고친다. */
const 나가는자리_ = [
  { file: '엔진_synkbrief.js', vendor: 'InstagramGraph', n: 3,
    뭐: 'synkbrief 요청 DM 답장·전용 계정 확인·본인 게시물 조회. 나가는 것은 댓글 ID나 요청자 IGSID, 전용 토큰, 공개 자료 링크다' },
  { file: '엔진_synkbrief.js', vendor: 'SupabaseOps', n: 1,
    뭐: '고정 운영 상태 주소에 전용 읽기 키만 보낸다. 원문 댓글·DM·Meta 토큰은 보내지 않는다' },
];
const 선언합계_ = 나가는자리_.reduce((a, r) => a + r.n, 0);

function 실측자리_() {
  const 표 = new Map(); // "file|vendor" -> n
  let 총 = 0;
  for (const f of liveFiles()) {
    const src = 소스(f);
    let i = 0;
    while ((i = src.indexOf('UrlFetchApp.fetch(', i)) !== -1) {
      const 머리 = src.slice(i, i + 260);
      const v = (벤더표_.find(([, re]) => re.test(머리)) || ['변수URL'])[0];
      const k = f + '|' + v;
      표.set(k, (표.get(k) || 0) + 1);
      총++;
      i += 18;
    }
  }
  return { 표, 총 };
}

test('나가는 자리 분모가 살아 있다 — 0이면 검사가 죽은 것이지 통과가 아니다', () => {
  assert.ok(liveFiles().length >= 2, `liveFiles() 가 ${liveFiles().length}벌 — .claspignore 파생이 깨졌다`);
  assert.ok(실측자리_().총 > 0, 'UrlFetchApp.fetch 를 한 자리도 못 찾았다 — 「0건」이 아니라 검사가 죽었다');
});

test('밖으로 나가는 자리 수가 선언표와 같다 (벤더·파일별)', () => {
  const { 표, 총 } = 실측자리_();
  const 선언 = new Map(나가는자리_.map((r) => [r.file + '|' + r.vendor, r.n]));
  const 어긋남 = [];
  for (const [k, n] of 표) {
    const d = 선언.get(k);
    if (d === undefined) 어긋남.push(`+ 새 자리 ${k} = ${n}개 — 무엇이 나가는지 확인하고 나가는자리_ 에 적어라`);
    else if (d !== n) 어긋남.push(`~ ${k}: 선언 ${d} ≠ 실측 ${n}`);
  }
  for (const [k, d] of 선언) if (!표.has(k)) 어긋남.push(`- 사라진 자리 ${k}(선언 ${d}) — 없앴으면 나가는자리_ 에서 지워라`);
  assert.deepEqual(어긋남, [], `나가는 자리가 선언과 갈렸다(선언 ${선언합계_} · 실측 ${총}):\n  ` + 어긋남.join('\n  '));
  assert.equal(총, 선언합계_);
});

test('선언표의 줄마다 무엇이 나가는지 적혀 있다', () => {
  const 빈설명 = 나가는자리_.filter((r) => !r.뭐 || r.뭐.length < 5).map((r) => r.file + '|' + r.vendor);
  assert.deepEqual(빈설명, []);
});

test('웹 입구(Code.js)는 밖으로 아무것도 보내지 않는다', () => {
  assert.doesNotMatch(소스('Code.js'), /UrlFetchApp|MailApp|GmailApp/);
});
