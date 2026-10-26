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
  /** 퀴즈 #7 몽골판(10-26): 한국어로만 나오는 진행 소리를 그 자리에서 옮기는 몽글 말풍선(퀴즈 #6 몽골판 버림의 교훈). 없으면 말풍선을 띄우지 않는다. */
  //   v2(첫 렌더 이해 시험 3점 — 「땡 · 셋 둘 하나 · 딩동댕이 무슨 소리인지 모른다」): 들리는 한국어 소리와 몽골어 뜻을 짝지어 보인다(「땡! = Буруу!」).
  bubble?: { title: string; nope: [string, string]; count: [string, string]; right: string; first?: [string, string] };
  //   v4(10-27 다시 살림 — v3 답 1이 「뜻 맞히기 퀴즈」 형식 설명에 머물러 「글자 그대로 읽으면 틀린다」가 빠짐): first = 첫 문제 0초 말풍선 [큰 줄, 작은 줄].
  /** 둘째 · 셋째 문제 머리 알약(v2 — 「같은 틀이 되풀이돼 둘째부터 넘긴다」에 남을 까닭 하나). 없으면 guess3. */
  qHooks?: string[];
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
    sayIt: 'ДАГАЖ ХЭЛЭЭРЭЙ', // 10-27 Opus 역번역: ДАВТААРАЙ는 「복습해」로도 읽힌다 — 따라 말하기 자리
    clearHud: 'ДУУСЛАА!',
    level: (n) => `${n}-Р ШАТ!`,
    finish: 'ДУУСЛАА!',
    stageClear: 'ҮГЧЛЭН ОЙЛГОВОЛ БУРУУ!', // 10-27 v5: v4 답 1도 「뜻 고르기 퀴즈」 형식 설명 — 끝 큰 제목을 「성공!」 대신 한 문장의 알맹이로(검수 통과한 0초 말풍선 줄)
    howMany: 'Хэдийг нь зөв таасан бэ?',
    comment: 'Оноогоо сэтгэгдэлд бичээрэй ↓',
    commentSize: 46,
    gotThis: 'Дараагийн шатанд уулзъя!',
    exam: 'ХЭЛЦ ҮГ #7',
    handle: '@synk.mn',
    monoFallback: true,
    next: 'ДАРААХ ▶',
    scoreNext: 'ОНОО ▶',
    yourTurn: 'ЧИНИЙ ЭЭЛЖ',
    hud: 'ХЭЛЦ ҮГ #7',
    bubble: { first: ['Үгчлэн ойлговол буруу!', 'Энэ юу гэсэн үг вэ?'], title: 'Энэ юу гэсэн үг вэ?', nope: ['땡! = Буруу!', 'Шууд утгаараа биш.'], count: ['셋 · 둘 · 하나 = 3 · 2 · 1', 'Зөв хариултаа сонго!'], right: '딩동댕! = Зөв!' },
    qHooks: ['', 'ДАРААГИЙНХ НЬ ИЛҮҮ ХЭЦҮҮ!', 'СҮҮЛИЙНХЭД НЬ БҮҮ ХУУРТААРАЙ!'], // 10-27 Opus 역번역: зальтай는 사람의 교활함 — 「마지막 건 속지 마!」
  },
};

/** 몽골어판에서 바꾸는 칸(관용구·예문·해요체 한국어는 그대로). 관용구 퀴즈 #7(10-26) — 순서는 data.ts(생쥐 · 불 · 물), 몽골어판 하나.
 *  보기는 두 낱말 안팎 동사원형, 해요체 발음은 앞 편처럼 ㅓ=ө·ㅐㅔ=э·ㅡ=ы·ㅜ=ү로 적고 소리 나는 대로(물에 [무레], 보듯 [보듣], 됐어요 [돼써요], 건너갔어요 [건너가써요]). ㄸ·ㅃ·ㅉ은 тт·пп·жж.
 *  뜻 풀이는 몽골어로 다시 쓴다(제작 방식 v2 §4-3). why = 정답 때 몽글 말풍선의 「왜 그 뜻인지」 한 줄(퀴즈 #6 몽골판 이해 시험 「왜 그 뜻인지가 없다」). */
const MN: { parts: [string, string]; guess: string; options: string[]; gloss: string; say: string; recap: string; why: string }[] = [
  {
    // 물에 빠진 생쥐 — 말할 때 [무레 빠진 생쥐가 돼써요]. 글자 그대로 옮긴 딱지 대신 엉뚱한 해석(「헤엄치는 쥐?」) — 몽골어에 같은 꼴 비유가 있으면 딱지가 곧 정답이 된다.
    parts: ['усанд унасан', 'хулгана'],
    guess: 'Хулгана сэлэх үү?',
    options: ['Усанд сэлэх дуртай', 'Нэвт норох', 'Их айх'],
    gloss: 'Шүхэргүй байсан болохоор\nнэвт норчихлоо!',
    say: 'мурэ ппажин сэнжүйга дуэссөё',
    recap: 'нэвт норох',
    why: 'Усанд унасан хулгана шиг нэвт норж, өрөвдөлтэй харагдах',
  },
  {
    // 불 보듯 뻔하다 — 말할 때 [불 보듣 뻔해요]. 사전 용례 「결과가 불 보듯 뻔하다」.
    parts: ['гал', 'харах мэт'],
    guess: 'Галыг ширтэх үү?', // 10-27 Opus 역번역: 대격이 없으면 「불이 노려볼까?」로도 읽힌다
    options: ['Галд дуртай', 'Их халуун', 'Илт тодорхой'],
    gloss: 'Муурын өмнө загас тавьбал\nюу болох нь илт!',
    say: 'бул бодыт ппөнхэё',
    recap: 'илт тодорхой',
    why: 'Галыг харж байгаа мэт тодорхой — эргэлзэх зүйлгүй', // 10-27 Opus 역번역: тод는 「밝다」로 기운다 → тодорхой, 대격
  },
  {
    // 물 건너가다 — 말할 때 [물 건너가써요]. 오답 「Гадаад явах」(외국에 가다)는 「물 건너온 = 외국에서 들여온」을 아는 사람이 걸리는 함정.
    parts: ['ус', 'гатлах'],
    guess: 'Ус гатлах уу?',
    options: ['Хэтэрхий оройтох', 'Гадаад явах', 'Загас барих'],
    gloss: 'Галт тэрэг аль хэдийн явчихлаа.\nАялал бүтэхгүй боллоо!',
    say: 'мул гөннөгассөё',
    recap: 'хэтэрхий оройтох',
    why: 'Ус гатлаад явчихсан — буцаах аргагүй', // 10-27 Opus 역번역: буцааж болохгүй는 「되돌리면 안 된다」(금지)로 먼저 읽힌다
  },
];

/** 정답 때 몽글 말풍선의 「왜 그 뜻인지」(몽골어판만). */
export const kidsWhy = (lang: KidsLang, index: number): string | undefined => (lang === 'mn' ? MN[index]?.why : undefined);

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
