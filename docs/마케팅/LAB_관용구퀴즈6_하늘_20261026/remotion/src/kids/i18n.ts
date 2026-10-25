// 키즈판 화면 글: 영어판(@synkkorean)과 몽골어판(@synk.mn · SYNK 페이스북). 한국어(관용구·예문·해요체)는 두 판 모두 그대로 둔다.
// 몽골어는 할하 키릴(10-13 Fable 검토 반영: хэтэрхий 뺌, ㅜ=ү, шилэмгий→шаардлага өндөртэй). 한국어 발음은 몽골에서 서울을 «Сөүл»로 적는 관례대로 ㅓ를 ө로 적는다. 글꼴: Inter Tight가 키릴(Ө·Ү 포함)을 갖고 있고 DM Mono는 없어서 몽골어 자리엔 모노를 쓰지 않는다.
import type { Question } from '../film/data';
import { EXAM, HANDLE, QUESTIONS, RECAP } from '../film/data';
import { LOCALES, type LocCode } from './locales';

export type KidsLang = 'en' | 'mn' | LocCode;

export type KidsUi = {
  guess3: string;
  nope: string;
  question: string;
  sayIt: string;
  clearHud: string;
  level: (n: number) => string;
  finish: string;
  stageClear: string;
  howMany: string;
  comment: string;
  commentSize: number;
  gotThis: string;
  exam: string;
  handle: string;
  monoFallback: boolean; // 모노 글꼴(DM Mono)에 없는 글자를 쓰는 판
  next: string; // v4 다음 문제 미리보기 카드
  scoreNext: string; // v4 마지막 문제의 미리보기(점수)
  yourTurn: string; // v4 SAY IT 뒤 따라 말할 차례
  hud: string; // 게임 판 이름(위쪽 알약)
};

const UI: Record<'en' | 'mn', KidsUi> = {
  en: {
    guess3: 'GUESS IN 3 SECONDS!',
    nope: 'NOPE!',
    question: 'What does it really mean?',
    sayIt: 'SAY IT',
    clearHud: 'CLEAR!',
    level: (n) => `LEVEL ${n}!`,
    finish: 'FINISH!',
    stageClear: 'STAGE CLEAR!',
    howMany: 'How many did you get?',
    comment: 'Comment your score ↓',
    commentSize: 60,
    gotThis: 'See you next round!',
    exam: EXAM.name,
    handle: HANDLE,
    monoFallback: false,
    next: 'NEXT ▶',
    scoreNext: 'SCORE ▶',
    yourTurn: 'YOUR TURN',
    hud: EXAM.name,
  },
  mn: {
    guess3: '3 СЕКУНДЭД ТААГААРАЙ!',
    nope: 'БУРУУ!',
    question: 'Жинхэнэ утга нь юу вэ?',
    sayIt: 'ДАВТААРАЙ',
    clearHud: 'ДУУСЛАА!',
    level: (n) => `${n}-Р ШАТ!`,
    finish: 'ДУУСЛАА!',
    stageClear: 'АМЖИЛТТАЙ!',
    howMany: 'Хэдийг нь зөв таасан бэ?',
    comment: 'Оноогоо сэтгэгдэлд бичээрэй ↓',
    commentSize: 46,
    gotThis: 'Дараагийн шатанд уулзъя!',
    exam: 'ХЭЛЦ ҮГ #6',
    handle: '@synk.mn',
    monoFallback: true,
    next: 'ДАРААХ ▶',
    scoreNext: 'ОНОО ▶',
    yourTurn: 'ЧИНИЙ ЭЭЛЖ',
    hud: 'ХЭЛЦ ҮГ #6',
  },
};

/** 몽골어판에서 바꾸는 칸(관용구·예문·해요체 한국어는 그대로). 관용구 퀴즈 #6(10-26) — 순서는 data.ts(바람 · 별 · 해), 모든 판 같음.
 *  보기는 두 낱말 안팎, 해요체 발음은 앞 편처럼 ㅓ=ө·ㅐㅔ=э·ㅡ=ы로 적고 소리 나는 대로(맞았어요 [마자써요], 하늘의 [하느레], 서쪽에서 [서쪼게서]). ㄸ·ㅃ·ㅉ은 тт·пп·жж.
 *  뜻 풀이는 몽골어로 다시 쓴다(제작 방식 v2 §4-3). */
