// 찰칵 낱말 — 낱말 카드 원고(설계 5절). 검수 전 초안이다(2026-11-04): 학습 문항 2중 검수(1차 Opus → 2차 아르곤) · 몽골어 검문을 거친 뒤 공개한다.
// band: 국립국어원 학습용 어휘 목록(2003, strata/topik-i.words.json)의 A · B. life = 목록 밖이지만 캠퍼스에서 날마다 읽는 말. notice = 3급 안내문.
// mean: 인화의 「뜻 고르기」 · 카드 뜻(화면 언어). ko는 쉬운 풀이다. ex: 예문(한국어 + 뜻).
// ask: 뜻 부탁 — 태오의 해요체 글(필요를 말함). 정답 낱말을 글에 넣지 않는다(places.test.mjs 꼬리표 시험).
// voice: assets/voice/<id>.mp3(레이싱 낱말 소리와 같은 원본 · 같은 목소리). 없는 낱말은 소리 단추 · 소리 부탁에 쓰지 않는다.
const w = (id, ko, band, mean, ex, extra = {}) => [id, Object.freeze({ id, ko, band, mean, ex, ...extra })];

export const WORDS = Object.freeze(Object.fromEntries([
  // 정문 표지판 · 층별 안내(섞는 판)
  w('library', '도서관', 'A', { ko: '책을 읽고 빌리는 곳', en: 'library' }, { ko: '도서관에서 책을 읽어요.', en: 'I read books at the library.' },
    { voice: true, ask: { ko: '책을 빌리고 싶어요. 어디로 가요?', en: 'I want to borrow a book. Where do I go?' } }),
  w('dorm', '기숙사', 'A', { ko: '학생들이 사는 집', en: 'dormitory' }, { ko: '저는 기숙사에 살아요.', en: 'I live in the dorm.' },
    { voice: true, ask: { ko: '친구가 학교 안에 살아요. 학생들이 사는 집은 어디예요?', en: 'My friend lives on campus. Where do students live?' } }),
  w('cafeteria', '식당', 'A', { ko: '밥을 먹는 곳', en: 'cafeteria' }, { ko: '식당에서 점심을 먹어요.', en: 'I have lunch at the cafeteria.' },
    { voice: true, ask: { ko: '배고파요 ㅠㅠ 밥 먹는 곳은 어디예요?', en: "I'm hungry… Where can I eat?" } }),
  w('bank', '은행', 'A', { ko: '돈을 찾고 넣는 곳', en: 'bank' }, { ko: '은행에서 돈을 찾아요.', en: 'I take out money at the bank.' },
    { voice: true, ask: { ko: '돈을 찾아야 해요. 어디로 가요?', en: 'I need to take out money. Where do I go?' } }),
  w('bookstore', '서점', 'A', { ko: '책을 사는 곳', en: 'bookstore' }, { ko: '서점에서 교과서를 사요.', en: 'I buy textbooks at the bookstore.' },
    { voice: true, ask: { ko: '새 책을 사야 해요. 어디로 가요?', en: 'I need to buy a new book. Where do I go?' } }),
  w('post', '우체국', 'A', { ko: '편지를 보내는 곳', en: 'post office' }, { ko: '우체국에서 편지를 보내요.', en: 'I send a letter at the post office.' },
    { voice: true, ask: { ko: '고향에 편지를 보내고 싶어요. 어디로 가요?', en: 'I want to send a letter home. Where do I go?' } }),
  w('pharmacy', '약국', 'A', { ko: '약을 사는 곳', en: 'pharmacy' }, { ko: '약국에서 감기약을 사요.', en: 'I buy cold medicine at the pharmacy.' },
    { voice: true, ask: { ko: '머리가 아파요 ㅠㅠ 약은 어디에서 사요?', en: 'I have a headache… Where can I buy medicine?' } }),
  w('office', '사무실', 'A', { ko: '사람들이 일하는 방', en: 'office' }, { ko: '사무실에 선생님이 계세요.', en: 'The teacher is in the office.' },
    { voice: true, ask: { ko: '학과 선생님을 만나야 해요. 일하시는 곳이 어디예요?', en: 'I need to see the department staff. Where do they work?' } }),
  w('union', '학생회관', 'life', { ko: '학생들이 모이는 건물', en: 'student union' }, { ko: '학생회관 1층에 식당이 있어요.', en: 'There is a cafeteria on the first floor of the student union.' }),
  // 정문 — 글을 얹는 고정 판(둘러보기 카드 · 인화만)
  w('university', '대학교', 'A', { ko: '대학생이 공부하는 학교', en: 'university' }, { ko: '새솔대학교는 우리 학교예요.', en: 'Saesol University is our school.' }, { voice: true }),
  w('stop', '정류장', 'A', { ko: '버스를 기다리는 곳', en: 'bus stop' }, { ko: '정류장에서 버스를 기다려요.', en: 'I wait for the bus at the bus stop.' }, { voice: true }),
  w('store', '편의점', 'life', { ko: '간식과 물을 파는 작은 가게', en: 'convenience store' }, { ko: '편의점에서 물을 사요.', en: 'I buy water at the convenience store.' }),
  // 정문 — 글 없는 물건(낱말 부탁 · 사진 → 낱말)
  w('cat', '고양이', 'A', { ko: '야옹 하고 우는 동물', en: 'cat' }, { ko: '벤치 위에 고양이가 있어요.', en: 'There is a cat on the bench.' }, { voice: true }),
  w('bench', '벤치', 'life', { ko: '밖에 있는 긴 의자', en: 'bench' }, { ko: '벤치에 앉아서 쉬어요.', en: 'I sit on the bench and rest.' }),
  w('vending', '자판기', 'life', { ko: '돈을 넣고 음료를 사는 기계', en: 'vending machine' }, { ko: '자판기에서 커피를 사요.', en: 'I buy coffee from the vending machine.' }),
  w('bike', '자전거', 'A', { ko: '두 바퀴로 타고 가는 것', en: 'bicycle' }, { ko: '자전거를 타고 학교에 가요.', en: 'I go to school by bicycle.' }, { voice: true }),
  w('tree', '나무', 'A', { ko: '가지와 잎이 있는 큰 식물', en: 'tree' }, { ko: '학교에 나무가 많아요.', en: 'There are many trees at school.' }, { voice: true }),
  w('building', '건물', 'A', { ko: '사람이 만든 큰 집', en: 'building' }, { ko: '저 건물이 도서관이에요.', en: 'That building is the library.' }, { voice: true }),
  // 정문 — 3급 안내문(받침판)
  w('n-construction', '공사 중\n후문을 이용해 주세요', 'notice', { ko: '길을 고치고 있으니 뒷문으로 가요', en: 'Under construction — please use the back gate' }, { ko: '공사 중이라서 후문으로 가요.', en: "It's under construction, so I go through the back gate." },
    { ask: { ko: '오늘 정문 앞으로 못 지나가요? 왜 그런지 안내 좀 찍어 줘요.', en: "Can't we walk past the front today? Send me the notice that explains why." } }),
  w('n-smoke', '금연 구역', 'notice', { ko: '여기서 담배를 피우면 안 돼요', en: 'No smoking area' }, { ko: '여기는 금연 구역이에요.', en: 'This is a no-smoking area.' },
    { ask: { ko: '여기서 담배를 피워도 돼요? 안내판을 찍어 줘요.', en: 'Is smoking okay here? Send me the sign.' } }),
  w('n-bike', '여기에 자전거를\n세우지 마세요', 'notice', { ko: '이 자리에 자전거를 두면 안 돼요', en: 'Do not park bicycles here' }, { ko: '여기에 자전거를 세우면 안 돼요.', en: "You can't park a bicycle here." },
    { ask: { ko: '여기에 자전거 둬도 돼요? 안내가 있으면 찍어 줘요.', en: 'Can I leave my bike here? If there is a notice, send it.' } }),
  w('n-fresh', '신입생 안내는\n학생회관 1층에서', 'notice', { ko: '새로 온 학생은 그 건물 1층으로 가요', en: 'New students: information on the union 1st floor' }, { ko: '신입생은 학생회관에서 안내를 받아요.', en: 'New students get information at the student union.' },
    { ask: { ko: '새로 온 학생은 어디에서 안내를 받아요? 그 안내를 찍어 줘요.', en: 'Where do new students get information? Send me that notice.' } }),
  // 학생회관 — 매단 안내판 · 유리문
  w('toilet', '화장실', 'A', { ko: '손을 씻고 볼일을 보는 곳', en: 'restroom' }, { ko: '화장실은 어디에 있어요?', en: 'Where is the restroom?' },
    { voice: true, ask: { ko: '손을 씻고 싶어요. 어디로 가요?', en: 'I want to wash my hands. Where do I go?' } }),
  w('stairs', '계단', 'B', { ko: '걸어서 올라가는 길', en: 'stairs' }, { ko: '계단으로 2층에 올라가요.', en: 'I go up to the second floor by the stairs.' },
    { voice: true, ask: { ko: '걸어서 위층으로 올라가고 싶어요. 어디로 가요?', en: 'I want to walk upstairs. Where do I go?' } }),
  w('entrance', '입구', 'B', { ko: '안으로 들어가는 곳', en: 'entrance' }, { ko: '입구에서 만나요.', en: "Let's meet at the entrance." },
    { voice: true, ask: { ko: '건물 안으로 들어가고 싶어요. 어디로 들어가요?', en: 'I want to go inside the building. Which way in?' } }),
  w('exit', '출구', 'life', { ko: '밖으로 나가는 곳', en: 'exit' }, { ko: '출구는 저쪽이에요.', en: 'The exit is over there.' },
    { ask: { ko: '밖으로 나가고 싶어요. 어디로 나가요?', en: 'I want to go outside. Which way out?' } }),
  w('lift', '엘리베이터', 'life', { ko: '타고 위층으로 올라가는 기계', en: 'elevator' }, { ko: '엘리베이터를 타고 5층에 가요.', en: 'I take the elevator to the fifth floor.' },
    { ask: { ko: '짐이 무거워요. 타고 올라가는 건 어디 있어요?', en: 'My bag is heavy. Where can I ride up?' } }),
  w('push', '미세요', 'life', { ko: '문을 앞으로 밀어요', en: 'Push' }, { ko: '문에 ‘미세요’라고 쓰여 있어요.', en: 'The door says “Push”.' }),
  w('pull', '당기세요', 'life', { ko: '문을 내 쪽으로 당겨요', en: 'Pull' }, { ko: '문에 ‘당기세요’라고 쓰여 있어요.', en: 'The door says “Pull”.' }),
  // 학생회관 — 글 없는 물건
  w('umbrella', '우산', 'A', { ko: '비가 올 때 쓰는 것', en: 'umbrella' }, { ko: '우산을 여기에 두세요.', en: 'Please leave your umbrella here.' }, { voice: true }),
  w('sofa', '소파', 'A', { ko: '여러 명이 앉는 푹신한 의자', en: 'sofa' }, { ko: '소파에 앉아서 기다려요.', en: 'I sit on the sofa and wait.' }, { voice: true }),
  w('water', '정수기', 'life', { ko: '마시는 물이 나오는 기계', en: 'water dispenser' }, { ko: '정수기에서 물을 마셔요.', en: 'I drink water from the water dispenser.' }),
  w('tray', '식판', 'life', { ko: '밥과 반찬을 담는 판', en: 'lunch tray' }, { ko: '식판을 들고 줄을 서요.', en: 'I hold a tray and stand in line.' }),
  w('copier', '복사기', 'life', { ko: '종이를 똑같이 찍어 내는 기계', en: 'photocopier' }, { ko: '복사기로 책을 복사해요.', en: 'I copy a book with the photocopier.' }),
  w('menu', '메뉴', 'A', { ko: '먹을 것을 적은 판', en: 'menu' }, { ko: '오늘 메뉴가 뭐예요?', en: "What's on the menu today?" }, { voice: true }),
].map(([id, value]) => [id, value])));

export const wordOf = (id) => WORDS[id] || null;
/** 화면 언어의 뜻 · 예문 뜻. 몽골어는 검문을 통과한 뒤 채운다 — 없으면 영어로 내려앉는다. */
export const pick = (field, lang) => field?.[lang] ?? field?.en ?? field?.ko ?? '';
