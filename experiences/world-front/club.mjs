/* 동아리장 알림 → 튜터 고르기 → 실력 파악 → 맞춤 (2026-11-24, 유호님 11-23 말씀 · 11-24 「추천대로 지어」).
 * 설계와 시안: qa/동아리알림시안_20261123/README.md. 화면은 메신저(밝은 종이 판)이고, 저장과 진단 기록은 모두 host(다리 world-front-club.mjs)가 한다.
 * 이 파일은 기록을 직접 읽거나 쓰지 않는다. 앞면(app.mjs)과 서울행 내 길(seoul-arrival)이 부른다.
 *   mountClub({host, state, sfx, calm, onDone}) — 처음 만남(동아리장 → 튜터 → 한글 한 문제 → 문항 넷 → 지금 여기)
 *   mountTutorDay({host, state, sfx, calm, onDone}) — 다음 날부터 튜터가 알림으로 건네는 한 가지(복습 · 내 위치 · 오늘)
 *   mountNote({state, sfx, calm, onOpen, onDrop, docked}) — 위에서 내려오는 알림(4초 뒤 작은 얼굴과 빨간 1로 접힘) */

const A = new URL('./assets/club/', import.meta.url).href;
const PH = new URL('./assets/ph/', import.meta.url).href;   // 오늘 할 일 사진(앞면 app.mjs의 assets/ph와 같은 자리)
export const CLUB_TUTORS = Object.freeze(['seoha', 'taeo', 'yuna']);
// 얼굴 동그라미: 사진에서 얼굴 가운데 · 얼굴 폭을 재어 얼굴이 지름의 2/3쯤 차게(배경 위치 = (가운데 × 크기 − 0.5) / (크기 − 1))
const FACE = {head: ['57% 25%', '230%'], seoha: ['50% 24%', '280%'], taeo: ['61% 20%', '340%'], yuna: ['53% 24%', '340%']};
const NAME = {head: {ko: '민우', en: 'Minu', mn: 'Мину'}, seoha: {ko: '서하', en: 'Seoha', mn: 'Сөха'}, taeo: {ko: '태오', en: 'Taeo', mn: 'Тэо'}, yuna: {ko: '유나', en: 'Yuna', mn: 'Юна'}};
// 맞춤 화면의 말하는 사람: 서하는 학생이 부르는 말(누나 · 언니 · 선배) 그대로, 태오 · 유나는 선배
export const tutorLabel = (t, call = '') => t === 'seoha' || !CLUB_TUTORS.includes(t) ? '서하' + (call ? ' ' + call : '') : `${NAME[t].ko} 선배`;
export const tutorFace = t => FACE[t] ? {url: `${A}${t}.webp`, pos: FACE[t][0], size: FACE[t][1]} : null;

