// 환승 러시 노선 사실(설계 4절). 실제 서울 지하철의 노선 번호 · 색 · 역 순서 · 환승 관계만 여기 한 곳에 둔다.
// 문 쪽 · 출구 번호 · 셔틀은 게임 속 사건이라 여기 없다. 안내 원고는 이 표에서 나오고, lines.test.mjs가 안내와 양쪽으로 대조한다.
export const LINES = Object.freeze({
  1: Object.freeze({ color: '#0052A4', say: '일호선', order: Object.freeze(['서울역', '시청', '종각', '종로3가', '종로5가', '동대문']) }),
  2: Object.freeze({ color: '#00A84D', say: '이호선', order: Object.freeze(['신촌', '이대', '아현', '충정로', '시청', '을지로입구', '을지로3가', '을지로4가']) }),
  3: Object.freeze({ color: '#EF7C1C', say: '삼호선', order: Object.freeze(['종로3가', '을지로3가']) }),
  4: Object.freeze({ color: '#00A5DE', say: '사호선', order: Object.freeze(['동대문', '서울역']) }),
  5: Object.freeze({ color: '#996CAC', say: '오호선', order: Object.freeze(['충정로', '종로3가', '을지로4가']) }),
});

// 역마다 지나는 노선(게임에 나오는 역만). 여기 있는 다른 노선은 도착 안내에 반드시 든다.
export const STATIONS = Object.freeze({
  신촌: Object.freeze({ slug: 'sinchon', lines: Object.freeze([2]) }),
  이대: Object.freeze({ slug: 'ewha', lines: Object.freeze([2]) }),
  아현: Object.freeze({ slug: 'ahyeon', lines: Object.freeze([2]) }),
  충정로: Object.freeze({ slug: 'chungjeongno', lines: Object.freeze([2, 5]) }),
  시청: Object.freeze({ slug: 'cityhall', lines: Object.freeze([1, 2]) }),
  을지로입구: Object.freeze({ slug: 'euljiro1', lines: Object.freeze([2]) }),
  을지로3가: Object.freeze({ slug: 'euljiro3', say: '을지로 삼가', lines: Object.freeze([2, 3]) }),
  을지로4가: Object.freeze({ slug: 'euljiro4', say: '을지로 사가', lines: Object.freeze([2, 5]) }),
  서울역: Object.freeze({ slug: 'seoulstation', lines: Object.freeze([1, 4]) }),
  종각: Object.freeze({ slug: 'jonggak', lines: Object.freeze([1]) }),
  종로3가: Object.freeze({ slug: 'jongno3', say: '종로 삼가', lines: Object.freeze([1, 3, 5]) }),
  종로5가: Object.freeze({ slug: 'jongno5', say: '종로 오가', lines: Object.freeze([1]) }),
  동대문: Object.freeze({ slug: 'dongdaemun', lines: Object.freeze([1, 4]) }),
});

/** 읽을 때 쓰는 역 이름(숫자가 든 이름은 한글 소리로). */
export const sayStation = (name) => STATIONS[name]?.say || name;
const has받침 = (word) => { const last = word.at(-1), code = last.charCodeAt(0) - 0xac00; if (code < 0 || code > 11171) return /[136780]$/.test(last); return code % 28 !== 0; };
/** 「충정로예요」 · 「시청이에요」 */
export const 이에요 = (word) => `${word}${has받침(word) ? '이에요' : '예요'}`;
/** 이 역에서 지금 탄 노선 말고 갈아탈 수 있는 노선. */
export const transfersAt = (name, line) => (STATIONS[name]?.lines || []).filter((n) => n !== line);
