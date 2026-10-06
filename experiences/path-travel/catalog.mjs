/**
 * 서울 개인화 여행의 조합·제약 처리를 확인하기 위한 가상 자료.
 * 동네 이름만 실제 지명이다. 업체, 요금, 시설, 영업시간, 좌표와 교통값은
 * 전부 예시이며 실제 여행·예약에 사용할 수 없다.
 */

export const FIXTURE_NOTICE = '가상 예시입니다. 실제 업체가 아니며 가격·시설·시간·좌표·이동 정보와 세부 특성은 검증용 샘플입니다.';

export const CATALOG_META = Object.freeze({
  id: 'seoul-personal-travel-fixture-v1',
  city: 'seoul',
  cityName: '서울',
  referenceDate: '2026-10-06',
  currency: 'KRW',
  party: Object.freeze({ adults: 1, rooms: 1, nights: 1 }),
  taxesAndFeesIncluded: true,
  isFixture: true,
  sourceKind: 'fixture',
  sourceNotice: FIXTURE_NOTICE,
  checkedAt: null,
  checkedAtNotice: '실제 공급처를 조회하거나 영업·가격·재고를 확인한 자료가 아닙니다.',
  traitNotice: '세부 특성은 취향 충돌을 시험하는 가상 시나리오값입니다. null과 unknown은 자료 없음이며 조건 충족을 뜻하지 않습니다.',
  scope: '성인 1명 · 서울 하루와 숙박 1박 · 출발지 서울역 · 숙소 체크인으로 종료',
});

export const AREAS = Object.freeze([
  { id: 'jongno', name: '종로·서촌', center: { lat: 37.575, lng: 126.976 } },
  { id: 'seongsu', name: '성수·서울숲', center: { lat: 37.546, lng: 127.045 } },
  { id: 'itaewon', name: '이태원·한강', center: { lat: 37.529, lng: 126.994 } },
].map((area) => Object.freeze({
  ...area,
  center: Object.freeze(area.center),
  isFixture: true,
  sourceNotice: '실제 권역 이름을 사용하며 중심 좌표는 이동 실험용 예시입니다.',
})));

const areaById = new Map(AREAS.map((area) => [area.id, area]));
const featureDefaults = {
  quiet: 0, central: 0, local: 0, fine: 0, cafe: 0,
  food: 0, hotel: 0, balanced: 0, none: 0, live: 0, club: 0,
};

/**
 * 해당 도메인만 제공한다. 숫자 null / 삼중상태 unknown을 0이나 false로 바꾸지 않는다.
 * 0..1: noiseLevel·crowdLevel은 높을수록 시끄럽고 붐빔, energy는 활기.
 * cleanliness·centrality는 청결·도심 접근 편의의 가상 수준이다.
 * novelty는 모험적인 메뉴 구성의 예시이며 개인의 실제 음식 경험을 판정하지 않는다.
 * spiceLevel: 0 안 매운 예시 / 1 약간 매운 예시 / 2 매운 예시.
 * waitMinutes는 입장·착석 전 대기, walkMinutes는 활동 자체의 도보다.
 * 숫자로 주어진 대기·도보는 기존 durationMinutes에 포함되어 있다.
 * null 대기는 미확인이며 추가 여유 시간의 필요 여부도 확인되지 않았다.
 */
const traitDefaults = Object.freeze({
  hotel: Object.freeze({ noiseLevel: null, centrality: null, cleanliness: null }),
  food: Object.freeze({ spiceLevel: null, vegetarian: 'unknown', novelty: null, waitMinutes: null }),
  activity: Object.freeze({ indoor: 'unknown', crowdLevel: null, walkMinutes: null }),
  night: Object.freeze({ energy: null, music: 'unknown', conversationFriendly: 'unknown', alcoholFreeOption: 'unknown' }),
});

