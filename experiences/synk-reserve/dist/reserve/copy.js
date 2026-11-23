/* SYNK 사전예약 — 화면 글(한국어 · 영어 · 몽골어)과 폼 고정 값.
 * 원본: SYNK-appsscript/experiences/synk-reserve/src/copy.js
 * 2026-11-23 유호님 「온라인 반 계획은 철수하자. 앱 오픈을 집중해서 사전예약 받자」.
 * 2026-11-24 유호님 정정 「게임으로 이동하는 단락 부분만 바꿔달란거였어」: 첫 화면과 폼은 11-23 판 그대로, 맨 아래 단락만 서울행 실제 화면(SCENES)으로.
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

  // 서울행 장면 — 지금 synk.im/world에 있는 화면만 쓴다(아직 없는 기능을 보이지 않는다).
  // 캡처: 라이브 synk.im/world 손님 길(experiences/seoul-arrival/qa/흐름.mjs --후보 <빈 폴더> --끝 road, ko 아이돌 · en 배우 · mn 아이돌), 11-24 04:40.
  // 서울역 개찰구 화면은 초록 고리가 크게 보여 「안녕, 서울.」 화면으로 바꿨다. 서울행 화면이 바뀌면 다시 찍는다(README 「화면 캡처」).
  const SCENES = [
    {
      id: 'immigration',
      ko: { name: '입국심사', body: '공항에 내리면 심사관이 먼저 묻습니다. 알맞은 대답을 골라 한국어로 답합니다.', alt: '공항 입국심사대. 심사관이 「한국에 무슨 일로 오셨어요?」라고 묻고, 아래에 「공부하러 왔어요.」 「여행하러 왔어요.」 「일하러 왔어요.」 세 대답이 있다.' },
      en: { name: 'Immigration', body: 'Land at the airport and the officer asks first. Pick the right reply and answer in Korean.', alt: 'The airport immigration desk. The officer asks 한국에 무슨 일로 오셨어요? (What brings you to Korea?), with three Korean answers below: I came to study, to travel, to work.' },
      mn: { name: 'Хилийн шалгалт', body: 'Нисэх буудал дээр шалгагч танаас асуулт асууна. Зөв хариултаа сонгож солонгосоор хариулна.', alt: 'Нисэх буудлын хилийн шалгалтын лангуу. Шалгагч «한국에 무슨 일로 오셨어요?» (Солонгост ямар зорилгоор ирсэн бэ?) гэж асууж, доор нь сурахаар, аялахаар, ажиллахаар ирсэн гэсэн гурван хариулт байна.' },
    },
    {
      id: 'hello',
      ko: { name: '안녕, 서울', body: '입국심사를 마치고 서울로 들어가는 길, 창밖으로 한강과 남산이 보입니다.', alt: '전철 창밖으로 한강과 남산타워가 보이고, 강가에 털실로 만든 「안녕」 글자가 서 있다. 아래에 「PROLOGUE 안녕, 서울.」이라고 적혀 있다.' },
      en: { name: 'Hello, Seoul', body: 'After immigration, on your way into Seoul, the Han River and Namsan come into view through the window.', alt: 'Through a train window: the Han River and N Seoul Tower, with giant felt letters 안녕 (Hello) on the riverbank. Below: PROLOGUE, 안녕, 서울. (Hello, Seoul.)' },
      mn: { name: 'Сайн уу, Сөүл', body: 'Хилийн шалгалтын дараа Сөүл рүү орох замд цонхоор Хан мөрөн, Намсан уул харагдана.', alt: 'Галт тэрэгний цонхоор Хан мөрөн, Намсан цамхаг харагдаж, эрэг дээр ноосоор хийсэн «안녕» (Сайн уу) гэсэн том үсэг байна. Доор нь «PROLOGUE 안녕, 서울.» (Сайн уу, Сөүл.) гэж бичсэн.' },
    },
    {
      id: 'name',
      ko: { name: '한글 이름 쓰기', body: '내 이름을 한글로 바꿔 획 순서대로 직접 씁니다.', alt: '학생증에 들어갈 이름 「볼로르」의 첫 글자 「볼」을 쓰는 칸. 획마다 순서 숫자가 붙어 있다.' },
      en: { name: 'Write your name in Hangul', body: 'Your name is turned into Hangul, and you write it yourself, stroke by stroke.', alt: 'The box for writing 볼, the first syllable of the name 볼로르 (Bolor), for the student ID. Each stroke has an order number.' },
      mn: { name: 'Нэрээ солонгос үсгээр бичих', body: 'Нэрээ солонгос үсэг рүү хөрвүүлж, зурлагын дарааллаар өөрөө бичнэ.', alt: 'Оюутны үнэмлэх дээрх «볼로르» (Болор) нэрийн эхний үе «볼»-ыг бичих хэсэг. Зурлага бүрд дарааллын дугаар байна.' },
    },
    {
      id: 'face',
      ko: { name: '내 모습 고르기', body: '이야기 속에서 내가 될 얼굴을 고릅니다.', alt: '「한국에서의 내 모습」 화면. 대학 정문 앞 학생 사진 아래로 고를 수 있는 얼굴들이 줄지어 있다.' },
      en: { name: 'Choose your look', body: 'Pick the face that will be you in the story.', alt: 'The Me in Korea screen: a student photo in front of the university gate, with a row of faces to choose from below.' },
      mn: { name: 'Төрхөө сонгох', body: 'Түүх доторх өөрийн царайг сонгоно.', alt: '«Солонгос дахь миний төрх» дэлгэц. Их сургуулийн хаалганы өмнөх оюутны зураг, доор нь сонгох царайнууд эгнэн байна.' },
    },
    {
      id: 'card',
      ko: { name: '학생증', body: '고른 얼굴과 이름으로 새솔대학교 학생증이 나옵니다.', alt: '「학생증이 나왔어요」 화면. 새솔대학교 학생증에 사진, 이름 볼로르, 국제학부 1학년, 꿈 · 아이돌이 적혀 있다.' },
      en: { name: 'Student ID', body: 'Your Saesol University student ID comes out with the face and name you chose.', alt: 'The Your student ID is ready screen: a Saesol University ID with a photo, the name 볼로르 (Bolor), first year at the School of International Studies, and the dream of becoming an actor.' },
      mn: { name: 'Оюутны үнэмлэх', body: 'Таны сонгосон царай, нэрээр Сэсол их сургуулийн оюутны үнэмлэх гарна.', alt: '«Оюутны үнэмлэх чинь гарлаа» дэлгэц. Сэсол их сургуулийн үнэмлэх дээр зураг, Болор гэсэн нэр, мөрөөдөл нь айдол гэж бичсэн байна.' },
    },
    {
      id: 'road',
      ko: { name: '내 길', body: '8화와 꿈 장면 일곱이 TOPIK 1급부터 4급까지 이어집니다. 지금은 1화가 열려 있습니다. 장면마다 상대가 먼저 말을 걸고, 나는 한국어로 답합니다.', alt: '「내 길」 화면. TOPIK 1에서 1화 학생 식당에서 길 묻기, 2화 동아리 박람회, 1급 승급 오디션(쇼케이스 오디션)이 차례로 이어지고, TOPIK 2는 「1급 오디션에 붙으면 열려요」로 잠겨 있다. 아래에 「1화 시작」 단추가 있다.' },
      en: { name: 'My road', body: '8 episodes and 7 dream scenes run from TOPIK Level 1 to Level 4. Episode 1 is open now. In every scene someone speaks to you first, and you answer in Korean.', alt: 'The My road screen: from TOPIK 1, Ep. 1 (asking the way in the student cafeteria), Ep. 2 (the club fair) and the Level 1 audition (a student film festival audition) follow in order. A Start Ep. 1 button is below.' },
      mn: { name: 'Миний зам', body: '8 анги болон мөрөөдлийн 7 хэсэг нь TOPIK-ийн 1-ээс 4-р түвшнийг хамарна. Одоогоор 1-р анги нээлттэй байна. Хэсэг бүрд ярилцагч тань эхэлж ярьж, та солонгосоор хариулна.', alt: '«Миний зам» дэлгэц. TOPIK 1 хэсэгт 1-р анги, 2-р анги, 1-р түвшний шалгаруулалт дараалан байрлаж, TOPIK 2 түгжээтэй байна. Доор нь «1-р ангийг эхлэх» товч байна.' },
    },
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
    privacy: '모으는 것은 이메일, 고른 관심, 이 쪽에 들어온 링크 표시와 화면 언어입니다(이메일을 고쳐 다시 보내면 앞서 적은 이메일도). 출시 안내 메일을 보내는 데만 쓰고, 안내를 보낸 뒤 지웁니다. 그 전에 지워 달라고 하시면 바로 지웁니다. Google Forms로 접수·보관됩니다. 동의하지 않으면 사전예약하지 않으셔도 됩니다.',
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
    nowTitle: '한국 유학을 먼저 살아 보는 한국어 이야기 게임',
    nowBody: '출시 전이지만 SYNK WORLD에서 서울행 이야기와 1화를 무료로 해 볼 수 있습니다. 공항에 내리면 입국심사관이 먼저 말을 겁니다.',
    nowGo: 'SYNK WORLD에서 해 보기',
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
    privacy: 'We collect your email, the interests you pick, which link brought you to this page and your screen language (and your earlier email if you correct it and send again). We use them only to send the launch email, then delete them. Ask us before then and we’ll delete them right away. Responses are received and stored with Google Forms. If you don’t agree, you don’t have to pre-register.',
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
    nowTitle: 'Live student life in Korea first, in a Korean story game',
    nowBody: 'Before launch, you can play the trip to Seoul and Episode 1 in SYNK WORLD for free. Land at the airport and the immigration officer speaks to you first.',
    nowGo: 'Play in SYNK WORLD',
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
    privacy: 'Бид таны имэйл, сонгосон сонирхол, орж ирсэн холбоос, хуудасны хэлийг цуглуулна. Имэйлээ засаад дахин илгээвэл өмнөх имэйлийг мөн хадгална. Үүнийг зөвхөн нээлтийн мэдэгдэл илгээхэд ашиглаж, мэдэгдэл илгээсний дараа устгана. Түүнээс өмнө устгуулахыг хүсвэл даруй устгана. Мэдээллийг Google Forms-оор хүлээн авч хадгална. Зөвшөөрөхгүй бол урьдчилан бүртгүүлэхгүй байж болно.',
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
    nowTitle: 'Солонгост оюутан болж үзэх солонгос хэлний тоглоом',
    nowBody: 'Албан ёсоор нээгдэхээс өмнө SYNK WORLD дээр «Сөүл рүү хийх аялал» болон 1-р ангийг үнэгүй тоглож болно. Нисэх буудал дээр буухад хилийн шалгагч танаас асуулт асууна.',
    nowGo: 'SYNK WORLD дээр тоглох',
    contact: 'Холбоо барих',
    privacyFoot: 'Хувийн мэдээллийн бодлого',
    terms: 'Үйлчилгээний нөхцөл',
    imgAlt: 'Жижиг тосгон. Тойрог хэлбэртэй нэг замын дагуу байшин, сургуулийн байр, их сургуулийн хаалга, оффис, кафе байрлана. Өглөөний нар мандаж байна. 3D зураг.',
  };

  return { FORM, INTERESTS, SCENES, ko, en, mn, LANGS: ['ko', 'en', 'mn'], LANG_NAMES: { ko: '한국어', en: 'English', mn: 'Монгол' } };
});
