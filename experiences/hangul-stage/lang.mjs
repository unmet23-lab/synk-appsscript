// 한글 만나기 화면 언어 · 1판(2026-10-19 「WORLD 화면 언어」, docs/공개판_설계.md §6). 10-03 「한글 단계는 한국어로 MVP」를 대신한다.
// 1판 범위: 안내(입구·문항 지시·단추) · 이유 한 줄(회차 시작과 판정 띠) · 마무리(결과·졸업) · 글자 설명(만나기 카드).
// 한글 글자·음절·낱말·노래 제목은 학습 내용이라 늘 한국어다. 노래 화면과 게임 튜터 대사는 2판이다.
// WORLD 안(같은 출처 iframe)에서는 WORLD가 저장한 언어를 그대로 읽는다(brand-opening/world-lang.mjs와 같은 저장 키·언어 목록 —
// qa/world-lang.test.mjs가 대조한다). 게임이 혼자 열려도 돌도록 이 파일은 다른 모듈을 부르지 않는다. 주소의 ?lang=en은 이번 화면만.
export const LANGS=Object.freeze(['en','mn','ko']);
export const LANG_KEY='synk.world.lang';
const supported=value=>LANGS.includes(value)?value:null;
function resolve(){
 try{const query=supported(new URLSearchParams(globalThis.location?.search||'').get('lang'));if(query)return query;}catch{}
 try{const saved=supported(globalThis.localStorage?.getItem(LANG_KEY));if(saved)return saved;}catch{}
 return 'ko';
}
let current=null;
const missing=new Map();
export function currentLang(){if(!current)current=resolve();return current;}
// 시험용: 언어를 정해 둔다(저장하지 않는다).
export function useLang(value){current=supported(value)||'ko';return current;}
export function missingStrings(){return [...missing.values()];}

