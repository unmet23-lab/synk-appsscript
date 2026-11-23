/* SYNK 사전예약 — 화면 글(한국어 · 영어 · 몽골어)과 폼 고정 값.
 * 원본: SYNK-appsscript/experiences/synk-reserve/src/copy.js
 * 2026-11-23 유호님 「온라인 반 계획은 철수하자. 앱 오픈을 집중해서 사전예약 받자」.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SynkReserveCopy = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // 홈페이지 문의 구글 폼(회사 서버가 5분마다 모아 Workspace 「문의 접수」에 올린다)의 질문 번호와 고정 값.
  // 고정 값은 폼의 선택지 글과 한 글자도 다르면 안 된다(app.test.js가 지킨다). 같은 폼을 /lab/topik4/(철수) · /ub/가 썼다.
  // 받는 쪽: docs/마케팅/온라인마케팅지도/engagement/company/website-inquiry-registration.mjs의 app-reserve 상품.
  const FORM = {
    action: 'https://docs.google.com/forms/d/e/1FAIpQLSc4Z1BdhPxMi0bWP7enSganI4xCIsTcCxRJ8EpxiWRxyVfsIg/formResponse',
    email: 'emailAddress',
    type: 'entry.1425474537',
    body: 'entry.1372278933',
    consent: 'entry.1000387687',
    typeValue: '출시 소식 문의',
    consentValue: '위 안내를 읽고, 문의 답변을 위한 개인정보 수집·이용에 동의합니다.',
    marker: '[SYNK 사전예약]',
  };

  // 관심: 언어와 상관없이 같은 값(id)으로 고르고, 문의 내용에는 한국어 이름(record)을 적는다.
  const INTERESTS = [
    { id: 'korean', record: '한국어', ko: '한국어 공부', en: 'Learning Korean', mn: 'Солонгос хэл сурах' },
    { id: 'study', record: '유학', ko: '한국 유학', en: 'Studying in Korea', mn: 'Солонгост суралцах' },
    { id: 'job', record: '취업', ko: '한국 취업', en: 'Working in Korea', mn: 'Солонгост ажиллах' },
  ];

  const ko = {
    htmlLang: 'ko',
    record: '한국어',
    title: 'SYNK 사전예약 — 2027년 2월 출시',
    description: 'SYNK가 2027년 2월에 정식으로 문을 엽니다. 이메일을 남기시면 출시 때 가장 먼저 알려 드립니다.',
    langLabel: '화면 언어',
    logoLabel: 'SYNK 홈',
    tag: '2027년 2월 정식 출시',
    h1: 'SYNK 사전예약',
    lead: '한국어 공부부터 한국 유학과 취업 준비까지, SYNK가 2027년 2월에 정식으로 문을 엽니다. 이메일을 남기시면 출시 때 가장 먼저 알려 드립니다.',
    notice: 'TOPIK 4급 온라인 반은 열지 않기로 했습니다. 관심을 보내 주셔서 감사합니다. 대신 SYNK가 2027년 2월에 정식으로 문을 엽니다.',
    formTitle: '이메일로 사전예약',
    emailLabel: '이메일',
    interestLabel: '관심 있는 것',
    interestHint: '출시 안내를 준비할 때 참고합니다. 고르지 않아도 됩니다.',
    privacy: '모으는 것은 이메일과 고른 관심입니다. 출시 안내 메일을 보내는 데만 쓰고, 안내를 보낸 뒤 지웁니다. 그 전에 지워 달라고 하시면 바로 지웁니다.',
    privacyLink: '개인정보 처리방침',
    // 화면은 이 쪽의 목적(출시 안내)을 밝힌다. 폼에는 폼에 고정된 동의 선택지 글(FORM.consentValue)이 기록된다 — 영어 · 몽골어 화면과 같은 방식(11-23 검수).
    consent: '위 안내를 읽고, 출시 안내를 위한 개인정보 수집·이용에 동의합니다.',
    submit: '사전예약하기',
    sending: '보내는 중…',
    note: '확인 메일은 따로 보내지 않습니다. 광고 메일도 보내지 않습니다.',
    errEmail: '이메일 주소를 다시 확인해 주세요.',
    errConsent: '안내에 동의해야 사전예약할 수 있습니다.',
    errTooFast: '잠시 뒤에 다시 눌러 주세요.',
    errSend: '보내지 못했습니다. 인터넷 연결을 확인하고 다시 눌러 주세요. 계속 안 되면 hello@synk.im으로 메일을 보내 주세요.',
    doneTitle: '사전예약이 접수되었습니다',
    doneBody: '2027년 2월 출시 때 {email} 주소로 알려 드립니다.',
    again: '이메일을 잘못 적었다면 다시 적기',
    share: '친구에게 보내기',
    copied: '주소를 복사했습니다.',
    shareText: 'SYNK가 2027년 2월에 출시합니다. 사전예약은 여기서 할 수 있어요.',
    nowTag: '지금 해 볼 수 있는 것',
    nowTitle: '말하기 연습은 지금도 열려 있습니다',
    nowBody: 'SYNK WORLD에서 한국어 말하기와 TOPIK 연습을 무료로 해 볼 수 있습니다.',
    nowGo: 'SYNK WORLD 열기',
    contact: '문의',
    privacyFoot: '개인정보 처리방침',
    terms: '이용약관',
    imgAlt: '길 하나가 한 바퀴로 이어진 작은 마을. 길을 따라 집, 교실, 대학 정문, 회사, 카페가 차례로 서 있고 아침 해가 떠오른다. 3D로 그린 그림이다.',
  };

  const en = {
    htmlLang: 'en',
    record: '영어',
    title: 'Pre-register for SYNK — launching February 2027',
    description: 'SYNK officially opens in February 2027. Leave your email and we’ll tell you first when it launches.',
    langLabel: 'Language',
    logoLabel: 'SYNK home',
    tag: 'Launching February 2027',
    h1: 'Pre-register for SYNK',
    lead: 'From learning Korean to getting ready to study and work in Korea, SYNK officially opens in February 2027. Leave your email and we’ll tell you first when it launches.',
    notice: 'We’ve decided not to open the TOPIK Level 4 online class. Thank you for your interest. Instead, SYNK officially opens in February 2027.',
    formTitle: 'Pre-register with your email',
    emailLabel: 'Email',
    interestLabel: 'What interests you',
    interestHint: 'We use this to plan the launch email. You can skip it.',
    privacy: 'We collect your email and the interests you pick. We use them only to send the launch email, then delete them. Ask us before then and we’ll delete them right away.',
    privacyLink: 'Privacy policy (Korean · English)',
    consent: 'I have read the notice above and agree to the collection and use of my personal information.',
    submit: 'Pre-register',
    sending: 'Sending…',
    note: 'We won’t send a confirmation email or any marketing email.',
    errEmail: 'Please check your email address.',
    errConsent: 'Please agree to the notice to pre-register.',
    errTooFast: 'Please wait a moment and try again.',
    errSend: 'We couldn’t send it. Check your internet connection and try again. If it still fails, email hello@synk.im.',
    doneTitle: 'You’re pre-registered',
    doneBody: 'We’ll email {email} when SYNK launches in February 2027.',
    again: 'Typed the wrong email? Enter it again',
    share: 'Send to a friend',
    copied: 'Link copied.',
    shareText: 'SYNK launches in February 2027. You can pre-register here.',
    nowTag: 'Try it now',
    nowTitle: 'Speaking practice is already open',
    nowBody: 'In SYNK WORLD you can practise speaking Korean and prepare for TOPIK for free.',
    nowGo: 'Open SYNK WORLD',
    contact: 'Contact',
    privacyFoot: 'Privacy',
    terms: 'Terms',
    imgAlt: 'A small town where one road runs in a loop past a house, a classroom, a university gate, an office and a café, with the morning sun rising. A 3D illustration.',
  };

  const mn = {
    htmlLang: 'mn',
    record: '몽골어',
    title: 'SYNK урьдчилсан бүртгэл — 2027 оны 2-р сард нээгдэнэ',
    description: 'SYNK 2027 оны 2-р сард албан ёсоор нээгдэнэ. Имэйлээ үлдээвэл нээгдэх үед хамгийн түрүүнд мэдэгдэнэ.',
    langLabel: 'Хэл',
    logoLabel: 'SYNK нүүр хуудас',
    tag: '2027 оны 2-р сард нээгдэнэ',
    h1: 'SYNK урьдчилсан бүртгэл',
    lead: 'Солонгос хэл сурахаас эхлээд Солонгост суралцах, ажиллах бэлтгэл хүртэл — SYNK 2027 оны 2-р сард албан ёсоор нээгдэнэ. Имэйлээ үлдээвэл нээгдэх үед хамгийн түрүүнд мэдэгдэнэ.',
    notice: 'TOPIK 4-р түвшний онлайн ангийг нээхгүй байхаар шийдлээ. Үүний оронд SYNK 2027 оны 2-р сард албан ёсоор нээгдэнэ. Сонирхсонд баярлалаа.',
    formTitle: 'Имэйлээр урьдчилан бүртгүүлэх',
    emailLabel: 'Имэйл',
    interestLabel: 'Сонирхож буй зүйл',
    interestHint: 'Таны сонголтыг нээлтийн мэдэгдэл бэлдэхэд харгалзана. Сонгохгүй байж болно.',
    privacy: 'Бид таны имэйл болон сонгосон сонирхлыг цуглуулна. Үүнийг зөвхөн нээлтийн мэдэгдэл илгээхэд ашиглаж, мэдэгдэл илгээсний дараа устгана. Түүнээс өмнө устгуулахыг хүсвэл даруй устгана.',
    privacyLink: 'Хувийн мэдээллийн бодлого (солонгос, англи)',
    consent: 'Дээрх мэдээлэлтэй танилцсан бөгөөд миний хувийн мэдээллийг цуглуулж, ашиглахыг зөвшөөрч байна.',
    submit: 'Урьдчилан бүртгүүлэх',
    sending: 'Илгээж байна…',
    note: 'Баталгаажуулах имэйл болон сурталчилгааны имэйл илгээхгүй.',
    errEmail: 'Имэйл хаягаа дахин шалгана уу.',
    errConsent: 'Урьдчилан бүртгүүлэхийн тулд хувийн мэдээлэл цуглуулахыг зөвшөөрнө үү.',
    errTooFast: 'Түр хүлээгээд дахин дарна уу.',
    errSend: 'Илгээж чадсангүй. Интернэт холболтоо шалгаад дахин дарна уу. Болохгүй бол hello@synk.im хаяг руу имэйл бичнэ үү.',
    doneTitle: 'Урьдчилсан бүртгэлийг хүлээн авлаа',
    doneBody: 'SYNK 2027 оны 2-р сард нээгдэхэд {email} хаягаар мэдэгдэнэ.',
    again: 'Имэйлээ буруу бичсэн бол дахин оруулах',
    share: 'Найздаа илгээх',
    copied: 'Холбоосыг хуулсан.',
    shareText: 'SYNK 2027 оны 2-р сард нээгдэнэ. Эндээс урьдчилан бүртгүүлж болно.',
    nowTag: 'Одоо туршиж болох зүйл',
    nowTitle: 'Ярианы дадлага одоо ч нээлттэй',
    nowBody: 'SYNK WORLD дээр солонгосоор ярих дадлага болон TOPIK-ийн дасгалыг үнэгүй хийж болно.',
    nowGo: 'SYNK WORLD нээх',
    contact: 'Холбоо барих',
    privacyFoot: 'Хувийн мэдээллийн бодлого',
    terms: 'Үйлчилгээний нөхцөл',
    imgAlt: 'Жижиг тосгон. Тойрог хэлбэртэй нэг замын дагуу байшин, сургуулийн байр, их сургуулийн хаалга, оффис, кафе байрлана. Өглөөний нар мандаж байна. 3D зураг.',
  };

  return { FORM, INTERESTS, ko, en, mn, LANGS: ['ko', 'en', 'mn'], LANG_NAMES: { ko: '한국어', en: 'English', mn: 'Монгол' } };
});
