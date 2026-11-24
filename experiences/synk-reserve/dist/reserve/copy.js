/* SYNK 사전예약 — 화면 글(한국어 · 영어 · 몽골어)과 폼 고정 값.
 * 원본: SYNK-appsscript/experiences/synk-reserve/src/copy.js
 * 2026-11-23 유호님 「온라인 반 계획은 철수하자. 앱 오픈을 집중해서 사전예약 받자」.
 * 2026-11-24 유호님 정정 「게임으로 이동하는 단락 부분만 바꿔달란거였어」: 첫 화면과 폼은 11-23 판 그대로, 맨 아래 단락만 바꾼다.
 * 같은 날 「게임이 하나도 재미없어보여 … 배경 색도 너무 후졌거든」으로 아래 단락을 미색 바탕의 장면 사진 이야기(B안)로, 발은 홈처럼 큰 synk로.
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

  // 아래 단락 「지금 해 볼 수 있는 것」 — 서울행 이야기를 장면 사진으로 따라간다(11-24 유호님 B안 「B안으로」).
  // 사진(src/img/<id>.webp)은 WORLD의 실제 장면 그림이다: 정문 · 내 길 꿈 무대는 seoul-arrival, 학생 식당 · 동아리 박람회는 드라마 시범판, 동아리 친구는 world-front.
  // shot이 있는 장면은 넓은 화면에서 사진 곁에 그 언어의 실제 화면 캡처(src/shots/<언어>/<shot>.webp)를 작은 휴대폰으로 띄운다.
  // line은 게임에서 실제로 하는 한국어 한 줄이라 세 언어 모두 한국어로 보이고, 영어 · 몽골어 판은 뜻(lineMean)을 곁에 단다.
  // 아직 안 열린 화는 soon으로 「곧 열려요」를 단다(아직 없는 기능을 있는 것처럼 말하지 않는다).
  const SCENES = [
    {
      id: 'gate', shot: 'name',
      ko: { tag: '01 · 입학', name: '정문에서 「환영」이 기다립니다', body: '내 이름을 한글로 직접 써서 학생증을 받습니다. 얼굴도, 꿈도 내가 고릅니다.', alt: '대학 정문 앞 광장에 털실로 만든 큰 「환영」 글자가 서 있다. 정문 둘레에 벚꽃이 피어 있다.' },
      en: { tag: '01 · First day', name: 'Giant felt letters 환영 (Welcome) greet you at the gate', body: 'Write your own name in Hangul to get your student ID. You choose your look and your dream, too.', alt: 'Giant felt letters 환영 (Welcome) stand in the square before the university gate, with cherry blossoms around it.' },
      mn: { tag: '01 · Элсэлт', name: 'Хаалган дээр таныг «환영» (Тавтай морил) гэсэн бичиг угтана', body: 'Нэрээ солонгос үсгээр өөрөө бичиж, оюутны үнэмлэхээ авна. Төрх, мөрөөдлөө ч өөрөө сонгоно.', alt: 'Их сургуулийн хаалганы өмнөх талбайд ноосоор хийсэн «환영» (Тавтай морил) гэсэн том үсэг байна. Хаалганы орчим интоор цэцэглэжээ.' },
    },
    {
      id: 'cafeteria', shot: 'road', line: '혹시 도서관이 어디에 있는지 아세요?',
      ko: { tag: '1화 · 학생 식당', name: '선배에게 길을 묻습니다', body: '상대가 먼저 말을 걸고, 대답은 내 목소리로 합니다.', lineLabel: '내가 하는 말', alt: '학생 식당에서 식판을 앞에 두고 웃는 태오 선배.' },
      en: { tag: 'Ep. 1 · Student cafeteria', name: 'Ask a senior for directions', body: 'They speak to you first, and you answer in your own voice.', lineLabel: 'What you say', lineMean: 'Do you know where the library is?', alt: 'Taeo, a senior, smiling over his cafeteria tray.' },
      mn: { tag: '1-р анги · Оюутны хоолны газар', name: 'Ахлах курсийн оюутнаас зам асууна', body: 'Ярилцагч тань эхэлж ярьж, та өөрийн дуу хоолойгоор хариулна.', lineLabel: 'Таны хэлэх үг', lineMean: 'Номын сан хаана байдгийг мэдэх үү?', alt: 'Оюутны хоолны газарт хоолны тавиурынхаа өмнө инээмсэглэж буй ахлах курсийн Тэо.' },
    },
    {
      id: 'fair', soon: true,
      ko: { tag: '2화 · 동아리 박람회', name: '동갑 친구와 말을 놓습니다', body: '존댓말에서 반말로 바꾸는 순간을 연습합니다.', soon: '곧 열려요', alt: '동아리 박람회. 부스 사이에서 전단을 든 학생이 손을 흔든다.' },
      en: { tag: 'Ep. 2 · Club fair', name: 'Switch to casual talk with a friend your age', body: 'Practise the moment you move from polite to casual Korean.', soon: 'Coming soon', alt: 'The club fair: a student holding a flyer waves between the booths.' },
      mn: { tag: '2-р анги · Клубийн үзэсгэлэн', name: 'Нас чацуу найзтайгаа «чи» гэж ярина', body: 'Хүндэтгэлийн хэллэгээс энгийн яриа руу шилжиж ярих дадлага хийнэ.', soon: 'Удахгүй нээгдэнэ', alt: 'Клубийн үзэсгэлэн. Лангуунуудын дунд сурталчилгааны хуудас барьсан оюутан гар даллаж байна.' },
    },
    {
      id: 'taeo', friends: true, line: '아깝다! ‘빵을’! 한 번 더 말해 봐요!',
      ko: { tag: '동아리 친구', name: '틀려도 친구가 고쳐 줍니다', body: '다정한 서하, 칭찬하는 태오, 솔직한 유나 가운데 같이 공부할 친구를 고릅니다.', lineLabel: '태오가 고쳐 주는 말', alt: '교실 책상에 기대 앉아 손짓하는 태오.' },
      en: { tag: 'Club friends', name: 'Get it wrong, and a friend helps you fix it', body: 'Choose who you study with: warm Seoha, upbeat Taeo or straight-talking Yuna.', lineLabel: 'How Taeo corrects you', lineMean: 'So close! 빵을! Say it once more!', alt: 'Taeo leaning on a classroom desk, gesturing.' },
      mn: { tag: 'Клубийн найзууд', name: 'Алдсан ч найз тань засаж өгнө', body: 'Халамжтай Сөха, магтах дуртай Тэо, шулуун шударга Юна гурвын хэнтэй нь хамт сурахаа сонгоно.', lineLabel: 'Тэогийн засах үг', lineMean: 'Бараг л зөв! «빵을»! Дахиад нэг хэлээд үзээрэй!', alt: 'Ангийн ширээ түшин сууж гараараа дохиж буй Тэо.' },
    },
    {
      id: 'idol',
      ko: { tag: '꿈의 무대', name: '8화 끝에서, 내 꿈의 무대에 섭니다', body: 'TOPIK 1급부터 4급까지 이어지는 이야기의 끝. 아이돌이면 데뷔 무대, 배우면 첫 주연 시사회입니다.', alt: '공연장 무대 위에 털실로 만든 「데뷔」 글자가 조명을 받고, 무대 옆에 선 사람의 뒷모습이 보인다.' },
      en: { tag: 'Dream stage', name: 'At the end of Ep. 8, you step onto your dream stage', body: 'The story runs from TOPIK Level 1 to Level 4. If you dream of being an idol, it ends at your debut; if an actor, at your first lead-role premiere.', alt: 'Felt letters 데뷔 (Debut) lit up on a concert stage, with someone watching from the wings.' },
      mn: { tag: 'Мөрөөдлийн тайз', name: '8-р ангийн төгсгөлд мөрөөдлийн тайзан дээрээ гарна', body: 'TOPIK-ийн 1-ээс 4-р түвшин хүртэл үргэлжлэх түүхийн төгсгөл. Айдол бол дебютийн тайз, жүжигчин бол анхны гол дүрийн нээлт.', alt: 'Концертын тайзан дээр ноосон «데뷔» (Дебют) гэсэн том үсэг гэрэлтэж, тайзны хажууд нэг хүн ар талаасаа харагдана.' },
    },
  ];
  // 동아리 친구 셋(장면 taeo의 얼굴 줄). 사진은 src/img/<id>.webp.
  const FRIENDS = [
    { id: 'seoha', ko: '서하', en: 'Seoha', mn: 'Сөха' },
    { id: 'taeo', ko: '태오', en: 'Taeo', mn: 'Тэо' },
    { id: 'yuna', ko: '유나', en: 'Yuna', mn: 'Юна' },
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
    nowTitle: '봄 학기, 서울로 유학을 왔습니다.',
    nowSub: '한국어로 말하며 이어 가는 이야기 게임, SYNK WORLD',
    nowGo: '서울행 무료로 해 보기',
    nowEnd: '출시 전에도 서울행과 1화는 무료입니다.',
    nowGo2: 'SYNK WORLD에서 해 보기',
    home: 'SYNK 홈',
    footLabel: '바닥 메뉴',
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
    nowTitle: 'Spring semester. You’ve come to Seoul to study.',
    nowSub: 'SYNK WORLD, a story game you play by speaking Korean',
    nowGo: 'Play the trip to Seoul for free',
    nowEnd: 'Before launch, the trip to Seoul and Episode 1 are free.',
    nowGo2: 'Play in SYNK WORLD',
    home: 'SYNK home',
    footLabel: 'Footer',
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
    nowTitle: 'Хаврын улирал. Та Сөүлд суралцахаар ирлээ.',
    nowSub: 'Солонгосоор ярьж түүхээ үргэлжлүүлдэг тоглоом — SYNK WORLD',
    nowGo: '«Сөүл рүү хийх аялал» хэсгийг үнэгүй тоглох',
    nowEnd: 'Албан ёсоор нээгдэхээс өмнө ч «Сөүл рүү хийх аялал» болон 1-р анги үнэгүй.',
    nowGo2: 'SYNK WORLD дээр тоглох',
    home: 'SYNK нүүр хуудас',
    footLabel: 'Доод цэс',
    privacyFoot: 'Хувийн мэдээллийн бодлого',
    terms: 'Үйлчилгээний нөхцөл',
    imgAlt: 'Жижиг тосгон. Тойрог хэлбэртэй нэг замын дагуу байшин, сургуулийн байр, их сургуулийн хаалга, оффис, кафе байрлана. Өглөөний нар мандаж байна. 3D зураг.',
  };

  return { FORM, INTERESTS, SCENES, FRIENDS, ko, en, mn, LANGS: ['ko', 'en', 'mn'], LANG_NAMES: { ko: '한국어', en: 'English', mn: 'Монгол' } };
});