export const STRINGS={
 'docTitle':{ko:'한글 단계 · SYNK WORLD',en:'Meet Hangul · SYNK WORLD',mn:'Солонгос үсэг · SYNK WORLD'},
 'effects':{ko:'효과음 켜고 끄기',en:'Turn sound effects on or off',mn:'Дууны эффектийг асаах, унтраах'},
 'heroTitle':{ko:'한글 만나기',en:'Meet Hangul',mn:'Солонгос үсэгтэй танилцах'},
 'heroGraduated':{ko:'한글 졸업',en:'Hangul done',mn:'Солонгос үсгийн курсээ төгслөө'},
 'lede.default':{ko:'소리를 듣고 글자를 고르고, 직접 만들어요.',en:'Hear a sound, pick the letter, and build it yourself.',mn:'Авиа сонсоод үсгийг сонгож, өөрөө бүтээнэ.'},
 'lede.graduated':{ko:'헷갈리기 쉬운 글자를 짧게 풀어요.',en:'A quick go at letters that are easy to mix up.',mn:'Андуурахад амархан үсгүүдийг богино хугацаанд давтана.'},
 'lede.now':{ko:'지금 만날 글자: {unit}. 듣고, 고르고, 직접 만들어요.',en:'Letters to meet now: {unit}. Listen, choose, and build them yourself.',mn:'Одоо танилцах үсэг: {unit}. Сонсож, сонгож, өөрөө бүтээнэ.'},
 'start.doneToday':{ko:'오늘 분량 끝',en:'Done for today',mn:'Өнөөдрийнх дууслаа'},
 'start.warmup':{ko:'몸풀기 시작하기',en:'Start the warm-up',mn:'Халаалт эхлэх'},
 'start.again':{ko:'한 번 더 하기',en:'One more time',mn:'Дахин нэг удаа'},
 'start.continue':{ko:'이어서 하기',en:'Continue',mn:'Үргэлжлүүлэх'},
 'start.start':{ko:'시작하기',en:'Start',mn:'Эхлэх'},
 'start.sub':{ko:'{n}문제 · {min}분쯤',en:'{n} questions · about {min} min',mn:'{n} асуулт · {min} минут орчим'},
 'start.subDone':{ko:'하루에 풀 수 있는 회차를 다 했어요',en:'You’ve done all of today’s sessions',mn:'Өнөөдрийн бүх хичээлээ хийлээ'},
 'toGames':{ko:'미니게임 하러 가기',en:'Go to mini games',mn:'Мини тоглоом руу очих'},
 'gamesNote':{ko:'놀이 목록의 바람길·말의 리듬으로 이어서 연습해요.',en:'Keep practicing with Wind Run and Speech Rhythm in the Play list.',mn:'Тоглоомын жагсаалтын «Салхин зам», «Үгийн хэмнэл»-ээр үргэлжлүүлэн дасгал хийгээрэй.'},
 'section.songs':{ko:'노래',en:'Songs',mn:'Дуу'},
 'section.songsFine':{ko:'노래에 맞춰 글자가 켜져요',en:'Letters light up with the song',mn:'Дууны хэмнэлээр үсгүүд асна'},
 'section.road':{ko:'한글 길',en:'Hangul road',mn:'Үсгийн зам'},
 'section.box':{ko:'글자 상자',en:'Letter box',mn:'Үсгийн хайрцаг'},
 'section.boxFine':{ko:'누르면 소리가 나요',en:'Tap a letter to hear it',mn:'Үсэг дээр дарвал авиа нь сонсогдоно'},
 'section.legend':{ko:'글자 상태',en:'Letter status',mn:'Үсгийн төлөв'},
 'section.signs':{ko:'마을 간판',en:'Town signs',mn:'Хотхоны самбар'},
 'section.signsFine':{ko:'글자를 다 익히면 읽혀요',en:'You can read them once you know all their letters',mn:'Бүх үсгийг нь сурвал уншигдана'},
 'section.plate':{ko:'내 명패',en:'My name plate',mn:'Миний нэрийн самбар'},
 'section.plateFine':{ko:'익힌 글자가 채워져요',en:'It fills up with the letters you learn',mn:'Сурсан үсгээр тань дүүрнэ'},
 'section.amount':{ko:'한 번에 풀 문제',en:'Questions per session',mn:'Нэг удаад хариулах асуулт'},
 'amount':{ko:'{n}문제',en:'{n} questions',mn:'{n} асуулт'},
 'skip':{ko:'한글을 이미 읽을 수 있어요',en:'I can already read Hangul',mn:'Би солонгос үсэг уншиж чадна'},
 'skipped':{ko:'한글 단계를 건너뛰었어요.',en:'You skipped the Hangul stage.',mn:'Та солонгос үсгийн шатыг алгаслаа.'},
 'unskip':{ko:'다시 배우기',en:'Learn it again',mn:'Дахин сурах'},
 'saveNote.failed':{ko:'이 기기에 진도를 저장하지 못했어요. 이번 접속에서만 이어져요.',en:'Couldn’t save progress on this device. It only continues during this visit.',mn:'Энэ төхөөрөмжид явцыг хадгалж чадсангүй. Зөвхөн энэ удаад үргэлжилнэ.'},
 'saveNote.none':{ko:'이 화면에서는 진도가 저장되지 않아요.',en:'Progress isn’t saved on this screen.',mn:'Энэ дэлгэц дээр явц хадгалагдахгүй.'},
 'voice.unsupported':{ko:'이 브라우저는 소리를 낼 수 없어요. 다른 브라우저로 열어 주세요.',en:'This browser can’t play sound. Please open it in another browser.',mn:'Энэ хөтөч дуу гаргаж чадахгүй. Өөр хөтчөөр нээнэ үү.'},
 'voice.missing':{ko:'이 기기에서 한국어 소리를 낼 수 없어요. 기기 설정에서 한국어 음성을 받으면 소리가 나요.',en:'This device can’t play Korean speech. Download a Korean voice in your device settings to hear it.',mn:'Энэ төхөөрөмж солонгос хэлээр дуу гаргаж чадахгүй. Төхөөрөмжийн тохиргооноос солонгос хэлний дуу хоолой татаж авбал дуу гарна.'},
 'state.unmet':{ko:'아직 안 만남',en:'not met yet',mn:'хараахан танилцаагүй'},
 'state.met':{ko:'만남',en:'met',mn:'танилцсан'},
 'state.learning':{ko:'익히는 중',en:'learning',mn:'сурч байна'},
 'state.mastered':{ko:'익힘',en:'learned',mn:'сурсан'},
 'legend.met':{ko:'만남',en:'Met',mn:'Танилцсан'},
 'legend.learning':{ko:'익히는 중',en:'Learning',mn:'Сурч байна'},
 'legend.mastered':{ko:'익힘',en:'Learned',mn:'Сурсан'},
 'final':{ko:'받침 {glyph}',en:'final {glyph}',mn:'эцсийн гийгүүлэгч {glyph}'},
 'road.done':{ko:'다 익힘',en:'learned',mn:'сурсан'},
 'road.now':{ko:'지금',en:'now',mn:'одоо'},
 'road.started':{ko:'배우는 중',en:'learning',mn:'сурч байна'},
 'road.next':{ko:'다음',en:'next',mn:'дараа нь'},
 'road.later':{ko:'준비 중',en:'coming soon',mn:'удахгүй'},
 'road.graduated':{ko:'졸업했어요',en:'Graduated',mn:'Төгссөн'},
 'road.current':{ko:'지금: {unit}',en:'Now: {unit}',mn:'Одоо: {unit}'},
 'road.allLearned':{ko:'한글 글자를 다 익혔어요',en:'You’ve learned all the Hangul letters',mn:'Та бүх солонгос үсгийг сурлаа'},
 'group.vowel':{ko:'모음',en:'Vowels',mn:'Эгшиг'},
 'group.consonant':{ko:'자음',en:'Consonants',mn:'Гийгүүлэгч'},
 'group.final':{ko:'받침',en:'Final consonants',mn:'Эцсийн гийгүүлэгч'},
 'tag.final':{ko:'받침',en:'Final',mn:'Төгсгөл'},
 'song.listen':{ko:'{title} 노래 듣기',en:'Listen to {title}',mn:'{title} дууг сонсох'},
 'sign.read':{ko:'{text} 간판, 눌러서 듣기',en:'{text} sign, tap to hear',mn:'«{text}» самбар, дарж сонсох'},
 'sign.hazy':{ko:'아직 흐린 간판',en:'A sign that’s still blurry',mn:'Одоохондоо бүдэг самбар'},
 'sign.tap':{ko:'눌러서 듣기',en:'Tap to hear',mn:'Дарж сонсох'},
 'sign.notYet':{ko:'아직 흐려요',en:'Still blurry',mn:'Одоохондоо бүдэг'},
 'unit.U1':{ko:'기본 모음',en:'Basic vowels',mn:'Үндсэн эгшиг'},
 'unit.U2':{ko:'자음 하나',en:'Consonants 1',mn:'Гийгүүлэгч 1'},
 'unit.U3':{ko:'자음 둘',en:'Consonants 2',mn:'Гийгүүлэгч 2'},
 'unit.U4':{ko:'모음 더하기',en:'More vowels',mn:'Нэмэлт эгшиг'},
 'unit.U5':{ko:'거센소리',en:'Aspirated consonants',mn:'Амьсгалт гийгүүлэгч'},
 'unit.U6':{ko:'받침 하나',en:'Final consonants 1',mn:'Эцсийн гийгүүлэгч 1'},
 'unit.U7':{ko:'받침 둘',en:'Final consonants 2',mn:'Эцсийн гийгүүлэгч 2'},
 'unit.U8':{ko:'된소리',en:'Tense consonants',mn:'Чанга гийгүүлэгч'},
 'unit.U9':{ko:'겹모음',en:'Combined vowels',mn:'Хос эгшиг'},
 'unit.U10':{ko:'첫 문장',en:'First sentence',mn:'Анхны өгүүлбэр'},
 // 이유 한 줄(회차 시작). 한국어는 core.mjs가 만든 글 그대로다.
 'reason.warmup':{ko:'몸풀기예요. 헷갈리기 쉬운 글자를 짧게 봐요.',en:'Warm-up time. A quick look at letters that are easy to mix up.',mn:'Халаалтын цаг. Андуурахад амархан үсгүүдийг товч харна.'},
 'reason.pair.now':{ko:'방금 헷갈린 글자예요. 오늘 다시 해요.',en:'You just mixed these letters up. Let’s go over them again today.',mn:'Эдгээр үсгийг дөнгөж сая андуурлаа. Өнөөдөр дахин давтъя.'},
 'reason.pair.yesterday':{ko:'어제 헷갈린 글자예요. 오늘 다시 해요.',en:'You mixed these letters up yesterday. Let’s go over them again today.',mn:'Эдгээр үсгийг өчигдөр андуурсан. Өнөөдөр дахин давтъя.'},
 'reason.pair.before':{ko:'지난번에 헷갈린 글자예요. 오늘 다시 해요.',en:'You mixed these letters up last time. Let’s go over them again today.',mn:'Эдгээр үсгийг өмнөх удаа андуурсан. Өнөөдөр дахин давтъя.'},
 'reason.newFinals':{ko:'오늘은 새 받침을 만나요.',en:{one:'Today you’ll meet 1 new final consonant.',other:'Today you’ll meet {n} new final consonants.'},mn:'Өнөөдөр {n} шинэ эцсийн гийгүүлэгчтэй танилцана.'},
 'reason.mixed':{ko:'다시 볼 글자와 새 글자예요.',en:'Letters to review, and new letters.',mn:'Давтах үсэг ба шинэ үсэг.'},
 'reason.new':{ko:'오늘은 새 글자를 만나요.',en:{one:'Today you’ll meet 1 new letter.',other:'Today you’ll meet {n} new letters.'},mn:'Өнөөдөр {n} шинэ үсэгтэй танилцана.'},
 'reason.due':{ko:'다시 만날 때가 된 글자예요.',en:'These letters are due for another look.',mn:'Дахин харах цаг нь болсон үсэг.'},
 'reason.practice':{ko:'아는 글자로 연습해요.',en:'Practice with letters you know.',mn:'Мэддэг үсгээрээ дасгал хийнэ.'},
 // 만나기 카드
 'listenTo':{ko:'{text} 듣기',en:'Hear {text}',mn:'«{text}» сонсох'},
 'listenSound':{ko:'{text} 소리 듣기',en:'Hear the sound {text}',mn:'«{text}» авиаг сонсох'},
 'newLetter':{ko:'새 글자 {glyph}',en:'New letter {glyph}',mn:'Шинэ үсэг {glyph}'},
 'newFinal':{ko:'새 받침 {glyph}',en:'New final consonant {glyph}',mn:'Шинэ эцсийн гийгүүлэгч {glyph}'},
 'trace':{ko:'따라 써 봐요',en:'Trace it',mn:'Даган бичээрэй'},
 'traceRedo':{ko:'다시 쓰기',en:'Clear and write again',mn:'Арилгаад дахин бичих'},
 'traceArea':{ko:'{glyph} 따라 쓰는 칸',en:'Space to trace {glyph}',mn:'{glyph}-г даган бичих талбай'},
 'derive.stroke':{ko:'{a}에 획을 더하면 {b}',en:'{a} plus one stroke makes {b}',mn:'{a} дээр нэг зураас нэмбэл {b}'},
 'derive.pair':{ko:'{a}과 {b}은 짝',en:'{a} and {b} are a pair',mn:'{a}, {b} хоёр хос'},
 'derive.twin':{ko:'{a}을 둘 쓰면 {b}',en:'{a} written twice makes {b}',mn:'{a}-г хоёр бичвэл {b}'},
 'derive.combine':{ko:'{a}와 {b}를 합치면 {c}',en:'{a} and {b} together make {c}',mn:'{a}, {b}-г нийлүүлбэл {c}'},
 'trio':{ko:'{sounds} 세 소리 견주기',en:'Compare three sounds: {sounds}',mn:'Гурван авиаг харьцуулах: {sounds}'},
 'trioTag':{ko:'세 소리',en:'3 sounds',mn:'3 авиа'},
 'sum':{ko:'아에 받침 {glyph}을 붙이면 {voice}',en:'Add final {glyph} to 아 to make {voice}',mn:'아 дээр эцсийн гийгүүлэгч {glyph} нэмбэл {voice}'},
 'note.c-ng':{ko:'첫소리 ㅇ은 소리가 없어요. 아는 ㅏ와 같은 소리예요.',en:'At the start of a syllable, ㅇ is silent, so 아 sounds just like ㅏ.',mn:'Үеийн эхэнд ㅇ дуугүй тул 아 нь ㅏ-тай адилхан дуудагдана.'},
 'note.f-ng':{ko:'받침 ㅇ은 소리가 있어요. 소리가 없는 첫소리 ㅇ과 달라요.',en:'Final ㅇ has a sound (ng). It’s different from the silent ㅇ at the start of a syllable.',mn:'Эцсийн гийгүүлэгч ㅇ дуутай (нг). Үеийн эхний дуугүй ㅇ-ээс ялгаатай.'},
 'note.f-g':{ko:'받침 ㄱ은 소리를 막고 끝내요. 터뜨리지 않아요.',en:'Final ㄱ stops the sound without letting it out.',mn:'Эцсийн гийгүүлэгч ㄱ дууг тасалж дуусгана. Гадагш гаргахгүй.'},
 'note.f-d':{ko:'받침 ㄷ은 소리를 막고 끝내요. 터뜨리지 않아요.',en:'Final ㄷ stops the sound without letting it out.',mn:'Эцсийн гийгүүлэгч ㄷ дууг тасалж дуусгана. Гадагш гаргахгүй.'},
 'note.f-b':{ko:'받침 ㅂ은 입을 다물고 끝내요. 터뜨리지 않아요.',en:'Final ㅂ ends with your lips closed, without letting the sound out.',mn:'Эцсийн гийгүүлэгч ㅂ-г уруулаа хамхиж дуусгана. Гадагш гаргахгүй.'},
 'note.f-s':{ko:'받침 ㅅ은 받침 ㄷ과 같은 소리로 읽어요.',en:'Final ㅅ is read with the same sound as final ㄷ.',mn:'Эцсийн гийгүүлэгч ㅅ-г эцсийн гийгүүлэгч ㄷ-тэй ижил дуугаар уншина.'},
 'note.f-j':{ko:'받침 ㅈ도 받침 ㄷ과 같은 소리로 읽어요.',en:'Final ㅈ is read like final ㄷ, too.',mn:'Эцсийн гийгүүлэгч ㅈ-г ч эцсийн гийгүүлэгч ㄷ шиг уншина.'},
 'note.c-k':{ko:'ㄱ에 획을 하나 더하면 ㅋ. 숨을 세게 내보내요.',en:'Add one stroke to ㄱ and you get ㅋ. Breathe out strongly.',mn:'ㄱ дээр нэг зураас нэмбэл ㅋ болно. Амьсгалаа хүчтэй гаргана.'},
 'note.c-t':{ko:'ㄷ에 획을 하나 더하면 ㅌ. 숨을 세게 내보내요.',en:'Add one stroke to ㄷ and you get ㅌ. Breathe out strongly.',mn:'ㄷ дээр нэг зураас нэмбэл ㅌ болно. Амьсгалаа хүчтэй гаргана.'},
 'note.c-p':{ko:'ㅍ은 ㅂ보다 숨을 세게 내보내요.',en:'ㅍ uses a stronger breath than ㅂ.',mn:'ㅍ-г ㅂ-ээс илүү хүчтэй амьсгалаар дуудна.'},
 'note.c-ch':{ko:'ㅈ에 획을 하나 더하면 ㅊ. 숨을 세게 내보내요.',en:'Add one stroke to ㅈ and you get ㅊ. Breathe out strongly.',mn:'ㅈ дээр нэг зураас нэмбэл ㅊ болно. Амьсгалаа хүчтэй гаргана.'},
 'note.c-kk':{ko:'ㄱ을 둘 쓰면 ㄲ. 목에 힘을 주고, 숨은 내보내지 않아요.',en:'Write ㄱ twice and you get ㄲ. Tense your throat and don’t let air out.',mn:'ㄱ-г хоёр бичвэл ㄲ болно. Хоолойгоо чангалж, амьсгал гаргахгүй.'},
 'note.c-tt':{ko:'ㄷ을 둘 쓰면 ㄸ. 목에 힘을 주고, 숨은 내보내지 않아요.',en:'Write ㄷ twice and you get ㄸ. Tense your throat and don’t let air out.',mn:'ㄷ-г хоёр бичвэл ㄸ болно. Хоолойгоо чангалж, амьсгал гаргахгүй.'},
 'note.c-pp':{ko:'ㅂ을 둘 쓰면 ㅃ. 목에 힘을 주고, 숨은 내보내지 않아요.',en:'Write ㅂ twice and you get ㅃ. Tense your throat and don’t let air out.',mn:'ㅂ-г хоёр бичвэл ㅃ болно. Хоолойгоо чангалж, амьсгал гаргахгүй.'},
 'note.c-ss':{ko:'ㅅ을 둘 쓰면 ㅆ. ㅅ보다 힘을 주어 단단하게 내요.',en:'Write ㅅ twice and you get ㅆ. Say it firmer and stronger than ㅅ.',mn:'ㅅ-г хоёр бичвэл ㅆ болно. ㅅ-ээс илүү хүчтэй, чанга дуудна.'},
 'note.c-jj':{ko:'ㅈ을 둘 쓰면 ㅉ. 목에 힘을 주고, 숨은 내보내지 않아요.',en:'Write ㅈ twice and you get ㅉ. Tense your throat and don’t let air out.',mn:'ㅈ-г хоёр бичвэл ㅉ болно. Хоолойгоо чангалж, амьсгал гаргахгүй.'},
 'note.v-wa':{ko:'오와 아를 빨리 이어 말하면 와.',en:'Say 오 and 아 quickly together and you get 와.',mn:'오, 아-г хурдан холбож хэлбэл 와 болно.'},
 'note.v-wo':{ko:'우와 어를 빨리 이어 말하면 워.',en:'Say 우 and 어 quickly together and you get 워.',mn:'우, 어-г хурдан холбож хэлбэл 워 болно.'},
 'note.v-wi':{ko:'우와 이를 빨리 이어 말하면 위.',en:'Say 우 and 이 quickly together and you get 위.',mn:'우, 이-г хурдан холбож хэлбэл 위 болно.'},
 'note.v-ui':{ko:'으와 이를 빨리 이어 말하면 의.',en:'Say 으 and 이 quickly together and you get 의.',mn:'으, 이-г хурдан холбож хэлбэл 의 болно.'},
 'note.v-oe':{ko:'ㅗ와 ㅣ를 합쳤지만, 소리는 「우에」를 빨리 말한 소리예요.',en:'It joins ㅗ and ㅣ, but it sounds like 우에 said quickly.',mn:'ㅗ, ㅣ-г нийлүүлсэн боловч «우에»-г хурдан хэлсэн мэт дуудагдана.'},
 'note.v-wae':{ko:'오와 애를 빨리 이어 말하면 왜.',en:'Say 오 and 애 quickly together and you get 왜.',mn:'오, 애-г хурдан холбож хэлбэл 왜 болно.'},
 'note.v-we':{ko:'우와 에를 빨리 이어 말하면 웨.',en:'Say 우 and 에 quickly together and you get 웨.',mn:'우, 에-г хурдан холбож хэлбэл 웨 болно.'},
 'note.v-ye':{ko:'ㅔ에 획을 하나 더하면 ㅖ. ㅓ가 ㅕ가 되는 것과 같아요.',en:'Add one stroke to ㅔ and you get ㅖ, just as ㅓ becomes ㅕ.',mn:'ㅔ дээр нэг зураас нэмбэл ㅖ болно. ㅓ нь ㅕ болдогтой адил.'},
 'note.v-yae':{ko:'ㅐ에 획을 하나 더하면 ㅒ. ㅏ가 ㅑ가 되는 것과 같아요.',en:'Add one stroke to ㅐ and you get ㅒ, just as ㅏ becomes ㅑ.',mn:'ㅐ дээр нэг зураас нэмбэл ㅒ болно. ㅏ нь ㅑ болдогтой адил.'},
 'note.sameSound':{ko:'{letters}는 소리가 같아요. 낱말마다 쓰는 글자가 정해져 있어요.',en:'{letters} sound the same. Each word always uses the same one.',mn:'{letters} адилхан дуудагдана. Үг бүрд аль үсгийг бичих нь тогтсон байдаг.'},
 'note.finalIntro':{ko:'받침은 글자 아래에 붙는 끝소리예요.',en:'A final consonant (받침) is the ending sound written under a syllable.',mn:'Эцсийн гийгүүлэгч (받침) нь үеийн доор бичигддэг төгсгөлийн дуу.'},
 // 문항 안내
 'prompt.pair':{ko:'헷갈리는 두 소리예요. 들은 쪽을 골라요',en:'Two sounds that are easy to confuse. Pick the one you heard',mn:'Андуурахад амархан хоёр дуу. Сонссоноо сонгоорой'},
 'prompt.teach':{ko:'몽글이 헷갈려요. 들은 것을 골라 알려 줘요',en:'Mongle is confused. Pick what you heard to help',mn:'Монгль андуураад байна. Сонссоноо сонгож туслаарай'},
 'prompt.word':{ko:'소리를 듣고 맞는 낱말을 골라요',en:'Listen and pick the right word',mn:'Сонсоод зөв үгийг сонгоорой'},
 'prompt.letter':{ko:'소리를 듣고 맞는 글자를 골라요',en:'Listen and pick the right letter',mn:'Сонсоод зөв үсгийг сонгоорой'},
 'prompt.see':{ko:'글자를 보고 맞는 소리를 골라요',en:'Look at the letter and pick the right sound',mn:'Үсгийг хараад зөв авиаг сонгоорой'},
 'prompt.build':{ko:'들은 소리를 만들어요',en:'Build the sound you heard',mn:'Сонссон авиагаа бүтээгээрэй'},
 'prompt.match':{ko:'소리와 글자를 짝지어요',en:'Match the sounds to the letters',mn:'Авиа, үсгийг хослуулаарай'},
 'speak':{ko:'소리 듣기',en:'Hear the sound',mn:'Авиа сонсох'},
 'slow':{ko:'천천히 듣기',en:'Listen slowly',mn:'Удаан сонсох'},
 'noFinal':{ko:'{text}, 받침 없음',en:'{text}, no final consonant',mn:'{text}, эцсийн гийгүүлэгчгүй'},
 'held':{ko:'몽글이 든 글자 {letter}',en:'The letter Mongle is holding: {letter}',mn:'Монгль найзын барьж буй үсэг: {letter}'},
 'soundN':{ko:'{n}번 소리',en:'Sound {n}',mn:'{n}-р авиа'},
 'letterN':{ko:'글자 {text}',en:'Letter {text}',mn:'{text} үсэг'},
 'col.sounds':{ko:'소리',en:'Sounds',mn:'Дуу'},
 'col.letters':{ko:'글자',en:'Letters',mn:'Үсэг'},
 'next':{ko:'다음',en:'Next',mn:'Дараах'},
 'check':{ko:'확인',en:'Check',mn:'Шалгах'},
 'quit':{ko:'그만하기',en:'Stop',mn:'Зогсоох'},
 // 판정 띠의 한 줄 + 이유 한 줄
 'ok':{ko:'맞아요',en:'Correct',mn:'Зөв'},
 'mongleGotIt':{ko:'몽글이 알았어요',en:'Mongle got it',mn:'Монгль ойлголоо'},
 'answerIs':{ko:'정답은 {target}',en:'The answer is {target}',mn:'Зөв хариулт: {target}'},
 'thisSound':{ko:'{target}은 이 소리예요',en:'{target} sounds like this',mn:'{target} ингэж дуудагдана'},
 'notButIs':{ko:'{made}가 아니라 {target}예요',en:'Not {made}, but {target}',mn:'{made} биш, {target}'},
 'allMatched':{ko:'다 맞췄어요',en:'All matched',mn:'Бүгдийг тааруулсан'},
 'allFound':{ko:'다 찾았어요',en:'All found',mn:'Бүгдийг олсон'},
 'why.heard':{ko:'‘{target}’를 들었어요.',en:'It was ‘{target}’.',mn:'«{target}» гэж сонсогдсон.'},
 'why.sound':{ko:'‘{target}’ 소리예요.',en:'That’s the sound ‘{target}’.',mn:'Энэ бол «{target}» авиа.'},
 'why.compare':{ko:'고른 ‘{chosen}’와 정답 소리를 차례로 들려줘요.',en:'You’ll hear ‘{chosen}’, the one you picked, and then the right sound.',mn:'Таны сонгосон «{chosen}», дараа нь зөв авиаг сонсгоно.'},
 'why.again':{ko:'‘{target}’ 소리를 한 번 더 들려줘요.',en:'You’ll hear the sound ‘{target}’ once more.',mn:'«{target}» авиаг дахин нэг удаа сонсгоно.'},
 'why.compareSound':{ko:'고른 소리와 정답 소리를 차례로 들려줘요.',en:'You’ll hear the sound you picked, then the right one.',mn:'Таны сонгосон авиа, дараа нь зөв авиаг сонсгоно.'},
 'why.built':{ko:'‘{target}’를 만들었어요.',en:'You built ‘{target}’.',mn:'Та «{target}»-г бүтээлээ.'},
 'why.compareBuilt':{ko:'만든 소리와 정답 소리를 차례로 들려줘요.',en:'You’ll hear the sound you built, then the right one.',mn:'Таны бүтээсэн авиа, дараа нь зөв авиаг сонсгоно.'},
 'why.matchedClean':{ko:'짝 {n}개를 한 번에 맞췄어요.',en:{one:'You matched 1 pair on the first try.',other:'You matched all {n} pairs on the first try.'},mn:'{n} хосыг эхний оролдлогоор тааруулсан.'},
 'why.matchedFound':{ko:'짝 {n}개를 모두 찾았어요.',en:{one:'You found the 1 pair.',other:'You found all {n} pairs.'},mn:'{n} хосыг бүгдийг нь олсон.'},
 // 마무리
 'finish.newLetters':{ko:'새 글자 {n}개, 끝!',en:{one:'1 new letter, done!',other:'{n} new letters, done!'},mn:'{n} шинэ үсэг, дууслаа!'},
 'finish.questions':{ko:'{n}문제, 끝!',en:{one:'1 question, done!',other:'{n} questions, done!'},mn:'{n} асуулт, дууслаа!'},
 'finish.reviewTitle':{ko:'다시 볼 글자',en:'A letter to look at again',mn:'Дахин харах үсэг'},
 'finish.reviewNote':{ko:'헷갈린 글자예요. 눌러서 소리를 다시 들어 봐요.',en:'You mixed this one up. Tap it to hear the sound again.',mn:'Андуурсан үсгүүд. Дарж авиаг нь дахин сонсоорой.'},
 'finish.mastered':{ko:'새로 익힌 글자',en:'Letters you just learned',mn:'Шинээр сурсан үсэг'},
 'finish.canRead':{ko:'이제 읽을 수 있어요',en:'Now you can read it',mn:'Одоо уншиж чадна'},
 'finish.tomorrow':{ko:'다음에 만날 글자',en:'Letters coming next',mn:'Дараа танилцах үсэг'},
 'finish.allMet':{ko:'한글 글자를 다 만났어요.',en:'You’ve met every Hangul letter.',mn:'Та бүх солонгос үсэгтэй танилцлаа.'},
 'finish.toTown':{ko:'우리 동네로',en:'To our town',mn:'Манай хотхон руу'},
 'finish.toStart':{ko:'처음으로 가기',en:'Back to the start',mn:'Эхлэл рүү буцах'},
 'finish.again':{ko:'한 번 더 하기',en:'One more time',mn:'Дахин нэг удаа'},
 'finish.song':{ko:'노래로 복습하기 · {title} 30초',en:'Review with a song · {title} 30 s',mn:'Дуу сонсож давтах · {title} 30 секунд'},
 'grad.title':{ko:'한글 단계, 졸업!',en:'Hangul stage complete!',mn:'Солонгос үсгийн шатыг давлаа!'},
 'grad.line':{ko:'이제 받침이 있는 낱말도 읽을 수 있어요.',en:'Now you can read words with final consonants, too.',mn:'Одоо эцсийн гийгүүлэгчтэй үгийг ч уншиж чадна.'},
 'grad.fine':{ko:'헷갈리기 쉬운 글자는 가끔 짧은 몸풀기로 다시 만나요. 글자 상자는 그대로 남아요.',en:'Letters that are easy to mix up come back now and then in a short warm-up. Your letter box stays.',mn:'Андуурахад амархан үсгүүд хааяа богино халаалтаар дахин гарч ирнэ. Үсгийн хайрцаг хэвээр үлдэнэ.'},
 'grad.note':{ko:'바람길·말의 리듬으로 이어서 연습해요.',en:'Keep practicing with Wind Run and Speech Rhythm.',mn:'«Салхин зам», «Үгийн хэмнэл»-ээр үргэлжлүүлэн дасгал хийгээрэй.'},
 'error.title':{ko:'한글 단계를 열지 못했어요',en:'Couldn’t open Meet Hangul',mn:'Солонгос үсгийн хэсгийг нээж чадсангүй'},
 'error.body':{ko:'필요한 파일을 불러오지 못했어요. 새로고침해 주세요.',en:'Some files didn’t load. Please refresh the page.',mn:'Шаардлагатай файлыг ачаалж чадсангүй. Хуудсаа дахин ачаална уу.'},
 'sheet.title':{ko:'한글을 읽을 수 있나요?',en:'Can you read Hangul?',mn:'Та солонгос үсэг уншиж чадах уу?'},
 'sheet.body':{ko:'읽을 수 있으면 이 단계를 건너뛰어도 돼요. 나중에 언제든 다시 배울 수 있어요.',en:'If you can, you can skip this stage. You can come back and learn anytime.',mn:'Уншиж чадвал энэ шатыг алгасаж болно. Хүссэн үедээ эргэн ирж сурч болно.'},
 'sheet.skip':{ko:'건너뛰기',en:'Skip',mn:'Алгасах'},
 'sheet.stay':{ko:'계속 배우기',en:'Keep learning',mn:'Үргэлжлүүлэн сурах'},
};