const UI = {
  now: {ko: '방금', en: 'now', mn: 'дөнгөж сая'},
  open: {ko: '답하기', en: 'Reply', mn: 'Хариулах'},
  typing: {ko: '입력 중…', en: 'typing…', mn: 'бичиж байна…'},
  head: {ko: '동아리장', en: 'Club president', mn: 'Клубын тэргүүн'},
  whoLine: {ko: '새솔대 한국어 동아리 · 동아리장 · 4학년', en: 'Saesol Univ. Korean Club · President · 4th year', mn: 'Сэсол их сургууль · Солонгос хэлний клуб · Тэргүүн · 4-р курс'},
  tutorSub: {ko: '한국어 동아리 튜터', en: 'Korean club tutor', mn: 'Солонгос хэлний клубийн туслах'},
  joined: {ko: '{n} 선배가 대화에 들어왔어요', en: '{n} joined the chat', mn: '{n} ярианд нэгдлээ'},
  pickSmall: {ko: '한국어 동아리 튜터', en: 'Korean club tutors', mn: 'Солонгос хэлний клубийн туслахууд'},
  pickTitle: {ko: '어떻게 배우고 싶어요?', en: 'How do you want to learn?', mn: 'Хэрхэн суралцмаар байна вэ?'},
  pickSub: {ko: '가르치는 방식과 성격을 보고 골라요', en: 'Pick by teaching style and personality', mn: 'Заах арга, зан чанарыг нь хараад сонгоорой'},
  pickFirst: {ko: '선배를 골라 주세요', en: 'Pick a senior', mn: 'Ахлах оюутнаа сонгоно уу'},
  pickGo: {ko: '{n} 선배로 할게요', en: 'Go with {n}', mn: '{n}-г сонгоё'},
  pickNote: {ko: '나중에 바꿀 수 있어요', en: 'You can change this later', mn: 'Дараа нь сольж болно'},
  same: {ko: '같은 실수, 이렇게 고쳐 줘요', en: 'Same mistake, how they fix it', mn: 'Ижил алдааг ингэж засаж өгнө'},
  start: {ko: '시작', en: 'Start', mn: 'Эхлэх'},
  notyet: {ko: '아직 못 읽어요', en: 'I can’t read it yet', mn: 'Одоохондоо уншиж чадахгүй'},
  listen: {ko: '듣기', en: 'Listen', mn: 'Сонсох'},
  again: {ko: '다시 듣기', en: 'Listen again', mn: 'Дахин сонсох'},
  listenFirst: {ko: '끝까지 들은 뒤에 고를 수 있어요', en: 'Listen to the end, then choose', mn: 'Дуустал нь сонсоод сонгож болно'},
  audioOff: {ko: '소리를 틀지 못했어요. 다시 눌러 주세요', en: 'Couldn’t play the sound. Tap again', mn: 'Дуу тоглуулж чадсангүй. Дахин дарна уу'},
  next: {ko: '다음 문제', en: 'Next', mn: 'Дараагийнх'},
  done: {ko: '결과 보기', en: 'See result', mn: 'Үр дүнг харах'},
  cont: {ko: '계속', en: 'Continue', mn: 'Үргэлжлүүлэх'},
  right: {ko: '맞아요', en: 'Correct', mn: 'Зөв'},
  wrong: {ko: '아니에요', en: 'Not quite', mn: 'Буруу'},
  here: {ko: '지금 여기', en: 'You are here', mn: 'Та одоо энд'},
  topik: {ko: 'TOPIK I 시험이 보는 {t}가지 실력 가운데', en: 'Out of the {t} skills TOPIK I tests', mn: 'TOPIK I шалгалт нийт {t} чадвар шалгадаг'},
  count: {ko: '{t}칸 중 {n}칸', en: '{n} / {t}', mn: '{n} / {t}'},
  checked: {ko: '{t}칸 중 {c}칸을 봤어요', en: 'Checked {c} of {t}', mn: '{t} чадвараас {c} чадварыг шалгалаа'},
  got: {ko: '맞힘', en: 'Got it', mn: 'Зөв'},
  hangul: {ko: '한글', en: 'Hangul', mn: 'Солонгос үсэг'},
  lis: {ko: '듣기', en: 'Listening', mn: 'Сонсох'},
  rea: {ko: '읽기', en: 'Reading', mn: 'Унших'},
  nxt: {ko: '연습할 곳', en: 'To practise', mn: 'Дасгал хийх'},
  go: {ko: '맞춤 연습 시작', en: 'Start my practice', mn: 'Дасгалаа эхлэх'},
  board: {ko: '문제 보러 가기', en: 'Go to the questions', mn: 'Асуулт руу очих'},
  later: {ko: '맞춤 화면으로', en: 'Back to My practice', mn: '«Миний дасгал» руу буцах'},
  change: {ko: '튜터 바꾸기', en: 'Change tutor', mn: 'Туслахаа солих'},
  todayDiv: {ko: '오늘', en: 'Today', mn: 'Өнөөдөр'},
  review: {ko: '복습', en: 'Review', mn: 'Давтлага'},
  level: {ko: '내 위치', en: 'Where I stand', mn: 'Миний ахиц'},
  today: {ko: '오늘', en: 'Today', mn: 'Өнөөдөр'},
  practice: {ko: '짧은 연습 시작', en: 'Start a short practice', mn: 'Богино дасгал эхлэх'},
  hangulGo: {ko: '한글 이어 하기', en: 'Keep going with Hangul', mn: 'Солонгос үсгийн дасгалаа үргэлжлүүлэх'},
  levelGo: {ko: '내 위치 보기', en: 'See where I stand', mn: 'Ахицаа харах'},
  todayGo: {ko: '시작하기', en: 'Start', mn: 'Эхлэх'},
  minutes: {ko: '{n}분', en: '{n} min', mn: '{n} мин'},
  perDay: {ko: '하루 {n}분', en: '{n} min a day', mn: 'Өдөрт {n} минут'},
};
// 사람이 하는 말 — 한국어 그대로 보이고, 영어 · 몽골어 화면에서는 아래에 뜻이 붙는다
const S = {
  m1: {ko: '안녕, 나는 한국어 동아리장 민우야.', en: 'Hi, I’m Minu, president of the Korean language club.', mn: 'Сайн уу, би солонгос хэлний клубийн тэргүүн Мину байна.'},
  m2: {ko: '혹시 한국어 잘해?', en: 'Do you speak Korean well, by any chance?', mn: 'Чи солонгосоор сайн ярьдаг уу?'},
  r_some: {ko: '조금 해요', en: 'A little', mn: 'Жаахан'},
  r_none: {ko: '아직 한글도 몰라요', en: 'I can’t even read Hangul yet', mn: 'Солонгос үсэг ч одоохондоо мэдэхгүй'},
  r_good: {ko: '꽤 해요', en: 'Pretty well', mn: 'Нэлээд сайн'},
  m3_some: {ko: '좋아! 딱 맞는 선배를 붙여 줄게.', en: 'Great! I’ll match you with the right senior.', mn: 'Сайн байна! Чамд тохирох ахлах оюутныг холбож өгье.'},
  m3_none: {ko: '괜찮아, 다들 거기서 시작해. 딱 맞는 선배를 붙여 줄게.', en: 'That’s fine, everyone starts there. I’ll match you with the right senior.', mn: 'Зүгээр ээ, бүгд тэндээс эхэлдэг. Чамд тохирох ахлах оюутныг холбож өгье.'},
  m3_good: {ko: '오, 멋진데? 제대로 봐 줄 선배를 붙여 줄게.', en: 'Oh, nice! I’ll match you with a senior who’ll check properly.', mn: 'Өө, гоё шүү! Түвшнийг чинь зөв тогтоож чадах ахлах курсийн оюутантай холбож өгье.'},
  m4: {ko: '우리 동아리 튜터들이야. 마음에 드는 스타일로 한 명 골라 봐.', en: 'These are our club’s tutors. Pick one whose style you like.', mn: 'Эд нар манай клубийн туслахууд. Таалагдсан арга барилтай нэгийг нь сонго.'},
  m5: {ko: '좋아, {n} 선배한테 말해 둘게. 곧 연락 올 거야!', en: 'OK, I’ll tell {n}. You’ll hear from them soon!', mn: 'За, {n}-д хэлчихье. Удахгүй чам руу бичнэ!'},
  pick: {ko: '{n} 선배요!', en: '{n}, please!', mn: '{n}!'},
  t1: {ko: '반가워요, 저는 {n}예요.', en: 'Nice to meet you, I’m {n}.', mn: 'Танилцсандаа таатай байна, намайг {n} гэдэг.'},
  t2: {ko: '지금 어디쯤인지 같이 볼게요. 한글 하나, 문제 넷이면 돼요.', en: 'Let’s see where you are: one Hangul word and four questions.', mn: 'Таны одоогийн түвшнийг хамт харъя. Солонгос үсгээр бичсэн нэг үг, дөрвөн асуулт л байна.'},
  t2n: {ko: '한글부터 같이 봐요. 낱말 하나면 돼요.', en: 'Let’s start with Hangul. Just one word.', mn: 'Солонгос үсгээс эхэлье. Ганцхан үг.'},
  q1: {ko: '이 글자, 읽을 수 있어요?', en: 'Can you read this?', mn: 'Үүнийг уншиж чадах уу?'},
  more: {ko: '이제 문제 넷을 볼게요.', en: 'Now four questions.', mn: 'Одоо дөрвөн асуулт.'},
  hear: {ko: '잘 듣고 골라 봐요.', en: 'Listen carefully and choose.', mn: 'Сайн сонсоод сонгоорой.'},
  board: {ko: '문제는 「내 위치」에서 이어서 볼게요.', en: 'We’ll do the questions in “Where I stand”.', mn: 'Үлдсэн асуултуудад «Миний ахиц» хэсэгт хариулъя.'},
  noDiag: {ko: '지금은 더 볼 문제가 없어요. 맞춤 연습에서 같이 봐요.', en: 'No more questions right now. We’ll see in your practice.', mn: 'Одоогоор өөр асуулт алга. «Миний дасгал» хэсэгт очоод хамт дасгал хийе.'},
  fin: {ko: '다 봤어요. 고마워요!', en: 'All done. Thank you!', mn: 'Бүгд дууслаа. Баярлалаа!'},
  bell: {ko: '다음 할 일은 이 알림으로 알려 줄게요. 하루에 한 번만요.', en: 'I’ll send your next step as a notification. Once a day.', mn: 'Дараа юу хийхийг ийм мэдэгдлээр хэлж өгнө. Өдөрт нэг л удаа.'},
  lineHangul: {ko: '한글부터 같이 해요. 소리 듣고 글자 고르기예요.', en: 'Let’s start with Hangul: hear a sound, pick the letter.', mn: 'Солонгос үсгээс хамт эхэлье: авиаг сонсоод үсгийг нь сонгоно.'},
  lineAll: {ko: '다 맞혔어요! 오늘 할 일로 이어 갈게요.', en: 'All correct! Let’s go on to today’s practice.', mn: 'Бүгд зөв! Одоо өнөөдрийн дасгалаа эхэлье.'},
  lineNext: {ko: '잘 봤어요. 다음은 「{s}」{j}. 그 연습부터 같이 해요.', en: 'Nice work. Next up: {s}. Let’s start with that practice.', mn: 'Сайн байна. Дараагийнх нь «{s}». Тэр дасгалаас эхэлье.'},
};
// 알림 글(다리가 code · slots만 주고 글은 여기서 세 언어로 짓는다 — 팬 세션과 맞춘 알림 꼴)
const NOTE = {
  'club.hello': {ko: '안녕, 나는 한국어 동아리장 민우야. 혹시 한국어 잘해?', en: 'Hi, I’m Minu, president of the Korean language club. Do you speak Korean well?', mn: 'Сайн уу, би солонгос хэлний клубийн тэргүүн Мину байна. Чи солонгосоор сайн ярьдаг уу?'},
  'tutor.review.hangul': {ko: '어제 한글을 처음 만났죠? 오늘은 「택시」 한 장만 같이 읽어 봐요.', en: 'You met Hangul yesterday. Let’s read just one word today: 택시.', mn: 'Өчигдөр солонгос үсэгтэй анх танилцсан биз дээ? Өнөөдөр «택시» гэдэг ганц үгийг хамт уншаад үзье.'},
  'tutor.review.skill': {ko: '지난번 「{skill}」에서 하나 놓쳤죠? 오늘 같은 종류로 짧게 연습해 봐요.', en: 'Last time you missed one question in {skillUi}. Let’s do a short practice of the same kind today.', mn: 'Өмнөх удаа «{skillUi}» хэсэгт нэг асуулт алдсан биз дээ? Өнөөдөр ижил төрлийн богино дасгал хийгээд үзье.'},
  'tutor.level': {ko: '지난번엔 {t}칸 중 {n}칸이 채워졌어요. 지금은 어디쯤인지 같이 볼까요?', en: 'Last time {n} of {t} squares were filled. Shall we see where you are now?', mn: 'Өмнөх удаагийн дүн: {n}/{t}. Одоогийн түвшнийг тань хамт харах уу?'},
  'tutor.today': {ko: '오늘은 「{title}」 해 볼까요? {m}분이면 돼요.', en: 'How about “{title}” today? It takes {m} minutes.', mn: 'Өнөөдөр «{title}» хийж үзэх үү? {m} минут л болно.'},
  'tutor.today.nomin': {ko: '오늘은 「{title}」 해 볼까요?', en: 'How about “{title}” today?', mn: 'Өнөөдөр «{title}» хийж үзэх үү?'},
};
// 튜터 셋 — 스타일은 학습 설정(도움 방식 · 설명 길이)으로 다리가 저장한다(world-front-club.mjs TUTOR_SETTINGS와 같은 값)
const TUT = {
  seoha: {min: 10, detailed: true, per: {ko: '다정하고 꼼꼼해요', en: 'Warm and thorough', mn: 'Халамжтай, нямбай'},
    sty: {ko: '천천히, 내 말로 풀어서', en: 'Slowly, explained in your language', mn: 'Эх хэлээр тань аажмаар тайлбарлана'},
    how: [{ko: '한 번에 하나씩', en: 'One thing at a time', mn: 'Нэг удаад нэгийг'}, {ko: '설명은 자세히', en: 'Detailed explanations', mn: 'Дэлгэрэнгүй тайлбар'}],
    fix: {ko: '괜찮아요. 먹는 것에는 ‘을’을 붙여요. 빵을 먹어요.', en: 'That’s okay. What you eat takes 을: 빵을 먹어요.', mn: 'Зүгээр ээ. Идэх зүйлийн ард «을» залгана: «빵을 먹어요».'},
    ok: '맞아요!', no: '괜찮아요.'},
  taeo: {min: 5, per: {ko: '밝고 칭찬을 잘해요', en: 'Upbeat and quick to praise', mn: 'Хөгжүүн, магтах дуртай'},
    sty: {ko: '일단 말해 보고, 같이 고쳐요', en: 'Say it first, fix it together', mn: 'Эхлээд хэлж үзээд, хамт засъя'},
    how: [{ko: '바로 말해 보기', en: 'Speak right away', mn: 'Шууд ярих'}, {ko: '설명은 짧게', en: 'Short explanations', mn: 'Богино тайлбар'}],
    fix: {ko: '아깝다! ‘빵을’! 한 번 더 말해 봐요!', en: 'So close! 빵을! Say it once more!', mn: 'Бараг л зөв! «빵을»! Дахиад нэг хэлээд үзээрэй!'},
    ok: '오, 맞아요!', no: '아깝다!'},
  yuna: {min: 5, per: {ko: '똑 부러지고 솔직해요', en: 'Sharp and straightforward', mn: 'Цэгцтэй, шулуун шударга'},
    sty: {ko: '짧고 정확하게', en: 'Short and precise', mn: 'Богино, оновчтой'},
    how: [{ko: '세 문제씩', en: 'Three at a time', mn: 'Гурав гурваар'}, {ko: '틀린 곳만 짚기', en: 'Only what you missed', mn: 'Зөвхөн алдсаныг нь'}],
    fix: {ko: '‘에’ 말고 ‘을’. 빵을 먹어요. 다음.', en: 'Not 에 — 을. 빵을 먹어요. Next.', mn: '«에» биш, «을». «빵을 먹어요». Дараагийнх.'},
    ok: '맞아요.', no: '아니에요.'},
};
// 한글 한 문제 — 외래어라 낱말 뜻을 몰라도 한글을 읽으면 맞힌다. 처음 만남은 「커피」(답은 한글 답 저장으로), 다음 날 복습은 「택시」(기록 없음)
const OBJ = {coffee: {ko: '커피', en: 'coffee', mn: 'кофе'}, banana: {ko: '바나나', en: 'banana', mn: 'банана'}, taxi: {ko: '택시', en: 'taxi', mn: 'такси'}};
const HANGUL = {
  coffee: {word: '커피', ok: 'coffee', more: {ko: '받침 없는 글자는 왼쪽 소리와 오른쪽 소리를 이어 읽어요. 커 = ㅋ + ㅓ.', en: 'A block without a final consonant joins the left and right sounds: 커 = ㅋ + ㅓ.', mn: 'Дэвсгэр үсэггүй үед зүүн, баруун үсгийн авиаг нийлүүлж уншина: 커 = ㅋ + ㅓ.'},
    ex: {coffee: {ko: '「커피」는 coffee랑 소리가 같아요.', en: '커피 sounds just like “coffee”.', mn: '«커피» нь «кофе» гэдэгтэй төстэй сонсогддог.'},
      banana: {ko: '그건 「바나나」예요. 「커피」의 ㅋ은 k 소리예요.', en: 'That’s 바나나, banana. The ㅋ in 커피 is a “k” sound.', mn: 'Тэр бол «바나나». «커피» гэдэг үгийн ㅋ үсэг «к» гэж дуудагдана.'},
      taxi: {ko: '그건 「택시」예요. 「커피」의 ㅋ은 k 소리예요.', en: 'That’s 택시, taxi. The ㅋ in 커피 is a “k” sound.', mn: 'Тэр бол «택시». «커피» гэдэг үгийн ㅋ үсэг «к» гэж дуудагдана.'}}},
  taxi: {word: '택시', ok: 'taxi', more: {ko: '받침은 글자 아래에 붙어요. 택 = ㅌ + ㅐ + ㄱ.', en: 'A final consonant sits under the block: 택 = ㅌ + ㅐ + ㄱ.', mn: 'Дэвсгэр үсгийг үеийн доод талд бичнэ: 택 = ㅌ + ㅐ + ㄱ.'},
    ex: {taxi: {ko: '「택시」는 taxi랑 소리가 같아요.', en: '택시 sounds just like “taxi”.', mn: '«택시» нь «такси» гэдэгтэй төстэй сонсогддог.'},
      coffee: {ko: '그건 「커피」예요. 「택시」의 ㅌ은 t 소리예요.', en: 'That’s 커피, coffee. The ㅌ in 택시 is a “t” sound.', mn: 'Тэр бол «커피». «택시» гэдэг үгийн ㅌ үсэг «т» гэж дуудагдана.'},
      banana: {ko: '그건 「바나나」예요. 「택시」의 ㅌ은 t 소리예요.', en: 'That’s 바나나, banana. The ㅌ in 택시 is a “t” sound.', mn: 'Тэр бол «바나나». «택시» гэдэг үгийн ㅌ үсэг «т» гэж дуудагдана.'}}},
  order: {coffee: ['coffee', 'banana', 'taxi'], taxi: ['banana', 'taxi', 'coffee']},
  notyet: {ko: '괜찮아요. 그럼 한글부터 같이 해요.', en: 'That’s okay. Then let’s start with Hangul.', mn: 'Зүгээр ээ. Тэгвэл солонгос үсгээс хамт эхэлье.'},
};

