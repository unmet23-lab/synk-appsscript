// 2026-11-07 공식 안내 재확인 반영기. real-places.mjs · real-course-data.mjs를
// 지금 판에서 읽어 바뀐 값만 고친 뒤 같은 JSON 꼴로 다시 쓴다.
// 근거와 바뀐 점은 같은 폴더 README.md에 있다. 한 번만 돌리는 기록용 도구다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// 언제 돌려도 같은 결과가 나오게 고치기 전 판(10월 표본, 9467e34035와 같은 바이트)에서 읽는다.
const base = path.resolve(root, '../../tests/fixtures/path-travel-catalog-20261009');
const T = '2026-11-07', U = '2026-12-07';
const DAY = 86400000;
const days = (from, through) => {
  const out = [];
  for (let t = Date.parse(from + 'T00:00:00Z'); t <= Date.parse(through + 'T00:00:00Z'); t += DAY) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
};
const weekday = date => new Date(date + 'T00:00:00Z').getUTCDay();
const slot = (open, close, lastEntry) => (lastEntry ? { open, close, lastEntry } : { open, close });
const week = (closed, slots) => Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(d => [String(d), closed.includes(d) ? [] : slots.map(s => ({ ...s }))]));

const URL_ = {
  balwoo: 'https://korean.visitseoul.net/restaurants/%EB%B0%9C%EC%9A%B0-%EA%B3%B5%EC%96%91/KOP030871',
  unhPreview: 'https://www.unhyeongung.or.kr/sub/introduce/preview.php',
  unhNight: 'https://www.unhyeongung.or.kr/sub/notice_guide/notice.php?group=basic&code=B10&abmode=view&no=1974',
  royalFree: 'https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view',
  royalCulture: 'https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260528151556017843&schM=view',
  cggWednesday: 'https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20261007095901706396&schM=view',
  cggNightPause: 'https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260902131858531105&schM=view',
  gbgNotice: 'https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930144202825885&schM=view',
};

