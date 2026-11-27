// PATH 「위험해요」 고정 카드와 급함 고정 문안. 모델을 부르지 않고 늘 같은 글을 보인다.
// 앱(물어보기 화면 맨 위의 입구 · 급함 답)과 SYNK-talk synk-path 번들(status: 'urgent'의 고정 문안)이 같은 바이트를 쓴다.
// 번호는 공식 출처에서 직접 확인한 것만 싣고 확인한 날을 단다. 90일 빼기에 넣지 않고 석 달마다 따로 다시 확인한다.
// 설계: docs/디자인/PATH_유학앱_20261120/AI상담_설계.md 「급함은 모델과 상관없이 늘 열린다」.

/** 마지막으로 모든 번호를 공식 출처에서 다시 확인한 날. 석 달이 지나면 유학 자료 확인 예약이 알린다. */
export const EMERGENCY_CHECKED = '2026-11-27';
export const EMERGENCY_RECHECK_DAYS = 90;

/**
 * 나라별 긴급 연락처(2026-11-27 공식 출처 확인). 번호와 쓰임은 출처에서 직접 읽었다. hours · languages 가운데 출처에 없던 것은 null이다.
 * 몽골은 101 · 102 · 103을 통합 번호 112로 옮기는 중이다(2025 정부 결의 67호). 개통 공지를 확인하면 112로 바꾼다.
 * 112(한국)의 직통 통역은 영어 · 중국어다. 몽골어 전화 상담은 1345의 평일 09~18시다(18~22시는 한국어 · 영어 · 중국어만).
 * label.mn과 what.mn은 현지어 검수(tools/몽골어대조.js)를 거쳐야 화면에 나간다(mnReviewed).
 */
const C = (country, number, ko, en, mn, whatKo, whatEn, hours, source) => Object.freeze({ country, number, label: Object.freeze({ ko, en, mn }), what: Object.freeze({ ko: whatKo, en: whatEn }), hours, source });
export const CONTACTS = Object.freeze([
  C('MN', '102', '경찰', 'Police', 'Цагдаа', '범죄 · 위험 신고', 'Report a crime or danger', null, 'https://crc.gov.mn/en/information-communication-network-and-service'),
  C('MN', '103', '구급차', 'Ambulance', 'Түргэн тусламж', '아프거나 다쳤을 때', 'Medical emergency', null, 'https://crc.gov.mn/en/information-communication-network-and-service'),
  C('MN', '101', '소방', 'Fire', 'Гал түймэр унтраах алба', '불이 났을 때', 'Fire', null, 'https://crc.gov.mn/en/information-communication-network-and-service'),
  C('MN', '108', '아동 · 청소년 긴급 도움', 'Child helpline', 'Хүүхдийн тусламжийн утас', '아동 · 청소년 보호 긴급 도움', 'Child protection emergency help', null, 'https://mlsp.gov.mn/eng/content/detail/2016'),
  C('KR', '112', '경찰', 'Police', 'Цагдаа', '범죄 · 위험 신고(영어 · 중국어 통역)', 'Report a crime or danger (English, Chinese interpreting)', '24h', 'https://www.korea.net/NewsFocus/policies/view?articleId=248494'),
  C('KR', '119', '화재 · 구조 · 구급', 'Fire, rescue, ambulance', 'Гал түймэр унтраах, аврах, түргэн тусламж', '불, 사고, 아프거나 다쳤을 때', 'Fire, accidents, medical emergencies', '24h', 'https://nfa.go.kr/nfa/news/pressrelease/press/?boardId=bbs_0000000000000010&mode=view&cntId=561'),
  C('KR', '1345', '외국인종합안내센터', 'Immigration Contact Center', 'Гадаадын иргэдийн лавлах төв', '체류 · 생활 상담(평일 09~22시, 몽골어는 18시까지, 18시 뒤는 한국어 · 영어 · 중국어)', 'Stay and daily-life help (weekdays 9:00-22:00; Mongolian until 18:00, then Korean, English and Chinese)', 'weekdays 09:00-22:00 (Mongolian until 18:00)', 'https://moj.go.kr/immigration/1530/subview.do'),
  C('KR', '1366', '여성긴급전화', "Women's emergency hotline", 'Эмэгтэйчүүдийн яаралтай утас', '가정폭력 · 성폭력 · 스토킹 · 교제폭력', 'Domestic or sexual violence, stalking, dating violence', '24h', 'https://www.mogef.go.kr/cc/wcc/cc_wcc_f001.do'),
  C('KR', '109', '자살예방 상담', 'Suicide prevention line', 'Амиа хорлолтоос сэргийлэх зөвлөгөөний утас', '마음이 너무 힘들 때', 'When you feel overwhelmed or unsafe with yourself', null, 'https://www.korea.kr/news/policyNewsView.do?newsId=148921874')
]);
/** 몽골어 글(label.mn · URGENT_TEXT.mn)이 현지어 검수를 마쳤는가. false면 앱은 몽골어 화면에서도 영어 글을 보인다. */
export const MN_REVIEWED = false;

/** 급함 고정 문안(학생 말 셋). 몽골어는 현지어 검수(tools/몽골어대조.js)를 거친다.
 * 담당자 연결 단추는 로그인 · 나이 · 상담함 스위치에 따라 있거나 없어서, 문안에는 단추 이야기를 넣지 않는다(카드가 단추나 메일을 따로 보인다). */
export const URGENT_TEXT = Object.freeze({
  ko: '지금 위험하다면 아래 번호로 먼저 연락하세요. 혼자 견디지 않아도 돼요.',
  en: 'If you are in danger now, call one of the numbers below first. You do not have to handle this alone.',
  mn: 'Хэрэв та яг одоо аюулд байгаа бол доорх дугааруудын аль нэг рүү эхлээд залгаарай. Ганцаараа тэвчих шаардлагагүй.'
});

/** 화면에 낼 급함 문안. 몽골어 검수 전이면 영어를 낸다. */
export const urgentText = (lang) => (lang === 'mn' && !MN_REVIEWED ? URGENT_TEXT.en : URGENT_TEXT[lang] || URGENT_TEXT.en);