function normalizeTraits(type, traits) {
  const domain = type === 'lunch' || type === 'dinner' ? 'food' : type;
  const values = Object.fromEntries(Object.entries(traitDefaults[domain]).map(([key, fallback]) => [
    key, traits[domain]?.[key] ?? fallback,
  ]));
  return Object.freeze({ [domain]: Object.freeze(values) });
}

function candidate({
  id, type, name, areaId, description, price, durationMinutes, openWindows,
  indoor = true, requiresAlcohol = false, features = {}, nightStyle = null,
  offset = [0, 0], restHotelId = null, traits = {},
}) {
  const area = areaById.get(areaId);
  return Object.freeze({
    id, type, name, areaId, area: area.name, description, price, durationMinutes,
    currency: 'KRW',
    priceUnit: type === 'hotel' ? '성인 1명 · 1객실 · 1박' : '성인 1명',
    taxesAndFeesIncluded: true,
    openWindows: Object.freeze(openWindows.map(([start, end]) => Object.freeze({ start, end }))),
    indoor, requiresAlcohol, nightStyle, restHotelId,
    features: Object.freeze({ ...featureDefaults, ...features }),
    traits: normalizeTraits(type, traits),
    location: Object.freeze({
      lat: Number((area.center.lat + offset[0]).toFixed(6)),
      lng: Number((area.center.lng + offset[1]).toFixed(6)),
    }),
    isFixture: true,
    sourceKind: 'fixture',
    sourceNotice: FIXTURE_NOTICE,
    checkedAt: null,
  });
}