// ── real-places.mjs ──
const realFile = path.join(root, 'real-places.mjs');
const realSrc = fs.readFileSync(path.join(base, 'real-places.mjs'), 'utf8');
const real = await import(pathToFileURL(path.join(base, 'real-places.mjs')).href);
const clone = value => JSON.parse(JSON.stringify(value));
const meta = { ...clone(real.REAL_META), checkedAt: T };
const calendar = {
  from: T,
  through: '2026-12-31',
  holidays: ['2026-12-25'],
  sourceUrl: real.REAL_CONDITION_CALENDAR.sourceUrl,
  verifiedAt: T,
  note: '우주항공청 2026년 월력요항(한국천문연구원 게시). 일요일은 주간시간표로 처리하며 이 배열에는 별도 공휴일만 수록. 11월에는 공휴일이 없고 12월은 25일 기독탄신일만 있어요.',
};
const festival = days(T, '2026-11-15');
// 무료 개방은 휴관일 제외 — 그 궁의 정기 휴궁 요일은 가격 예외에 넣지 않는다.
const festivalOpen = closedDay => festival.filter(date => weekday(date) !== closedDay);
const places = clone(real.REAL_PLACES).map(place => {
  place.checkedAt = T; place.verifiedAt = T;
  place.conditions.hours.verifiedAt = T; place.conditions.price.verifiedAt = T;
  const hours = place.conditions.hours, price = place.conditions.price;
  switch (place.id) {
    case 'balwoo-gongyang': {
      place.sourceUrl = place.accessSourceUrl = place.visitSourceUrl = URL_.balwoo;
      place.openingNote = '월~토 점심 1부 11:30~13:20, 2부 13:30~14:50, 저녁 18:00~20:20(주문마감 19:10). 일요일·1월 1일·설날·추석은 쉬어요. 각 부의 시작 시각에 맞춘 입장·예약 가능 여부는 방문 전 확인해 주세요.';
      place.accessNote = '3호선 안국역 6번 출구. 조계사 맞은편 템플스테이 통합정보센터 5층이에요.';
      Object.assign(hours, {
        sourceUrl: URL_.balwoo,
        weekly: week([0], [slot('11:30', '13:20'), slot('13:30', '14:50'), slot('18:00', '20:20', '19:10')]),
        scope: 'partial',
        note: '서울 관광 안내와 운영 단체 안내가 점심 1·2부, 저녁 시간, 일요일 휴무로 일치해요. 각 부의 시작 시각에 맞춘 입장·예약 조건은 확인하지 못해 운영 시간 안의 방문도 확인이 필요해요.',
      });
      Object.assign(price, {
        sourceUrl: URL_.balwoo,
        note: '서울 관광 안내는 선식(평일 점심 한정) 36,000원·원식 50,000원을 소개하나 코스의 인원 단위·예약·추가 주문을 확인하지 못해 예산 확정에 사용하지 않음',
      });
      break;
    }
    case 'seoul-museum-craft-art': {
      place.visitNote = '전시동별 운영시간·부분 휴관 공지를 확인해 주세요. 어린이박물관은 예약 안내를 확인해 주세요.';
      place.openingNote = '전시실 기본 10:00~18:00, 입장마감은 종료 30분 전. 월요일·1월 1일 휴관(공휴일인 월요일은 일반 전시 운영, 어린이박물관은 모든 월요일 휴관). 2026.9.15~11.30 화·수·금·토·일에는 전시실 가운데 전시1동만 21:00까지 연장해요.';
      hours.validFrom = T; hours.validThrough = U;
      delete hours.exceptions;
      delete place.visitNoticeSourceUrl; // 10.13~10.25 로비 휴관 공지 — 끝났다
      break;
    }
    case 'unhyeongung': {
      place.visitSourceUrl = URL_.unhPreview;
      place.openingNote = '동절기(11~3월) 09:00~18:00(입장마감 17:30). 월요일 휴관, 공휴일인 월요일은 개장해요. 2026.9.1~11.29 화·수·금·토·일에는 21:00까지(입장마감 20:30) 야간 개방하고, 목요일은 18:00까지예요.';
      const night = Object.fromEntries(days(T, '2026-11-29').filter(date => [0, 2, 3, 5, 6].includes(weekday(date)))
        .map(date => [date, { slots: [slot('09:00', '21:00', '20:30')], scope: 'full', note: '야간 개방 기간(2026.9.1~11.29 화·수·금·토·일)', sourceUrl: URL_.unhNight }]));
      Object.assign(hours, {
        sourceUrl: URL_.unhPreview,
        weekly: week([1], [slot('09:00', '18:00', '17:30')]),
        validFrom: T, validThrough: U,
        exceptions: night,
        note: '운현궁 공식 동절기(11~3월) 시간과 야간 개방(9.1~11.29) 안내. 유료 행사·체험 제외',
      });
      break;
    }
    case 'gyeongbokgung': {
      place.visitNote = '근정전 월대 출입 제한(9.2~10.31)은 끝났어요. 2026.10.29~11.15는 코리아 그랜드 페스티벌 무료 개방(휴궁일 제외), 11.25(매월 마지막 수요일)도 무료예요. 특별·야간 행사, 한복·연령별 무료 조건은 별도 확인해 주세요.';
      place.openingNote = '화요일 휴궁. 11~2월 09:00~17:00(입장마감 16:00). 공휴일과 정기휴궁일이 겹치면 다음 첫 비공휴일에 쉬어요.';
      Object.assign(hours, {
        weekly: week([2], [slot('09:00', '17:00', '16:00')]),
        scope: 'full', validFrom: T, validThrough: U,
        note: '11~12월 일반 주간 관람 시간. 근정전 월대 출입 제한은 10.31에 끝났어요.',
      });
      delete hours.exceptions;
      price.exceptions = {
        ...Object.fromEntries(festivalOpen(2).map(date => [date, { kind: 'free', amount: 0, label: '코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)', scope: 'adult-one', sourceUrl: URL_.royalFree }])),
        '2026-11-25': { kind: 'free', amount: 0, label: '매월 마지막 수요일 일반 관람', sourceUrl: URL_.royalCulture },
      };
      break;
    }
    case 'changgyeonggung': {
      place.visitNote = '11~1월은 17:30부터 야간개방구역(홍화문·명정전·통명전·춘당지·대온실 권역)으로 이동해요. 2026.11.10~11.15에는 「동궐동락」 야간 특별 프로그램으로 야간 일반관람을 쉬어요(주간 입장마감 16:30, 관람 종료 17:30). 별도 예약 행사와 일반 입장은 구분해 주세요.';
      place.costNote = '일반 개인 대인 1,000원 · 내국인 만25~64세·외국인 만19~64세 기준 · 매주 수요일 무료, 2026.10.29~11.15 무료 개방';
      const pause = days('2026-11-10', '2026-11-15');
      Object.assign(hours, {
        weekly: week([1], [slot('09:00', '17:30')]),
        scope: 'full', validFrom: T, validThrough: U,
        exceptions: Object.fromEntries(pause.map(date => [date, { slots: [slot('09:00', '17:30', '16:30')], scope: 'full', note: '「동궐동락」 야간 특별 프로그램 기간이라 야간 일반관람을 쉬어요', sourceUrl: URL_.cggNightPause }])),
        partialExtensions: [
          { from: T, through: '2026-11-09', weekdays: [0, 2, 3, 4, 5, 6], slots: [slot('17:30', '21:00', '20:00')], note: '야간개방구역만 관람 가능' },
          { from: '2026-11-16', through: U, weekdays: [0, 2, 3, 4, 5, 6], slots: [slot('17:30', '21:00', '20:00')], note: '야간개방구역만 관람 가능' },
        ],
        note: '주간표는 일반 주간 관람 기준 09:00~17:30. 11~1월은 17:30부터 야간개방구역만 관람할 수 있고 입장은 20:00까지',
      });
      const wednesdays = days(T, U).filter(date => weekday(date) === 3 && !festival.includes(date));
      price.exceptions = {
        ...Object.fromEntries(festivalOpen(1).map(date => [date, { kind: 'free', amount: 0, label: '코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)', scope: 'adult-one', sourceUrl: URL_.royalFree }])),
        ...Object.fromEntries(wednesdays.map(date => [date, { kind: 'free', amount: 0, label: '매주 수요일 일반 관람', sourceUrl: URL_.cggWednesday }])),
      };
      break;
    }
    case 'national-folk-museum': {
      place.visitNote = '상설전시관1은 2026.9.30~12.21(예정) 휴관. 주말·공휴일은 옥외전시장 내부 관람 제한.';
      Object.assign(hours, {
        weekly: week([], [slot('09:00', '17:00', '16:00')]),
        validFrom: T, validThrough: U,
        note: '11~2월 동절기 시간(야간연장 없음). 상설전시관1 휴관 기간으로 전체 관람 가능 여부는 미확인. 주말·공휴일 옥외전시장 내부도 제한',
      });
      delete hours.exceptions;
      break;
    }
    default: break;
  }
  return place;
});
const realHead = realSrc.slice(0, realSrc.indexOf('export const REAL_META'));
const realOut = realHead
  + `export const REAL_META = Object.freeze(${JSON.stringify(meta, null, 2)});\n\n`
  + `export const REAL_CONDITION_CALENDAR = Object.freeze(${JSON.stringify(calendar, null, 2)});\n\n`
  + `export const REAL_PLACES = Object.freeze(${JSON.stringify(places, null, 2)}.map(place => Object.freeze(place)));\n`;