/* ── 부품 ── */
// 두 틀(앞면 app.css · 서울행 style.css)의 같은 이름 클래스가 새어 들지 않게 그림자 안에 그린다. 글꼴 · 안전 여백 변수(--sans · --sat · --sab)는 그대로 물려받는다
function shadowBox(cls, parent = document.body) {
  const host = document.createElement('div'); host.className = cls;
  const sr = host.attachShadow({mode: 'open'}); const st = document.createElement('style'); st.textContent = CSS; sr.append(st);
  parent.append(host); return {host, sr};
}
function openRoot(lang) {
  document.querySelectorAll('.cl-host').forEach(n => n.remove());
  const {host, sr} = shadowBox('cl-host');
  const root = document.createElement('div'); root.className = 'cl-root'; root.setAttribute('lang', lang); sr.append(root);
  root.kill = () => host.remove();
  return root;
}
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const fill = (s, v = {}) => String(s).replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
const fillAll = (o, v) => Object.fromEntries(Object.entries(o).map(([k, s]) => [k, fill(s, v)]));
const josaYe = w => { const c = String(w).trim().slice(-1).charCodeAt(0); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 ? '이에요' : '예요'; };
const wait = ms => new Promise(r => setTimeout(r, ms));
// 알림 글: code · slots → 세 언어
export function noteText(note) {
  const code = note?.code === 'tutor.today' && !note.slots?.m ? 'tutor.today.nomin' : note?.code;
  const o = NOTE[code]; return o ? fillAll(o, note.slots || {}) : null;
}

function kit({lang, sfx, calm}) {
  const L = o => o ? (o[lang] ?? o.ko) : '';
  const mean = o => lang === 'ko' || !o || !o[lang] ? '' : `<span class="mean">${esc(o[lang])}</span>`;
  const nm = t => L(NAME[t]);
  const snd = k => { try { sfx?.(k); } catch {} };
  const sleep = ms => wait(calm() ? Math.min(ms, 60) : ms);
  const anim = (el, kf, o) => calm() || !el?.animate ? {finished: Promise.resolve()} : el.animate(kf, o);
  const face = (el, who) => { const f = tutorFace(who); if (!el || !f) return; el.style.backgroundImage = `url(${f.url})`; el.style.backgroundSize = f.size; el.style.backgroundPosition = f.pos; };
  return {lang, L, mean, nm, snd, sleep, anim, face, calm};
}

function chatShell(root, K) {
  root.innerHTML = `<section class="cl-msg" aria-live="polite"><header class="cl-hd"><span class="cl-av" data-hd-av></span><span class="cl-nm"><b data-hd-name></b><span data-hd-sub></span></span></header><div class="cl-th" data-th></div><div class="cl-ft" data-ft></div></section>`;
  const th = root.querySelector('[data-th]'), ft = root.querySelector('[data-ft]'), msg = root.querySelector('.cl-msg'), sub = root.querySelector('[data-hd-sub]');
  const scroll = () => { th.scrollTop = th.scrollHeight; };
  const header = (who, text) => { K.face(root.querySelector('[data-hd-av]'), who); root.querySelector('[data-hd-name]').textContent = K.nm(who); sub.textContent = text || ''; sub.className = ''; };
  const faceRow = (cls, who) => { const w = document.createElement('div'); w.className = cls + (th.lastElementChild?.dataset.who === who ? ' cont' : ''); return w; };
  async function typing(who, ms) {
    const keep = sub.textContent; sub.textContent = K.L(UI.typing); sub.className = 'typing';
    const w = faceRow('cl-m', who); w.innerHTML = '<span class="cl-av"></span><span class="cl-dots"><i></i><i></i><i></i></span>'; K.face(w.querySelector('.cl-av'), who); th.append(w); scroll();
    await K.sleep(ms); w.remove(); sub.textContent = keep; sub.className = '';
  }
  async function say(who, o, ms = 800) {
    await typing(who, ms);
    const w = faceRow('cl-m', who); w.dataset.who = who;
    w.innerHTML = `<span class="cl-av"></span><span class="cl-b"><span lang="ko">${esc(typeof o === 'string' ? o : o.ko)}</span>${typeof o === 'string' ? '' : K.mean(o)}</span>`; K.face(w.querySelector('.cl-av'), who); th.append(w);
    K.anim(w, [{opacity: 0, transform: 'translateY(10px)'}, {opacity: 1, transform: 'none'}], {duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)'}); K.snd('tap'); scroll(); return w;
  }
  function me(o) { const w = document.createElement('div'); w.className = 'cl-me'; w.dataset.who = 'me'; w.innerHTML = `<span lang="ko">${esc(o.ko)}</span>${K.mean(o)}`; th.append(w); K.anim(w, [{opacity: 0, transform: 'translateY(10px)'}, {opacity: 1, transform: 'none'}], {duration: 280}); K.snd('tap'); scroll(); }
  function replies(list) {
    ft.innerHTML = '';
    return new Promise(res => list.forEach((o, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'cl-rp' + (o.solid ? ' solid' : '');
      b.innerHTML = o.solid ? esc(K.L(o)) : `<span lang="ko">${esc(o.ko)}</span>${K.mean(o)}`;
      b.onclick = () => { ft.innerHTML = ''; res(o); }; ft.append(b);
      K.anim(b, [{opacity: 0, transform: 'translateY(8px)'}, {opacity: 1, transform: 'none'}], {duration: 260, delay: i * 60, fill: 'backwards'});
      if (i === 0) setTimeout(() => b.focus?.({preventScroll: true}), 30);
    }));
  }
  function sys(html) { const w = document.createElement('div'); w.className = 'cl-sys'; w.innerHTML = html; th.append(w); scroll(); return w; }
  function add(el) { th.append(el); K.anim(el, [{opacity: 0, transform: 'translateY(12px)'}, {opacity: 1, transform: 'none'}], {duration: 320}); scroll(); return el; }
  return {root, msg, th, ft, scroll, header, say, me, replies, sys, add};
}

function ctaButton(K, label, mins) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'cl-cta';
  b.innerHTML = `<span>${esc(label)}</span>${mins ? `<span class="mn">${esc(fill(K.L(UI.minutes), {n: mins}))}</span>` : ''}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>`;
  return b;
}
const CK = '<svg class="ck" viewBox="0 0 24 24" fill="none" stroke="#2f7d4f" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><svg class="xx" viewBox="0 0 24 24" fill="none" stroke="#c2412d" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>';

