// Official web notices; dates, partial access and sample menu prices are not live availability.
export const REAL_META = Object.freeze({
  "version": 2,
  "area": "서울 종로·안국·인사동·북촌",
  "checkedAt": "2026-10-07",
  "sourceKind": "official-web-notices",
  "liveAvailability": false
});

export const REAL_CONDITION_CALENDAR = Object.freeze({
  "from": "2026-09-07",
  "through": "2026-11-06",
  "holidays": [
    "2026-09-24",
    "2026-09-25",
    "2026-09-26",
    "2026-10-03",
    "2026-10-05",
    "2026-10-09"
  ],
  "sourceUrl": "https://www.kasi.re.kr/kor/post/newsMaterial/32031",
  "verifiedAt": "2026-10-07",
  "note": "우주항공청 2026년 월력요항(한국천문연구원 게시). 일요일은 주간시간표로 처리하며 이 배열에는 별도 공휴일만 수록"
});

export const REAL_PLACES = Object.freeze([
  {
    "id": "gaeseong-mandu-koong",
    "name": "개성만두 궁",
    "category": "food",
    "address": "서울특별시 종로구 인사동10길 11-3",
    "description": "개성만두와 사골 국물 요리를 소개하는 한식당.",
    "checkedAt": "2026-10-07",
    "sourceLabel": "서울관광재단 Visit Seoul",
    "sourceUrl": "https://korean.visitseoul.net/restaurants/%EA%B6%81/KOP011155",
    "costNote": "공식 식사류 예시: 개성 만둣국 15,000원 · 매장 최저비용이 아니며 세금·주문 단위 확인 필요",
    "visitNote": "영업시간·쉬는 시간·휴무일을 확인해 주세요.",
    "openingNote": "일·월·화 11:30~20:00. 수~토 마감은 매장 공식 21:30, 서울 관광 안내 21:00으로 서로 달라요. 평일 쉬는 시간·요일별 마지막 주문은 방문 전 확인해 주세요. 신정·설·추석 당일과 별도 여름휴가 휴무 안내가 있어요.",
    "accessNote": "3호선 안국역 5번 출구에서 인사동10길로 이동해요.",
    "accessSourceUrl": "https://korean.visitseoul.net/restaurants/%EA%B6%81/KOP011155",
    "visitSourceUrl": "https://www.koong.co.kr/2020/storeinfo/headoffice.php",
    "verifiedAt": "2026-10-07",
    "conditions": {
      "hours": {
        "verifiedAt": "2026-10-07",
        "sourceUrl": "https://www.koong.co.kr/2020/storeinfo/headoffice.php",
        "weekly": {},
        "scope": "partial",
        "holidayPolicy": "unknown",
        "note": "공식 매장과 관광 안내의 마감시간이 다르고, 매장 표의 주문마감과 일부 요일 폐점시간도 맞지 않아 시간 조건은 미확인"
      },
      "price": {
        "kind": "sample",
        "label": "개성 만둣국",
        "scope": "menu-item",
        "taxStatus": "not-stated",
        "sourceUrl": "https://www.koong.co.kr/2020/menuinfo/meals.php",
        "verifiedAt": "2026-10-07",
        "amount": 15000,
        "note": "식사류 메뉴 한 항목의 표시가격. 인분·세금 별도 문구는 없으며 다른 메뉴나 매장 최저비용을 뜻하지 않음"
      }
    }
  },
  {
    "id": "balwoo-gongyang",
    "name": "발우공양",
    "category": "food",
    "address": "서울특별시 종로구 우정국로 56 템플스테이 통합정보센터 5층",
    "description": "한국불교문화사업단이 직접 운영하며 사찰음식 조리법을 소개하는 레스토랑.",
    "checkedAt": "2026-10-07",
    "sourceLabel": "서울관광재단 Visit Seoul",
    "sourceUrl": "https://korean.visitseoul.net/restaurants/BalwooGongyang/KOP4vpx7k",
    "costNote": "메뉴별 가격은 공식 안내에서 확인",
    "visitNote": "예약·운영시간과 원하는 메뉴의 제공 조건을 확인해 주세요.",
    "openingNote": "서울 공식 관광 안내는 11:30~21:00, 쉬는 시간 15:00~18:00, 마지막 주문 19:40으로 소개해요. 정기휴무는 공식 본문에서 확인하지 못했어요. 방문 전 매장 확인이 필요해요.",
    "accessNote": "1호선 종각역 3-1번 출구 또는 3호선 안국역 6번 출구. 템플스테이 통합정보센터 5층이에요.",
    "accessSourceUrl": "https://korean.visitseoul.net/restaurants/BalwooGongyang/KOP4vpx7k",
    "visitSourceUrl": "https://korean.visitseoul.net/restaurants/BalwooGongyang/KOP4vpx7k",
    "verifiedAt": "2026-10-07",
    "conditions": {
      "hours": {
        "verifiedAt": "2026-10-07",
        "sourceUrl": "https://korean.visitseoul.net/restaurants/BalwooGongyang/KOP4vpx7k",
        "weekly": {},
        "scope": "partial",
        "holidayPolicy": "unknown",
        "note": "정기휴무·요일별 적용 미확인. 안내 시간과 실제 예약 가능 여부는 별도 확인"
      },
      "price": {
        "kind": "unknown",
        "label": "메뉴 제공 요일·시간·주문 단위 확인 필요",
        "scope": "menu-item",
        "taxStatus": "not-stated",
        "sourceUrl": "https://korean.visitseoul.net/restaurants/BalwooGongyang/KOP4vpx7k",
        "verifiedAt": "2026-10-07",
        "note": "서울 관광 안내에 선식 36,000원(평일 점심 한정), 원식 50,000원이 있으나 상품 이용 조건과 인분·세금을 확인하지 못해 예산 확정에 사용하지 않음"
      }
    }
  },
  {
    "id": "kyungin-traditional-teahouse",
    "name": "경인미술관 전통다원",
    "category": "tea",
    "address": "서울특별시 종로구 인사동10길 11-4 경인미술관",
    "description": "경인미술관의 한옥·정원 공간에서 전통차와 한식 다과를 소개하는 찻집.",
    "checkedAt": "2026-10-07",
    "sourceLabel": "서울관광재단 Visit Seoul",
    "sourceUrl": "https://korean.visitseoul.net/restaurants/%EA%B2%BD%EC%9D%B8%EB%AF%B8%EC%88%A0%EA%B4%80%EC%A0%84%ED%86%B5%EB%8B%A4%EC%9B%90/KOP010878",
    "costNote": "메뉴별 가격은 공식 안내에서 확인",
    "visitNote": "영업시간·쉬는 시간·휴무일을 확인해 주세요.",
    "openingNote": "매일 11:00~21:20. 신정·설·추석 휴무 안내가 있어요. 미술관 전시 관람시간과는 별개예요.",
    "accessNote": "3호선 안국역 5번 출구. 인사동10길 경인미술관 안에 있어요.",
    "accessSourceUrl": "https://korean.visitseoul.net/restaurants/%EA%B2%BD%EC%9D%B8%EB%AF%B8%EC%88%A0%EA%B4%80%EC%A0%84%ED%86%B5%EB%8B%A4%EC%9B%90/KOP010878",
    "visitSourceUrl": "https://korean.visitseoul.net/restaurants/%EA%B2%BD%EC%9D%B8%EB%AF%B8%EC%88%A0%EA%B4%80%EC%A0%84%ED%86%B5%EB%8B%A4%EC%9B%90/KOP010878",
    "verifiedAt": "2026-10-07",
    "conditions": {
      "hours": {
        "verifiedAt": "2026-10-07",
        "sourceUrl": "https://korean.visitseoul.net/restaurants/%EA%B2%BD%EC%9D%B8%EB%AF%B8%EC%88%A0%EA%B4%80%EC%A0%84%ED%86%B5%EB%8B%A4%EC%9B%90/KOP010878",
        "weekly": {
          "0": [
            {
              "open": "11:00",
              "close": "21:20"
            }
          ],
          "1": [
            {
              "open": "11:00",
              "close": "21:20"
            }
          ],
          "2": [
            {
              "open": "11:00",
              "close": "21:20"
            }
          ],
          "3": [
            {
              "open": "11:00",
              "close": "21:20"
            }
          ],
          "4": [
            {
              "open": "11:00",
              "close": "21:20"
            }
          ],
          "5": [
            {
              "open": "11:00",
              "close": "21:20"
            }
          ],
          "6": [
            {
              "open": "11:00",
              "close": "21:20"
            }
          ]
        },
        "scope": "full",
        "holidayPolicy": "unknown",
        "note": "명절 휴무 범위는 미확인. 공휴일 날짜는 별도 확인"
      },
      "price": {
        "kind": "unknown",
        "label": "개별 메뉴 가격 미확인",
        "scope": "menu-item",
        "taxStatus": "not-stated",
        "sourceUrl": "https://korean.visitseoul.net/restaurants/%EA%B2%BD%EC%9D%B8%EB%AF%B8%EC%88%A0%EA%B4%80%EC%A0%84%ED%86%B5%EB%8B%A4%EC%9B%90/KOP010878",
        "verifiedAt": "2026-10-07"
      }
    }
  },
  {
    "id": "osulloc-bukchon",
    "name": "오설록 티하우스 북촌점",
    "category": "tea",
    "address": "서울특별시 종로구 북촌로 45",
    "description": "차와 북촌점 티푸드, 논알코올 티 칵테일을 소개하는 오설록 티하우스.",
    "checkedAt": "2026-10-07",
    "sourceLabel": "오설록",
    "sourceUrl": "https://www.osulloc.com/kr/ko/store-introduction/312",
    "costNote": "메뉴별 가격은 공식 안내에서 확인",
    "visitNote": "시즌별 메뉴와 티코스 예약 조건을 확인해 주세요.",
    "openingNote": "월~목 11:00~20:00, 금~일 11:00~21:00. 정기휴무는 공식 매장 본문에 따로 안내되어 있지 않아 확인이 필요해요.",
    "accessNote": "북촌로 45. 공식 매장 소개의 지도보기를 확인해 주세요. 역·출구 안내는 해당 본문에서 확인하지 못했어요.",
    "accessSourceUrl": "https://www.osulloc.com/kr/ko/store-introduction/312",
    "visitSourceUrl": "https://www.osulloc.com/kr/ko/store-introduction/312",
    "verifiedAt": "2026-10-07",
    "conditions": {
      "hours": {
        "verifiedAt": "2026-10-07",
        "sourceUrl": "https://www.osulloc.com/kr/ko/store-introduction/312",
        "weekly": {
          "0": [
            {
              "open": "11:00",
              "close": "21:00"
            }
          ],
          "1": [
            {
              "open": "11:00",
              "close": "20:00"
            }
          ],
          "2": [
            {
              "open": "11:00",
              "close": "20:00"
            }
          ],
          "3": [
            {
              "open": "11:00",
              "close": "20:00"
            }
          ],
          "4": [
            {
              "open": "11:00",
              "close": "20:00"
            }
          ],
          "5": [
            {
              "open": "11:00",
              "close": "21:00"
            }
          ],
          "6": [
            {
              "open": "11:00",
              "close": "21:00"
            }
          ]
        },
        "scope": "full",
        "holidayPolicy": "unknown",
        "note": "요일별 공식 안내이며 정기휴무·공휴일 예외는 미확인"
      },
      "price": {
        "kind": "unknown",
        "label": "선택 메뉴·티코스 조건 확인 필요",
        "scope": "menu-item",
        "taxStatus": "not-stated",
        "sourceUrl": "https://www.osulloc.com/kr/ko/store-introduction/312",
        "verifiedAt": "2026-10-07",
        "note": "북촌 시즈널 티코스 39,000원 안내는 있으나 1인 단위·세금·예약 조건을 확정하지 못해 매장 예산으로 사용하지 않음"
      }
    }
  },
  {
    "id": "nine-tree-insadong",
    "name": "나인트리 바이 파르나스 서울 인사동",
    "category": "stay",
    "address": "서울특별시 종로구 인사동길 49",
    "description": "인사동길에 있는 호텔. 객실 유형과 이용 조건을 공식 예약 화면에서 비교할 수 있어요.",
    "checkedAt": "2026-10-07",
    "sourceLabel": "나인트리 바이 파르나스",
    "sourceUrl": "https://www.ninetreehotels.com/ko/insadong",
    "costNote": "날짜·객실·인원별 요금 확인 · 세금·취소 조건 별도 확인",
    "visitNote": "객실 구성·투숙 인원·예약 가능 여부를 확인해 주세요.",
    "openingNote": "공식 객실 안내 기준 체크인 15:00, 체크아웃 12:00. 예약 상품의 별도 이용 조건을 확인해 주세요.",
    "accessNote": "3호선 안국역 6번 출구. 공식 호텔찾기에서 서울 인사동 지점을 확인해 주세요.",
    "accessSourceUrl": "https://www.ninetreehotels.com/ko/hub/hotel-find",
    "visitSourceUrl": "https://www.ninetreehotels.com/ko/insadong/room/standard-double",
    "verifiedAt": "2026-10-07",
    "conditions": {
      "hours": {
        "verifiedAt": "2026-10-07",
        "sourceUrl": "https://www.ninetreehotels.com/ko/insadong/room/standard-double",
        "weekly": {},
        "scope": "partial",
        "holidayPolicy": "unknown",
        "note": "체크인·체크아웃은 방문 영업시간이나 당일 입실 가능 여부를 뜻하지 않음"
      },
      "price": {
        "kind": "unknown",
        "label": "날짜·객실·인원별 예약 요금 확인",
        "scope": "room",
        "taxStatus": "not-stated",
        "sourceUrl": "https://www.ninetreehotels.com/ko/insadong",
        "verifiedAt": "2026-10-07",
        "note": "객실 요금을 일반 성인 1인 입장·메뉴 예산으로 비교하지 않음"
      }
    }
  },
  {
    "id": "orakai-insadong-suites",
    "name": "오라카이 인사동 스위츠",
    "category": "stay",
    "address": "서울특별시 종로구 인사동4길 18",
    "description": "주방 시설과 여러 객실 유형을 안내하는 레지던스 호텔. 필요한 객실 구성과 투숙 인원을 먼저 확인해 보세요.",
    "checkedAt": "2026-10-07",
    "sourceLabel": "오라카이 인사동 스위츠",
    "sourceUrl": "https://insa.orakaihotels.com/kr/default.asp",
    "costNote": "날짜·객실·인원별 요금 확인 · 세금·취소 조건 별도 확인",
    "visitNote": "객실 구성·투숙 인원·예약 가능 여부를 확인해 주세요.",
    "openingNote": "체크인 16:00부터, 체크아웃 11:00까지. 이른 입실·늦은 퇴실은 객실 상황과 추가 요금 조건을 따로 확인해 주세요.",
    "accessNote": "1·3·5호선 종로3가역 5번 출구. 공식 교통 안내는 짐이 많을 때 4번 출구 에스컬레이터도 안내해요.",
    "accessSourceUrl": "https://insa.orakaihotels.com/kr/about/location.asp",
    "visitSourceUrl": "https://insa.orakaihotels.com/kr/about/guest_info.asp?mCode=1",
    "verifiedAt": "2026-10-07",
    "conditions": {
      "hours": {
        "verifiedAt": "2026-10-07",
        "sourceUrl": "https://insa.orakaihotels.com/kr/about/guest_info.asp?mCode=1",
        "weekly": {},
        "scope": "partial",
        "holidayPolicy": "unknown",
        "note": "체크인·체크아웃은 방문 영업시간이나 당일 입실 가능 여부를 뜻하지 않음"
      },
      "price": {
        "kind": "unknown",
        "label": "날짜·객실·인원별 예약 요금 확인",
        "scope": "room",
        "taxStatus": "not-stated",
        "sourceUrl": "https://insa.orakaihotels.com/kr/default.asp",
        "verifiedAt": "2026-10-07",
        "note": "객실 요금을 일반 성인 1인 입장·메뉴 예산으로 비교하지 않음"
      }
    }
  },
  {
    "id": "seoul-museum-craft-art",
    "name": "서울공예박물관",
    "category": "culture",
    "address": "서울특별시 종로구 율곡로3길 4",
    "description": "전통과 현대 공예 전시를 둘러볼 수 있는 박물관. 관람할 전시동과 휴관 공지를 먼저 확인해 보세요.",
    "checkedAt": "2026-10-07",
    "sourceLabel": "서울공예박물관",
    "sourceUrl": "https://craftmuseum.seoul.go.kr/preview/visit",
    "costNote": "일반 관람 무료 · 대관전시 유료 가능",
    "visitNote": "전시동별 운영시간·부분 휴관 공지를 확인해 주세요. 어린이박물관은 예약 안내를 확인해 주세요. 2026.10.13~10.25에는 전시1동 1층 로비 휴관·통행 제한 공지가 있어요.",
    "openingNote": "전시실 기본 10:00~18:00, 입장마감은 종료 30분 전. 월요일·1월 1일 휴관(공휴일인 월요일은 일반 전시 운영, 어린이박물관은 모든 월요일 휴관). 2026.9.15~11.30 화·수·금·토·일에는 전시실 가운데 전시1동 1~2층만 21:00까지 연장해요. 2026.10.13~10.25에는 전시1동 1층 로비 휴관·통행 제한이 있어요.",
    "accessNote": "3호선 안국역 1번 출구. 일반 관람객용 주차장은 운영하지 않아요.",
    "accessSourceUrl": "https://craftmuseum.seoul.go.kr/preview/visit",
    "visitSourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000444",
    "verifiedAt": "2026-10-07",
    "conditions": {
      "hours": {
        "verifiedAt": "2026-10-07",
        "sourceUrl": "https://craftmuseum.seoul.go.kr/preview/visit",
        "weekly": {
          "0": [
            {
              "open": "10:00",
              "close": "18:00",
              "lastEntry": "17:30"
            }
          ],
          "1": [],
          "2": [
            {
              "open": "10:00",
              "close": "18:00",
              "lastEntry": "17:30"
            }
          ],
          "3": [
            {
              "open": "10:00",
              "close": "18:00",
              "lastEntry": "17:30"
            }
          ],
          "4": [
            {
              "open": "10:00",
              "close": "18:00",
              "lastEntry": "17:30"
            }
          ],
          "5": [
            {
              "open": "10:00",
              "close": "18:00",
              "lastEntry": "17:30"
            }
          ],
          "6": [
            {
              "open": "10:00",
              "close": "18:00",
              "lastEntry": "17:30"
            }
          ]
        },
        "scope": "full",
        "holidayPolicy": "same",
        "validFrom": "2026-10-07",
        "validThrough": "2026-11-06",
        "exceptions": {
          "2026-10-05": {
            "slots": [
              {
                "open": "10:00",
                "close": "18:00",
                "lastEntry": "17:30"
              }
            ],
            "scope": "full",
            "note": "공휴일인 월요일 일반 전시 운영; 어린이박물관 제외"
          },
          "2026-10-13": {
            "slots": [
              {
                "open": "10:00",
                "close": "18:00",
                "lastEntry": "17:30"
              }
            ],
            "scope": "partial",
            "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
            "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
          },
          "2026-10-14": {
            "slots": [
              {
                "open": "10:00",
                "close": "18:00",
                "lastEntry": "17:30"
              }
            ],
            "scope": "partial",
            "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
            "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
          },
          "2026-10-15": {
            "slots": [
              {
                "open": "10:00",
                "close": "18:00",
                "lastEntry": "17:30"
              }
            ],
            "scope": "partial",
            "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
            "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
          },
          "2026-10-16": {
            "slots": [
              {
                "open": "10:00",
                "close": "18:00",
                "lastEntry": "17:30"
              }
            ],
            "scope": "partial",
            "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
            "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
          },
          "2026-10-17": {
            "slots": [
              {
                "open": "10:00",
                "close": "18:00",
                "lastEntry": "17:30"
              }
            ],
            "scope": "partial",
            "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
            "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
          },
          "2026-10-18": {
            "slots": [
              {
                "open": "10:00",
                "close": "18:00",
                "lastEntry": "17:30"
              }
            ],
            "scope": "partial",
            "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
            "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
          },
          "2026-10-20": {
            "slots": [
              {
                "open": "10:00",
                "close": "18:00",
                "lastEntry": "17:30"
              }
            ],
            "scope": "partial",
            "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
            "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
          },
          "2026-10-21": {
            "slots": [
              {
                "open": "10:00",
                "close": "18:00",
                "lastEntry": "17:30"
              }
            ],
            "scope": "partial",
            "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
            "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
          },
          "2026-10-22": {
            "slots": [
              {
                "open": "10:00",
                "close": "18:00",
                "lastEntry": "17:30"
              }
            ],
            "scope": "partial",
            "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
            "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
          },
          "2026-10-23": {
            "slots": [
              {
                "open": "10:00",
                "close": "18:00",
                "lastEntry": "17:30"
              }
            ],
            "scope": "partial",
            "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
            "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
          },
          "2026-10-24": {
            "slots": [
              {
                "open": "10:00",
                "close": "18:00",
                "lastEntry": "17:30"
              }
            ],
            "scope": "partial",
            "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
            "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
          },
          "2026-10-25": {
            "slots": [
              {
                "open": "10:00",
                "close": "18:00",
                "lastEntry": "17:30"
              }
            ],
            "scope": "partial",
            "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
            "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
          }
        },
        "partialExtensions": [
          {
            "from": "2026-09-15",
            "through": "2026-11-30",
            "weekdays": [
              0,
              2,
              3,
              5,
              6
            ],
            "slots": [
              {
                "open": "17:30",
                "close": "21:00",
                "lastEntry": "20:30"
              }
            ],
            "note": "17:30 이후 일반 전시 입장은 마감되지만 전시1동 1~2층은 연장 운영해요. 대상 공간과 입장 조건을 확인해 주세요.",
            "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000444"
          }
        ]
      },
      "price": {
        "kind": "free",
        "label": "일반 전시 관람",
        "scope": "adult-one",
        "taxStatus": "not-stated",
        "sourceUrl": "https://craftmuseum.seoul.go.kr/preview/visit",
        "verifiedAt": "2026-10-07",
        "amount": 0,
        "note": "대관전시 및 예약 프로그램은 별도"
      }
    },
    "visitNoticeSourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
  },
  {
    "id": "unhyeongung",
    "name": "운현궁",
    "category": "culture",
    "address": "서울특별시 종로구 삼일대로 464",
    "description": "흥선대원군의 사가였던 역사 공간. 일반 관람과 행사·야간 운영 공지를 구분해 살펴보세요.",
    "checkedAt": "2026-10-07",
    "sourceLabel": "서울 공식 관광정보 Visit Seoul",
    "sourceUrl": "https://korean.visitseoul.net/attractions/%EC%9A%B4%ED%98%84%EA%B6%81_/471",
    "costNote": "일반 관람 무료",
    "visitNote": "휴관일과 계절별·특별 운영시간을 확인해 주세요. 유료 행사는 별도입니다.",
    "openingNote": "확인일 기준 일반 09:00~19:00(입장마감 18:30). 월요일 휴관, 공휴일인 월요일은 개장 안내예요. 2026.9.1~11.29 화·수·금·토·일에는 21:00까지(입장마감 20:30) 야간 개방해요. 동절기 시간은 별도 확인해 주세요.",
    "accessNote": "3호선 안국역 4번 출구. 삼일대로 464의 운현궁 입구를 지도에서 확인해 주세요.",
    "accessSourceUrl": "https://korean.visitseoul.net/attractions/%EC%9A%B4%ED%98%84%EA%B6%81_/471",
    "visitSourceUrl": "https://korean.visitseoul.net/attractions/%EC%9A%B4%ED%98%84%EA%B6%81_/471",
    "verifiedAt": "2026-10-07",
    "conditions": {
      "hours": {
        "verifiedAt": "2026-10-07",
        "sourceUrl": "https://korean.visitseoul.net/attractions/%EC%9A%B4%ED%98%84%EA%B6%81_/471",
        "weekly": {
          "0": [
            {
              "open": "09:00",
              "close": "21:00",
              "lastEntry": "20:30"
            }
          ],
          "1": [],
          "2": [
            {
              "open": "09:00",
              "close": "21:00",
              "lastEntry": "20:30"
            }
          ],
          "3": [
            {
              "open": "09:00",
              "close": "21:00",
              "lastEntry": "20:30"
            }
          ],
          "4": [
            {
              "open": "09:00",
              "close": "19:00",
              "lastEntry": "18:30"
            }
          ],
          "5": [
            {
              "open": "09:00",
              "close": "21:00",
              "lastEntry": "20:30"
            }
          ],
          "6": [
            {
              "open": "09:00",
              "close": "21:00",
              "lastEntry": "20:30"
            }
          ]
        },
        "scope": "full",
        "holidayPolicy": "unknown",
        "validFrom": "2026-10-07",
        "validThrough": "2026-10-31",
        "exceptions": {
          "2026-10-05": {
            "slots": [
              {
                "open": "09:00",
                "close": "19:00",
                "lastEntry": "18:30"
              }
            ],
            "scope": "full",
            "note": "공휴일인 월요일 정상 개장 일반 안내"
          }
        },
        "note": "야간기간은11/29까지이나 11월 일반 동절기 운영범위는 추가 확인 필요"
      },
      "price": {
        "kind": "free",
        "label": "일반 관람",
        "scope": "adult-one",
        "taxStatus": "not-stated",
        "sourceUrl": "https://korean.visitseoul.net/attractions/%EC%9A%B4%ED%98%84%EA%B6%81_/471",
        "verifiedAt": "2026-10-07",
        "amount": 0,
        "note": "유료 행사·체험 제외"
      }
    }
  },
  {
    "id": "gyeongbokgung",
    "name": "경복궁",
    "category": "culture",
    "address": "서울특별시 종로구 사직로 161",
    "description": "조선의 법궁에서 전각과 궁궐 마당을 둘러보는 일반 관람. 별도 예약 행사는 구분해 확인해요.",
    "checkedAt": "2026-10-07",
    "sourceLabel": "국가유산청 궁능유적본부",
    "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R702000000.do?schGroupCode=gbg",
    "costNote": "일반 개인 대인 3,000원 · 내국인 만25~64세·외국인 만19~64세 기준 · 무료일·감면 별도",
    "visitNote": "2026.9.2~10.31 근정전 월대 출입 제한. 특별·야간 행사, 한복·연령별 무료 조건은 별도 확인해 주세요.",
    "openingNote": "화요일 휴궁. 10월 09:00~18:00(입장마감 17:00), 11월 09:00~17:00(입장마감 16:00). 공휴일과 정기휴궁일이 겹치면 다음 첫 비공휴일에 쉬어요.",
    "accessNote": "3호선 경복궁역 5번 출구 또는 5호선 광화문역 2번 출구에서 궁 입구로 이동해요.",
    "accessSourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R707000000.do?schGroupCode=gbg",
    "visitSourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930144202825885&schM=view",
    "verifiedAt": "2026-10-07",
    "conditions": {
      "hours": {
        "verifiedAt": "2026-10-07",
        "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R702000000.do?schGroupCode=gbg",
        "weekly": {
          "0": [
            {
              "open": "09:00",
              "close": "18:00",
              "lastEntry": "17:00"
            }
          ],
          "1": [
            {
              "open": "09:00",
              "close": "18:00",
              "lastEntry": "17:00"
            }
          ],
          "2": [],
          "3": [
            {
              "open": "09:00",
              "close": "18:00",
              "lastEntry": "17:00"
            }
          ],
          "4": [
            {
              "open": "09:00",
              "close": "18:00",
              "lastEntry": "17:00"
            }
          ],
          "5": [
            {
              "open": "09:00",
              "close": "18:00",
              "lastEntry": "17:00"
            }
          ],
          "6": [
            {
              "open": "09:00",
              "close": "18:00",
              "lastEntry": "17:00"
            }
          ]
        },
        "scope": "partial",
        "holidayPolicy": "same",
        "validFrom": "2026-10-07",
        "validThrough": "2026-11-06",
        "exceptions": {
          "2026-10-06": {
            "closed": true,
            "note": "전체 궁능 대체 휴관일"
          },
          "2026-11-01": {
            "slots": [
              {
                "open": "09:00",
                "close": "17:00",
                "lastEntry": "16:00"
              }
            ],
            "scope": "full",
            "note": "11월 일반 관람 시간"
          },
          "2026-11-02": {
            "slots": [
              {
                "open": "09:00",
                "close": "17:00",
                "lastEntry": "16:00"
              }
            ],
            "scope": "full",
            "note": "11월 일반 관람 시간"
          },
          "2026-11-03": {
            "closed": true
          },
          "2026-11-04": {
            "slots": [
              {
                "open": "09:00",
                "close": "17:00",
                "lastEntry": "16:00"
              }
            ],
            "scope": "full",
            "note": "11월 일반 관람 시간"
          },
          "2026-11-05": {
            "slots": [
              {
                "open": "09:00",
                "close": "17:00",
                "lastEntry": "16:00"
              }
            ],
            "scope": "full",
            "note": "11월 일반 관람 시간"
          },
          "2026-11-06": {
            "slots": [
              {
                "open": "09:00",
                "close": "17:00",
                "lastEntry": "16:00"
              }
            ],
            "scope": "full",
            "note": "11월 일반 관람 시간"
          }
        },
        "note": "10월은 근정전 월대 출입제한으로 부분 관람 안내; 일반 주간 관람만 대상"
      },
      "price": {
        "kind": "exact",
        "label": "일반 개인 대인 입장",
        "scope": "adult-one",
        "taxStatus": "not-stated",
        "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R703000000.do",
        "verifiedAt": "2026-10-07",
        "amount": 3000,
        "exceptions": {
          "2026-10-29": {
            "kind": "free",
            "amount": 0,
            "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
            "scope": "adult-one",
            "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
          },
          "2026-10-30": {
            "kind": "free",
            "amount": 0,
            "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
            "scope": "adult-one",
            "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
          },
          "2026-10-31": {
            "kind": "free",
            "amount": 0,
            "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
            "scope": "adult-one",
            "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
          },
          "2026-11-01": {
            "kind": "free",
            "amount": 0,
            "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
            "scope": "adult-one",
            "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
          },
          "2026-11-02": {
            "kind": "free",
            "amount": 0,
            "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
            "scope": "adult-one",
            "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
          },
          "2026-11-03": {
            "kind": "free",
            "amount": 0,
            "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
            "scope": "adult-one",
            "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
          },
          "2026-11-04": {
            "kind": "free",
            "amount": 0,
            "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
            "scope": "adult-one",
            "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
          },
          "2026-11-05": {
            "kind": "free",
            "amount": 0,
            "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
            "scope": "adult-one",
            "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
          },
          "2026-11-06": {
            "kind": "free",
            "amount": 0,
            "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
            "scope": "adult-one",
            "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
          },
          "2026-10-28": {
            "kind": "free",
            "amount": 0,
            "label": "매월 마지막 수요일 일반 관람",
            "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260528151556017843&schM=view"
          }
        },
        "note": "내국인 만25~64세·외국인 만19~64세 일반 기준. 증빙 감면·한복·별도 특별관람 제외"
      }
    }
  },
  {
    "id": "changgyeonggung",
    "name": "창경궁",
    "category": "culture",
    "address": "서울특별시 종로구 창경궁로 185",
    "description": "궁궐 전각과 정원을 둘러보는 종로의 역사 공간. 주간과 야간의 공개 구역이 달라요.",
    "checkedAt": "2026-10-07",
    "sourceLabel": "국가유산청 궁능유적본부",
    "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R702000000.do?schGroupCode=cgg",
    "costNote": "일반 개인 대인 1,000원 · 내국인 만25~64세·외국인 만19~64세 기준 · 2026.10.7부터 수요일 무료",
    "visitNote": "10월은 18시, 11월은 17:30부터 야간개방구역으로 이동해요. 물빛연화 등 별도 예약 행사와 일반 입장은 구분해 주세요.",
    "openingNote": "월요일 휴궁. 일반 09:00~21:00(입장마감 20:00). 공휴일과 정기휴궁일이 겹치면 다음 첫 비공휴일에 쉬어요. 야간에는 공개 구역이 제한돼요.",
    "accessNote": "4호선 혜화역 4번 출구에서 성균관대 방면을 거쳐 창경궁·종로 방향으로 이동해요. 공식 안내상 2026년 말까지 주차장 잠정 폐쇄예요.",
    "accessSourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R707000000.do?schGroupCode=cgg",
    "visitSourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R702000000.do?schGroupCode=cgg",
    "verifiedAt": "2026-10-07",
    "conditions": {
      "hours": {
        "verifiedAt": "2026-10-07",
        "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R702000000.do?schGroupCode=cgg",
        "weekly": {
          "0": [
            {
              "open": "09:00",
              "close": "18:00"
            }
          ],
          "1": [],
          "2": [
            {
              "open": "09:00",
              "close": "18:00"
            }
          ],
          "3": [
            {
              "open": "09:00",
              "close": "18:00"
            }
          ],
          "4": [
            {
              "open": "09:00",
              "close": "18:00"
            }
          ],
          "5": [
            {
              "open": "09:00",
              "close": "18:00"
            }
          ],
          "6": [
            {
              "open": "09:00",
              "close": "18:00"
            }
          ]
        },
        "scope": "full",
        "holidayPolicy": "same",
        "validFrom": "2026-10-07",
        "validThrough": "2026-11-06",
        "exceptions": {
          "2026-10-05": {
            "slots": [
              {
                "open": "09:00",
                "close": "18:00"
              }
            ],
            "scope": "full",
            "note": "대체공휴일 정상 개방"
          },
          "2026-10-06": {
            "closed": true,
            "note": "대체공휴일 다음 날 전체 궁능 휴관"
          },
          "2026-11-01": {
            "slots": [
              {
                "open": "09:00",
                "close": "17:30"
              }
            ],
            "scope": "full",
            "note": "11월은17:30부터 야간개방구역만 관람"
          },
          "2026-11-02": {
            "closed": true
          },
          "2026-11-03": {
            "slots": [
              {
                "open": "09:00",
                "close": "17:30"
              }
            ],
            "scope": "full",
            "note": "11월은17:30부터 야간개방구역만 관람"
          },
          "2026-11-04": {
            "slots": [
              {
                "open": "09:00",
                "close": "17:30"
              }
            ],
            "scope": "full",
            "note": "11월은17:30부터 야간개방구역만 관람"
          },
          "2026-11-05": {
            "slots": [
              {
                "open": "09:00",
                "close": "17:30"
              }
            ],
            "scope": "full",
            "note": "11월은17:30부터 야간개방구역만 관람"
          },
          "2026-11-06": {
            "slots": [
              {
                "open": "09:00",
                "close": "17:30"
              }
            ],
            "scope": "full",
            "note": "11월은17:30부터 야간개방구역만 관람"
          }
        },
        "partialExtensions": [
          {
            "from": "2026-10-07",
            "through": "2026-10-31",
            "weekdays": [
              0,
              2,
              3,
              4,
              5,
              6
            ],
            "slots": [
              {
                "open": "18:00",
                "close": "21:00",
                "lastEntry": "20:00"
              }
            ],
            "note": "야간개방구역만 관람 가능; 별도 예약 행사 제외"
          },
          {
            "from": "2026-11-01",
            "through": "2026-11-06",
            "weekdays": [
              0,
              2,
              3,
              4,
              5,
              6
            ],
            "slots": [
              {
                "open": "17:30",
                "close": "21:00",
                "lastEntry": "20:00"
              }
            ],
            "note": "야간개방구역만 관람 가능"
          }
        ]
      },
      "price": {
        "kind": "exact",
        "label": "일반 개인 대인 입장",
        "scope": "adult-one",
        "taxStatus": "not-stated",
        "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R703000000.do",
        "verifiedAt": "2026-10-07",
        "amount": 1000,
        "exceptions": {
          "2026-10-29": {
            "kind": "free",
            "amount": 0,
            "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
            "scope": "adult-one",
            "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
          },
          "2026-10-30": {
            "kind": "free",
            "amount": 0,
            "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
            "scope": "adult-one",
            "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
          },
          "2026-10-31": {
            "kind": "free",
            "amount": 0,
            "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
            "scope": "adult-one",
            "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
          },
          "2026-11-01": {
            "kind": "free",
            "amount": 0,
            "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
            "scope": "adult-one",
            "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
          },
          "2026-11-02": {
            "kind": "free",
            "amount": 0,
            "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
            "scope": "adult-one",
            "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
          },
          "2026-11-03": {
            "kind": "free",
            "amount": 0,
            "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
            "scope": "adult-one",
            "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
          },
          "2026-11-04": {
            "kind": "free",
            "amount": 0,
            "label": "매주 수요일 일반 관람",
            "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20261007095901706396&schM=view"
          },
          "2026-11-05": {
            "kind": "free",
            "amount": 0,
            "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
            "scope": "adult-one",
            "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
          },
          "2026-11-06": {
            "kind": "free",
            "amount": 0,
            "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
            "scope": "adult-one",
            "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
          },
          "2026-10-07": {
            "kind": "free",
            "amount": 0,
            "label": "매주 수요일 일반 관람",
            "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20261007095901706396&schM=view"
          },
          "2026-10-14": {
            "kind": "free",
            "amount": 0,
            "label": "매주 수요일 일반 관람",
            "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20261007095901706396&schM=view"
          },
          "2026-10-21": {
            "kind": "free",
            "amount": 0,
            "label": "매주 수요일 일반 관람",
            "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20261007095901706396&schM=view"
          },
          "2026-10-28": {
            "kind": "free",
            "amount": 0,
            "label": "매주 수요일 일반 관람",
            "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20261007095901706396&schM=view"
          }
        },
        "note": "내국인 만25~64세·외국인 만19~64세 기준. 별도 예약 행사·증빙 감면 제외"
      }
    }
  },
  {
    "id": "national-folk-museum",
    "name": "국립민속박물관 본관",
    "category": "culture",
    "address": "서울특별시 종로구 삼청로 37",
    "description": "한국인의 생활문화와 민속을 살펴보는 무료 박물관. 경복궁 입장과는 별개예요.",
    "checkedAt": "2026-10-07",
    "sourceLabel": "국립민속박물관",
    "sourceUrl": "https://nfm.go.kr/home/subIndex/1239.do",
    "costNote": "본관 일반 관람 무료 · 경복궁 관람은 별도 유료",
    "visitNote": "상설전시관1은 2026.9.30~12.21(예정) 휴관. 주말·공휴일은 옥외전시장 내부 관람 제한. 10.13 14:00~14:10 소방훈련 안내가 있어요.",
    "openingNote": "3~10월 09:00~18:00, 수요일 20:00까지. 11~2월 09:00~17:00(야간연장 없음). 입장마감은 종료 1시간 전. 1월 1일·설·추석 당일 휴관.",
    "accessNote": "삼청로 37 본관 입구를 확인해 주세요. 무료 박물관 관람과 경복궁 유료 관람 동선을 구분해요.",
    "accessSourceUrl": "https://nfm.go.kr/home/subIndex/1239.do",
    "visitSourceUrl": "https://nfm.go.kr/home/subIndex/1239.do",
    "verifiedAt": "2026-10-07",
    "conditions": {
      "hours": {
        "verifiedAt": "2026-10-07",
        "sourceUrl": "https://nfm.go.kr/home/subIndex/1239.do",
        "weekly": {
          "0": [
            {
              "open": "09:00",
              "close": "18:00",
              "lastEntry": "17:00"
            }
          ],
          "1": [
            {
              "open": "09:00",
              "close": "18:00",
              "lastEntry": "17:00"
            }
          ],
          "2": [
            {
              "open": "09:00",
              "close": "18:00",
              "lastEntry": "17:00"
            }
          ],
          "3": [
            {
              "open": "09:00",
              "close": "20:00",
              "lastEntry": "19:00"
            }
          ],
          "4": [
            {
              "open": "09:00",
              "close": "18:00",
              "lastEntry": "17:00"
            }
          ],
          "5": [
            {
              "open": "09:00",
              "close": "18:00",
              "lastEntry": "17:00"
            }
          ],
          "6": [
            {
              "open": "09:00",
              "close": "18:00",
              "lastEntry": "17:00"
            }
          ]
        },
        "scope": "partial",
        "holidayPolicy": "same",
        "validFrom": "2026-10-07",
        "validThrough": "2026-11-06",
        "exceptions": {
          "2026-11-01": {
            "slots": [
              {
                "open": "09:00",
                "close": "17:00",
                "lastEntry": "16:00"
              }
            ],
            "scope": "partial",
            "note": "11월 동절기 시간, 상설전시관1 휴관 중"
          },
          "2026-11-02": {
            "slots": [
              {
                "open": "09:00",
                "close": "17:00",
                "lastEntry": "16:00"
              }
            ],
            "scope": "partial",
            "note": "11월 동절기 시간, 상설전시관1 휴관 중"
          },
          "2026-11-03": {
            "slots": [
              {
                "open": "09:00",
                "close": "17:00",
                "lastEntry": "16:00"
              }
            ],
            "scope": "partial",
            "note": "11월 동절기 시간, 상설전시관1 휴관 중"
          },
          "2026-11-04": {
            "slots": [
              {
                "open": "09:00",
                "close": "17:00",
                "lastEntry": "16:00"
              }
            ],
            "scope": "partial",
            "note": "11월 동절기 시간, 상설전시관1 휴관 중"
          },
          "2026-11-05": {
            "slots": [
              {
                "open": "09:00",
                "close": "17:00",
                "lastEntry": "16:00"
              }
            ],
            "scope": "partial",
            "note": "11월 동절기 시간, 상설전시관1 휴관 중"
          },
          "2026-11-06": {
            "slots": [
              {
                "open": "09:00",
                "close": "17:00",
                "lastEntry": "16:00"
              }
            ],
            "scope": "partial",
            "note": "11월 동절기 시간, 상설전시관1 휴관 중"
          }
        },
        "note": "상설전시관1 휴관 기간으로 전체 관람 가능 여부는 미확인. 주말·공휴일 옥외전시장 내부도 제한"
      },
      "price": {
        "kind": "free",
        "label": "본관 일반 관람",
        "scope": "adult-one",
        "taxStatus": "not-stated",
        "sourceUrl": "https://nfm.go.kr/home/subIndex/1239.do",
        "verifiedAt": "2026-10-07",
        "amount": 0,
        "note": "경복궁 입장료 및 별도 상품·프로그램 제외"
      }
    }
  }
].map(place => Object.freeze(place)));
