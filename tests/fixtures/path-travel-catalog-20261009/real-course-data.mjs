// Reference products and a manual source-review ledger. No live route, reservation or total-cost claims.
export const REAL_COURSE_META = Object.freeze({
  "version": 1,
  "area": "서울 종로·안국·인사동·북촌",
  "verifiedAt": "2026-10-07",
  "freshnessDays": 30,
  "sourceKind": "official-web-notices",
  "liveAvailability": false,
  "routeDurationVerified": false,
  "refreshMode": "manual",
  "priceNote": "선택한 예시 메뉴와 일반 관람의 표시금액만 더해요. 인원별 총비용이나 최저비용이 아니에요.",
  "timeNote": "체류시간과 이동 여유는 계획을 위한 입력값이에요. 실제 보행시간·대기시간은 확인되지 않았어요.",
  "reviewNote": "공식 안내와 기간이 바뀌면 담당자가 원문을 다시 확인해요. 재확인 날짜는 운영 보장 기한이 아니에요."
});

export const REAL_COURSE_OFFERINGS = Object.freeze({
  "gaeseong-mandu-koong": {
    "kind": "sample",
    "label": "개성 만둣국",
    "amount": 15000,
    "currency": "KRW",
    "unit": "menu-item",
    "taxStatus": "not-stated",
    "sourceUrl": "https://www.koong.co.kr/2020/menuinfo/meals.php",
    "verifiedAt": "2026-10-07",
    "availabilityNote": "메뉴 1개 표시가격이에요. 인분·세금·주문 가능 여부는 매장 확인이 필요해요."
  }
});