// ── real-course-data.mjs ──
const courseFile = path.join(root, 'real-course-data.mjs');
const courseSrc = fs.readFileSync(path.join(base, 'real-course-data.mjs'), 'utf8');
const course = await import(pathToFileURL(path.join(base, 'real-course-data.mjs')).href);
const courseMeta = { ...clone(course.REAL_COURSE_META), verifiedAt: T };
const offerings = clone(course.REAL_COURSE_OFFERINGS);
for (const row of Object.values(offerings)) row.verifiedAt = T;
const recheckNotes = {
  'balwoo-gongyang': '점심 1·2부의 시작 시각에 맞춘 입장·예약 조건과 코스의 인원 단위·세금을 확인하기 전에는 표시가격을 합산하지 않아요.',
  'seoul-museum-craft-art': '야간 연장(11.30 종료) 뒤 운영시간, 부분 휴관 공지와 대관전시·예약 프로그램의 별도 조건을 확인해요.',
  unhyeongung: '야간 개방 종료(11.29) 뒤 동절기 운영과 공휴일 적용 여부를 확인해요.',
  gyeongbokgung: '12월 운영시간과 무료 관람일(코리아 그랜드 페스티벌 11.15 종료, 매월 마지막 수요일), 휴궁일을 함께 확인해요.',
  changgyeonggung: '「동궐동락」 기간(11.10~11.15) 야간 일반관람 중단 뒤 재개, 수요일 무료 관람과 휴궁일을 함께 확인해요.',
  'national-folk-museum': '상설전시관1 휴관 종료 예정일(12.21)과 실제 재개, 동절기 시간과 옥외 내부 제한을 확인해요.',
};
const rechecks = clone(course.REAL_COURSE_RECHECKS).map(row => {
  row.verifiedAt = T; row.reviewBy = U;
  if (row.placeId === 'balwoo-gongyang') row.sourceUrls = [URL_.balwoo];
  if (row.placeId === 'unhyeongung') row.sourceUrls = [URL_.unhPreview, URL_.unhNight, ...row.sourceUrls];
  if (row.placeId === 'changgyeonggung') row.sourceUrls = [...row.sourceUrls, URL_.cggNightPause];
  if (recheckNotes[row.placeId]) row.note = recheckNotes[row.placeId];
  return row;
});
const periodNotes = {
  'royal-autumn-free': '일반 관람 무료 기간이며 휴궁일·별도 특별관람은 제외돼요.',
  'unhyeongung-evening': '화·수·금·토·일 야간 개방 안내. 목요일과 그 밖의 동절기 날은 09:00~18:00이에요.',
};
// 확인일에 이미 끝난 기간(공예박물관 로비 10.13~10.25, 경복궁 월대 9.2~10.31)은 걷어 낸다.
const periods = clone(course.REAL_COURSE_PERIODS).filter(row => !row.through || row.through >= T).map(row => {
  row.verifiedAt = T;
  if (row.reviewOn && row.reviewOn < T) row.reviewOn = U;
  if (row.id === 'unhyeongung-evening') { row.sourceUrl = URL_.unhNight; row.reviewOn = '2026-11-29'; }
  if (row.id === 'royal-autumn-free') row.reviewOn = '2026-11-15';
  if (periodNotes[row.id]) row.note = periodNotes[row.id];
  return row;
});
const pauseAt = periods.findIndex(row => row.id === 'changgyeonggung-night-area');
periods.splice(pauseAt + 1, 0, {
  id: 'changgyeonggung-night-pause',
  placeIds: ['changgyeonggung'],
  kind: 'partial-closure',
  from: '2026-11-10',
  through: '2026-11-15',
  reviewOn: '2026-11-15',
  sourceUrl: URL_.cggNightPause,
  verifiedAt: T,
  note: '「동궐동락」 야간 특별 프로그램 기간이라 17:30~21:00 야간 일반관람을 쉬어요. 주간 입장마감 16:30, 관람 종료 17:30이에요.',
});
const courseHead = courseSrc.slice(0, courseSrc.indexOf('export const REAL_COURSE_META'));
const courseOut = courseHead
  + `export const REAL_COURSE_META = Object.freeze(${JSON.stringify(courseMeta, null, 2)});\n\n`
  + `export const REAL_COURSE_OFFERINGS = Object.freeze(${JSON.stringify(offerings, null, 2)});\n\n`
  + `export const REAL_COURSE_RECHECKS = Object.freeze(${JSON.stringify(rechecks, null, 2)});\n\n`
  + `export const REAL_COURSE_PERIODS = Object.freeze(${JSON.stringify(periods, null, 2)});\n`;

if (process.argv.includes('--write')) {
  fs.writeFileSync(realFile, realOut);
  fs.writeFileSync(courseFile, courseOut);
  console.log('written', realFile, courseFile);
} else {
  const outDir = process.argv[2];
  fs.writeFileSync(path.join(outDir, 'real-places.mjs'), realOut);
  fs.writeFileSync(path.join(outDir, 'real-course-data.mjs'), courseOut);
  console.log('preview written to', outDir);
}
