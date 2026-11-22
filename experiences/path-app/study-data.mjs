// PATH 유학 자료. 순수 자료와 검사만 둔다(창, DOM, 저장소를 쓰지 않는다).
// RULES는 공식 조건이다. 출처 · 기준일 · 확인한 날이 없으면 모듈을 읽을 때 던진다.
// inCurrentGuide는 「지금 쓰는 공식 안내에서 같은 값을 직접 읽었는가」다. false이면 대조를 「확인 필요」에 두고 기준일만 알린다.
// PROGRAMS는 과정이다. 예시(example: true)는 만든 값이고 실제 대학 이름을 쓰지 않는다.
// 실제 과정(example: false)은 대학이 공개한 모집 요강에서 옮긴 값이다. 출처와 확인한 날이 꼭 있어야 하고,
// 지어낸 건물 그림을 쓰지 않으며(image: null), 대학이 안내하지 않은 비용은 null로 둔다(만들지 않는다).
// 협약한 대학만 partner: true다. 공개 요강을 옮겼을 뿐인 대학은 partner: false이고 화면에 「협력」이라고 쓰지 않는다.

export const RULE_STATUS = Object.freeze(['in-force', 'announced']);
export const LEVELS = Object.freeze(['language', 'undergraduate']);
export const REGIONS = Object.freeze(['local', 'metro']);
export const VISAS = Object.freeze(['D-2', 'D-4']);
export const IMAGE_IDS = Object.freeze(['univ-a', 'univ-b', 'univ-c']);
export const TONES = Object.freeze(['lapis', 'meadow', 'ink', 'coral']);
import { MAX_TOPIK } from './study-shape.mjs';
export { MAX_TOPIK };

// 출처는 금액을 지금 직접 읽은 문서다(2026-11-21). 금액은 2023-07-03에 시행됐다(법무부 2023-06-23 보도자료).
// 학위 과정: 법무부 2026-10-07 보도자료 별첨의 「현행」 칸. 어학연수: 주몽골대사관 비자신청센터(KVAC) 안내(한국어 · 몽골어 쪽).
const MOJ_2026 = Object.freeze({
  title: Object.freeze({ ko: '법무부 2026-10-07 보도자료', en: 'Ministry of Justice press release, 2026-10-07' }),
  url: 'https://www.moj.go.kr/bbs/moj/182/611170/artclView.do'
});
const KVAC_D2 = Object.freeze({
  title: Object.freeze({ ko: '주몽골대사관 비자신청센터 유학(D-2) 안내', en: 'Korea Visa Application Center in Mongolia, Study (D-2) guide' }),
  url: 'https://www.visaforkorea.mn/ko/study-visa-d-2-1d-2-4'
});
const KVAC_D4 = Object.freeze({
  title: Object.freeze({ ko: '주몽골대사관 비자신청센터 어학연수(D-4-1) 안내', en: 'Korea Visa Application Center in Mongolia, Language trainee (D-4-1) guide' }),
  url: 'https://www.visaforkorea.mn/ko/korean-language-trainee-d-4-1'
});

export const RULES = Object.freeze([
  { id: 'finance-d2-local', kind: 'finance', visa: 'D-2', region: 'local', won: 16000000, status: 'in-force', basis: '2023-07-03', inCurrentGuide: true, source: MOJ_2026, checkedAt: '2026-11-21' },
  { id: 'finance-d2-metro', kind: 'finance', visa: 'D-2', region: 'metro', won: 20000000, status: 'in-force', basis: '2023-07-03', inCurrentGuide: true, source: MOJ_2026, checkedAt: '2026-11-21' },
  { id: 'finance-d4-local', kind: 'finance', visa: 'D-4', region: 'local', won: 8000000, status: 'in-force', basis: '2023-07-03', inCurrentGuide: true, source: KVAC_D4, checkedAt: '2026-11-21' },
  { id: 'finance-d4-metro', kind: 'finance', visa: 'D-4', region: 'metro', won: 10000000, status: 'in-force', basis: '2023-07-03', inCurrentGuide: true, source: KVAC_D4, checkedAt: '2026-11-21' },
  // 몽골에서 신청할 때 잔고 증명서를 내는 방법. 대조에는 쓰지 않고 재정 칸 아래 안내로 보인다.
  { id: 'finance-proof-mn-d2', kind: 'finance-proof', visa: 'D-2', issuedWithinDays: 14, heldDays: 30, status: 'in-force', basis: '2026-11-21', source: KVAC_D2, checkedAt: '2026-11-21' },
  { id: 'finance-proof-mn-d4', kind: 'finance-proof', visa: 'D-4', issuedWithinDays: 14, heldDays: 30, status: 'in-force', basis: '2026-11-21', source: KVAC_D4, checkedAt: '2026-11-21' },
  // 계획 발표: 대조에는 쓰지 않고 안내 글로만 보인다. 시행일이 정해지면 in-force 규칙으로 바꾼다.
  { id: 'finance-topik4-waiver', kind: 'finance-waiver', topik: 4, status: 'announced', basis: '2026-10-07', source: MOJ_2026, checkedAt: '2026-11-21' }
].map(Object.freeze));

