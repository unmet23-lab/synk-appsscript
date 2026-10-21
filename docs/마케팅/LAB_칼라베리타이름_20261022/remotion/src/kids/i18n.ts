// 키즈판 화면 글: 스페인어판(YouTube @synkkorean, 제목·설명 스페인어 — 트렌드 스캔 10-19 후보 3 「내 이름 한국어로」 방식). 한국어(이름·예문·해요체)는 그대로 둔다.
// 중립 멕시코 스페인어(tú). 글꼴: Inter Tight가 ¡¿·악센트를 갖고 있다. DM Mono는 라틴 기본 글자만 믿어 이 판은 모노를 쓰지 않는다.
import type { Question } from '../film/data';
import { EXAM, HANDLE, QUESTIONS, RECAP } from '../film/data';

export type KidsLang = 'es';

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
  cta: { title: string; url: string; note: string }; // 끝 화면 전환 카드(역할 전환 — 결과 화면으로)
};

const UI: Record<KidsLang, KidsUi> = {
  es: {
    guess3: '¡ADIVINA EN 3 SEGUNDOS!',
    nope: '¡NO!',
    question: '¿Cómo se escribe en coreano?',
    sayIt: 'DILO',
    clearHud: '¡LISTO!',
    level: (n) => `¡NIVEL ${n}!`,
    finish: '¡FIN!',
    stageClear: '¡LO LOGRASTE!',
    howMany: '¿Y TU nombre?',
    comment: 'Escríbelo en coreano',
    commentSize: 46,
    gotThis: 'synk.im/nombre',
    exam: EXAM.name,
    handle: HANDLE,
    monoFallback: true,
    next: 'SIGUE ▶',
    scoreNext: '¿Y TÚ? ▶',
    yourTurn: '¡AHORA TÚ!',
    hud: 'CALAVERITAS',
    hook: '¿TU NOMBRE EN COREANO?',
    cta: { title: '¿Y TU nombre?', url: 'synk.im/nombre', note: 'gratis · sin registro' },
  },
};

export const kidsUi = (lang: KidsLang): KidsUi => UI[lang];

/** 화면 글 글꼴 줄(KidsFilm이 --kids-font로 깐다). 스페인어는 Inter Tight 그대로. */
export const kidsFont = (_lang: KidsLang): string | undefined => undefined;

export const kidsQuestions = (_lang: KidsLang, _mnNavel?: string): Question[] => QUESTIONS;

/** 끝 화면 별 아래 줄: 한글 이름. */
export const kidsRecap = (_lang: KidsLang): string[] => RECAP;