/* 판정: 고른 보기는 남색(그림이면 테), 틀렸으면 붉은 테와 ✕, 맞는 보기는 0.3초 늦게 초록 체크. 그 뒤 판정 줄(왜 맞는지 · 고른 말이 무엇인지)이 열린다 */
async function judge(K, C, card, {chosen, correct, good, head, lines, last, label = null}) {
  const btns = [...card.querySelectorAll('.cl-ch')];
  btns.forEach(b => b.disabled = true); card.querySelectorAll('.cl-skip').forEach(b => b.disabled = true);
  const mine = btns.find(b => b.dataset.v === chosen);
  if (mine) { mine.classList.add('mine'); if (!good) mine.classList.add('wrong'); }
  if (good) { mine?.classList.add('right'); K.snd('chime1320'); }
  else { if (mine) K.snd('flick'); await K.sleep(320); btns.find(b => b.dataset.v === correct)?.classList.add('right'); K.snd('chime880'); }
  btns.filter(b => !b.classList.contains('right') && !b.classList.contains('mine')).forEach(b => b.classList.add('dim'));
  const fb = card.querySelector('.cl-fb'), inn = fb.querySelector('.in');
  inn.innerHTML = `${head ? `<p class="v ${good ? 'ok' : 'no'}">${esc(head)}</p>` : ''}${lines.filter(Boolean).map(t => `<p>${esc(t)}</p>`).join('')}<button class="cl-nx" type="button">${esc(K.L(label || (last ? UI.done : UI.next)))}</button>`;
  const nx = inn.querySelector('.cl-nx');
  const go = new Promise(res => { nx.onclick = () => { K.snd('tap'); nx.disabled = true; K.anim(nx, [{opacity: 1}, {opacity: 0}], {duration: 180, fill: 'forwards'}).finished.then(() => nx.remove()); res(); }; });
  const h = inn.scrollHeight, tick = setInterval(C.scroll, 40);
  await K.anim(fb, [{height: '0px'}, {height: h + 'px'}], {duration: 360, easing: 'cubic-bezier(.2,.8,.2,1)'}).finished.catch(() => {});
  clearInterval(tick); fb.style.height = 'auto'; C.scroll(); nx.focus?.({preventScroll: true});
  return go;
}

// 판정 머리: 한국어 화면은 튜터의 말투(「오, 맞아요!」 · 「아깝다!」), 영어 · 몽골어 화면은 맞음 · 아님
const verdict = (K, T, good) => K.lang === 'ko' ? (good ? T.ok : T.no) : K.L(good ? UI.right : UI.wrong);
// 한글 낱말 카드 한 장(커피 · 택시). 돌려주는 값: 고른 보기(coffee · banana · taxi · notyet), 맞았는지, 「다음」을 누를 때 풀리는 약속
async function hangulCard(K, C, key, {n = 1, tutor, skip = true, last = false, label = null}) {
  const H = HANGUL[key], T = TUT[tutor];
  const card = document.createElement('section'); card.className = 'cl-card';
  card.innerHTML = `<p class="k">${n} · <b>${esc(K.L(UI.hangul))}</b></p><p class="word" lang="ko">${esc(H.word)}</p>
    <div class="chs pic">${HANGUL.order[key].map(v => `<button class="cl-ch" type="button" data-v="${v}" aria-label="${esc(K.L(OBJ[v]))}"><span class="ob" style="background-image:url(${A}obj-${v}.webp)"></span>${CK}</button>`).join('')}</div>
    ${skip ? `<button class="cl-skip" type="button" data-v="notyet"><span lang="ko">${esc(UI.notyet.ko)}</span>${K.mean(UI.notyet)}</button>` : ''}<div class="cl-fb"><div class="in"></div></div>`;
  C.add(card);
  const v = await new Promise(res => { card.querySelectorAll('.cl-ch,.cl-skip').forEach(b => b.onclick = () => res(b.dataset.v)); });
  const good = v === H.ok;
  const lines = v === 'notyet' ? [K.L(HANGUL.notyet)] : [K.L(H.ex[v]), ...(T.detailed || !good ? [K.L(H.more)] : [])];
  const next = judge(K, C, card, {chosen: v === 'notyet' ? null : v, correct: H.ok, good, head: v === 'notyet' ? '' : verdict(K, T, good), lines, last: typeof last === 'function' ? last(good) : last, label});
  return {v, good, next};
}

/* ── 처음 만남 ── */
export function mountClub({host, state, sfx, calm = () => false, onDone}) {
  const lang = state.lang || 'ko', K = kit({lang, sfx, calm});
  const root = openRoot(lang);
  const C = chatShell(root, K);
  let alive = true;
  const live = () => alive && root.isConnected;
  const byName = (o, t) => ({ko: fill(o.ko, {n: NAME[t].ko}), en: fill(o.en, {n: NAME[t].en}), mn: fill(o.mn, {n: NAME[t].mn})});
  (async () => {
    C.msg.classList.add('solo'); C.header('head', K.L(UI.now));
    const wc = document.createElement('div'); wc.className = 'cl-who';
    wc.innerHTML = `<div class="cv" style="background-image:url(${A}head.webp)"></div><div class="tx"><b>${esc(K.nm('head'))}</b><span>${esc(K.L(UI.whoLine))}</span></div>`;
    C.add(wc); await K.sleep(500); if (!live()) return;
    await C.say('head', S.m1, 650); if (!live()) return;
    await C.say('head', S.m2, 850); if (!live()) return;
    const a = await C.replies([{...S.r_some, k: 'some'}, {...S.r_none, k: 'none'}, {...S.r_good, k: 'good'}]); if (!live()) return;
    C.me(a);
    await C.say('head', S['m3_' + a.k], 900); if (!live()) return;
    await C.say('head', S.m4, 900); if (!live()) return;
    await K.sleep(400);
    const t = await pickTutor(root, K); if (!live()) return;
    void host.clubTutor?.(t, {answer: a.k});
    C.me(byName(S.pick, t));
    await C.say('head', byName(S.m5, t), 850); if (!live()) return;
    await K.sleep(700); if (!live()) return;
    const s = C.sys(`<span class="cl-av"></span><span>${esc(fill(K.L(UI.joined), {n: K.nm(t)}))}</span>`); K.face(s.querySelector('.cl-av'), t); K.snd('switch');
    C.msg.classList.remove('solo'); C.header(t, K.L(UI.tutorSub));
    await C.say(t, byName(S.t1, t), 850); if (!live()) return;
    await C.say(t, a.k === 'none' ? S.t2n : S.t2, 950); if (!live()) return;
    await C.replies([{...UI.start, solid: 1}]); if (!live()) return;
    const res = await diagnose({host, C, K, t, live}); if (!live()) return;
    await result({host, C, K, t, res, live, onDone, root});
  })().catch(e => { console.warn('[club]', e); });
  return {root, stop: () => { alive = false; try { C.audio?.pause(); } catch {} try { host.clubStop?.(); } catch {} root.kill(); }};
}

/* 튜터 고르기(11-24 유호님 「튜터 고를때 성격같은거 골라줘. 원하는 스타일(티칭) 마다 고를수있도록」): 가르치는 방식 · 성격 글이 먼저고 얼굴은 작다.
   세 장은 크기가 같고 열 때마다 순서를 섞으며 미리 골라진 쪽이 없다(이야기 지도 3-5 선배 고르기의 규칙과 같다). 고른 장에만 같은 실수를 고쳐 주는 말이 열린다 */
