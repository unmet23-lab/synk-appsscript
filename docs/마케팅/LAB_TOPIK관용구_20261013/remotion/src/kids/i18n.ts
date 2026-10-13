// 키즈판 화면 글: 영어판(@synkkorean)과 몽골어판(@synk.mn · SYNK 페이스북). 한국어(관용구·예문·해요체)는 두 판 모두 그대로 둔다.
// 몽골어는 할하 키릴(10-13 Fable 검토 반영: хэтэрхий 뺌, ㅜ=ү, шилэмгий→шаардлага өндөртэй). 한국어 발음은 몽골에서 서울을 «Сөүл»로 적는 관례대로 ㅓ를 ө로 적는다. 글꼴: Inter Tight가 키릴(Ө·Ү 포함)을 갖고 있고 DM Mono는 없어서 몽골어 자리엔 모노를 쓰지 않는다.
import type { Question } from '../film/data';
import { EXAM, HANDLE, QUESTIONS, RECAP } from '../film/data';

export type KidsLang = 'en' | 'mn';

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
};

const UI: Record<KidsLang, KidsUi> = {
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
    gotThis: "You've got this!",
    exam: `${EXAM.name} · ${EXAM.date}`,
    handle: HANDLE,
    monoFallback: false,
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
    gotThis: 'Чи чадна!',
    exam: `${EXAM.name} · 10.17–18`,
    handle: '@synk.mn',
    monoFallback: true,
  },
};

/** 몽골어판에서 바꾸는 칸(관용구·예문·해요체 한국어는 그대로). */
const MN: { parts: [string, string]; guess: string; options: string[]; gloss: string; say: string; recap: string }[] = [
  {
    parts: ['гар', 'том'],
    guess: 'том гар?',
    options: ['Гар нь том', 'Өгөөмөр — хоол ихээр хийдэг', 'Гар урлалд сайн'],
    gloss: 'Эмээ үргэлж хоол ихээр хийдэг.',
    say: 'сони көё',
    recap: 'өгөөмөр',
  },
  {
    parts: ['хөл', 'өргөн'],
    guess: 'өргөн хөл?',
    options: ['Танил тал ихтэй', 'Хөл нь өргөн', 'Хаа сайгүй алхдаг'],
    gloss: 'Минсү хаана ч очсон танил хүнтэй.',
    say: 'бари нөлбөё',
    recap: 'танил тал ихтэй',
  },
  {
    parts: ['нүд', 'өндөр'],
    guess: 'өндөр нүд?',
    options: ['Нүд нь том', 'Хол хардаг', 'Шаардлага өндөртэй'],
    gloss: 'Эгч маань танилцуулсан залуу болгоноос татгалздаг.',
    say: 'нүни нопаё',
    recap: 'шаардлага өндөртэй',
  },
];

export const kidsUi = (lang: KidsLang): KidsUi => UI[lang];

export const kidsQuestions = (lang: KidsLang): Question[] =>
  lang === 'en'
    ? QUESTIONS
    : QUESTIONS.map((q, i) => ({
        ...q,
        parts: q.parts.map(([ko], k) => [ko, MN[i].parts[k]] as [string, string]),
        guess: MN[i].guess,
        options: q.options.map((o, k) => ({ ...o, text: MN[i].options[k] })),
        gloss: MN[i].gloss,
        say: [q.say[0], MN[i].say] as [string, string],
      }));

export const kidsRecap = (lang: KidsLang): string[] => (lang === 'en' ? RECAP : MN.map((m) => m.recap));
