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
    exam: 'ХЭЛЦ ҮГ #2',
    handle: '@synk.mn',
    monoFallback: true,
    next: 'ДАРААХ ▶',
    scoreNext: 'ОНОО ▶',
    yourTurn: 'ЧИНИЙ ЭЭЛЖ',
    hud: 'ХЭЛЦ ҮГ #2',
  },
};

/** 몽골어판에서 바꾸는 칸(관용구·예문·해요체 한국어는 그대로). 관용구 퀴즈 #2(10-18) 초안 — 순서는 data.ts(입 · 귀 · 배꼽).
 *  보기는 두 낱말 안팎(v4 「짧은 보기」와 같은 까닭), 해요체 발음은 첫 편처럼 ㅓ=ө·ㅜ=ү(입이 무거워요 → иби мугөвоё).
 *  10-18 Fable 교정 반영: Хөхрөтлөө → Хөхөртлөө(хөхрөх의 자음 앞 어간은 хөхөр-), 광고 зар(벼룩시장 공고) → сурталчилгаа. хүй·Жиү·ЧИНИЙ ЭЭЛЖ는 그대로. */
const MN: { parts: [string, string]; guess: string; options: string[]; gloss: string; say: string; recap: string }[] = [
  {
    parts: ['ам', 'хүнд'],
    guess: 'хүнд ам?',
    options: ['Их иддэг', 'Нууц хадгалдаг', 'Удаан ярьдаг'],
    gloss: 'Жиү чиний нууцыг хэзээ ч бусдад ярьдаггүй.',
    say: 'иби мугөвоё',
    recap: 'нууц хадгалдаг',
  },
  {
    parts: ['чих', 'нимгэн'],
    guess: 'нимгэн чих?',
    options: ['Сайн сонсдог', 'Жижиг чихтэй', 'Юунд ч итгэдэг'],
    gloss: 'Аав маань сурталчилгаанд харсан бүхнээ худалдаж авдаг.',
    say: 'гвига ялбаё',
    recap: 'юунд ч итгэдэг',
  },
  {
    parts: ['хүй', 'унах'],
    guess: 'хүй унах?',
    options: ['Хөхөртлөө инээдэг', 'Гэдэс өвддөг', 'Хэт их иддэг'],
    gloss: 'Ёстой инээдтэй юм, элгээ хөштөл инээлээ!', // 몽골어에서 хүй унах는 갓난아기 탯줄이 떨어지는 말이라 뜻 풀이는 몽골어 관용 표현으로(10-18 제미나이 검문)
    say: 'бэккоп ппажигэссөё',
    recap: 'хөхөртлөө инээдэг',
  },
];

/** 13개 현지어판(locales.ts)의 화면 글을 영어판 칸에 맞춘다. 끝 화면 계정은 채널마다 KidsFilm handle로 바꾼다. */
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

/** 10-18 배꼽 낱말 판 고르기: 아르곤·flash 검문 모두 「хүй는 주로 탯줄, 배꼽은 хүйс」, Fable은 「хүй가 일상어」 — 두 판을 다 만들어 둔다.
 *  mnNavel='хүйс'면 배꼽 문제의 글자 그대로 조각·오답 딱지만 хүйс로 바꾼다(뜻 풀이·보기는 그대로). */
const navelFix = (s: string, navel?: string) => (navel ? s.replace(/^хүй(?=\s|\?|$)/, navel) : s);

export const kidsQuestions = (lang: KidsLang, mnNavel?: string): Question[] =>
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
        parts: q.parts.map(([ko], k) => [ko, navelFix(MN[i].parts[k], mnNavel)] as [string, string]),
        guess: navelFix(MN[i].guess, mnNavel),
        options: q.options.map((o, k) => ({ ...o, text: MN[i].options[k], short: MN[i].options[k] })), // short에 영어 짧은 보기가 남지 않게
        gloss: MN[i].gloss,
        say: [q.say[0], MN[i].say] as [string, string],
      }));

export const kidsRecap = (lang: KidsLang): string[] => (lang === 'en' ? RECAP : lang === 'mn' ? MN.map((m) => m.recap) : LOCALES[lang].q.map((m) => m.recap));
