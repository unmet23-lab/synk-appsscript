// 찰칵 낱말 — 낱말 카드 원고(설계 5절). 문항 · 해설은 학습 문항 2중 검수(tools/topik-review.mjs), 몽골어는 몽골어 검문을 탄다.
// band: 국립국어원 학습용 어휘 목록(2003, strata/topik-i.words.json)의 A · B. life = 목록 밖이지만 캠퍼스에서 날마다 읽는 말. notice = 3급 안내문.
// mean: 인화의 「뜻 고르기」 · 카드 뜻(화면 언어). ko는 쉬운 풀이다. ex: 예문(한국어 + 뜻).
// ask: 뜻 부탁 — 태오의 해요체 글(필요를 말함). 정답 낱말을 글에 넣지 않는다(places.test.mjs 꼬리표 시험).
// voice: assets/voice/<id>.mp3(레이싱 낱말 소리와 같은 원본 · 같은 목소리). 없는 낱말은 소리 단추 · 소리 부탁에 쓰지 않는다.
const w = (id, ko, band, mean, ex, extra = {}) => [id, Object.freeze({ id, ko, band, mean, ex, ...extra })];

export const WORDS = Object.freeze(Object.fromEntries([
  // 정문 표지판 · 층별 안내(섞는 판)
  w('library', '도서관', 'A', { ko: '책을 읽고 빌리는 곳', en: 'library', mn: 'номын сан' }, { ko: '도서관에서 책을 읽어요.', en: 'I read books at the library.', mn: 'Номын санд ном уншдаг.' },
    { voice: true, ask: { ko: '책을 빌리고 싶어요. 어디로 가요?', en: 'I want to borrow a book. Where do I go?', mn: 'Гэрээр авч унших ном хэрэгтэй байна. Хаашаа явах вэ?' } }),
  w('dorm', '기숙사', 'A', { ko: '학교에서 학생들이 사는 곳', en: 'dormitory', mn: 'оюутны байр' }, { ko: '저는 기숙사에 살아요.', en: 'I live in the dorm.', mn: 'Би оюутны байранд амьдардаг.' },
    { voice: true, ask: { ko: '친구가 학교 안에 살아요. 학생들이 사는 곳은 어디예요?', en: 'My friend lives on campus. Where do students live?', mn: 'Найз маань сургуулийн хотхонд амьдардаг. Оюутнууд хаана амьдардаг вэ?' } }),
  w('cafeteria', '식당', 'A', { ko: '밥을 먹는 곳', en: 'cafeteria', mn: 'хоолны газар' }, { ko: '식당에서 점심을 먹어요.', en: 'I have lunch at the cafeteria.', mn: 'Хоолны газарт өдрийн хоол иддэг.' },
    { voice: true, ask: { ko: '배고파요. 밥 먹는 곳은 어디예요?', en: "I'm hungry. Where can I eat?", mn: 'Өлсөж байна. Хаана хоол идэх вэ?' } }),
  w('bank', '은행', 'A', { ko: '돈을 찾고 넣는 곳', en: 'bank', mn: 'банк' }, { ko: '은행에서 돈을 찾아요.', en: 'I take out money at the bank.', mn: 'Банкнаас мөнгө авдаг.' },
    { voice: true, ask: { ko: '돈을 찾아야 해요. 어디로 가요?', en: 'I need to take out money. Where do I go?', mn: 'Мөнгө авах хэрэгтэй. Хаашаа явах вэ?' } }),
  w('bookstore', '서점', 'A', { ko: '책을 사는 곳', en: 'bookstore', mn: 'номын дэлгүүр' }, { ko: '서점에서 교과서를 사요.', en: 'I buy textbooks at the bookstore.', mn: 'Номын дэлгүүрээс сурах бичиг авдаг.' },
    { voice: true, ask: { ko: '새 책을 사야 해요. 어디로 가요?', en: 'I need to buy a new book. Where do I go?', mn: 'Шинэ ном худалдаж авах хэрэгтэй. Хаашаа явах вэ?' } }),
  w('post', '우체국', 'A', { ko: '편지를 보내는 곳', en: 'post office', mn: 'шуудан' }, { ko: '우체국에서 편지를 보내요.', en: 'I send a letter at the post office.', mn: 'Шуудангаас захидал илгээдэг.' },
    { voice: true, ask: { ko: '고향에 편지를 보내고 싶어요. 어디로 가요?', en: 'I want to send a letter home. Where do I go?', mn: 'Нутаг руугаа захидал илгээмээр байна. Хаашаа явах вэ?' } }),
  w('pharmacy', '약국', 'A', { ko: '약을 사는 곳', en: 'pharmacy', mn: 'эмийн сан' }, { ko: '약국에서 감기약을 사요.', en: 'I buy cold medicine at the pharmacy.', mn: 'Эмийн сангаас ханиадны эм авдаг.' },
    { voice: true, ask: { ko: '머리가 아파요. 약은 어디에서 사요?', en: 'I have a headache. Where can I buy medicine?', mn: 'Толгой өвдөж байна. Эм хаанаас авах вэ?' } }),
  w('office', '사무실', 'A', { ko: '사람들이 일하는 방', en: 'office', mn: 'ажлын өрөө' }, { ko: '사무실에 선생님이 계세요.', en: 'The teacher is in the office.', mn: 'Багш ажлын өрөөндөө байгаа.' },
    { voice: true, ask: { ko: '선생님을 만나고 싶어요. 선생님이 일하시는 방은 어디예요?', en: 'I want to see the teacher. Which room does the teacher work in?', mn: 'Багштай уулзмаар байна. Багшийн өрөө хаана вэ?' } }),
  // 정문 — 글을 얹는 고정 판(둘러보기 카드 · 인화만)
  w('university', '대학교', 'A', { ko: '고등학교 다음에 가서 공부하는 곳', en: 'university', mn: 'их сургууль' }, { ko: '새솔대학교는 우리 학교예요.', en: 'Saesol University is our school.', mn: 'Сэсол их сургууль бол манай сургууль.' }, { voice: true }),
  w('stop', '정류장', 'A', { ko: '버스를 기다리는 곳', en: 'bus stop', mn: 'автобусны буудал' }, { ko: '정류장에서 버스를 기다려요.', en: 'I wait for the bus at the bus stop.', mn: 'Буудал дээр автобус хүлээдэг.' }, { voice: true }),
  w('store', '편의점', 'life', { ko: '음식이나 필요한 물건을 사는 곳', en: 'convenience store', mn: 'хүнсний жижиг дэлгүүр' }, { ko: '편의점에서 물을 사요.', en: 'I buy water at the convenience store.', mn: 'Жижиг дэлгүүрээс ус авдаг.' }),
  // 정문 — 글 없는 물건(낱말 부탁 · 사진 → 낱말)
  w('cat', '고양이', 'A', { ko: '야옹 하고 우는 동물', en: 'cat', mn: 'муур' }, { ko: '벤치 위에 고양이가 있어요.', en: 'There is a cat on the bench.', mn: 'Урт сандал дээр муур байна.' }, { voice: true }),
  w('bench', '벤치', 'life', { ko: '밖에 있는 긴 의자', en: 'bench', mn: 'урт сандал' }, { ko: '벤치에 앉아서 쉬어요.', en: 'I sit on the bench and rest.', mn: 'Урт сандал дээр суугаад амарч байна.' }),
  w('vending', '자판기', 'life', { ko: '돈을 넣고 음료를 사는 기계', en: 'vending machine', mn: 'худалдааны автомат' }, { ko: '자판기에서 커피를 사요.', en: 'I buy coffee from the vending machine.', mn: 'Худалдааны автоматаас кофе авдаг.' }),
  w('bike', '자전거', 'A', { ko: '바퀴가 두 개 있고 발로 밟아서 가는 탈것', en: 'bicycle', mn: 'унадаг дугуй' }, { ko: '자전거를 타고 학교에 가요.', en: 'I go to school by bicycle.', mn: 'Дугуйгаар сургуульдаа явдаг.' }, { voice: true }),
  w('tree', '나무', 'A', { ko: '가지와 잎이 있는 큰 식물', en: 'tree', mn: 'мод' }, { ko: '학교에 나무가 많아요.', en: 'There are many trees at school.', mn: 'Сургуульд олон мод бий.' }, { voice: true }),
  w('building', '건물', 'A', { ko: '사람이 들어가 살거나 일할 수 있게 지은 것', en: 'building', mn: 'барилга' }, { ko: '저 건물이 도서관이에요.', en: 'That building is the library.', mn: 'Тэр барилга бол номын сан.' }, { voice: true }),
  // 정문 — 3급 안내문(받침판)
  w('n-construction', '공사 중입니다\n후문을 이용해 주세요', 'notice', { ko: '공사를 하고 있으니 정문 대신 뒷문을 이용하세요', en: 'Under construction — please use the back gate', mn: 'Засвартай — хойд хаалгаар орно уу' }, { ko: '공사 중이라서 후문으로 가요.', en: "It's under construction, so I go through the back gate.", mn: 'Засвартай учраас хойд хаалгаар явж байна.' },
    { ask: { ko: '오늘 정문 앞으로 왜 못 지나가요? 안내판 좀 찍어 줘요.', en: "Why can't we walk past the front gate today? Send me a photo of the sign.", mn: 'Өнөөдөр гол хаалганы өмнүүр яагаад явж болохгүй байна вэ? Зарын самбарын зургийг явуулаач.' } }),
  w('n-smoke', '이곳은\n금연 구역입니다', 'notice', { ko: '여기서 담배를 피우면 안 돼요', en: 'No smoking area', mn: 'Тамхи татахыг хориглоно' }, { ko: '여기는 금연 구역이에요.', en: 'This is a no-smoking area.', mn: 'Энд тамхи татахыг хориглосон.' },
    { ask: { ko: '여기서 담배를 피워도 돼요? 안내판을 찍어 줘요.', en: 'Is smoking okay here? Send me the sign.', mn: 'Энд тамхи татаж болох уу? Зарын самбарын зургийг явуулаач.' } }),
  w('n-bike', '여기에 자전거를\n세우지 마세요', 'notice', { ko: '이 자리에 자전거를 두면 안 돼요', en: 'Do not park bicycles here', mn: 'Энд дугуй бүү тавиарай' }, { ko: '여기에 자전거를 세우면 안 돼요.', en: "You can't park a bicycle here.", mn: 'Энд дугуй тавьж болохгүй.' },
    { ask: { ko: '정문 앞에 자전거 둬도 돼요? 안내판이 있으면 찍어 줘요.', en: 'Can I leave my bike by the front gate? If there is a sign, send me a photo.', mn: 'Гол хаалганы өмнө дугуйгаа тавьж болох уу? Зарын самбар байвал зургийг нь явуулаач.' } }),
  w('n-fresh', '신입생 안내는\n학생회관 1층에서', 'notice', { ko: '새로 온 학생은 학생회관 1층에서 안내를 받아요', en: 'New students: information on the union 1st floor', mn: 'Шинэ оюутны мэдээлэл: оюутны төвийн 1 давхарт' }, { ko: '신입생은 학생회관에서 안내를 받아요.', en: 'New students get information at the student union.', mn: 'Шинэ оюутнууд оюутны төвөөс мэдээлэл авдаг.' },
    { ask: { ko: '새로 온 학생이 학교 설명을 들으려면 어디로 가야 해요? 그 안내판을 찍어 줘요.', en: 'Where should new students go to hear about the school? Send me a photo of that sign.', mn: 'Шинэ оюутнууд сургуулийн тухай мэдээлэл авахын тулд хаашаа явах вэ? Зарын самбарын зургийг явуулаач.' } }),
  w('n-welcome', '신입생 환영회는\n도서관 2층에서', 'notice', { ko: '도서관 2층에서 새로 온 학생을 맞이하는 모임이 있어요', en: 'Freshman welcome party: library 2nd floor', mn: 'Шинэ оюутныг угтах арга хэмжээ номын сангийн 2 давхарт' }, { ko: '신입생 환영회는 도서관 2층에서 해요.', en: 'The freshman welcome party is on the 2nd floor of the library.', mn: 'Шинэ оюутныг угтах арга хэмжээ номын сангийн 2 давхарт болно.' }),
  w('n-fix', '자전거 수리는\n학생회관 1층에서', 'notice', { ko: '자전거를 고치려면 학생회관 1층으로 가요', en: 'Bicycle repair: union 1st floor', mn: 'Унадаг дугуйн засвар: оюутны төвийн 1 давхарт' }, { ko: '자전거 수리는 학생회관에서 해요.', en: 'Bicycle repairs are done at the student union.', mn: 'Унадаг дугуйг оюутны төвд засдаг.' }),
  // 학생회관 — 매단 안내판 · 유리문
  w('toilet', '화장실', 'A', { ko: '손을 씻고 볼일을 보는 곳', en: 'restroom', mn: 'ариун цэврийн өрөө' }, { ko: '화장실은 어디에 있어요?', en: 'Where is the restroom?', mn: 'Ариун цэврийн өрөө хаана байна вэ?' },
    { voice: true, ask: { ko: '손을 씻고 싶어요. 어디로 가요?', en: 'I want to wash my hands. Where do I go?', mn: 'Гараа угаамаар байна. Хаашаа явах вэ?' } }),
  w('stairs', '계단', 'B', { ko: '걸어서 위층이나 아래층으로 가는 길', en: 'stairs', mn: 'шат' }, { ko: '계단으로 2층에 올라가요.', en: 'I go up the stairs to the second floor.', mn: 'Шатаар 2 давхарт гардаг.' },
    { voice: true, ask: { ko: '걸어서 위층으로 올라가고 싶어요. 어디로 가요?', en: 'I want to walk upstairs. Where do I go?', mn: 'Дээд давхарт алхаж гармаар байна. Хаашаа явах вэ?' } }),
  w('entrance', '입구', 'B', { ko: '안으로 들어가는 곳', en: 'entrance', mn: 'орох хаалга' }, { ko: '입구에서 만나요.', en: "Let's meet at the entrance.", mn: 'Үүдэн дээр уулзъя.' },
    { voice: true, ask: { ko: '건물 안으로 들어가고 싶어요. 어디로 들어가요?', en: 'I want to go inside the building. Which way in?', mn: 'Энэ барилга руу орох гэсэн юм. Хаагуур орох вэ?' } }),
  w('exit', '출구', 'life', { ko: '밖으로 나가는 곳', en: 'exit', mn: 'гарах хаалга' }, { ko: '출구는 저쪽이에요.', en: 'The exit is over there.', mn: 'Гарах хаалга тэнд байна.' },
    { ask: { ko: '밖으로 나가고 싶어요. 어디로 나가요?', en: 'I want to go outside. Which way out?', mn: 'Гадагш гармаар байна. Хаагуур гарах вэ?' } }),
  w('lift', '엘리베이터', 'life', { ko: '타고 위층으로 올라가는 기계', en: 'elevator', mn: 'цахилгаан шат' }, { ko: '엘리베이터를 타고 5층에 가요.', en: 'I take the elevator to the fifth floor.', mn: 'Цахилгаан шатаар 5 давхарт гардаг.' },
    { ask: { ko: '짐이 무거워요. 타고 올라가는 건 어디 있어요?', en: 'My bag is heavy. Where can I ride up?', mn: 'Ачаа хүнд байна. Шатаар алхахгүйгээр хаагуур дээш гарах вэ?' } }),
  w('push', '미세요', 'life', { ko: '손으로 문을 앞으로 밀어서 열어요', en: 'Push', mn: 'Түлхэнэ үү' }, { ko: '이 문은 안으로 미세요.', en: 'Push this door inward.', mn: 'Энэ хаалгыг дотогш түлхэнэ үү.' }),
  w('pull', '당기세요', 'life', { ko: '손으로 문을 잡고 몸 쪽으로 열어요', en: 'Pull', mn: 'Татна уу' }, { ko: '이 문은 몸 쪽으로 당기세요.', en: 'Pull this door toward you.', mn: 'Энэ хаалгыг өөр лүүгээ татна уу.' }),
  w('slide', '옆으로 미세요', 'life', { ko: '문을 왼쪽이나 오른쪽으로 움직여서 열어요', en: 'Slide to open', mn: 'Хажуу тийш түлхэнэ үү' }, { ko: '이 문은 옆으로 미세요.', en: 'Slide this door to the side.', mn: 'Энэ хаалгыг хажуу тийш түлхэнэ үү.' }),
  // 학생회관 — 글 없는 물건
  w('umbrella', '우산', 'A', { ko: '비가 올 때 쓰는 것', en: 'umbrella', mn: 'шүхэр' }, { ko: '우산을 여기에 두세요.', en: 'Please leave your umbrella here.', mn: 'Шүхрээ энд тавина уу.' }, { voice: true }),
  w('sofa', '소파', 'A', { ko: '여러 명이 앉는 편한 의자', en: 'sofa', mn: 'буйдан' }, { ko: '소파에 앉아서 기다려요.', en: 'I sit on the sofa and wait.', mn: 'Буйдан дээр суугаад хүлээж байна.' }, { voice: true }),
  w('water', '정수기', 'life', { ko: '마시는 물이 나오는 기계', en: 'water dispenser', mn: 'ус шүүгч' }, { ko: '정수기에서 물을 받아서 마셔요.', en: 'I get water from the water dispenser and drink it.', mn: 'Ус шүүгчээс ус аваад уудаг.' }),
  w('tray', '식판', 'life', { ko: '밥과 반찬을 담는 판', en: 'lunch tray', mn: 'хоолны тавиур' }, { ko: '식판을 들고 줄을 서요.', en: 'I hold a tray and stand in line.', mn: 'Хоолны тавиур бариад дараалалд зогсдог.' }),
  w('copier', '복사기', 'life', { ko: '종이에 있는 글이나 그림을 똑같이 찍어 내는 기계', en: 'photocopier', mn: 'хувилагч' }, { ko: '복사기로 책을 복사해요.', en: 'I copy a book with the photocopier.', mn: 'Хувилагчаар ном хувилдаг.' }),
  w('menu', '메뉴', 'A', { ko: '식당에서 파는 음식과 값을 쓴 것', en: 'menu', mn: 'цэс' }, { ko: '메뉴 좀 보여 주세요.', en: 'Can I see the menu, please?', mn: 'Цэс үзүүлнэ үү.' }, { voice: true }),
].map(([id, value]) => [id, value])));

export const wordOf = (id) => WORDS[id] || null;
/** 화면 언어의 뜻 · 예문 뜻. */
export const pick = (field, lang) => field?.[lang] ?? field?.en ?? field?.ko ?? '';
