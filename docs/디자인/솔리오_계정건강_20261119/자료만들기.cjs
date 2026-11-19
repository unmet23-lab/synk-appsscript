#!/usr/bin/env node
'use strict';
/*
 * 계정 건강 시안이 읽는 자료.js를 다시 만든다.
 *   node docs/디자인/솔리오_계정건강_20261119/자료만들기.cjs [--지금 <ISO 시각>]
 * real은 우리 계정을 두 장부에서 읽어 진단한 것이고, sample은 유형을 보이려고 지어낸 계정을 같은 진단에 넣은 것이다.
 * 진단 규칙은 tools/lib/계정건강.js 하나다. 시안은 이 결과를 그리기만 한다.
 */
const fs = require('node:fs');
const path = require('node:path');
const repo = path.resolve(__dirname, '..', '..', '..');
const { 진단, 방 } = require(path.join(repo, 'tools', 'lib', '계정건강.js'));
const { 계정들 } = require(path.join(repo, 'tools', '계정건강.js'));

const at = process.argv.indexOf('--지금');
const now = at >= 0 ? Date.parse(process.argv[at + 1]) : Date.now();
const DAY = 864e5;
const day = n => new Date(now - n * DAY).toISOString();
const date = n => day(n).slice(0, 10);
const when = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);

/* 지어낸 계정. 편은 오래된 것부터 하루 간격이고 [조회, 공유, 댓글, 저장, 좋아요, 넘기지 않고 본 비율] 순이다 */
function 예시(key, name, platform, followers, titles, rows) {
  return { key, name, platform, followers: Array.isArray(followers) ? followers : [{ date: date(14), n: followers }, { date: date(0), n: followers }],
    posts: rows.map(([views, shares, comments, saves, likes, stayed], i) => ({ id: key + i, title: titles[i % titles.length], publishedAt: day(rows.length - i + 2),
      points: { '72h': { views, shares, comments, saves, likes } }, screen: stayed ? { stayedToWatchPct: stayed } : {} })) };
}
const rep = (n, row) => Array.from({ length: n }, () => row);
const 예시들 = [
  예시('shell', '인스타그램 @dalbit.table', 'instagram', 21400, ['주말 브런치', '새 메뉴', '오픈 준비'], rep(9, [310, 0, 0, 1, 9])),
  예시('seed', '인스타그램 @namu.workshop', 'instagram', 180, ['대패질 3분', '옹이 메우기', '오일 고르는 법'], rep(9, [240, 4, 2, 3, 14])),
  예시('likes', '틱톡 @haru.lettering', 'tiktok', 640, ['붓펜 한 줄', '이름 써 드려요', '오늘의 문장'], rep(9, [6200, 1, 0, 2, 480])),
  예시('onehit', '유튜브 @slow.camping', 'youtube', 260, ['우중 캠핑', '장비 정리', '첫 솔로 캠핑', '불멍 1시간', '겨울 준비', '타프 치기', '화목 난로', '설거지 팁', '한파 캠핑'],
    [...rep(8, [220, 1, 0, 1, 5]), [12400, 70, 22, 41, 380]]),
  예시('blocked', '틱톡 @mogu.snack', 'tiktok', 1900, ['신상 리뷰', '편의점 조합', '1+1 정리'], [...rep(8, [2600, 15, 6, 9, 110]), [48, 0, 0, 0, 2], [41, 0, 0, 0, 1], [55, 0, 0, 0, 2]]),
  예시('bought', '인스타그램 @studio.onda', 'instagram', [{ date: date(14), n: 1200 }, { date: date(0), n: 4100 }], ['작업실 소개', '수강 후기', '클래스 일정'], rep(9, [900, 4, 2, 3, 30])),
  예시('grow', '유튜브 @batang.note', 'youtube', [{ date: date(14), n: 410 }, { date: date(0), n: 468 }], ['노션 가계부', '주간 계획표', '독서 기록', '습관 표'],
    [...rep(5, [1800, 12, 6, 9, 70, 74]), ...rep(5, [2900, 21, 9, 15, 120, 76])]),
  예시('early', '틱톡 @first.bake', 'tiktok', 12, ['첫 식빵', '버터 고르기'], rep(2, [140, 1, 0, 0, 6])),
];

const real = 방(계정들(repo).map(a => 진단(a, now)), { now, 모은때: `${when}에 읽었습니다. 하루에 두 번 모읍니다.` });
const sample = 방(예시들.map(a => 진단(a, now)), { now, 모은때: '지어낸 계정입니다. 숫자와 이름은 예시입니다.' });
const out = path.join(__dirname, '자료.js');
fs.writeFileSync(out, '/* 자료만들기.cjs가 다시 만든다. 손으로 고치지 않는다. */\nwindow.ROOMS = ' + JSON.stringify({ real, sample }) + ';\n');
console.log(`자료.js를 썼다. 우리 계정 ${real.rows.length}줄(${real.scope}) · 예시 ${sample.rows.length}줄`);
for (const r of sample.rows) console.log(`  예시 ${r.nm}: ${r.val} · ${r.mid}`);