const L = (ko, en) => Object.freeze({ ko, en });

export const PROGRAMS = Object.freeze([
  {
    id: 'example-a-ug', example: true, name: L('예시대학 A', 'Example University A'), place: L('전북 전주', 'Jeonju, Jeonbuk'),
    region: 'local', level: 'undergraduate', visa: 'D-2', majors: L('경영 · 컴퓨터 · 간호', 'Business · Computing · Nursing'), image: 'univ-a',
    requires: { education: 'highschool', gradePct: 70, topik: 3 },
    costs: { tuition: 6400000, dorm: 1800000, living: 6000000 },
    scholarship: [{ topik: 3, tuitionRate: 0.3 }, { topik: 4, tuitionRate: 0.5 }],
    applyOpens: '2027-01-21', certified: false, source: null, checkedAt: null
  },
  {
    id: 'example-b-lang', example: true, name: L('예시대학 B 한국어교육원', 'Example University B Korean Language Institute'), place: L('전북 익산', 'Iksan, Jeonbuk'),
    region: 'local', level: 'language', visa: 'D-4', majors: L('한국어 과정 1년', 'One-year Korean language program'), image: 'univ-b',
    requires: { education: 'highschool', gradePct: 60, topik: 0 },
    costs: { tuition: 5200000, dorm: 1600000, living: 5400000 },
    scholarship: [],
    applyOpens: '2026-12-31', certified: false, source: null, checkedAt: null
  },
  {
    id: 'example-c-ug', example: true, name: L('예시대학 C', 'Example University C'), place: L('충남 천안', 'Cheonan, Chungnam'),
    region: 'local', level: 'undergraduate', visa: 'D-2', majors: L('기계 · 호텔 · 디자인', 'Mechanical · Hospitality · Design'), image: 'univ-c',
    requires: { education: 'highschool', gradePct: 75, topik: 4 },
    costs: { tuition: 6800000, dorm: 2000000, living: 6600000 },
    scholarship: [{ topik: 4, tuitionRate: 0.4 }, { topik: 5, tuitionRate: 0.6 }],
    applyOpens: '2027-02-04', certified: false, source: null, checkedAt: null
  },

  // ── 대학이 공개한 모집 요강에서 옮긴 실제 과정(2026-11-21 확인). 협약 대학이 아니다(partner: false). ──
  // 금액 · 일정 · 조건은 요강 원문에서 직접 읽은 값이다. 원문에 없는 값(생활비 등)은 null로 둔다.
  {
    id: 'jbnu-ug', example: false, partner: false, name: L('전북대학교', 'Jeonbuk National University'), place: L('전북 전주', 'Jeonju, Jeonbuk'),
    region: 'local', level: 'undergraduate', visa: 'D-2', majors: L('신입학 · 외국인 전형', 'Freshman · international admission'),
    term: L('2027년 3월 입학', 'March 2027 intake'), image: null, tone: 'lapis',
    requires: { education: 'highschool', gradePct: 0, topik: 2 },
    requiresNote: L('TOPIK 2급으로 입학하면 입학 직후 전북대 한국어연수과정 2개 학기를 꼭 들어야 해요. 국내 한국어학당 4급반 수료나 전북대 자체시험 2급으로도 지원할 수 있어요. 고교 성적의 최저 기준은 없고 서류와 면접 총점 60점 이상이 합격 기준이에요. 검정고시는 인정하지 않아요. 졸업하려면 TOPIK 4급이 필요해요.',
      'If you enter with TOPIK level 2, you must complete two terms of the university’s Korean language program right after admission. Completing level 4 at a Korean language institute in Korea, or level 2 on the university’s own test, also qualifies. There is no minimum school grade; you need 60 points or more across document review and interview. School-leaving equivalency exams are not accepted. TOPIK level 4 is required to graduate.'),
    costs: { tuition: 4032000, dorm: 2809260, living: null }, dormLabel: L('두 학기 · 3인실 · 평일 세 끼 포함', 'Two semesters · triple room · weekday meals included'),
    costsNote: L('등록금은 인문 · 사회과학 · 경상대학 기준이에요(한 학기 2,016,000원). 공과대학은 한 학기 2,704,000원, 예술대학은 2,779,000원이에요. 기숙사는 참빛관 3인실, 평일 세 끼 포함 한 학기 1,404,630원 기준이고 방학은 들어 있지 않아요. 남학생은 식사 없는 대동관(한 학기 580,000원)도 신청할 수 있어요. 모두 2026학년도 2학기 금액이라 2027년에는 달라질 수 있어요.',
      'Tuition is for humanities, social sciences and commerce (₩2,016,000 per semester). Engineering is ₩2,704,000 and arts ₩2,779,000 per semester. The dormitory figure is Chambit Hall, triple room with three weekday meals, ₩1,404,630 per semester, excluding vacations. Male students can also apply for Daedong Hall without meals (₩580,000 per semester). All amounts are for the second semester of 2026 and may change in 2027.'),
    scholarship: [{ topik: 5, won: 820500 }, { topik: 6, won: 2016000 }],
    scholarshipNote: L('신입생 장학금은 첫 학기에만 줘요. TOPIK 5급은 수업료2의 50%(인문 계열 820,500원), 6급은 첫 학기 등록금 전액이에요. 그 밖의 급수는 예산 범위 안에서 수업료1(375,000원)을 면제받을 수 있어요. 3월 입학은 2026-12-23까지 성적표를 내야 해요.',
      'Freshman scholarships apply to the first semester only. TOPIK level 5 waives 50% of Tuition 2 (₩820,500 for humanities); level 6 waives the full first-semester tuition. Other levels may have Tuition 1 (₩375,000) waived within the budget. For March entry, the score report is due by 2026-12-23.'),
    applyOpens: null, applyRounds: [['2026-09-21', '2026-10-02'], ['2026-11-09', '2026-11-20']],
    applyNote: L('2027년 3월 입학 접수는 2026-11-20에 끝났어요. 9월 입학 요강은 아직 나오지 않았어요.', 'Applications for March 2027 closed on 2026-11-20. The guide for September entry has not been published yet.'),
    certified: false, checkedAt: '2026-11-21',
    source: { title: L('전북대학교 2027학년도 전기 학부 외국인특별전형 모집요강', 'Jeonbuk National University, Spring 2027 undergraduate international admissions guide'), url: 'https://ioffice.jbnu.ac.kr/bbs/ioffice/5310/401304/artclView.do' }
  },
  {
    id: 'jbnu-lang', example: false, partner: false, name: L('전북대학교 한국어학당', 'Jeonbuk National University Korean Language Institute'), place: L('전북 전주', 'Jeonju, Jeonbuk'),
    region: 'local', level: 'language', visa: 'D-4', majors: L('한 학기 10주', '10 weeks per term'),
    term: L('2027년 봄학기', 'Spring term 2027'), image: null, tone: 'lapis',
    requires: { education: 'highschool', gradePct: 0, topik: 0 },
    requiresNote: L('한국어를 전혀 몰라도 지원할 수 있고 배치시험으로 반을 정해요. 고등학교 졸업(예정) 이상이면 돼요. 2개 학기 이상 등록하면 어학연수(D-4) 비자를 신청할 수 있어요.',
      'You can apply with no Korean at all; a placement test decides your class. A high school diploma (or expected graduation) is enough. Registering for two or more terms lets you apply for the language training (D-4) visa.'),
    costs: { tuition: 5600000, dorm: null, living: null },
    costsNote: L('수업료는 한 학기 1,400,000원이고 한 해 네 학기예요(2027년 봄학기부터 오른 금액). 전형료는 70,000원이에요. 기숙사비는 2인실, 평일 세 끼 포함 「1학기 약 100만 원」이라고만 안내해 한 해 금액을 알 수 없어서 합계에 넣지 않았어요.',
      'Tuition is ₩1,400,000 per term, four terms a year (raised from spring 2027). The application fee is ₩70,000. The institute only says the dormitory is “about ₩1,000,000 per term” for a double room with three weekday meals, so the yearly cost is unknown and not included in the total.'),
    scholarship: [],
    applyOpens: null, applyRounds: [['2026-11-30', '2026-12-11'], ['2026-12-12', '2026-12-25']],
    applyNote: L('봄학기 접수는 2026-11-30부터예요. 1차 마감은 12-11, 2차 마감은 12-25예요. 수업은 2027-03-02에 시작해요. 일정은 바뀔 수 있어요.', 'Spring term applications open on 2026-11-30. The first deadline is 12-11 and the second is 12-25. Classes start on 2027-03-02. Dates may change.'),
    certified: false, checkedAt: '2026-11-21',
    source: { title: L('전북대학교 한국어학당 한국어 연수과정 안내', 'Jeonbuk National University Korean Language Institute program guide'), url: 'https://wz3.jbnu.ac.kr/lec_korean/10877/subview.do' }
  },
  {
    id: 'wku-ug', example: false, partner: false, name: L('원광대학교', 'Wonkwang University'), place: L('전북 익산', 'Iksan, Jeonbuk'),
    region: 'local', level: 'undergraduate', visa: 'D-2', majors: L('신입학 · 외국인 전형', 'Freshman · international admission'),
    term: L('2027년 3월 입학', 'March 2027 intake'), image: null, tone: 'meadow',
    requires: { education: 'highschool', gradePct: 0, topik: 0 },
    requiresNote: L('입학할 때 TOPIK은 필수가 아니에요(성적이 있는 사람만 내요). 졸업하려면 TOPIK 4급(예체능 3급) 이상이나 그에 맞는 조건 하나를 채워야 해요. 고교 성적의 최저 기준은 없고 서류와 면접 총점 60점 이상이 합격 기준이에요.',
      'TOPIK is not required for admission (submit a score only if you have one). To graduate you need TOPIK level 4 (level 3 for arts and sports) or one equivalent condition. There is no minimum school grade; you need 60 points or more across document review and interview.'),
    costs: { tuition: 6379000, dorm: 1618000, living: null }, dormLabel: L('두 학기 · 2인실 · 식비 별도', 'Two semesters · double room · meals extra'),
    costsNote: L('등록금은 인문 · 사회 계열 기준이에요(첫 학기 3,248,000원, 다음 학기 3,131,000원). 공학 · 예능 계열은 첫 학기 4,375,000원이에요. 기숙사는 학생생활관 2인실 관리비 한 학기 809,000원 기준이고 식비는 따로예요(하루 세 끼 한 학기 1,075,000원). 모두 2026학년도 금액이라 2027년에는 오를 수 있어요.',
      'Tuition is for humanities and social sciences (₩3,248,000 for the first semester, ₩3,131,000 after). Engineering and arts are ₩4,375,000 for the first semester. The dormitory figure is the residence hall double room fee, ₩809,000 per semester; meals are extra (₩1,075,000 per semester for three meals a day). All amounts are for 2026 and may rise in 2027.'),
    scholarship: [{ topik: 3, won: 1624000 }, { topik: 4, won: 1948800 }, { topik: 5, won: 3248000 }],
    scholarshipNote: L('4년제 신입학 기준이에요. TOPIK 3급 이상은 등록금의 50%, 4급 이상은 60%, 5급 이상은 100%를 깎아 줘요. 요강에 기간이 적혀 있지 않아 첫 학기 등록금으로만 계산했어요. 재학생 장학금은 직전 학기 성적과 TOPIK 기준이 따로 있어요.',
      'For four-year freshman admission. TOPIK level 3 or higher waives 50% of tuition, level 4 or higher 60%, level 5 or higher 100%. The guide does not state the period, so this is calculated on the first semester only. Scholarships for continuing students have separate grade and TOPIK criteria.'),
    applyOpens: null, applyRounds: [['2026-11-23', '2026-11-27'], ['2026-12-28', '2026-12-31']],
    applyNote: L('1차 접수는 2026-11-23부터 11-27까지, 2차는 12-28부터 12-31까지예요. 방문이나 우편으로 접수해요. 요강 파일 이름에 「(안)」이 붙어 있어 일정이 바뀔 수 있어요.',
      'Round 1 runs 2026-11-23 to 11-27 and round 2 runs 12-28 to 12-31. Apply in person or by post. The guide file is marked as a draft, so dates may change.'),
    certified: false, checkedAt: '2026-11-21',
    source: { title: L('원광대학교 2027학년도 1학기(3월) 외국인 학부 신(편)입학 모집요강', 'Wonkwang University, Spring 2027 undergraduate international admissions guide'), url: 'https://ipsi.wku.ac.kr/detail.do?menuurl=qBExJT7yxTZkr1QAFxkj1g%3D%3D&board_seq=9786' }
  },
  {
    id: 'wku-lang', example: false, partner: false, name: L('원광대학교 한국문화교육센터', 'Wonkwang University Korean Culture Education Center'), place: L('전북 익산', 'Iksan, Jeonbuk'),
    region: 'local', level: 'language', visa: 'D-4', majors: L('한 학기 10주', '10 weeks per term'),
    term: L('2027년 봄학기', 'Spring term 2027'), image: null, tone: 'meadow',
    requires: { education: 'highschool', gradePct: 0, topik: 0 },
    requiresNote: L('고등학교 졸업 이상이면 지원할 수 있고 한국어 조건은 없어요. 어학연수(D-4-1) 비자를 받으려면 두 학기 이상 등록해야 해요.',
      'A high school diploma is enough and there is no Korean requirement. To get the language training (D-4-1) visa you must register for at least two terms.'),
    costs: { tuition: 4400000, dorm: null, living: null },
    costsNote: L('수강료는 한 학기 1,100,000원이고 한 해 네 학기예요. 처음 한 번 전형료 · 교재비 100,000원과 보험료 100,000원을 더 내요(요강의 한 해 합계 4,600,000원). 기숙사 2인실 관리비는 대학 정규 학기(방학 제외) 한 학기에 809,000원이고 식비는 따로예요. 연수는 방학에도 이어져 한 해 기숙사비를 알 수 없어서 합계에 넣지 않았어요.',
      'Tuition is ₩1,100,000 per term, four terms a year. You also pay a one-time ₩100,000 for application and textbooks and ₩100,000 for insurance (the guide’s yearly total is ₩4,600,000). The double-room dormitory fee is ₩809,000 per regular university semester (excluding vacations), with meals extra. Language terms continue through vacations, so the yearly dormitory cost is unknown and not included in the total.'),
    scholarship: [],
    scholarshipNote: L('연수 과정 자체의 장학금은 요강에 없어요. 두 학기 이상 수료하고 원광대 학부에 들어가면 첫 학기 등록금을 100% 깎아 줘요.',
      'The guide lists no scholarship for the language program itself. If you complete two or more terms and enter Wonkwang University as an undergraduate, the first semester’s tuition is fully waived.'),
    applyOpens: null, applyRounds: [['2026-12-01', '2026-12-24']],
    applyNote: L('봄학기 서류 접수는 2026-12-01부터 12-24까지예요. 수업은 2027-03-02에 시작해요. 일정은 바뀔 수 있어요.', 'Documents for the spring term are accepted from 2026-12-01 to 12-24. Classes start on 2027-03-02. Dates may change.'),
    certified: false, checkedAt: '2026-11-21',
    source: { title: L('2026 원광대학교 한국문화교육센터 모집요강', 'Wonkwang University Korean Culture Education Center admissions guide, 2026'), url: 'https://ipsi.wku.ac.kr/detail.do?menuurl=8pYtphfeWm2Bb85hdKCTcQ%3D%3D&board_seq=7060' }
  },
  {
    id: 'jj-ug', example: false, partner: false, name: L('전주대학교', 'Jeonju University'), place: L('전북 전주', 'Jeonju, Jeonbuk'),
    region: 'local', level: 'undergraduate', visa: 'D-2', majors: L('신입학 · 외국인 전형', 'Freshman · international admission'),
    term: L('2027년 3월 입학', 'March 2027 intake'), image: null, tone: 'ink',
    requires: { education: 'highschool', gradePct: 0, topik: 2 },
    requiresNote: L('TOPIK 2급이 없어도 세종학당 초급2 이상, 사회통합프로그램 2단계, 전주대 한국어학당 3급 이상 수료, 대학 자체 시험(JJ-TOPIK) 합격 같은 조건 가운데 하나로 지원할 수 있어요. TOPIK 2급 이하로 입학하면 두 학기, 3급이면 한 학기 동안 한국어 집중교육을 꼭 들어야 해요. 고교 성적의 최저 기준은 없고 서류평가 60점 이상이 합격 기준이에요. 졸업하려면 TOPIK 4급이 필요해요.',
      'Without TOPIK level 2 you can still apply through one of several alternatives, such as King Sejong Institute Beginner 2 or higher, KIIP level 2, completing level 3 at the university’s Korean language institute, or passing the university’s own test (JJ-TOPIK). Entering with TOPIK level 2 or lower requires two semesters of intensive Korean; level 3 requires one. There is no minimum school grade; you need 60 points or more in document review. TOPIK level 4 is required to graduate.'),
    costs: { tuition: 7330000, dorm: 1738000, living: null }, dormLabel: L('두 학기 · 2인실 · 식비 별도', 'Two semesters · double room · meals extra'),
    costsNote: L('등록금은 인문 · 사회과학 · 경영 계열 기준이에요(한 학기 3,665,000원). 관광 · 의과학 · 체육 계열은 한 학기 4,302,000원, 공학 · 디자인 · 소프트웨어 계열은 4,788,000원이에요. 보험료와 기타경비는 들어 있지 않아요. 기숙사는 스타빌 2인실 한 학기(16주) 869,000원 기준이고 식비는 들어 있지 않아요. 모두 2026학년도 금액이라 달라질 수 있어요.',
      'Tuition is for humanities, social sciences and business (₩3,665,000 per semester). Tourism, medical sciences and sports are ₩4,302,000 and engineering, design and software ₩4,788,000 per semester. Insurance and other fees are not included. The dormitory figure is a Star Ville double room, ₩869,000 per 16-week semester, without meals. All amounts are for 2026 and may change.'),
    scholarship: [{ topik: 0, won: 1466000 }, { topik: 3, won: 1832500 }, { topik: 4, won: 2565500 }, { topik: 5, won: 3665000 }],
    scholarshipNote: L('입학하는 학기에만 주는 장학금이에요. 신입생은 모두 등록금의 40%를 깎아 주고, TOPIK 3급은 50%, 4급은 70%, 5급 이상은 100%예요. 다음 학기부터는 TOPIK 급수와 직전 학기 성적으로 25%에서 100%까지 정해요.',
      'These apply to the entry semester only. Every freshman gets 40% off tuition; TOPIK level 3 gets 50%, level 4 gets 70%, and level 5 or higher gets 100%. From the next semester, 25% to 100% is decided by TOPIK level and the previous semester’s grades.'),
    applyOpens: null, applyRounds: [['2026-10-12', '2026-10-21'], ['2026-12-01', '2026-12-11'], ['2027-01-04', '2027-01-13']],
    applyNote: L('1차 접수는 끝났어요. 2차는 2026-12-01부터 12-11까지, 3차는 2027-01-04부터 01-13까지예요. 서류는 기한까지 국제처에 도착해야 해요.', 'Round 1 has closed. Round 2 runs 2026-12-01 to 12-11 and round 3 runs 2027-01-04 to 01-13. Documents must arrive at the international office by the deadline.'),
    certified: false, checkedAt: '2026-11-21',
    source: { title: L('2027학년도 전주대학교 전기 외국인 신 · 편입학 특별전형 모집요강', 'Jeonju University, Spring 2027 international admissions guide'), url: 'https://www.jj.ac.kr/global/admission/guidelines.do' }
  }
].map((p) => Object.freeze({ ...p, requires: Object.freeze(p.requires), costs: Object.freeze(p.costs), scholarship: Object.freeze(p.scholarship.map(Object.freeze)) })));

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z'));
const isText = (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 200;
const isPair = (v) => isObj(v) && isText(v.ko) && isText(v.en);
const isLong = (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 600;
const isNote = (v) => isObj(v) && isLong(v.ko) && isLong(v.en);
const isWon = (v) => Number.isSafeInteger(v) && v >= 0 && v <= 1000000000;
const isLevel = (v) => Number.isInteger(v) && v >= 0 && v <= MAX_TOPIK;
const isHttps = (v) => { try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } };
const isSource = (v) => isObj(v) && isPair(v.title) && isHttps(v.url);
const fail = (m) => { throw new TypeError('Invalid study data: ' + m); };

export function financeRule(rules, visa, region) {
  return rules.find((r) => r.kind === 'finance' && r.status === 'in-force' && r.visa === visa && r.region === region) || null;
}
export function announcedRules(rules, kind) {
  return rules.filter((r) => r.status === 'announced' && r.kind === kind);
}
/** 장학금 한 단계가 한 해에 깎아 주는 금액. scholarshipTerms가 1이면 비율 장학금은 한 학기 몫만이다. */
export function scholarshipAmount(program, step) {
  if (Number.isInteger(step.won)) return step.won;
  return Math.round(program.costs.tuition * step.tuitionRate * (program.scholarshipTerms === 1 ? 0.5 : 1));
}
export function proofRule(rules, visa) {
  return rules.find((r) => r.kind === 'finance-proof' && r.status === 'in-force' && !r.stale && r.visa === visa) || null;
}
export function programById(programs, id) {
  return programs.find((p) => p.id === id) || null;
}

/** 자료의 약속을 검사한다. 어기면 던진다(틀린 자료로 화면을 그리지 않는다). */
export function validateStudyData(rules, programs) {
  if (!Array.isArray(rules) || !Array.isArray(programs)) fail('lists');
  const ruleIds = new Set();
  for (const r of rules) {
    if (!isObj(r) || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(r.id) || ruleIds.has(r.id)) fail('rule id');
    ruleIds.add(r.id);
    if (!RULE_STATUS.includes(r.status) || !isDate(r.basis) || !isDate(r.checkedAt) || !isSource(r.source)) fail('rule source ' + r.id);
    if (r.kind === 'finance') { if (!VISAS.includes(r.visa) || !REGIONS.includes(r.region) || !isWon(r.won) || typeof r.inCurrentGuide !== 'boolean') fail('finance rule ' + r.id); }
    else if (r.kind === 'finance-waiver') { if (!isLevel(r.topik)) fail('waiver rule ' + r.id); }
    else if (r.kind === 'finance-proof') { if (!VISAS.includes(r.visa) || ![r.issuedWithinDays, r.heldDays].every((d) => Number.isInteger(d) && d > 0 && d <= 366)) fail('proof rule ' + r.id); }
    else fail('rule kind ' + r.id);
  }
  const seenFinance = new Set();
  for (const r of rules) if (r.kind === 'finance' && r.status === 'in-force') {
    const key = r.visa + '/' + r.region;
    if (seenFinance.has(key)) fail('duplicate finance rule ' + key);
    seenFinance.add(key);
  }
  const ids = new Set();
  for (const p of programs) {
    if (!isObj(p) || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(p.id) || ids.has(p.id)) fail('program id');
    ids.add(p.id);
    if (typeof p.example !== 'boolean' || !isPair(p.name) || !isPair(p.place) || !isPair(p.majors)) fail('program text ' + p.id);
    if (!REGIONS.includes(p.region) || !LEVELS.includes(p.level) || !VISAS.includes(p.visa)) fail('program kind ' + p.id);
    if (p.example ? !IMAGE_IDS.includes(p.image) : !(p.image === null || IMAGE_IDS.includes(p.image))) fail('program image ' + p.id);
    if (!(p.tone === undefined || TONES.includes(p.tone))) fail('program tone ' + p.id);
    for (const key of ['term', 'requiresNote', 'costsNote', 'scholarshipNote', 'applyNote', 'dormLabel']) if (!(p[key] === undefined || p[key] === null || isNote(p[key]))) fail('program ' + key + ' ' + p.id);
    if (!(p.partner === undefined || typeof p.partner === 'boolean') || (p.example && p.partner)) fail('program partner ' + p.id);
    if (!(p.scholarshipTerms === undefined || p.scholarshipTerms === 1 || p.scholarshipTerms === 2)) fail('program scholarship terms ' + p.id);
    if ((p.level === 'language') !== (p.visa === 'D-4')) fail('program visa ' + p.id);
    const q = p.requires;
    if (!isObj(q) || q.education !== 'highschool' || !Number.isInteger(q.gradePct) || q.gradePct < 0 || q.gradePct > 100 || !isLevel(q.topik)) fail('program requires ' + p.id);
    const c = p.costs;
    const known = (v) => isWon(v) || (!p.example && v === null);
    if (!isObj(c) || !isWon(c.tuition) || !known(c.dorm) || !known(c.living)) fail('program costs ' + p.id);
    if (!Array.isArray(p.scholarship)) fail('program scholarship ' + p.id);
    // 장학금 단계는 비율(tuitionRate) 또는 한 해 금액(won) 가운데 하나로 적는다. 급수가 오를수록 금액이 커야 한다.
    let last = -1, lastAmount = 0;
    for (const s of p.scholarship) {
      const byRate = typeof s.tuitionRate === 'number' && s.tuitionRate > 0 && s.tuitionRate <= 1 && s.won === undefined;
      const byWon = isWon(s.won) && s.won > 0 && s.won <= c.tuition && s.tuitionRate === undefined;
      if (!isObj(s) || !isLevel(s.topik) || s.topik <= last || (s.topik !== 0 && s.topik < q.topik) || !(byRate || byWon)) fail('scholarship steps ' + p.id);
      const amount = scholarshipAmount(p, s);
      if (!(amount > lastAmount)) fail('scholarship steps ' + p.id);
      last = s.topik; lastAmount = amount;
    }
    if (!(p.applyOpens === null || isDate(p.applyOpens)) || typeof p.certified !== 'boolean') fail('program dates ' + p.id);
    if (!(p.applyCloses === undefined || p.applyCloses === null || (isDate(p.applyCloses) && (!p.applyOpens || p.applyCloses >= p.applyOpens)))) fail('program close date ' + p.id);
    // 접수 차수가 여럿이면 applyRounds에 [시작, 마감]을 이른 순서로 적는다(그때 applyOpens는 null).
    if (p.applyRounds !== undefined) {
      let prev = '';
      if (!Array.isArray(p.applyRounds) || !p.applyRounds.length || p.applyOpens !== null) fail('program rounds ' + p.id);
      for (const r of p.applyRounds) {
        if (!Array.isArray(r) || r.length !== 2 || !isDate(r[0]) || !isDate(r[1]) || r[1] < r[0] || r[0] <= prev) fail('program rounds ' + p.id);
        prev = r[1];
      }
    }
    if (p.example) { if (p.certified) fail('example cannot be certified ' + p.id); }
    else if (!isSource(p.source) || !isDate(p.checkedAt)) fail('real program needs a source ' + p.id);
    if (!seenFinance.has(p.visa + '/' + p.region)) fail('no finance rule for ' + p.id);
  }
  return true;
}

/** 확인한 날이 days보다 오래된 규칙과 실제 과정. 예시 과정은 세지 않는다. */
export function staleItems(rules, programs, now = new Date(), days = 90) {
  const t = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const old = (d) => (t - Date.parse(d + 'T00:00:00Z')) / 86400000 > days;
  return [
    ...rules.filter((r) => old(r.checkedAt)).map((r) => ({ type: 'rule', id: r.id, checkedAt: r.checkedAt })),
    ...programs.filter((p) => !p.example && old(p.checkedAt)).map((p) => ({ type: 'program', id: p.id, checkedAt: p.checkedAt }))
  ];
}

/** 지금 쓸 규칙 목록. 확인한 날이 days보다 오래된 규칙에는 stale 표시를 붙인다(대조는 「확인 필요」로 내려간다). */
export function rulesAt(rules, now = new Date(), days = 90) {
  const old = new Set(staleItems(rules, [], now, days).map((x) => x.id));
  return rules.map((r) => (old.has(r.id) ? { ...r, stale: true } : r));
}

/**
 * 화면에 낼 과정. 실제 과정이 하나라도 있으면 실제 과정만 낸다(미리보기와 공개판이 같다).
 * 실제 과정이 없으면 미리보기에서만 예시를 낸다. 공개판에는 예시를 싣지 않는다(예시의 금액 · 일정은 만든 값이다).
 */
export function programsFor(programs, publicWeb) {
  const real = programs.filter((p) => !p.example);
  return real.length ? real : publicWeb ? [] : [...programs];
}

/** 원서 접수의 지금 상태. before(시작 전) · open(접수 중) · closed(마감이 지남) · unknown(날짜를 모름). days는 시작 또는 마감까지 남은 날. */
export function applyWindow(program, now = new Date()) {
  const rounds = Array.isArray(program.applyRounds) ? program.applyRounds : [[program.applyOpens ?? null, program.applyCloses ?? null]];
  // 접수가 여러 차수면 몇 차인지와 다음 차수가 열리는 날을 붙인다(1차 마감이 접수 끝으로 읽히지 않게).
  const at = (w, i) => (rounds.length > 1 ? { ...w, round: i + 1, nextOpens: isDate(rounds[i + 1]?.[0]) ? rounds[i + 1][0] : null } : w);
  let sawClose = false;
  for (const [i, [opens, closes]] of rounds.entries()) {
    const toOpen = daysUntil(opens, now);
    if (toOpen !== null && toOpen > 0) return at({ state: 'before', days: toOpen }, i);
    const toClose = daysUntil(closes, now);
    if (toClose !== null) return at({ state: 'open', days: toClose }, i);
    if (toOpen === 0) return at({ state: 'open', days: null }, i);
    if (isDate(closes)) sawClose = true;
  }
  return { state: sawClose ? 'closed' : 'unknown', days: null };
}

/** 접수 시작까지 남은 날. 날짜가 없거나 지났으면 null(화면은 「일정 확인 필요」로 쓴다). */
export function daysUntil(dateText, now = new Date()) {
  if (!isDate(dateText)) return null;
  const t = now instanceof Date ? now.getTime() : new Date(now).getTime();
  // 한국 대학의 접수일은 한국 날짜다. 기기 시간대(몽골 UTC+8 등)와 상관없이 한국 시간(UTC+9)의 오늘로 센다.
  const todayKst = Math.floor((t + 9 * 3600000) / 86400000);
  const d = Date.parse(dateText + 'T00:00:00Z') / 86400000 - todayKst;
  return d >= 0 ? d : null;
}

validateStudyData(RULES, PROGRAMS);