export const REAL_COURSE_RECHECKS = Object.freeze([
  {
    "placeId": "gaeseong-mandu-koong",
    "name": "개성만두 궁",
    "verifiedAt": "2026-10-07",
    "reviewBy": "2026-11-06",
    "sourceUrls": [
      "https://www.koong.co.kr/2020/menuinfo/meals.php",
      "https://www.koong.co.kr/2020/storeinfo/headoffice.php",
      "https://korean.visitseoul.net/restaurants/%EA%B6%81/KOP011155"
    ],
    "note": "매장·관광 안내의 마감시간 차이, 요일별 마지막 주문, 메뉴 표시가격·인분·세금을 재확인해요."
  },
  {
    "placeId": "balwoo-gongyang",
    "name": "발우공양",
    "verifiedAt": "2026-10-07",
    "reviewBy": "2026-11-06",
    "sourceUrls": [
      "https://korean.visitseoul.net/restaurants/BalwooGongyang/KOP4vpx7k"
    ],
    "note": "메뉴별 제공 요일·시간·인분·세금과 정기휴무를 확인하기 전에는 표시가격을 합산하지 않아요."
  },
  {
    "placeId": "kyungin-traditional-teahouse",
    "name": "경인미술관 전통다원",
    "verifiedAt": "2026-10-07",
    "reviewBy": "2026-11-06",
    "sourceUrls": [
      "https://korean.visitseoul.net/restaurants/%EA%B2%BD%EC%9D%B8%EB%AF%B8%EC%88%A0%EA%B4%80%EC%A0%84%ED%86%B5%EB%8B%A4%EC%9B%90/KOP010878"
    ],
    "note": "차 메뉴별 가격·인분·세금, 마지막 주문과 명절 휴무 범위를 확인해요."
  },
  {
    "placeId": "osulloc-bukchon",
    "name": "오설록 티하우스 북촌점",
    "verifiedAt": "2026-10-07",
    "reviewBy": "2026-11-06",
    "sourceUrls": [
      "https://www.osulloc.com/kr/ko/store-introduction/312"
    ],
    "note": "일반 음료 메뉴가격과 티코스 인원·예약·제공시간을 확인해요. 브랜드 안내와 연결 예약 서비스의 시간 범위도 대조해요."
  },
  {
    "placeId": "nine-tree-insadong",
    "name": "나인트리 바이 파르나스 서울 인사동",
    "verifiedAt": "2026-10-07",
    "reviewBy": "2026-11-06",
    "sourceUrls": [
      "https://www.ninetreehotels.com/ko/insadong/room/standard-double"
    ],
    "note": "체크인·체크아웃과 방문 영업시간을 구분해요. 날짜·객실·인원별 요금은 코스 금액에서 제외해요."
  },
  {
    "placeId": "orakai-insadong-suites",
    "name": "오라카이 인사동 스위츠",
    "verifiedAt": "2026-10-07",
    "reviewBy": "2026-11-06",
    "sourceUrls": [
      "https://insa.orakaihotels.com/kr/about/guest_info.asp?mCode=1"
    ],
    "note": "체크인·체크아웃과 방문 영업시간을 구분해요. 날짜·객실·인원별 요금은 코스 금액에서 제외해요."
  },
  {
    "placeId": "seoul-museum-craft-art",
    "name": "서울공예박물관",
    "verifiedAt": "2026-10-07",
    "reviewBy": "2026-10-13",
    "sourceUrls": [
      "https://craftmuseum.seoul.go.kr/preview/visit",
      "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000444",
      "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
    ],
    "note": "로비 부분휴관·야간 대상 공간·입장마감과 대관전시·예약 프로그램의 별도 조건을 확인해요."
  },
  {
    "placeId": "unhyeongung",
    "name": "운현궁",
    "verifiedAt": "2026-10-07",
    "reviewBy": "2026-11-01",
    "sourceUrls": [
      "https://korean.visitseoul.net/attractions/%EC%9A%B4%ED%98%84%EA%B6%81_/471"
    ],
    "note": "11월 일반 운영시간과 야간 개방의 종료·공휴일 적용 여부를 확인해요."
  },
  {
    "placeId": "gyeongbokgung",
    "name": "경복궁",
    "verifiedAt": "2026-10-07",
    "reviewBy": "2026-11-01",
    "sourceUrls": [
      "https://royal.khs.go.kr/ROYAL/contents/R703000000.do",
      "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930144202825885&schM=view",
      "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view",
      "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260528151556017843&schM=view",
      "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260830151817711582&schM=view",
      "https://royal.khs.go.kr/ROYAL/contents/R707000000.do?schGroupCode=gbg"
    ],
    "note": "근정전 월대 제한 종료, 11월 운영시간, 무료 관람일과 휴궁일을 함께 확인해요."
  },
  {
    "placeId": "changgyeonggung",
    "name": "창경궁",
    "verifiedAt": "2026-10-07",
    "reviewBy": "2026-11-01",
    "sourceUrls": [
      "https://royal.khs.go.kr/ROYAL/contents/R703000000.do",
      "https://royal.khs.go.kr/ROYAL/contents/R702000000.do?schGroupCode=cgg",
      "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view",
      "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20261007095901706396&schM=view",
      "https://royal.khs.go.kr/ROYAL/contents/R707000000.do?schGroupCode=cgg"
    ],
    "note": "수요일 무료 관람·축제 기간·휴궁일과 11월 야간 공개 구역 경계를 함께 확인해요."
  },
  {
    "placeId": "national-folk-museum",
    "name": "국립민속박물관 본관",
    "verifiedAt": "2026-10-07",
    "reviewBy": "2026-11-01",
    "sourceUrls": [
      "https://nfm.go.kr/home/subIndex/1239.do"
    ],
    "note": "상설전시관1 휴관 종료 예정일과 실제 재개, 동절기 시간·야간 중단, 옥외 내부 제한을 확인해요."
  }
]);

