// 키즈판 화면 글: 영어판(@synkkorean)과 몽골어판(@synk.mn · SYNK 페이스북). 한국어(시각·읽기·예문)는 두 판 모두 그대로 둔다.
// 「한국어로 시간 읽기」(10-22): 보기 셋이 한국어 읽기라 두 판이 같고, 판마다 바꾸는 것은 시·분 조각 뜻·예문 뜻·읽는 법·끝 규칙 카드뿐이다.
// 몽골어는 할하 키릴(관용구 퀴즈 연재에서 검문을 마친 틀 문장은 그대로). 한국어 발음은 앞 편처럼 ㅓ=ө·ㅐㅔ=э·ㅡ=ы·ㅜ=ү로, 소리 나는 대로. 된소리 [삼십뿐]의 ㅃ은 기식 없는 б로 적는다(몽골어 п는 거센소리, пп로 시작하는 낱말도 없다 — Opus 역번역 10-22). 「2 цаг хагас」는 「2시간 반」으로 먼저 읽혀 시각은 2:30으로 적는다.
// 글꼴: Inter Tight가 키릴(Ө·Ү 포함)을 갖고 있고 DM Mono는 없어서 몽골어 자리엔 모노를 쓰지 않는다.
import type { Question } from '../film/data';
import { EXAM, HANDLE, QUESTIONS, RECAP, RULE } from '../film/data';

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
  next: string; // v4 다음 문제 미리보기 카드
  scoreNext: string; // v4 마지막 문제의 미리보기(점수)
  yourTurn: string; // v4 SAY IT 뒤 따라 말할 차례
  hud: string; // 게임 판 이름(위쪽 알약)
  hook: string; // 0초 약속 한 줄(첫 문제 어두운 알약) — 제작 방식 v2 §2-1
  rule: typeof RULE; // 끝 규칙 카드
};

const UI: Record<KidsLang, KidsUi> = {
  en: {
    guess3: 'GUESS IN 3 SECONDS!',
    nope: 'NOPE!',
    question: 'How do you say it?',
    sayIt: 'SAY IT',
    clearHud: 'CLEAR!',
    level: (n) => `LEVEL ${n}!`,
    finish: 'FINISH!',
    stageClear: 'STAGE CLEAR!',
    howMany: 'How many did you get?',
    comment: RULE.comment,
    commentSize: 40,
    gotThis: 'See you next round!',
    exam: EXAM.name,
    handle: HANDLE,
    monoFallback: false,
    next: 'NEXT ▶',
    scoreNext: 'SCORE ▶',
    yourTurn: 'YOUR TURN',
    hud: 'TIME QUIZ',
    hook: '2 NUMBER SYSTEMS? 1 RULE.',
    rule: RULE,
  },
  mn: {
    guess3: '3 СЕКУНДЭД ТААГААРАЙ!',
    nope: 'БУРУУ!',
    question: 'Солонгосоор яаж хэлэх вэ?',
    sayIt: 'ДАВТААРАЙ',
    clearHud: 'ДУУСЛАА!',
    level: (n) => `${n}-Р ШАТ!`,
    finish: 'ДУУСЛАА!',
    stageClear: 'АМЖИЛТТАЙ!',
    howMany: 'Хэдийг нь зөв таасан бэ?',
    comment: 'Танай тэнд одоо хэдэн цаг болж байна вэ? Солонгосоор бичээрэй ↓',
    commentSize: 34,
    gotThis: 'Дараагийн шатанд уулзъя!',
    exam: 'ЦАГ ХЭЛЭХ',
    handle: '@synk.mn',
    monoFallback: true,
    next: 'ДАРААХ ▶',
    scoreNext: 'ОНОО ▶',
    yourTurn: 'ЧИНИЙ ЭЭЛЖ',
    hud: 'ЦАГ ХЭЛЭХ',
    hook: 'СОЛОНГОСООР ЦАГ ХЭЛЖ ЧАДАХ УУ?', // 「Солонгосоор хэдэн цаг вэ?」는 동사 없이 「한국어로 몇 시?」가 돼 어색(아르곤 10-22)
    rule: {
      title: 'ДҮРЭМ',
      rows: [
        { ko: '시', what: 'цаг', nums: '한 · 두 · 세 · 네' },
        { ko: '분', what: 'минут', nums: '일 · 이 · 삼 · 사' },
      ],
      bonus: '30분 = 반 (хагас)',
      comment: 'Танай тэнд одоо хэдэн цаг болж байна вэ? Солонгосоор бичээрэй ↓',
    },
  },
};

/** 몽골어판에서 바꾸는 칸(시각·보기·예문·읽기 한국어는 그대로). 순서는 data.ts(3:30 · 1:10 · 2:30). */
const MN: { parts: [string, string]; gloss: string; say: string }[] = [
  { parts: ['3 цаг', '30 минут'], gloss: '3 цаг 30 минутад уулзъя!', say: 'сэ ши самшип бүн' },
  { parts: ['1 цаг', '10 минут'], gloss: 'Хичээл 1 цаг 10 минутад тарна!', say: 'хан ши шип бүн' },
  { parts: ['2 цаг', '30 минут'], gloss: 'Аль хэдийн 2:30 боллоо. 반 = хагас!', say: 'дү ши бан' },
];

export const kidsUi = (lang: KidsLang): KidsUi => UI[lang];

/** 화면 글 글꼴 줄(KidsFilm이 --kids-font로 깐다). 영어·몽골어는 Inter Tight 그대로. */
export const kidsFont = (_lang: KidsLang): string | undefined => undefined;

export const kidsQuestions = (lang: KidsLang, _mnNavel?: string): Question[] =>
  lang === 'en'
    ? QUESTIONS
    : QUESTIONS.map((q, i) => ({
        ...q,
        parts: q.parts.map(([ko], k) => [ko, MN[i].parts[k]] as [string, string]),
        gloss: MN[i].gloss,
        say: [q.say[0], MN[i].say] as [string, string],
      }));

/** 끝 화면 별 아래 줄: 두 판 모두 한국어 읽기(정답) 그대로. */
export const kidsRecap = (_lang: KidsLang): string[] => RECAP;
