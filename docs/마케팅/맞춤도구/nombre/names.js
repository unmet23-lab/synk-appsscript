/* 이름 사전 — 국립국어원 외래어 표기 용례(2026-10-12 조사)에서 옮겼다. 원자료: 탐색노트.md
 * en: 영어 이름은 철자로 규칙을 돌릴 수 없어 이 목록만 쓴다. ko = 용례 표기(status verified) 또는 규칙 추정(estimated),
 *     common = 흔히 보이는 다른 표기(관찰), wrong = 국립국어원이 용례에 틀린 표기로 적어 둔 것.
 * exceptions: 규칙 결과와 용례가 다른 이름(용례를 앞에 둔다).
 */
(function (root) {
  'use strict';
  var NAMES = {
 "en": {
  "james": {
   "ko": "제임스",
   "status": "verified",
   "wrong": [
    "제임즈"
   ]
  },
  "john": {
   "ko": "존",
   "status": "verified",
   "wrong": [
    "죤"
   ]
  },
  "robert": {
   "ko": "로버트",
   "status": "verified"
  },
  "michael": {
   "ko": "마이클",
   "status": "verified"
  },
  "william": {
   "ko": "윌리엄",
   "status": "verified"
  },
  "david": {
   "ko": "데이비드",
   "status": "verified",
   "wrong": [
    "데이빗"
   ]
  },
  "richard": {
   "ko": "리처드",
   "status": "verified",
   "wrong": [
    "리차드"
   ]
  },
  "joseph": {
   "ko": "조지프",
   "status": "verified",
   "common": [
    "조셉"
   ]
  },
  "thomas": {
   "ko": "토머스",
   "status": "verified",
   "wrong": [
    "토마스"
   ]
  },
  "charles": {
   "ko": "찰스",
   "status": "verified"
  },
  "christopher": {
   "ko": "크리스토퍼",
   "status": "verified"
  },
  "daniel": {
   "ko": "대니얼",
   "status": "verified",
   "common": [
    "다니엘"
   ]
  },
  "matthew": {
   "ko": "매슈",
   "status": "verified",
   "common": [
    "매튜"
   ]
  },
  "anthony": {
   "ko": "앤서니",
   "status": "verified",
   "wrong": [
    "앤소니",
    "안소니",
    "안토니"
   ]
  },
  "mark": {
   "ko": "마크",
   "status": "verified"
  },
  "steven": {
   "ko": "스티븐",
   "status": "verified"
  },
  "stephen": {
   "ko": "스티븐",
   "status": "verified"
  },
  "paul": {
   "ko": "폴",
   "status": "verified"
  },
  "andrew": {
   "ko": "앤드루",
   "status": "verified",
   "common": [
    "앤드류"
   ],
   "wrong": [
    "앤드류스"
   ]
  },
  "joshua": {
   "ko": "조슈아",
   "status": "verified"
  },
  "kevin": {
   "ko": "케빈",
   "status": "verified"
  },
  "brian": {
   "ko": "브라이언",
   "status": "verified"
  },
  "george": {
   "ko": "조지",
   "status": "verified",
   "common": [
    "죠지"
   ],
   "wrong": [
    "세인트죠지스"
   ]
  },
  "edward": {
   "ko": "에드워드",
   "status": "verified"
  },
  "ryan": {
   "ko": "라이언",
   "status": "verified"
  },
  "jacob": {
   "ko": "제이컵",
   "status": "verified",
   "common": [
    "제이콥"
   ]
  },
  "nicholas": {
   "ko": "니컬러스",
   "status": "verified",
   "common": [
    "니콜라스"
   ]
  },
  "jonathan": {
   "ko": "조너선",
   "status": "verified",
   "common": [
    "조나단"
   ]
  },
  "justin": {
   "ko": "저스틴",
   "status": "verified"
  },
  "brandon": {
   "ko": "브랜던",
   "status": "verified",
   "common": [
    "브랜든"
   ]
  },
  "benjamin": {
   "ko": "벤저민",
   "status": "verified",
   "wrong": [
    "벤자민"
   ]
  },
  "samuel": {
   "ko": "새뮤얼",
   "status": "verified",
   "common": [
    "사무엘",
    "새뮤엘"
   ]
  },
  "alexander": {
   "ko": "알렉산더",
   "status": "verified"
  },
  "henry": {
   "ko": "헨리",
   "status": "verified"
  },
  "jack": {
   "ko": "잭",
   "status": "verified"
  },
  "oliver": {
   "ko": "올리버",
   "status": "verified"
  },
  "noah": {
   "ko": "노아",
   "status": "verified"
  },
  "liam": {
   "ko": "리엄",
   "status": "verified",
   "common": [
    "리암"
   ]
  },
  "ethan": {
   "ko": "이선",
   "status": "verified",
   "common": [
    "에단",
    "이든"
   ]
  },
  "lucas": {
   "ko": "루커스",
   "status": "verified",
   "common": [
    "루카스"
   ]
  },
  "mason": {
   "ko": "메이슨",
   "status": "verified"
  },
  "logan": {
   "ko": "로건",
   "status": "verified"
  },
  "elijah": {
   "ko": "일라이자",
   "status": "verified",
   "common": [
    "엘리야",
    "엘라이자"
   ]
  },
  "aiden": {
   "ko": "에이든",
   "status": "verified"
  },
  "jackson": {
   "ko": "잭슨",
   "status": "verified"
  },
  "harry": {
   "ko": "해리",
   "status": "verified"
  },
  "oscar": {
   "ko": "오스카",
   "status": "verified"
  },
  "charlie": {
   "ko": "찰리",
   "status": "verified"
  },
  "leo": {
   "ko": "리오",
   "status": "verified",
   "common": [
    "레오"
   ]
  },
  "theodore": {
   "ko": "시어도어",
   "status": "verified",
   "common": [
    "테오도르"
   ]
  },
  "arthur": {
   "ko": "아서",
   "status": "verified",
   "common": [
    "아더"
   ],
   "wrong": [
    "아더왕"
   ]
  },
  "peter": {
   "ko": "피터",
   "status": "verified"
  },
  "patrick": {
   "ko": "패트릭",
   "status": "verified"
  },
  "scott": {
   "ko": "스콧",
   "status": "verified",
   "common": [
    "스캇"
   ]
  },
  "eric": {
   "ko": "에릭",
   "status": "verified"
  },
  "adam": {
   "ko": "애덤",
   "status": "verified",
   "common": [
    "아담"
   ]
  },
  "tyler": {
   "ko": "타일러",
   "status": "verified"
  },
  "kyle": {
   "ko": "카일",
   "status": "verified"
  },
  "jason": {
   "ko": "제이슨",
   "status": "verified"
  },
  "aaron": {
   "ko": "에런",
   "status": "verified",
   "common": [
    "아론",
    "애런"
   ]
  },
  "nathan": {
   "ko": "네이선",
   "status": "verified",
   "common": [
    "네이슨",
    "나단"
   ]
  },
  "luke": {
   "ko": "루크",
   "status": "verified"
  },
  "owen": {
   "ko": "오언",
   "status": "verified",
   "common": [
    "오웬"
   ]
  },
  "isaac": {
   "ko": "아이작",
   "status": "verified"
  },
  "dylan": {
   "ko": "딜런",
   "status": "verified"
  },
  "caleb": {
   "ko": "케일럽",
   "status": "verified"
  },
  "hunter": {
   "ko": "헌터",
   "status": "verified"
  },
  "evan": {
   "ko": "에번",
   "status": "verified",
   "common": [
    "에반"
   ]
  },
  "gabriel": {
   "ko": "게이브리얼",
   "status": "verified",
   "common": [
    "가브리엘"
   ]
  },
  "sebastian": {
   "ko": "서배스천",
   "status": "verified",
   "common": [
    "세바스찬"
   ]
  },
  "max": {
   "ko": "맥스",
   "status": "verified"
  },
  "jeffrey": {
   "ko": "제프리",
   "status": "verified"
  },
  "timothy": {
   "ko": "티머시",
   "status": "verified",
   "wrong": [
    "티모시"
   ]
  },
  "gregory": {
   "ko": "그레고리",
   "status": "verified"
  },
  "frank": {
   "ko": "프랭크",
   "status": "verified"
  },
  "raymond": {
   "ko": "레이먼드",
   "status": "verified"
  },
  "jordan": {
   "ko": "조던",
   "status": "verified"
  },
  "mary": {
   "ko": "메리",
   "status": "verified"
  },
  "patricia": {
   "ko": "퍼트리샤",
   "status": "verified",
   "common": [
    "패트리샤"
   ]
  },
  "jennifer": {
   "ko": "제니퍼",
   "status": "verified"
  },
  "linda": {
   "ko": "린다",
   "status": "verified"
  },
  "elizabeth": {
   "ko": "엘리자베스",
   "status": "verified"
  },
  "barbara": {
   "ko": "바버라",
   "status": "verified",
   "common": [
    "바바라"
   ]
  },
  "susan": {
   "ko": "수전",
   "status": "verified",
   "wrong": [
    "수잔"
   ]
  },
  "jessica": {
   "ko": "제시카",
   "status": "verified"
  },
  "sarah": {
   "ko": "세라",
   "status": "verified",
   "common": [
    "사라"
   ],
   "wrong": [
    "새라"
   ]
  },
  "karen": {
   "ko": "캐런",
   "status": "verified",
   "common": [
    "카렌"
   ]
  },
  "nancy": {
   "ko": "낸시",
   "status": "verified"
  },
  "lisa": {
   "ko": "리사",
   "status": "verified"
  },
  "margaret": {
   "ko": "마거릿",
   "status": "verified",
   "wrong": [
    "마가렛"
   ]
  },
  "emily": {
   "ko": "에밀리",
   "status": "verified"
  },
  "emma": {
   "ko": "에마",
   "status": "verified",
   "common": [
    "엠마"
   ]
  },
  "olivia": {
   "ko": "올리비아",
   "status": "verified"
  },
  "ava": {
   "ko": "에이바",
   "status": "verified",
   "common": [
    "아바"
   ]
  },
  "sophia": {
   "ko": "소피아",
   "status": "verified"
  },
  "isabella": {
   "ko": "이저벨라",
   "status": "verified",
   "common": [
    "이사벨라"
   ]
  },
  "mia": {
   "ko": "미아",
   "status": "verified"
  },
  "charlotte": {
   "ko": "샬럿",
   "status": "verified",
   "common": [
    "샬롯"
   ],
   "wrong": [
    "퀸샬롯제도"
   ]
  },
  "amelia": {
   "ko": "어밀리아",
   "status": "estimated",
   "common": [
    "아멜리아"
   ]
  },
  "harper": {
   "ko": "하퍼",
   "status": "verified"
  },
  "evelyn": {
   "ko": "에벌린",
   "status": "verified",
   "common": [
    "에블린"
   ]
  },
  "abigail": {
   "ko": "애비게일",
   "status": "verified"
  },
  "ella": {
   "ko": "엘라",
   "status": "estimated"
  },
  "grace": {
   "ko": "그레이스",
   "status": "verified"
  },
  "chloe": {
   "ko": "클로이",
   "status": "verified",
   "common": [
    "클로에"
   ]
  },
  "lily": {
   "ko": "릴리",
   "status": "verified"
  },
  "hannah": {
   "ko": "해나",
   "status": "verified",
   "common": [
    "한나"
   ]
  },
  "madison": {
   "ko": "매디슨",
   "status": "verified"
  },
  "ashley": {
   "ko": "애슐리",
   "status": "verified"
  },
  "amanda": {
   "ko": "어맨다",
   "status": "verified",
   "wrong": [
    "아만다"
   ]
  },
  "stephanie": {
   "ko": "스테퍼니",
   "status": "verified",
   "common": [
    "스테파니"
   ]
  },
  "nicole": {
   "ko": "니콜",
   "status": "verified"
  },
  "rachel": {
   "ko": "레이철",
   "status": "verified",
   "common": [
    "레이첼"
   ]
  },
  "rebecca": {
   "ko": "리베카",
   "status": "verified",
   "common": [
    "레베카"
   ]
  },
  "laura": {
   "ko": "로라",
   "status": "verified"
  },
  "michelle": {
   "ko": "미셸",
   "status": "verified",
   "wrong": [
    "미쉘"
   ]
  },
  "kimberly": {
   "ko": "킴벌리",
   "status": "verified"
  },
  "amy": {
   "ko": "에이미",
   "status": "verified"
  },
  "anna": {
   "ko": "애나",
   "status": "verified",
   "common": [
    "안나"
   ]
  },
  "victoria": {
   "ko": "빅토리아",
   "status": "verified"
  },
  "natalie": {
   "ko": "내털리",
   "status": "verified",
   "common": [
    "나탈리"
   ]
  },
  "zoe": {
   "ko": "조이",
   "status": "verified",
   "common": [
    "조에"
   ]
  },
  "sophie": {
   "ko": "소피",
   "status": "verified"
  },
  "isla": {
   "ko": "아일라",
   "status": "verified"
  },
  "freya": {
   "ko": "프레이아",
   "status": "estimated"
  },
  "ruby": {
   "ko": "루비",
   "status": "estimated"
  },
  "alice": {
   "ko": "앨리스",
   "status": "verified"
  },
  "lucy": {
   "ko": "루시",
   "status": "verified"
  },
  "katherine": {
   "ko": "캐서린",
   "status": "verified"
  },
  "catherine": {
   "ko": "캐서린",
   "status": "verified"
  },
  "julia": {
   "ko": "줄리아",
   "status": "verified",
   "common": [
    "쥴리아"
   ],
   "wrong": [
    "쥴리엣"
   ]
  },
  "kate": {
   "ko": "케이트",
   "status": "verified"
  },
  "megan": {
   "ko": "메건",
   "status": "verified",
   "common": [
    "메간"
   ]
  },
  "lauren": {
   "ko": "로런",
   "status": "verified",
   "common": [
    "로렌"
   ],
   "wrong": [
    "로렌스"
   ]
  },
  "samantha": {
   "ko": "서맨사",
   "status": "verified",
   "common": [
    "사만다"
   ]
  },
  "taylor": {
   "ko": "테일러",
   "status": "verified"
  },
  "heather": {
   "ko": "헤더",
   "status": "verified"
  },
  "kelly": {
   "ko": "켈리",
   "status": "verified"
  },
  "christina": {
   "ko": "크리스티나",
   "status": "verified"
  },
  "melissa": {
   "ko": "멀리사",
   "status": "verified",
   "common": [
    "멜리사"
   ]
  },
  "angela": {
   "ko": "앤절라",
   "status": "verified",
   "common": [
    "안젤라"
   ]
  },
  "helen": {
   "ko": "헬렌",
   "status": "verified"
  },
  "sandra": {
   "ko": "샌드라",
   "status": "verified",
   "common": [
    "산드라"
   ]
  },
  "donna": {
   "ko": "도나",
   "status": "verified"
  },
  "carol": {
   "ko": "캐럴",
   "status": "verified",
   "wrong": [
    "캐롤"
   ]
  },
  "ruth": {
   "ko": "루스",
   "status": "verified"
  },
  "sharon": {
   "ko": "샤론",
   "status": "verified"
  },
  "dorothy": {
   "ko": "도러시",
   "status": "verified",
   "common": [
    "도로시"
   ]
  },
  "deborah": {
   "ko": "데버라",
   "status": "verified",
   "common": [
    "데보라"
   ]
  },
  "emilia": {
   "ko": "에밀리아",
   "status": "estimated"
  },
  "scarlett": {
   "ko": "스칼릿",
   "status": "verified",
   "common": [
    "스칼렛"
   ]
  },
  "madeline": {
   "ko": "매들린",
   "status": "verified"
  },
  "brittany": {
   "ko": "브리트니",
   "status": "verified"
  },
  "jane": {
   "ko": "제인",
   "status": "verified"
  },
  "ann": {
   "ko": "앤",
   "status": "verified"
  },
  "anne": {
   "ko": "앤",
   "status": "verified"
  },
  "diana": {
   "ko": "다이애나",
   "status": "verified",
   "wrong": [
    "다이아나"
   ]
  }
 },
 "exceptions": {
  "es": {
   "montserrat": {
    "ko": "몬세라트",
    "rule": "몬트세라트",
    "why": "usage"
   }
  },
  "pt": {
   "joão": {
    "ko": "주앙",
    "rule": "조앙",
    "why": "usage"
   },
   "joao": {
    "ko": "주앙",
    "rule": "조앙",
    "why": "usage"
   },
   "eduardo": {
    "ko": "에두아르두",
    "rule": "이두아르두",
    "why": "usage"
   },
   "rodrigues": {
    "ko": "호드리게스",
    "rule": "호드리그스",
    "why": "usage"
   },
   "lisboa": {
    "ko": "리스보아",
    "rule": "리즈보아",
    "why": "usage"
   }
  },
  "br": {
   "joão": {
    "ko": "주앙",
    "rule": "조앙",
    "why": "usage"
   },
   "joao": {
    "ko": "주앙",
    "rule": "조앙",
    "why": "usage"
   },
   "eduardo": {
    "ko": "에두아르두",
    "rule": "이두아르두",
    "why": "usage"
   },
   "ernesto": {
    "ko": "에르네스투",
    "rule": "이르네스투",
    "why": "usage"
   }
  }
 }
};
  if (typeof module !== 'undefined' && module.exports) module.exports = NAMES;
  else root.SynkNames = NAMES;
})(typeof self !== 'undefined' ? self : this);