function pickTutor(root, K) {
  return new Promise(res => {
    const order = [...CLUB_TUTORS]; for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const sh = document.createElement('section'); sh.className = 'cl-pick'; sh.setAttribute('aria-label', K.L(UI.pickTitle));
    sh.innerHTML = `<div class="top"><small>${esc(K.L(UI.pickSmall))}</small><h3>${esc(K.L(UI.pickTitle))}</h3><p class="sub">${esc(K.L(UI.pickSub))}</p></div>
      <div class="list" role="radiogroup" aria-label="${esc(K.L(UI.pickTitle))}">${order.map(t => { const T = TUT[t]; return `<button type="button" class="tc" role="radio" aria-checked="false" data-t="${t}">
        <span class="hd"><span class="cl-av"></span><span class="nm"><b>${esc(K.nm(t))}</b><small>${esc(K.L(T.per))}</small></span><i class="rd" aria-hidden="true"></i></span>
        <span class="sty"><span lang="ko">${esc(T.sty.ko)}</span>${K.mean(T.sty)}</span>
        <span class="how">${T.how.map(h => `<span>${esc(K.L(h))}</span>`).join('')}<span>${esc(fill(K.L(UI.perDay), {n: T.min}))}</span></span>
        <span class="ex"><small>${esc(K.L(UI.same))}</small><span class="mine" lang="ko">빵에 먹어요.</span><span class="his"><span lang="ko">${esc(T.fix.ko)}</span>${K.mean(T.fix)}</span></span></button>`; }).join('')}</div>
      <div class="bot"><button class="cl-cta center" type="button" data-go disabled></button><small>${esc(K.L(UI.pickNote))}</small></div>`;
    root.append(sh);
    const go = sh.querySelector('[data-go]'), cards = [...sh.querySelectorAll('.tc')];
    let picked = null;
    const sync = () => { cards.forEach(c => c.setAttribute('aria-checked', String(c.dataset.t === picked))); go.disabled = !picked; go.textContent = picked ? fill(K.L(UI.pickGo), {n: K.nm(picked)}) : K.L(UI.pickFirst); };
    cards.forEach(c => { K.face(c.querySelector('.cl-av'), c.dataset.t); c.onclick = () => { if (picked === c.dataset.t) return; picked = c.dataset.t; sync(); K.snd('switch'); requestAnimationFrame(() => c.scrollIntoView?.({block: 'nearest', behavior: K.calm() ? 'auto' : 'smooth'})); }; });
    sh.querySelector('.list').addEventListener('keydown', e => { const i = cards.indexOf(e.target.closest?.('.tc')); if (i < 0 || !['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'].includes(e.key)) return; e.preventDefault(); cards[(i + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : cards.length - 1)) % cards.length].focus(); });
    sync(); requestAnimationFrame(() => { sh.classList.add('on'); cards[0]?.focus?.({preventScroll: true}); }); K.snd('flick');
    go.onclick = () => { if (!picked) return; root.getRootNode().activeElement?.blur?.(); sh.classList.remove('on'); setTimeout(() => sh.remove(), 520); res(picked); };
  });
}

/* 실력 파악: 한글 한 문제(답은 한글 답 저장) → 읽으면 문항 넷(다리가 「내 위치」 짧은 진단과 같은 문항 · 세션으로 고르고 기록한다) */
async function diagnose({host, C, K, t, live}) {
  const rows = [];
  await C.say(t, S.q1, 650); if (!live()) return rows;
  const h = await hangulCard(K, C, 'coffee', {n: 1, tutor: t, last: good => !good});
  void host.answerHangul?.(h.good ? 'reads' : 'new');
  rows.push({skillId: 'hangul', ok: h.good});
  await h.next; if (!live() || !h.good) return rows;
  const d = await host.clubDiag?.();
  if (!live()) return rows;
  if (d?.status === 'board') {
    await C.say(t, S.board, 700); if (!live()) return rows;
    const b = ctaButton(K, K.L(UI.board), 0); C.add(b); b.focus?.({preventScroll: true});
    await new Promise(res => { b.onclick = res; }); b.disabled = true;
    rows.board = await host.clubBoard?.() || true; return rows;
  }
  if (!d || d.status !== 'ready' || !d.item) { await C.say(t, S.noDiag, 700); return rows; }
  await C.say(t, S.more, 600);
  let item = d.item, i = 0;
  const total = d.total || 1;
  while (item && live()) {
    i += 1;
    const row = await engineItem({host, C, K, t, item, n: i + 1, last: i >= total}); if (row) rows.push(row);
    if (i >= total) break;
    item = await host.clubNext?.();
  }
  return rows;
}
async function engineItem({host, C, K, t, item, n, last}) {
  const T = TUT[t], listening = !!item.audio;
  if (listening) await C.say(t, S.hear, 450);
  const card = document.createElement('section'); card.className = 'cl-card';
  let body = '';
  if (listening) body += `<button class="cl-listen" type="button"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg><span class="lt">${esc(K.L(UI.listen))}</span><span class="bar"><i></i></span></button><p class="cl-note">${esc(K.L(UI.listenFirst))}</p>`;
  if (item.prompt) body += `<p class="pass" lang="ko">${esc(item.prompt)}</p>`;
  if (item.question) body += `<p class="qline" lang="ko">${esc(item.question)}</p>`;
  const two = (item.choices.length === 2 || item.choices.length === 4) && item.choices.every(c => String(c.label || '').length <= 5);
  if (listening) body += `<button class="cl-back cl-pass" type="button" hidden>${esc(K.L(UI.next))}</button>`;
  body += `<div class="chs${two ? ' two' : ''}" lang="ko">${item.choices.map(c => `<button class="cl-ch" type="button" data-v="${esc(c.id)}"${listening ? ' disabled' : ''}><span>${esc(c.label)}</span>${CK}</button>`).join('')}</div><div class="cl-fb"><div class="in"></div></div>`;
  card.innerHTML = `<p class="k">${n} · <b>${esc(item.label || '')}</b></p>${body}`;
  C.add(card);
  const btns = [...card.querySelectorAll('.cl-ch')], pass = card.querySelector('.cl-pass');
  let audio = null, answered = false;
  const lb = card.querySelector('.cl-listen');
  if (lb) {
    const bar = lb.querySelector('i'), note = card.querySelector('.cl-note');
    let playing = false;
    const failed = () => { if (note?.isConnected) note.textContent = K.L(UI.audioOff); if (pass && !answered) pass.hidden = false; };
    lb.onclick = async () => {
      if (playing || answered) return; K.snd('tap');
      const kind = await host.clubReplay?.(); if (!kind) { failed(); return; }
      try { audio = new Audio(item.audio); C.audio = audio; } catch { void host.clubAudio?.('failed'); failed(); return; }
      playing = true; bar.style.width = '0%';
      const end = status => { if (!playing) return; playing = false; void host.clubAudio?.(status);
        if (answered) return;
        if (status === 'completed') { bar.style.width = '100%'; btns.forEach(b => b.disabled = false); if (pass) pass.hidden = true; lb.querySelector('.lt').textContent = K.L(UI.again); note?.remove(); btns[0]?.focus?.({preventScroll: true}); }
        else failed(); };
      audio.ontimeupdate = () => { if (audio.duration) bar.style.width = (audio.currentTime / audio.duration * 100) + '%'; };
      audio.addEventListener('ended', () => end('completed'), {once: true});
      audio.addEventListener('error', () => end('failed'), {once: true});
      Promise.resolve(audio.play()).catch(() => end('failed'));
    };
  }
  const v = await new Promise(res => { btns.forEach(b => b.onclick = () => res(b.dataset.v)); if (pass) pass.onclick = () => res(null); });
  answered = true; try { audio?.pause(); } catch {}
  if (lb) lb.disabled = true;
  if (v === null) { pass.disabled = true; btns.forEach(b => b.disabled = true); K.snd('tap'); await host.clubSkip?.(); return null; }
  if (pass) pass.remove();
  const out = await host.clubAnswer?.(v) || {};
  const good = !!out.correct;
  await judge(K, C, card, {chosen: v, correct: out.correctId, good, head: verdict(K, T, good), lines: [out.explanation || ''], last});
  return {skillId: item.skillId, label: item.label, labelKo: item.labelKo || item.label, ok: good};
}

function cellsHTML(K, cells, lisN) {
  if (!cells?.length) return '';
  const row = (lb, list) => list.length ? `<span class="lb">${esc(lb)}</span><span class="cells" style="--n:${list.length}">${list.map(c => `<i data-c="${c}"></i>`).join('')}</span>` : '';
  return row(K.L(UI.lis), cells.slice(0, lisN)) + row(K.L(UI.rea), cells.slice(lisN));
}
async function result({host, C, K, t, res, live, onDone, root}) {
  if (res.board) { root.classList.add('out'); setTimeout(() => root.kill(), 420); onDone?.(typeof res.board === 'object' ? res.board : null); return; }
  await C.say(t, S.fin, 600); if (!live()) return;
  const fin = await host.clubFinish?.(res.map(r => ({skillId: r.skillId, label: r.label || '', labelKo: r.labelKo || '', ok: r.ok}))) || {};
  const cells = Array.isArray(fin.cells) ? fin.cells : [], hg = res.find(r => r.skillId === 'hangul'), tested = res.filter(r => r.skillId !== 'hangul');
  const card = document.createElement('section'); card.className = 'cl-card res';
  card.innerHTML = `<p class="k"><b>${esc(K.L(UI.here))}</b></p>${cells.length && tested.length ? `<h3>${esc(fill(K.L(UI.checked), {t: fin.total, c: tested.length}))}</h3><p class="sub">${esc(fill(K.L(UI.topik), {t: fin.total}))}</p>` : ''}
    <div class="strip"><span class="lb">${esc(K.L(UI.hangul))}</span><span><span class="hg ${hg?.ok ? 'done' : 'next'}">${esc(K.L(hg?.ok ? UI.got : UI.nxt))}</span></span>${cellsHTML(K, cells, fin.listening || 0)}</div>
    ${tested.length ? `<ul class="legend">${tested.map(r => `<li><i class="${r.ok ? 'done' : 'next'}"></i><span>${esc(r.label || '')}</span><small>${esc(K.L(r.ok ? UI.got : UI.nxt))}</small></li>`).join('')}</ul>` : ''}`;
  C.add(card);
  await K.sleep(350);
  for (const i of card.querySelectorAll('.cells i[data-c]')) { const c = i.dataset.c; if (!c) continue; i.className = c; K.anim(i, [{transform: 'scaleY(.2)', opacity: .3}, {transform: 'scaleY(1)', opacity: 1}], {duration: 260, easing: 'cubic-bezier(.3,1.5,.5,1)'}); K.snd(c === 'done' ? 'chime1320' : 'switch'); await K.sleep(140); }
  if (!live()) return;
  const miss = tested.find(r => !r.ok);
  const line = !hg?.ok ? S.lineHangul : miss ? {...fillAll(S.lineNext, {s: miss.label}), ko: fill(S.lineNext.ko, {s: miss.labelKo, j: josaYe(miss.labelKo)})} : S.lineAll;
  if (tested.length || !hg?.ok) { await C.say(t, line, 850); if (!live()) return; }
  await C.say(t, S.bell, 750); if (!live()) return;
  const go = ctaButton(K, K.L(UI.go), fin.minutes || 0); C.add(go); go.focus?.({preventScroll: true});
  go.onclick = async () => { go.disabled = true; K.snd('paper'); const next = await host.clubDone?.(); root.classList.add('out'); setTimeout(() => root.kill(), 420); onDone?.(next); };
}