export const CANDIDATES = Object.freeze([
  candidate({
    id: 'hotel-jongno-a', type: 'hotel', name: '종로 작은 스테이 A', areaId: 'jongno',
    description: '숙박비를 아끼고 도심에서 움직이는 선택을 비교하는 가상 숙소. 객실·방음은 실제 시설 정보가 아닙니다.',
    price: 78000, durationMinutes: 10, openWindows: [[840, 1800]],
    features: { quiet: 0.45, central: 0.95, hotel: 0.45, balanced: 0.9 },
    traits: { hotel: { noiseLevel: 0.65, centrality: 0.95, cleanliness: 0.7 } },
  }),
  candidate({
    id: 'hotel-seongsu-b', type: 'hotel', name: '성수 조용한 호텔 B', areaId: 'seongsu',
    description: '조용한 밤과 휴식에 예산을 더 쓰는 선택을 비교하는 가상 숙소입니다.',
    price: 148000, durationMinutes: 10, openWindows: [[840, 1800]],
    features: { quiet: 1, central: 0.6, hotel: 0.95, balanced: 0.75 },
    traits: { hotel: { noiseLevel: 0.1, centrality: 0.6, cleanliness: 0.95 } },
  }),
  candidate({
    id: 'hotel-itaewon-c', type: 'hotel', name: '이태원 전망 호텔 C', areaId: 'itaewon',
    description: '숙소에서 보내는 시간과 공간의 여유에 지출하는 선택을 비교하는 가상 숙소입니다.',
    price: 238000, durationMinutes: 10, openWindows: [[840, 1800]],
    features: { quiet: 0.7, central: 0.85, hotel: 1, balanced: 0.5 },
    traits: { hotel: { noiseLevel: 0.35, centrality: 0.85, cleanliness: null } },
  }),

  candidate({
    id: 'lunch-jongno-a', type: 'lunch', name: '종로 작은 밥상 A', areaId: 'jongno',
    description: '익숙한 한식 한 끼와 낮은 식비를 선호하는 경우를 위한 가상 식당입니다.',
    price: 10000, durationMinutes: 45, openWindows: [[660, 870]],
    features: { local: 1, fine: 0.1, cafe: 0.1, food: 0.65, balanced: 1 }, offset: [0.001, -0.001],
    traits: { food: { spiceLevel: 1, vegetarian: false, novelty: 0.15, waitMinutes: 0 } },
  }),
  candidate({
    id: 'lunch-seongsu-b', type: 'lunch', name: '성수 브런치 테이블 B', areaId: 'seongsu',
    description: '느긋한 식사와 카페 분위기를 함께 비교하는 가상 식당입니다.',
    price: 21000, durationMinutes: 70, openWindows: [[630, 930]],
    features: { local: 0.3, fine: 0.35, cafe: 1, food: 0.65, balanced: 0.75 }, offset: [0.001, 0.001],
    traits: { food: { spiceLevel: 0, vegetarian: true, novelty: 0.3, waitMinutes: 25 } },
  }),
  candidate({
    id: 'lunch-itaewon-c', type: 'lunch', name: '이태원 점심 코스 C', areaId: 'itaewon',
    description: '점심에 더 많은 시간과 돈을 쓰는 선택을 비교하는 가상 코스 식당입니다.',
    price: 42000, durationMinutes: 90, openWindows: [[690, 900]],
    features: { local: 0.35, fine: 1, cafe: 0.25, food: 1, balanced: 0.4 }, offset: [-0.001, 0.001],
    traits: { food: { spiceLevel: 1, vegetarian: 'unknown', novelty: 1, waitMinutes: 10 } },
  }),
  candidate({
    id: 'lunch-seongsu-d', type: 'lunch', name: '성수 동네 국수 D', areaId: 'seongsu',
    description: '카페 권역에서도 식사는 간단하게 해결하는 선택을 비교하는 가상 식당입니다.',
    price: 9000, durationMinutes: 35, openWindows: [[660, 900]],
    features: { local: 0.9, fine: 0.05, cafe: 0.1, food: 0.5, balanced: 1 }, offset: [-0.001, -0.001],
    traits: { food: { spiceLevel: 2, vegetarian: false, novelty: 0.55, waitMinutes: null } },
  }),

  candidate({
    id: 'activity-jongno-a', type: 'activity', name: '서촌 작은 전시 A', areaId: 'jongno',
    description: '비가 올 때도 실내에서 천천히 머무는 선택을 비교하는 가상 전시 공간입니다.',
    price: 8000, durationMinutes: 80, openWindows: [[600, 1080]],
    features: { quiet: 0.9, local: 0.85, fine: 0.3, balanced: 0.9 }, offset: [0.002, -0.002],
    traits: { activity: { indoor: true, crowdLevel: 0.15, walkMinutes: 20 } },
  }),
  candidate({
    id: 'activity-seongsu-b', type: 'activity', name: '서울숲 느린 산책 B', areaId: 'seongsu',
    description: '실제 서울숲 권역을 배경으로 만든 야외 산책 예시. 경로·소요시간은 실측하지 않았습니다.',
    price: 0, durationMinutes: 70, openWindows: [[540, 1110]], indoor: false,
    features: { quiet: 0.9, local: 0.6, cafe: 0.55, balanced: 1 }, offset: [-0.002, -0.002],
    traits: { activity: { indoor: false, crowdLevel: 0.65, walkMinutes: 70 } },
  }),
  candidate({
    id: 'activity-itaewon-c', type: 'activity', name: '한강 오후 산책 C', areaId: 'itaewon',
    description: '한강 권역에서 야외 시간을 보내는 가상 일정. 지정 코스와 현장 접근성은 확인하지 않았습니다.',
    price: 0, durationMinutes: 90, openWindows: [[540, 1170]], indoor: false,
    features: { quiet: 0.8, local: 0.5, fine: 0.35, balanced: 1 }, offset: [-0.003, 0],
    traits: { activity: { indoor: false, crowdLevel: null, walkMinutes: 90 } },
  }),
  candidate({
    id: 'activity-seongsu-d', type: 'activity', name: '성수 실내 취향 공방 D', areaId: 'seongsu',
    description: '비가 오는 날 손으로 만드는 활동에 지출하는 선택을 비교하는 가상 체험 공간입니다.',
    price: 28000, durationMinutes: 90, openWindows: [[660, 1140]],
    features: { quiet: 0.7, local: 0.4, cafe: 0.85, fine: 0.5, balanced: 0.55 }, offset: [0.002, 0],
    traits: { activity: { indoor: true, crowdLevel: 0.4, walkMinutes: 10 } },
  }),

  candidate({
    id: 'dinner-jongno-a', type: 'dinner', name: '종로 저녁 백반 A', areaId: 'jongno',
    description: '저녁도 편안한 한식과 합리적인 지출로 마무리하는 가상 식당입니다.',
    price: 15000, durationMinutes: 55, openWindows: [[1020, 1260]],
    features: { local: 1, fine: 0.1, cafe: 0.05, food: 0.7, balanced: 1 }, offset: [-0.001, 0.001],
    traits: { food: { spiceLevel: 1, vegetarian: false, novelty: 0.15, waitMinutes: 5 } },
  }),
  candidate({
    id: 'dinner-seongsu-b', type: 'dinner', name: '성수 저녁 다이닝 B', areaId: 'seongsu',
    description: '카페 같은 분위기에서 천천히 저녁을 먹는 선택을 비교하는 가상 식당입니다.',
    price: 31000, durationMinutes: 80, openWindows: [[1020, 1350]],
    features: { local: 0.35, fine: 0.7, cafe: 1, food: 0.85, balanced: 0.65 }, offset: [0, 0.002],
    traits: { food: { spiceLevel: 0, vegetarian: true, novelty: 0.55, waitMinutes: 25 } },
  }),
  candidate({
    id: 'dinner-itaewon-c', type: 'dinner', name: '이태원 테이스팅 코스 C', areaId: 'itaewon',
    description: '술 주문 없이 음식 코스 자체에 예산을 집중하는 경우를 위한 가상 식당입니다.',
    price: 72000, durationMinutes: 110, openWindows: [[1050, 1350]],
    features: { local: 0.25, fine: 1, cafe: 0.3, food: 1, balanced: 0.25 }, offset: [0.001, -0.001],
    traits: { food: { spiceLevel: 0, vegetarian: 'unknown', novelty: 1, waitMinutes: 0 } },
  }),
  candidate({
    id: 'dinner-itaewon-d', type: 'dinner', name: '이태원 동네 식탁 D', areaId: 'itaewon',
    description: '야간 활동 전 식비와 시간을 아끼는 선택을 비교하는 가상 식당입니다.',
    price: 17000, durationMinutes: 50, openWindows: [[1020, 1320]],
    features: { local: 0.9, fine: 0.15, cafe: 0.25, food: 0.65, balanced: 0.9 }, offset: [-0.001, -0.001],
    traits: { food: { spiceLevel: 2, vegetarian: true, novelty: 0.75, waitMinutes: null } },
  }),

  candidate({
    id: 'night-jongno-quiet-a', type: 'night', name: '서촌 밤 찻집 A', areaId: 'jongno',
    description: '술 없이 조용한 대화와 차를 즐기는 선택을 비교하는 가상 찻집입니다.',
    price: 9000, durationMinutes: 65, openWindows: [[1140, 1410]], nightStyle: 'quiet',
    features: { quiet: 1, cafe: 0.9, local: 0.6, balanced: 0.8 }, offset: [0, -0.002],
    traits: { night: { energy: 0.15, music: 'background', conversationFriendly: true, alcoholFreeOption: true } },
  }),
  candidate({
    id: 'night-seongsu-live-b', type: 'night', name: '성수 저녁 공연 B', areaId: 'seongsu',
    description: '음주 없이 실내 라이브 음악을 듣는 선택을 비교하는 가상 공연입니다. 실제 공연 일정이 아닙니다.',
    price: 26000, durationMinutes: 90, openWindows: [[1170, 1440]], nightStyle: 'live',
    features: { live: 1, cafe: 0.3, fine: 0.5, balanced: 0.6 }, offset: [0.001, -0.002],
    traits: { night: { energy: 0.65, music: 'live', conversationFriendly: false, alcoholFreeOption: true } },
  }),
  candidate({
    id: 'night-itaewon-club-c', type: 'night', name: '이태원 댄스 클럽 C', areaId: 'itaewon',
    description: '늦은 시간 음악과 춤을 즐기는 가상 클럽입니다. 이 예시는 주류 포함 상품으로 음주 제외 조건에서는 탈락합니다.',
    price: 45000, durationMinutes: 100, openWindows: [[1260, 1620]], nightStyle: 'club', requiresAlcohol: true,
    features: { club: 1, live: 0.55, fine: 0.4, balanced: 0.25 }, offset: [0.001, 0.002],
    traits: { night: { energy: 1, music: 'dance', conversationFriendly: false, alcoholFreeOption: false } },
  }),
  ...AREAS.map((area, index) => candidate({
    id: `night-${area.id}-rest`, type: 'night',
    name: `${area.name.split('·')[0]} 숙소에서 쉬기 ${['D', 'E', 'F'][index]}`,
    areaId: area.id,
    description: '추가 외출을 넣지 않는 가상 선택지입니다. 별도 숙박비는 없으며 숙소 비용은 호텔 항목에서 한 번 계산합니다.',
    price: 0, durationMinutes: 0, openWindows: [[0, 1800]], nightStyle: 'none',
    features: { quiet: 1, none: 1, balanced: 1 },
    traits: { night: { energy: 0, music: 'none', conversationFriendly: 'unknown', alcoholFreeOption: true } },
    restHotelId: ['hotel-jongno-a', 'hotel-seongsu-b', 'hotel-itaewon-c'][index],
  })),
]);