const MN: { parts: [string, string]; guess: string; options: string[]; gloss: string; say: string; recap: string }[] = [
  {
    // 바람맞다 — 말할 때 [바람마자써요]. «салхинд цохиулах»는 몽골어 굳은 말(바람 쐬어 몸살 나다, mongoltoli)이라 보기 «Ханиад хүрэх»와 짝인 강한 함정이 된다(10-26 Opus 역번역).
    //   정답 보기는 다른 둘과 같은 동사원형 두 낱말로(«Хүлээсэн хүн ирэхгүй»는 혼자 완결문이라 튀었다).
    parts: ['салхи', 'цохиулах'],
    guess: 'салхинд цохиулах?',
    options: ['Ханиад хүрэх', 'Дэмий хүлээх', 'Үс сэгсийх'],
    gloss: 'Хоёр цаг хүлээсэн чинь ирсэнгүй!',
    say: 'барам мажассөё',
    recap: 'дэмий хүлээх',
  },
  {
    // 하늘의 별 따기 — [하느레 별 따기예요]. 몽골어 «тэнгэрээс од шүүрэх»는 「드문 행운 · 꾀바름」이라 그 말을 딱지로 두고 오답 «Маш их азтай»(아주 운이 좋다)를 짝으로 —
    //   1번 문제와 같은 「몽골어로 읽은 오답」 함정. «түүх»는 혼자 놓이면 「역사」로 읽혀 «шүүрэх»로(Opus 역번역 안 A).
    parts: ['тэнгэрийн од', 'шүүрэх'],
    guess: 'тэнгэрээс од шүүрэх?',
    options: ['Маш их азтай', 'Олоход маш хэцүү', 'Их өндөр нуруутай'],
    gloss: 'Концертын тасалбар авахад үнэхээр хэцүү!',
    say: 'ханырэ бёл ттагиеё',
    recap: 'олоход маш хэцүү',
  },
  {
    // 해가 서쪽에서 뜨다 — 말할 때 [해가 서쪼게서 뜨게써요]. 몽골어에도 같은 뜻의 굳은 말 «нар баруунаас гарах»가 있어(위키사전 · 기초사전 몽골어판 «нар баруунаас мандах»)
    //   글자 그대로 옮긴 딱지가 곧 정답이 된다 — 간체판처럼 엉뚱한 글자 해석 «Дэлхий буцаж эргэх?»(지구가 거꾸로 도나?)로 두고, 「몽골어도 같다」는 게시글로.
    //   정답은 «Огт болдоггүй зүйл»(「해선 안 되는 일」로도 읽힘) 대신 «Байж боломгүй зүйл болох», 보기 꼴은 모두 동사원형.
    parts: ['нар баруунаас', 'мандах'],
    guess: 'Дэлхий буцаж эргэх?',
    options: ['Унтаж хоцрох', 'Цаг агаар муудах', 'Байж боломгүй зүйл болох'],
    gloss: 'Дүү маань аяга таваг\nугаачихсан гэж үү?\nИтгэмээргүй!', // 자동 줄바꿈이 의문 꼬리 «гэж / үү?»를 갈랐다(Fable) — 줄 자리를 준다(KidsQuestion 풀이 pre-line)
    say: 'хэга сөжжогэсө ттыгэссөё',
    recap: 'байж боломгүй',
  },
];

/** 현지어판(locales.ts)의 화면 글을 영어판 칸에 맞춘다. 끝 화면 계정은 채널마다 KidsFilm handle로 바꾼다. */
const locUi = (code: LocCode): KidsUi => {
  const u = LOCALES[code].ui;
  return {
    ...u,
    level: (n) => u.level.replace('{n}', String(n)),
    commentSize: u.commentSize ?? 60,
    exam: u.quiz,
    hud: u.quiz,
    handle: HANDLE,
    monoFallback: /[^\x20-\x7E]/.test(u.quiz + u.sayIt + u.yourTurn), // DM Mono는 라틴 기본 글자만 믿는다
  };
};

export const kidsUi = (lang: KidsLang): KidsUi => (lang === 'en' || lang === 'mn' ? UI[lang] : locUi(lang));

/** 화면 글 글꼴 줄(KidsFilm이 --kids-font로 깐다). 영어·몽골어·라틴·키릴은 Inter Tight, 그 밖의 글자는 윈도 설치 글꼴. */
export const kidsFont = (lang: KidsLang): string | undefined => (lang === 'en' || lang === 'mn' ? undefined : LOCALES[lang].font);

export const kidsQuestions = (lang: KidsLang, _mnNavel?: string): Question[] =>
  lang === 'en'
    ? QUESTIONS
    : lang !== 'mn'
    ? QUESTIONS.map((q, i) => {
        const l = LOCALES[lang].q[i];
        return {
          ...q,
          parts: q.parts.map(([ko], k) => [ko, l.parts[k]] as [string, string]),
          guess: l.guess,
          options: q.options.map((o, k) => ({ ...o, text: l.options[k], short: l.options[k] })),
          gloss: l.gloss,
          say: [q.say[0], l.say] as [string, string],
        };
      })
    : QUESTIONS.map((q, i) => ({
        ...q,
        parts: q.parts.map(([ko], k) => [ko, MN[i].parts[k]] as [string, string]),
        guess: MN[i].guess,
        options: q.options.map((o, k) => ({ ...o, text: MN[i].options[k], short: MN[i].options[k] })), // short에 영어 짧은 보기가 남지 않게
        gloss: MN[i].gloss,
        say: [q.say[0], MN[i].say] as [string, string],
      }));

export const kidsRecap = (lang: KidsLang): string[] => (lang === 'en' ? RECAP : lang === 'mn' ? MN.map((m) => m.recap) : LOCALES[lang].q.map((m) => m.recap));