function fill(text,vars){
 if(text&&typeof text==='object')text=vars?.n===1&&text.one!=null?text.one:text.other;
 return String(text??'').replace(/\{(\w+)\}/g,(_,name)=>vars&&vars[name]!=null?String(vars[name]):'');
}
export function t(key,vars,lang=currentLang()){
 const entry=Object.hasOwn(STRINGS,key)?STRINGS[key]:null;
 if(!entry){missing.set(`*:${key}`,{key,lang:'*'});return fill(key,vars);}
 let text=entry[lang];
 if(text==null||text===''){if(lang!=='ko')missing.set(`${lang}:${key}`,{key,lang});text=entry.ko;}
 return fill(text,vars);
}
// index.html의 data-i18n(글자) · data-i18n-label(aria-label)을 지금 언어로. 한국어면 원문을 그대로 둔다.
export function translatePage(root=globalThis.document){
 if(!root?.querySelectorAll)return;
 const lang=currentLang();
 if(root.documentElement)root.documentElement.lang=lang;
 if(lang==='ko')return;
 if(root.title!==undefined)root.title=t('docTitle');
 for(const node of root.querySelectorAll('[data-i18n]'))node.textContent=t(node.dataset.i18n);
 for(const node of root.querySelectorAll('[data-i18n-label]'))node.setAttribute('aria-label',t(node.dataset.i18nLabel));
}
