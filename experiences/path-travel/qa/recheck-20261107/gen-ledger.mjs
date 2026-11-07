// 2026-11-07 재확인 대장(sources.json)을 지금 자료에서 만든다.
// records·photos는 places-v2.mjs의 SOURCES·PHOTO_CREDITS와 같아야 하고
// (tests/path-travel-live-catalog.test.mjs가 대조), fetches·changes는 이번에 연 출처와 바꾼 값이다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const { SOURCES, PHOTO_CREDITS, TRAVEL_META, TRAVEL_PLACES } = await import(pathToFileURL(path.resolve(here, '../../places-v2.mjs')).href);
const { REAL_CONDITION_CALENDAR } = await import(pathToFileURL(path.resolve(here, '../../real-places.mjs')).href);

const reopened = 'reopened: 같은 주소를 다시 열어 운영·휴무·요금·접근 항목을 대조함';
const ledger = {
  version: 1,
  checkedAt: TRAVEL_META.checkedAt,
  scope: '공개 서울 하루 앱(synk.im/try/travel/)의 장소 25곳과 공휴일 달력을 공식 안내로 다시 확인. 실시간 영업·예약 가능 여부·보행 시간은 확인하지 않음.',
  method: '각 출처를 curl로 받아 본문 글을 대조. 자바스크립트로만 그리는 쪽(나인트리 객실·호텔찾기)은 브라우저로 열어 읽음. 그림으로만 올린 궁능유적본부 공지 두 건은 그림을 직접 읽음.',
  calendar: REAL_CONDITION_CALENDAR,
  records: SOURCES,
  photos: PHOTO_CREDITS,
  places: TRAVEL_PLACES.map(place => ({ id: place.id, name: place.name, verifiedAt: place.verifiedAt, hoursVerifiedAt: place.conditions.hours.verifiedAt, priceVerifiedAt: place.conditions.price.verifiedAt })),
  fetches: [
    { result: reopened, note: '61개 출처 주소 가운데 58개가 200으로 열려 본문을 대조함' },
    { url: 'https://korean.visitseoul.net/restaurants/BalwooGongyang/KOP4vpx7k', result: 'gone', note: '200이지만 본문이 「원하시는 페이지를 찾을 수 없습니다」. 같은 곳 새 안내 KOP030871(수정일 2026.10.27)로 옮김' },
    { url: 'https://english.visitseoul.net/attractions/Changgyeonggung%20Palace/ENP000297', result: '404', note: '주소 표기가 Changgyeonggung-Palace(하이픈)로 바뀜. 새 주소의 지도 좌표가 자료와 같음' },
    { url: 'https://data.visitkorea.or.kr/linkedview/1604784', result: '503', note: '경희궁 입장마감 근거를 관리 기관인 서울역사박물관 경희궁 안내(입장마감 17:30)로 옮김' },
    { url: 'https://app.catchtable.co.kr/ct/shop/osullocteahouse_bukchon', result: 'not-read', note: '예약 연결 단추 주소일 뿐 조건 근거가 아니라 본문을 대조하지 않음' },
  ],
  changes: [
    { placeId: 'calendar', before: '2026-09-07~2026-11-06, 공휴일 6일', after: '2026-11-07~2026-12-31, 공휴일 2026-12-25', sourceUrl: REAL_CONDITION_CALENDAR.sourceUrl },
    { placeId: 'unhyeongung', before: '일반 09:00~19:00 기준, 10월 31일까지만 유효(11월 시간 미확인)', after: '동절기(11~3월) 09:00~18:00 입장 17:30, 월 휴관. 11.29까지 화·수·금·토·일 야간 개방 09:00~21:00 입장 20:30', sourceUrl: 'https://www.unhyeongung.or.kr/sub/introduce/preview.php' },
    { placeId: 'gyeongbokgung', before: '10월 근정전 월대 출입 제한으로 부분 관람, 11.1~11.6만 11월 시간', after: '월대 제한 10.31 종료로 전체 관람. 11~12월 09:00~17:00 입장 16:00, 화 휴궁. 11.7~11.15 무료(코리아 그랜드 페스티벌), 11.25 무료(매월 마지막 수요일)', sourceUrl: 'https://royal.khs.go.kr/ROYAL/contents/R702000000.do?schGroupCode=gbg' },
    { placeId: 'changgyeonggung', before: '11.1~11.6만 11월 주간 09:00~17:30·야간개방구역 연장', after: '주간 09:00~17:30, 야간개방구역 17:30~21:00(입장 20:00). 11.10~11.15 「동궐동락」으로 야간 일반관람 중단(주간 입장 16:30). 11.15까지 무료, 그 뒤 매주 수요일 무료', sourceUrl: 'https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260902131858531105&schM=view' },
    { placeId: 'national-folk-museum', before: '10월 시간표 + 11.1~11.6 동절기 예외', after: '11~2월 매일 09:00~17:00 입장 16:00(야간연장 없음). 상설전시관1 휴관(12.21 종료 예정)으로 부분 관람 유지', sourceUrl: 'https://nfm.go.kr/home/subIndex/1239.do' },
    { placeId: 'seoul-museum-craft-art', before: '10.13~10.25 로비 부분휴관 예외 포함', after: '지난 예외와 로비 공지 주소(visitNoticeSourceUrl) 정리. 기본 10:00~18:00 입장 17:30, 월 휴관, 11.30까지 전시1동 야간 연장 유지', sourceUrl: 'https://craftmuseum.seoul.go.kr/preview/visit' },
    { placeId: 'balwoo-gongyang', before: '서울 관광 안내 11:30~21:00·주문마감 19:40과 운영 단체 안내가 충돌해 시간 미확인', after: '새 서울 관광 안내와 운영 단체 안내가 일치: 월~토 점심 1부 11:30~13:20 · 2부 13:30~14:50, 저녁 18:00~20:20(주문마감 19:10), 일·1월 1일·설·추석 휴무. 각 부의 입장·예약 조건 때문에 부분 판정 유지(일요일·시간 밖은 닫힘으로 판정)', sourceUrl: 'https://korean.visitseoul.net/restaurants/%EB%B0%9C%EC%9A%B0-%EA%B3%B5%EC%96%91/KOP030871' },
    { placeId: 'gyeonghuigung', before: '입장마감 출처 data.visitkorea.or.kr', after: '같은 값(09:00~18:00, 입장 17:30)을 서울역사박물관 경희궁 안내로 확인', sourceUrl: 'https://museum.seoul.go.kr/www/intro/annexIntro/annex_20/annex_20_01.jsp?sso=ok' },
  ],
  unchanged: '개성만두 궁(매장·관광 안내 마감 충돌 그대로), 경인미술관 전통다원(10:00~22:50 대 11:00~21:20 충돌 그대로), 오설록 북촌, 나인트리 인사동(체크인 15:00·체크아웃 12:00), 오라카이 인사동(16:00·11:00), 황생가칼국수, 토속촌삼계탕, 통인시장(도시락 카페 요일 표기 충돌 그대로), 프릳츠 원서, 국립현대미술관 서울, 서울역사박물관(11.30까지 야간 확대 — 12월 시간은 박물관 안내에 없어 11.30 뒤는 확인 필요로 남김), 조계사, 북촌 한옥마을, 이문설농탕, 광화문 미진, 어니언 안국, 아름다운 차박물관, 대한민국역사박물관',
  limits: [
    '자료의 판정은 확인일부터 30일(2026-12-07)까지만 「확인됨」이 될 수 있다. 그 뒤는 다시 확인해야 한다.',
    '실시간 영업·임시 휴무·예약 가능 여부·혼잡·보행 시간은 확인하지 않았다.',
    '사진 13장의 사용 조건은 이번에 다시 보지 않았다(PHOTO_CREDITS checkedAt 2026-10-09 그대로).',
  ],
};
fs.writeFileSync(path.join(here, 'sources.json'), JSON.stringify(ledger, null, 2) + '\n');
console.log('sources.json', SOURCES.length, 'records', PHOTO_CREDITS.length, 'photos');