export const REAL_COURSE_PERIODS = Object.freeze([
  {
    "id": "craft-lobby-closure",
    "placeIds": [
      "seoul-museum-craft-art"
    ],
    "kind": "partial-closure",
    "from": "2026-10-13",
    "through": "2026-10-25",
    "reviewOn": "2026-10-13",
    "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452",
    "verifiedAt": "2026-10-07",
    "note": "전시1동 1층 로비 휴관·통행 제한. 10월 27일 정상운영 안내이며, 26일은 정기휴관일이에요."
  },
  {
    "id": "craft-extended-evening",
    "placeIds": [
      "seoul-museum-craft-art"
    ],
    "kind": "partial-extension",
    "from": "2026-09-15",
    "through": "2026-11-30",
    "reviewOn": "2026-11-30",
    "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000444",
    "verifiedAt": "2026-10-07",
    "note": "화·수·금·토·일 전시1동 1~2층의 야간 연장 기간이에요. 전체 전시실 연장이 아니에요."
  },
  {
    "id": "unhyeongung-evening",
    "placeIds": [
      "unhyeongung"
    ],
    "kind": "extension",
    "from": "2026-09-01",
    "through": "2026-11-29",
    "reviewOn": "2026-11-01",
    "sourceUrl": "https://korean.visitseoul.net/attractions/%EC%9A%B4%ED%98%84%EA%B6%81_/471",
    "verifiedAt": "2026-10-07",
    "note": "화·수·금·토·일 야간 개방 안내. 기존 조건자료는 11월 일반시간 미확인으로 10월 31일까지 사용해요."
  },
  {
    "id": "gyeongbokgung-woldae",
    "placeIds": [
      "gyeongbokgung"
    ],
    "kind": "partial-closure",
    "from": "2026-09-02",
    "through": "2026-10-31",
    "reviewOn": "2026-11-01",
    "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260830151817711582&schM=view",
    "verifiedAt": "2026-10-07",
    "note": "근정전 월대 출입 제한 기간이에요. 11월 재개 여부와 새 공지를 확인해요."
  },
  {
    "id": "royal-autumn-free",
    "placeIds": [
      "gyeongbokgung",
      "changgyeonggung"
    ],
    "kind": "free-admission-period",
    "from": "2026-10-29",
    "through": "2026-11-15",
    "reviewOn": "2026-11-06",
    "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view",
    "verifiedAt": "2026-10-07",
    "note": "일반 관람 무료 기간이며 휴궁일·별도 특별관람은 제외돼요. 현재 조건자료에는 11월 6일까지의 날짜만 반영돼요."
  },
  {
    "id": "gyeongbokgung-winter-hours",
    "placeIds": [
      "gyeongbokgung"
    ],
    "kind": "season-change",
    "startsOn": "2026-11-01",
    "reviewOn": "2026-11-01",
    "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930144202825885&schM=view",
    "verifiedAt": "2026-10-07",
    "note": "11월 일반 관람 09:00~17:00, 입장마감 16:00으로 바뀌어요."
  },
  {
    "id": "changgyeonggung-night-area",
    "placeIds": [
      "changgyeonggung"
    ],
    "kind": "season-change",
    "startsOn": "2026-11-01",
    "reviewOn": "2026-11-01",
    "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R702000000.do?schGroupCode=cgg",
    "verifiedAt": "2026-10-07",
    "note": "야간 공개 구역으로 제한되는 경계가 10월 18:00에서 11월 17:30으로 바뀌어요."
  },
  {
    "id": "folk-winter-hours",
    "placeIds": [
      "national-folk-museum"
    ],
    "kind": "season-change",
    "startsOn": "2026-11-01",
    "reviewOn": "2026-11-01",
    "sourceUrl": "https://nfm.go.kr/home/subIndex/1239.do",
    "verifiedAt": "2026-10-07",
    "note": "11~2월 09:00~17:00, 종료 1시간 전 입장마감이며 수요일 야간 연장은 운영하지 않아요."
  },
  {
    "id": "folk-hall1-closure",
    "placeIds": [
      "national-folk-museum"
    ],
    "kind": "partial-closure",
    "from": "2026-09-30",
    "through": "2026-12-21",
    "endIsTentative": true,
    "reviewOn": "2026-11-06",
    "sourceUrl": "https://nfm.go.kr/home/subIndex/1239.do",
    "verifiedAt": "2026-10-07",
    "note": "상설전시관1 휴관 종료는 12월 21일 예정이에요. 확정 재개일로 사용하지 않아요."
  }
]);
