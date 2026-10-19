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
    exam: 'ХЭЛЦ ҮГ #3',
    handle: '@synk.mn',
    monoFallback: true,
    next: 'ДАРААХ ▶',
    scoreNext: 'ОНОО ▶',
    yourTurn: 'ЧИНИЙ ЭЭЛЖ',
    hud: 'ХЭЛЦ ҮГ #3',
  },
};

/** 몽골어판에서 바꾸는 칸(관용구·예문·해요체 한국어는 그대로). 관용구 퀴즈 #3(10-19) 초안 — 순서는 data.ts(미역국 · 식은 죽 · 김칫국).
 *  보기는 두 낱말 안팎, 해요체 발음은 퀴즈 #2처럼 ㅓ=ө·ㅐㅔ=э로 적고 소리 나는 대로(미역국 [미역꾹], 먹기 [먹끼], 김칫국 [김치꾹]).
 *  뜻 풀이는 몽골어로 자연스럽게: 식은 죽 먹기는 몽골어 비유 «ус уух мэт амархан», 김칫국은 몽골에서도 쓰는 «алаагүй баавгайн арьс». */
const MN: { parts: [string, string]; guess: string; options: string[]; gloss: string; say: string; recap: string }[] = [
  {
    parts: ['замгийн шөл', 'идэх'],
    guess: 'замгийн шөл идэх?',
    options: ['Төрсөн өдрөө тэмдэглэх', 'Шалгалтад унах', 'Эрүүл хооллох'],
    gloss: 'Би шалгалтад дахиад л уначихлаа.',
    say: 'миёккуг мөгөссөё',
    recap: 'шалгалтад унах',
  },
  {
    parts: ['хүйтэн зутан', 'идэх'],
    guess: 'хүйтэн зутан идэх?',
    options: ['Маш амархан', 'Их уйтгартай', 'Амтгүй хоол'],
    gloss: 'Энэ асуулт ус уух мэт амархан.',
    say: 'сигын жуг мөккиеё',
    recap: 'маш амархан',
  },
  {
    parts: ['кимчитэй шөл', 'уух'],
    guess: 'кимчитэй шөл түрүүлж уух?',
    options: ['Кимчинд дуртай', 'Цангасан', 'Хэт эрт баярлах'],
    gloss: 'Одоохондоо мэдэхгүй. Алаагүй баавгайн арьсыг битгий хуваа!',
    say: 'гимчиккуг масижи маё',
    recap: 'хэт эрт баярлах',
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