/* ── 다음 날부터: 튜터 알림 한 가지 ── */
export function mountTutorDay({host, state, sfx, calm = () => false, onDone}) {
  const note = state.note || {}, t = CLUB_TUTORS.includes(note.who) ? note.who : 'seoha', lang = state.lang || 'ko', K = kit({lang, sfx, calm});
  const root = openRoot(lang);
  const C = chatShell(root, K);
  let alive = true;
  const live = () => alive && root.isConnected;
  const close = (next = null) => { root.classList.add('out'); setTimeout(() => root.kill(), 420); onDone?.(next); };
  (async () => {
    C.header(t, K.L(UI.tutorSub));
    const d = document.createElement('p'); d.className = 'cl-day'; d.textContent = K.L(UI.todayDiv); C.th.append(d);
    const text = noteText(note); if (!text) { close(); return; }
    await C.say(t, text, 650); if (!live()) return;
    let label = K.L(UI.todayGo), mins = note.slots?.m || 0;
    if (note.code === 'tutor.review.hangul') {
      const h = await hangulCard(K, C, 'taxi', {n: 1, tutor: t, label: UI.cont}); await h.next; if (!live()) return;
      label = K.L(UI.hangulGo); mins = 0;
    } else if (note.kind === 'review') { label = K.L(UI.practice); mins = 0; }
    else if (note.kind === 'level') {
      const s = note.slots || {}, cells = Array.isArray(s.cells) ? s.cells : [];
      const card = document.createElement('section'); card.className = 'cl-card res';
      card.innerHTML = `<p class="k"><b>${esc(K.L(UI.here))}</b></p><h3>${esc(fill(K.L(UI.count), {t: s.t, n: s.n}))}</h3><div class="strip">${cellsHTML(K, cells, s.listening || 0)}</div>`;
      card.querySelectorAll('.cells i[data-c]').forEach(i => { if (i.dataset.c) i.className = i.dataset.c; });
      C.add(card); label = K.L(UI.levelGo); mins = 0;
    } else if (note.kind === 'today' && note.slots?.photo) {
      const card = document.createElement('section'); card.className = 'cl-card plan';
      card.innerHTML = `<div class="pp" style="background-image:url(${PH}${esc(note.slots.photo)}.webp)"></div><div class="pb"><p class="k"><b>${esc(K.L(UI.today))}</b></p><p class="pt" lang="ko">${esc(note.slots.title)}</p></div>`;
      C.add(card);
    }
    const go = ctaButton(K, label, mins); C.add(go); go.focus?.({preventScroll: true});
    const back = document.createElement('button'); back.type = 'button'; back.className = 'cl-back'; back.textContent = K.L(UI.later); C.add(back);
    back.onclick = () => { K.snd('tap'); close(); };
    const change = document.createElement('button'); change.type = 'button'; change.className = 'cl-back'; change.textContent = K.L(UI.change); C.add(change);
    change.onclick = async () => { K.snd('tap'); const nt = await pickTutor(root, K); if (!live()) return; const r = nt !== t ? await host.clubTutor?.(nt, {change: true}) : null; close(r?.state || null); };
    go.onclick = async () => { go.disabled = true; back.disabled = true; K.snd('paper'); close(); await host.clubAct?.(note.kind, note.slots || {}); };
  })().catch(e => console.warn('[club day]', e));
  return {root, stop: () => { alive = false; root.kill(); }};
}

/* ── 알림 ── 검은 알약이 돋고 얼굴 카드로 부풀었다가 4초 뒤 위 가운데의 작은 얼굴과 빨간 1로 접힌다(드라마 「오늘」 입구 1과 같은 꼴) */
export function mountNote({state, sfx, calm = () => false, onOpen, onDrop, docked = false, parent = document.body}) {
  const note = state.note; if (!note) return null;
  const text = noteText(note); if (!text) return null;
  const lang = state.lang || 'ko', K = kit({lang, sfx, calm}), who = note.who === 'head' || CLUB_TUTORS.includes(note.who) ? note.who : 'head';
  document.querySelectorAll('.cl-host-note').forEach(n => n.remove());
  const box = shadowBox('cl-host-note', parent);
  const dim = document.createElement('div'); dim.className = 'cl-dim'; box.sr.append(dim);
  const isl = document.createElement('button'); isl.type = 'button'; isl.className = 'cl-isl';
  const tag = note.kind === 'club' ? K.L(UI.head) : K.L(UI[note.kind] || UI.today);
  isl.setAttribute('aria-label', `${K.nm(who)} · ${tag} · ${text[lang] || text.ko}`);
  isl.innerHTML = `<span class="row"><span class="fc"></span><span class="tx"><span class="nm">${esc(K.nm(who))}<span class="tag">${esc(tag)}</span><span class="tm">${esc(K.L(UI.now))}</span></span><span class="ms" lang="ko">${esc(text.ko)}</span>${lang !== 'ko' && text[lang] ? `<span class="mn">${esc(text[lang])}</span>` : ''}<span class="ft"><span>${esc(K.L(UI.open))} ›</span></span></span></span>${note.read ? '' : '<span class="badge">1</span>'}`;
  K.face(isl.querySelector('.fc'), who); box.sr.append(isl);
  const row = isl.querySelector('.row'), fc = isl.querySelector('.fc');
  const measure = () => { fc.style.transition = 'none'; fc.style.width = fc.style.height = '56px'; isl.style.setProperty('--h', Math.max(84, Math.ceil(row.scrollHeight)) + 'px'); fc.style.width = fc.style.height = ''; void fc.offsetWidth; fc.style.transition = ''; };
  measure(); document.fonts?.ready?.then(() => { if (box.host.isConnected) measure(); });
  let opened = false;
  isl.onclick = () => { if (opened) return; opened = true; K.snd('paper'); box.host.remove(); onOpen?.(); };
  const dock = () => { isl.classList.add('docked'); isl.classList.remove('open'); dim.classList.remove('on'); };
  const dispose = () => { opened = true; box.host.remove(); }, alive = () => box.host.isConnected;
  if (docked || calm()) { isl.classList.add('in', 'docked'); return {dispose, alive}; }
  (async () => {
    await wait(700); if (opened || !alive()) return; K.snd('chime880'); isl.classList.add('in');
    await wait(420); if (opened || !alive()) return; K.snd('tap'); isl.classList.add('open'); dim.classList.add('on'); onDrop?.();
    await wait(4200); if (opened || !alive()) return; isl.classList.remove('open'); dim.classList.remove('on'); await wait(560); if (!opened && alive()) { dock(); K.snd('switch'); }
  })();
  return {dispose, alive};
}

/* ── 겉 ── 밝은 종이 판. 색은 한 색 한 역할(먹 · 남색 = 나 · 초록 = 맞음 · 붉은 펜 = 짚어 줌 · 빨강 = 안 읽은 수).
 * 글은 승인 서체(--sans) 하나 안에서 목소리를 나눈다: 말풍선 600 · 튜터 스타일 한 줄 500 큰 글 · 결과 숫자 850 */