// [대중교통 분, 도보 분, 택시 분]. 실제 지도·경로 API의 응답이 아니다.
const TRAVEL_TIMES = Object.freeze({
  'jongno|station': [22, 42, 15],
  'seongsu|station': [40, 120, 32],
  'itaewon|station': [30, 65, 22],
  'jongno|seongsu': [38, 120, 30],
  'itaewon|jongno': [34, 85, 25],
  'itaewon|seongsu': [36, 100, 28],
});

function areaIdOf(point) {
  const id = typeof point === 'string' ? point : point?.areaId;
  if (id !== 'station' && !areaById.has(id)) {
    throw new RangeError(`가상 교통 자료에 없는 출발·도착 권역입니다: ${String(id)}`);
  }
  return id;
}

/** Local-only adapter. Walking minutes include transfer walks for transit/taxi. */
export function quoteTransportation(from, to, mode = 'transit') {
  if (!['walk', 'transit', 'taxi'].includes(mode)) {
    throw new RangeError(`지원하지 않는 이동수단입니다: ${String(mode)}`);
  }
  const fromArea = areaIdOf(from);
  const toArea = areaIdOf(to);
  const sameLocation = (typeof from === 'object' && from === to)
    || (fromArea === 'station' && toArea === 'station') || (from?.location && to?.location
    && from.location.lat === to.location.lat && from.location.lng === to.location.lng);
  const sameArea = fromArea === toArea;
  const key = [fromArea, toArea].sort().join('|');
  const times = sameLocation ? [0, 0, 0] : sameArea ? [12, 18, 8] : TRAVEL_TIMES[key];
  const minutes = times[['transit', 'walk', 'taxi'].indexOf(mode)];
  const cost = minutes === 0 || mode === 'walk' ? 0
    : mode === 'transit' ? (sameArea ? 1500 : 1800)
      : sameArea ? 6500 : 6500 + Math.round(minutes / 5) * 1800;
  const walkMinutes = minutes === 0 ? 0 : mode === 'walk' ? minutes
    : mode === 'transit' ? (sameArea ? 6 : 10) : (sameArea ? 1 : 3);

  return Object.freeze({
    fromArea, toArea, mode, minutes, cost, walkMinutes,
    currency: 'KRW', taxesAndFeesIncluded: true,
    isFixture: true, sourceKind: 'fixture', sourceNotice: FIXTURE_NOTICE,
    notice: '거리·대기·환승·요금이 실제와 다른 가상 교통 견적입니다.',
    checkedAt: null,
  });
}