const CSS = `
:host{all:initial}
.cl-root{position:fixed;inset:0;z-index:60;background:#efece5;color:#17160f;font-family:var(--sans,system-ui,sans-serif);font-weight:500;letter-spacing:-.015em;-webkit-font-smoothing:antialiased;word-break:keep-all;transition:opacity .4s}
.cl-root.out{opacity:0;pointer-events:none}
.cl-root button{font-family:inherit;letter-spacing:inherit;-webkit-tap-highlight-color:transparent}
.cl-root button:focus-visible{outline:2.5px solid #1d2547;outline-offset:2px}
.cl-root .mean{display:block;margin-top:2px;font-weight:500;font-size:.84em;line-height:1.4;color:rgba(23,22,15,.62)}
.cl-msg{position:absolute;inset:0;display:flex;flex-direction:column;max-width:560px;margin:0 auto}
.cl-hd{flex:none;display:flex;align-items:center;gap:11px;padding:calc(16px + var(--sat,env(safe-area-inset-top,0px))) 16px 12px;box-shadow:0 1px 0 rgba(23,22,15,.1)}
.cl-av{position:relative;width:40px;height:40px;flex:none;border-radius:50%;background:#ddd center/cover no-repeat}
.cl-nm{min-width:0;flex:1}.cl-nm b{display:block;font-size:16px;font-weight:800}.cl-nm span{display:block;margin-top:1px;font-size:12.5px;font-weight:600;color:rgba(23,22,15,.62)}.cl-nm span.typing{color:#2f7d4f}
.cl-th{flex:1;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;padding:12px 16px 18px;display:flex;flex-direction:column;gap:8px;-webkit-mask-image:linear-gradient(transparent 0,#000 14px);mask-image:linear-gradient(transparent 0,#000 14px)}
.cl-th>*{flex-shrink:0}.cl-th::-webkit-scrollbar{display:none}
.cl-who{align-self:stretch;margin:4px 0 10px;border-radius:22px;overflow:hidden;background:#fffdf8;box-shadow:0 1px 0 rgba(23,22,15,.04),0 10px 24px rgba(23,22,15,.06)}
.cl-who .cv{height:210px;background:#ccc center 30%/cover no-repeat}.cl-who .tx{padding:12px 16px 14px}.cl-who b{display:block;font-size:19px;font-weight:850}.cl-who span{display:block;margin-top:2px;font-size:13.5px;font-weight:650;color:rgba(23,22,15,.66)}
.cl-m{display:flex;gap:8px;align-items:flex-start;max-width:88%}.cl-m .cl-av{width:30px;height:30px}.cl-m.cont .cl-av{visibility:hidden}.cl-msg.solo .cl-m .cl-av{display:none}
.cl-b{padding:10px 14px;border-radius:20px 20px 20px 6px;background:#fffdf8;box-shadow:0 1px 0 rgba(23,22,15,.04),0 6px 16px rgba(23,22,15,.05);font-size:16px;line-height:1.45;font-weight:600}
.cl-me{align-self:flex-end;max-width:80%;padding:10px 14px;border-radius:20px 20px 6px 20px;background:#1d2547;color:#f5f6fb;font-size:16px;line-height:1.45;font-weight:650}.cl-me .mean{color:rgba(245,246,251,.72)}
.cl-dots{display:inline-flex;gap:4px;padding:13px 14px;border-radius:20px 20px 20px 6px;background:#fffdf8}.cl-dots i{width:7px;height:7px;border-radius:50%;background:rgba(23,22,15,.35);animation:clDot 1s infinite}.cl-dots i:nth-child(2){animation-delay:.15s}.cl-dots i:nth-child(3){animation-delay:.3s}
@keyframes clDot{40%{transform:translateY(-4px);background:rgba(23,22,15,.6)}}
.cl-sys{align-self:center;display:flex;align-items:center;gap:8px;margin:6px 0;font-size:12.5px;font-weight:650;color:rgba(23,22,15,.66)}.cl-sys .cl-av{width:24px;height:24px}
.cl-day{align-self:center;margin:6px 0;padding:4px 11px;border-radius:999px;background:rgba(23,22,15,.06);font-size:12px;font-weight:700;color:rgba(23,22,15,.62)}
.cl-ft{flex:none;padding:12px 12px calc(16px + var(--sab,env(safe-area-inset-bottom,0px)));display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;min-height:76px;box-sizing:border-box;box-shadow:0 -1px 0 rgba(23,22,15,.1)}.cl-ft:empty{box-shadow:none}
.cl-rp{display:flex;flex-direction:column;align-items:flex-end;justify-content:center;min-height:46px;padding:8px 16px;border:0;border-radius:22px;background:rgba(29,37,71,.09);color:#1d2547;font-size:15.5px;font-weight:750;text-align:right;cursor:pointer}
.cl-rp .mean{color:rgba(29,37,71,.7);font-size:12.5px}.cl-rp.solid{min-width:120px;align-items:center;background:#1d2547;color:#f5f6fb}
.cl-card{align-self:stretch;margin-left:38px;padding:16px;border-radius:22px;background:#fffdf8;box-shadow:0 1px 0 rgba(23,22,15,.04),0 10px 24px rgba(23,22,15,.06)}
.cl-card .k{display:flex;align-items:center;gap:8px;margin:0;font-size:12.5px;font-weight:600;color:rgba(23,22,15,.62);font-variant-numeric:tabular-nums}.cl-card .k b{font-weight:700;color:rgba(23,22,15,.66)}
.cl-card .word{margin:14px 0 4px;font-size:44px;font-weight:800;letter-spacing:-.02em;text-align:center}
.cl-card .pass{margin:12px 0 2px;padding:12px 14px;border-radius:14px;background:rgba(23,22,15,.045);font-size:16px;line-height:1.6;font-weight:600;white-space:pre-wrap}
.cl-card .qline{margin:12px 0 0;font-size:16.5px;font-weight:800}
.cl-listen{display:flex;align-items:center;gap:10px;margin:14px 0 2px;min-height:52px;width:100%;padding:0 16px;border:0;border-radius:16px;background:rgba(23,22,15,.05);font-size:15.5px;font-weight:750;color:inherit;cursor:pointer}
.cl-listen svg{width:22px;height:22px;flex:none}.cl-listen .bar{flex:1;height:4px;border-radius:2px;background:rgba(23,22,15,.1);overflow:hidden}.cl-listen .bar i{display:block;height:100%;width:0;background:#17160f}
.cl-note{margin:6px 0 0;font-size:13px;font-weight:600;color:rgba(23,22,15,.62)}
.cl-root .chs{display:grid;gap:8px;margin-top:14px}.cl-root .chs.pic{grid-template-columns:repeat(3,1fr)}.cl-root .chs.two{grid-template-columns:1fr 1fr}
.cl-ch{position:relative;min-width:0;overflow-wrap:anywhere;min-height:52px;padding:10px 14px;border:0;border-radius:14px;background:#fffdf8;box-shadow:inset 0 0 0 1.5px rgba(23,22,15,.12);font-size:16.5px;font-weight:750;line-height:1.35;color:inherit;text-align:left;display:flex;align-items:center;gap:8px;cursor:pointer;transition:background .2s,box-shadow .2s,color .2s,opacity .2s}
.chs.pic .cl-ch{justify-content:center;padding:6px}.chs.two .cl-ch{justify-content:center;text-align:center;padding:10px 28px}
.cl-ch .ob{display:block;width:100%;aspect-ratio:1;border-radius:10px;background:#e9e6dc center/cover no-repeat}
.cl-ch .ck,.cl-ch .xx{width:22px;height:22px;flex:none;opacity:0}.chs.pic .ck,.chs.pic .xx{position:absolute;right:7px;top:7px;z-index:1;background:#fffdf8;border-radius:50%;padding:2px}
.chs:not(.pic) .ck,.chs:not(.pic) .xx{margin-left:auto}.chs.two .ck,.chs.two .xx{position:absolute;right:8px}
.chs:not(.pic) .cl-ch .ck,.chs:not(.pic) .cl-ch .xx{display:none}.chs:not(.pic) .cl-ch.right .ck,.chs:not(.pic) .cl-ch.mine.wrong .xx{display:block}
.cl-ch .ck path{stroke-dasharray:24;stroke-dashoffset:24}
.cl-ch.mine{background:#1d2547;color:#f5f6fb;box-shadow:none}.chs.pic .cl-ch.mine{background:#fffdf8;box-shadow:inset 0 0 0 2.5px #1d2547}
.cl-ch.mine.wrong{background:#fffdf8;color:#c2412d;box-shadow:inset 0 0 0 2px #c2412d}.chs.pic .cl-ch.mine.wrong{box-shadow:inset 0 0 0 2.5px #c2412d}.cl-ch.mine.wrong .xx{opacity:1}
.cl-ch.right .ck{opacity:1}.cl-ch.right .ck path{stroke-dashoffset:0;transition:stroke-dashoffset .38s cubic-bezier(.2,.8,.2,1)}.cl-ch.right:not(.mine){box-shadow:inset 0 0 0 2px #2f7d4f}
.cl-ch.mine.right:not(.wrong){background:#fffdf8;color:#17160f;box-shadow:inset 0 0 0 2.5px #2f7d4f}
.cl-ch.dim{opacity:.45}.cl-ch:disabled{cursor:default}
.cl-skip{margin-top:10px;min-height:40px;padding:0 14px;border:0;border-radius:999px;background:none;box-shadow:inset 0 0 0 1.5px rgba(23,22,15,.12);font-size:14.5px;font-weight:700;color:rgba(23,22,15,.66);cursor:pointer;text-align:left}
.cl-fb{overflow:hidden;height:0}.cl-fb .in{padding-top:12px;margin-top:12px;border-top:1px solid rgba(23,22,15,.1)}
.cl-fb .v{margin:0;font-size:15px;font-weight:800}.cl-fb .v.ok{color:#2f7d4f}.cl-fb .v.no{color:#c2412d}.cl-fb p{margin:5px 0 0;font-size:15px;line-height:1.55;font-weight:600}
.cl-nx{margin-top:12px;min-height:44px;width:100%;border:0;border-radius:999px;background:#17160f;color:#fbf8f1;font-size:15px;font-weight:750;cursor:pointer}
.cl-card.res h3{margin:10px 0 0;font-size:30px;font-weight:850;letter-spacing:-.035em;font-variant-numeric:tabular-nums}
.cl-card.res .sub{margin:4px 0 0;font-size:13px;font-weight:500;color:rgba(23,22,15,.62)}
.cl-root .strip{display:grid;grid-template-columns:auto 1fr;gap:8px 12px;align-items:center;margin-top:16px}.cl-root .strip .lb{font-size:13.5px;font-weight:750;color:rgba(23,22,15,.66)}
.cl-root .cells{display:grid;grid-template-columns:repeat(var(--n,8),1fr);gap:4px}.cl-root .cells i{height:22px;border-radius:5px;background:rgba(23,22,15,.07)}.cl-root .cells i.done{background:#17160f}.cl-root .cells i.next{background:#fffdf8;box-shadow:inset 0 0 0 2px #c2412d}
.hg{display:inline-flex;align-items:center;height:28px;padding:0 11px;border-radius:999px;font-size:13.5px;font-weight:750}.hg.done{background:#17160f;color:#fbf8f1}.hg.next{box-shadow:inset 0 0 0 2px #c2412d;color:#c2412d}
.cl-root .legend{display:flex;flex-direction:column;gap:6px;margin:14px 0 0;padding:0;list-style:none}.cl-root .legend li{display:flex;align-items:center;gap:8px;font-size:14.5px;font-weight:650}.cl-root .legend li i{width:12px;height:12px;border-radius:3px;flex:none}.cl-root .legend li i.done{background:#17160f}.cl-root .legend li i.next{box-shadow:inset 0 0 0 2px #c2412d}.cl-root .legend li small{margin-left:auto;flex:none;white-space:nowrap;padding-left:8px;font-size:12.5px;color:rgba(23,22,15,.62)}
.cl-card.plan{padding:0;overflow:hidden}.cl-card.plan .pp{height:150px;background:#ddd center/cover}.cl-card.plan .pb{padding:14px 16px 16px}.cl-card.plan .pt{margin:6px 0 0;font-size:20px;font-weight:850}
.cl-cta{display:flex;align-items:center;gap:10px;width:100%;min-height:56px;padding:0 20px;border:0;border-radius:999px;background:#17160f;color:#fbf8f1;font-size:16.5px;font-weight:800;cursor:pointer;flex-shrink:0}
.cl-cta.center{justify-content:center}.cl-cta .mn{margin-left:auto;font-size:13px;font-weight:600;color:rgba(251,248,241,.6);font-variant-numeric:tabular-nums}.cl-cta svg{width:16px;height:16px;flex:none}.cl-cta:not(.center) svg{margin-left:auto}.cl-cta .mn+svg{margin-left:0}
.cl-back{align-self:center;min-height:44px;padding:0 16px;border:0;background:none;font-size:14.5px;font-weight:700;color:rgba(23,22,15,.6);cursor:pointer}
.cl-pick{position:absolute;inset:0;z-index:5;max-width:560px;margin:0 auto;background:#efece5;transform:translateY(100%);visibility:hidden;transition:transform .5s cubic-bezier(.2,.9,.2,1),visibility 0s .5s;display:flex;flex-direction:column}
.cl-pick.on{transform:none;visibility:visible;transition:transform .5s cubic-bezier(.2,.9,.2,1)}
.cl-pick .top{padding:calc(20px + var(--sat,env(safe-area-inset-top,0px))) 20px 10px}.cl-pick .top small{display:block;font-size:13px;font-weight:700;color:rgba(23,22,15,.62)}.cl-pick .top h3{margin:4px 0 0;font-size:24px;font-weight:850;letter-spacing:-.02em}
.cl-pick .top .sub{margin:6px 0 0;font-size:14px;font-weight:600;color:rgba(23,22,15,.6)}
.cl-pick .list{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding:6px 20px 8px;scrollbar-width:none}
.cl-pick .list::-webkit-scrollbar{display:none}
.cl-pick .tc{display:flex;flex-direction:column;align-items:stretch;gap:8px;width:100%;padding:14px 16px 15px;border:0;border-radius:22px;background:#fffdf8;box-shadow:0 6px 20px rgba(23,22,15,.06),inset 0 0 0 1px rgba(23,22,15,.08);text-align:left;font:inherit;color:#17160f;cursor:pointer;flex:none}
.cl-pick .tc[aria-checked="true"]{box-shadow:0 8px 24px rgba(23,22,15,.1),inset 0 0 0 2px #17160f}
.cl-pick .tc .hd{display:flex;align-items:center;gap:10px}
.cl-pick .tc .cl-av{width:40px;height:40px;flex:none}
.cl-pick .tc .nm{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1}
.cl-pick .tc .nm b{font-size:15.5px;font-weight:800}
.cl-pick .tc .nm small{font-size:13px;font-weight:650;color:rgba(23,22,15,.6)}
.cl-pick .tc .rd{width:22px;height:22px;flex:none;border-radius:50%;box-shadow:inset 0 0 0 1.5px rgba(23,22,15,.28)}
.cl-pick .tc[aria-checked="true"] .rd{background:#17160f;box-shadow:inset 0 0 0 6px #17160f,inset 0 0 0 11px #fffdf8}
.cl-pick .tc .sty{display:block;font-size:19px;font-weight:600;letter-spacing:-.035em;line-height:1.3}
.cl-pick .tc .sty .mean{letter-spacing:-.01em}
.cl-pick .tc .how{display:flex;flex-wrap:wrap;gap:6px}
.cl-pick .tc .how span{display:inline-flex;align-items:center;height:26px;padding:0 9px;border-radius:999px;background:rgba(23,22,15,.055);font-size:12.5px;font-weight:700;color:rgba(23,22,15,.66)}
.cl-pick .tc .ex{display:none;flex-direction:column;gap:6px;margin-top:4px;padding-top:10px;border-top:1px solid rgba(23,22,15,.1)}
.cl-pick .tc[aria-checked="true"] .ex{display:flex}
.cl-pick .tc .ex small{font-size:12px;font-weight:700;color:rgba(23,22,15,.62)}
.cl-pick .tc .ex .mine{align-self:flex-end;padding:7px 12px;border-radius:16px 16px 5px 16px;background:#1d2547;color:#f5f6fb;font-size:14px;font-weight:700}
.cl-pick .tc .ex .his{align-self:flex-start;max-width:92%;padding:9px 12px;border-radius:16px 16px 16px 5px;background:rgba(23,22,15,.055);font-size:14.5px;font-weight:700;line-height:1.4}
.cl-cta:disabled{background:rgba(23,22,15,.14);color:rgba(23,22,15,.62);cursor:default}
.cl-pick .bot{flex:none;padding:12px 20px calc(16px + var(--sab,env(safe-area-inset-bottom,0px)))}.cl-pick .bot small{display:block;margin-top:8px;text-align:center;font-size:12.5px;font-weight:650;color:rgba(23,22,15,.62)}
.cl-dim{position:fixed;inset:0;z-index:58;background:rgba(243,238,230,.3);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);opacity:0;pointer-events:none;transition:opacity .5s}.cl-dim.on{opacity:1}
.cl-isl{position:fixed;z-index:59;left:50%;top:calc(10px + var(--sat,env(safe-area-inset-top,0px)));width:52px;height:52px;margin-left:-26px;padding:0;border:0;border-radius:28px;background:#060709;color:#FAFAF9;font-family:var(--sans,system-ui,sans-serif);letter-spacing:-.015em;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.12),inset 0 0 0 1px rgba(255,255,255,.08),0 18px 44px rgba(0,0,0,.35);overflow:hidden;transform:scale(0);transition:transform .38s cubic-bezier(.3,1.5,.5,1),width .6s cubic-bezier(.3,1.2,.5,1),height .6s cubic-bezier(.3,1.2,.5,1),margin-left .6s cubic-bezier(.3,1.2,.5,1),border-radius .6s}
.cl-isl.in{transform:scale(1)}.cl-isl.open{width:min(366px,calc(100vw - 24px));height:var(--h,128px);margin-left:calc(min(366px,calc(100vw - 24px)) / -2);border-radius:30px}
.cl-isl .row{display:flex;gap:12px;align-items:flex-start;padding:12px 14px 12px 12px;width:min(366px,calc(100vw - 24px));box-sizing:border-box}
.cl-isl .fc{width:28px;height:28px;flex:none;border-radius:50%;background:#333 center/cover no-repeat;transition:width .5s,height .5s}.cl-isl.open .fc{width:56px;height:56px}
.cl-isl .tx{min-width:0;flex:1;opacity:0;transition:opacity .3s}.cl-isl.open .tx{opacity:1;transition-delay:.25s}
.cl-isl .nm{display:flex;align-items:center;gap:7px;font-size:14px;font-weight:650;color:rgba(250,250,249,.82)}.cl-isl .tag{font-size:12.5px;font-weight:600;color:rgba(250,250,249,.55)}.cl-isl .tag::before{content:'· '}
.cl-isl .tm{margin-left:auto;font-size:12.5px;color:rgba(250,250,249,.55)}.cl-isl .ms{display:block;margin:5px 0 0;font-size:16px;line-height:1.42;font-weight:700}.cl-isl .mn{display:block;margin:4px 0 0;font-size:13px;line-height:1.45;color:rgba(250,250,249,.62)}
.cl-isl .ft{display:flex;margin-top:9px}.cl-isl .ft span{margin-left:auto;display:inline-flex;align-items:center;height:32px;padding:0 14px;border-radius:999px;background:#FAFAF9;color:#08090C;font-size:13px;font-weight:750}
.cl-isl.docked{overflow:visible}.cl-isl.docked .row{padding:0;width:52px;height:52px;align-items:center;justify-content:center}.cl-isl.docked .fc{width:44px;height:44px}.cl-isl.docked .tx{display:none}
.cl-isl .badge{position:absolute;top:-3px;right:-3px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#ff3b30;color:#fff;font-size:12px;font-weight:700;line-height:20px;text-align:center;box-shadow:0 0 0 2.5px #060709;transform:scale(0);transition:transform .42s cubic-bezier(.3,1.6,.5,1) .12s;box-sizing:border-box}
.cl-isl.docked .badge{transform:scale(1)}
@media (prefers-reduced-motion:reduce){.cl-isl,.cl-pick,.cl-dim,.cl-root,.cl-isl .badge{transition:none}.cl-dots i{animation:none}}
`;
