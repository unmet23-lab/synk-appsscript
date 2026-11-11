// 언어 프로필 — 판본 언어마다 글꼴 · 줄 길이 · 줄바꿈 · 읽기 속도(설계 10). 20개 언어를 같은 정본(episode.json)에서 렌더하는 칸이다.
// 정본은 C 묶음의 docs/마케팅/현지화/언어프로필.json이다 — 새편.mjs가 그 파일이 있으면 src/langProfile.json으로 복사하고,
// 여기 기본값 위에 아는 칸(글꼴 · 줄최대글자 · 읽기속도 · 줄바꿈 · 문자)만 덮는다. 그 파일이 없으면 아래 기본값으로 렌더한다.
// 지금 렌더해 시험한 언어는 mn(몽골어)뿐이다. 나머지 줄은 자리만 잡아 둔 것이라, 처음 렌더할 때 글자 검사(설계 11)로 폭을 다시 잰다.
import profileFile from './langProfile.json';

export type Script = 'latin' | 'cyrillic' | 'han' | 'kana' | 'myanmar' | 'thai' | 'khmer' | 'sinhala' | 'devanagari' | 'hangul';
export type LangProfile = {
  code: string; // BCP 47(sns-계정.json language와 같은 값)
  name: string;
  script: Script;
  /** 화면 글 글꼴 줄(CSS). 시스템 글꼴 이름이면 렌더하는 PC에 깔려 있어야 한다(윈도 기본 글꼴만 적는다). */
  font: string;
  /** public/fonts 아래 글꼴 파일을 같이 등록할 때. */
  files?: { family: string; file: string; weight?: string }[];
  /** 굵은 글자 한 자의 평균 폭(em) — 자동 맞춤 어림에 쓴다. */
  em: number;
  /** 칸마다 한 줄 최대 글자 수(넘으면 글자를 줄이고, 그래도 넘으면 두 줄). */
  maxLine: { bridge: number; option: number; why: number; gloss: number; recap: number };
  /** 낱말 경계: space = 띄어쓰기에서만 줄을 바꾼다 · char = 아무 글자 사이 · phrase = 글에 넣은 줄바꿈(\n)에서만. */
  breaks: 'space' | 'char' | 'phrase';
  /** 읽기 속도(초당 글자) — 칸이 떠 있는 시간 안에 읽히는지 검사(글자검사.mjs). */
  cps: number;
};

const 시스템 = {
  mn: "'Inter Tight', 'SUIT', sans-serif",
  latin: "'Inter Tight', 'SUIT', sans-serif",
  zhHans: "'Microsoft YaHei UI', 'Microsoft YaHei', 'SUIT', sans-serif",
  zhHant: "'Microsoft JhengHei UI', 'Microsoft JhengHei', 'SUIT', sans-serif",
  ja: "'Yu Gothic UI', 'Yu Gothic', 'Meiryo', 'SUIT', sans-serif",
  my: "'Myanmar Text', 'SUIT', sans-serif",
  th: "'Leelawadee UI', 'SUIT', sans-serif",
  km: "'Khmer UI', 'Leelawadee UI', 'SUIT', sans-serif",
  si: "'Nirmala UI', 'Iskoola Pota', 'SUIT', sans-serif",
  deva: "'Nirmala UI', 'SUIT', sans-serif",
};

const 라틴 = (code: string, name: string): LangProfile => ({ code, name, script: 'latin', font: 시스템.latin, em: 0.56, maxLine: { bridge: 30, option: 26, why: 34, gloss: 36, recap: 26 }, breaks: 'space', cps: 15 });

/** 기본값. 렌더 · 시험을 거친 줄에는 「시험」 표시를 단다(지금은 mn뿐). */
export const PROFILES: Record<string, LangProfile> = {
  // 시험: 2026-11-10 몽골어 퀴즈 세 편(이해 시험 · 몽골어 세 겹). 키릴 굵은 글자는 라틴보다 넓다(퀴즈 #6 Fable — 1.2로 셈).
  mn: { code: 'mn', name: '몽골어', script: 'cyrillic', font: 시스템.mn, em: 0.62, maxLine: { bridge: 28, option: 24, why: 32, gloss: 34, recap: 24 }, breaks: 'space', cps: 13 },
  en: 라틴('en', '영어'),
  es: 라틴('es', '스페인어'),
  'pt-BR': 라틴('pt-BR', '포르투갈어(브라질)'),
  vi: 라틴('vi', '베트남어'),
  id: 라틴('id', '인도네시아어'),
  ms: 라틴('ms', '말레이어'),
  fil: 라틴('fil', '필리핀어'),
  uz: 라틴('uz', '우즈베크어'),
  ru: { code: 'ru', name: '러시아어', script: 'cyrillic', font: 시스템.mn, em: 0.62, maxLine: { bridge: 28, option: 24, why: 32, gloss: 34, recap: 24 }, breaks: 'space', cps: 14 },
  kk: { code: 'kk', name: '카자흐어', script: 'cyrillic', font: 시스템.mn, em: 0.62, maxLine: { bridge: 28, option: 24, why: 32, gloss: 34, recap: 24 }, breaks: 'space', cps: 13 },
  ky: { code: 'ky', name: '키르기스어', script: 'cyrillic', font: 시스템.mn, em: 0.62, maxLine: { bridge: 28, option: 24, why: 32, gloss: 34, recap: 24 }, breaks: 'space', cps: 13 },
  'zh-Hans': { code: 'zh-Hans', name: '간체 중국어', script: 'han', font: 시스템.zhHans, em: 1.0, maxLine: { bridge: 16, option: 12, why: 18, gloss: 18, recap: 12 }, breaks: 'phrase', cps: 7 },
  'zh-Hant': { code: 'zh-Hant', name: '번체 중국어', script: 'han', font: 시스템.zhHant, em: 1.0, maxLine: { bridge: 16, option: 12, why: 18, gloss: 18, recap: 12 }, breaks: 'phrase', cps: 7 },
  ja: { code: 'ja', name: '일본어', script: 'kana', font: 시스템.ja, em: 1.0, maxLine: { bridge: 16, option: 12, why: 18, gloss: 18, recap: 12 }, breaks: 'phrase', cps: 8 },
  my: { code: 'my', name: '버마어', script: 'myanmar', font: 시스템.my, em: 0.8, maxLine: { bridge: 22, option: 18, why: 24, gloss: 24, recap: 18 }, breaks: 'phrase', cps: 9 },
  th: { code: 'th', name: '타이어', script: 'thai', font: 시스템.th, em: 0.6, maxLine: { bridge: 26, option: 22, why: 30, gloss: 30, recap: 22 }, breaks: 'phrase', cps: 12 },
  km: { code: 'km', name: '크메르어', script: 'khmer', font: 시스템.km, em: 0.75, maxLine: { bridge: 22, option: 18, why: 24, gloss: 24, recap: 18 }, breaks: 'phrase', cps: 9 },
  si: { code: 'si', name: '싱할라어', script: 'sinhala', font: 시스템.si, em: 0.75, maxLine: { bridge: 22, option: 18, why: 24, gloss: 24, recap: 18 }, breaks: 'space', cps: 9 },
  ne: { code: 'ne', name: '네팔어', script: 'devanagari', font: 시스템.deva, em: 0.7, maxLine: { bridge: 24, option: 20, why: 26, gloss: 26, recap: 20 }, breaks: 'space', cps: 10 },
  hi: { code: 'hi', name: '힌디어', script: 'devanagari', font: 시스템.deva, em: 0.7, maxLine: { bridge: 24, option: 20, why: 26, gloss: 26, recap: 20 }, breaks: 'space', cps: 10 },
};

// C 묶음 프로필(꼴 「언어프로필/1」 — {언어: {<코드>: {글꼴줄, 낱말경계, 읽기속도: {초당글자}, 글자폭: {em}, …}}})에서 아는 칸만 읽는다.
// 글자폭 em은 HarfBuzz로 잰 「자소 묶음 하나(공백 포함)의 평균 폭」이라 이 틀의 어림(굵은 글자 한 자)과 같은 뜻으로 쓴다.
// 꼴이 달라도 렌더를 막지 않는다(모르는 칸은 기본값).
type Raw = Record<string, unknown>;
const fromFile = (code: string): Partial<LangProfile> => {
  const f = profileFile as unknown as Raw;
  const o = ((f['언어'] as Raw | undefined)?.[code] ?? f[code]) as Raw | undefined;
  if (!o || typeof o !== 'object') return {};
  const out: Partial<LangProfile> = {};
  if (typeof o['글꼴줄'] === 'string' && (o['글꼴줄'] as string).trim()) out.font = o['글꼴줄'] as string;
  const cps = (o['읽기속도'] as Raw | undefined)?.['초당글자'];
  if (typeof cps === 'number' && cps > 0) out.cps = cps;
  const em = (o['글자폭'] as Raw | undefined)?.['em'];
  // 그 em은 띄어쓰기를 섞은 평균이라 글자만의 폭보다 작다 — textEm은 띄어쓰기를 따로 세므로 글자 몫을 6% 넉넉히 잡는다
  if (typeof em === 'number' && em > 0.2 && em < 1.5) out.em = em * 1.06;
  const br = o['낱말경계'];
  if (br === '띄어쓰기') out.breaks = 'space';
  else if (typeof br === 'string' && /Segmenter|글자/.test(br)) out.breaks = 'phrase'; // 띄어쓰기 없는 문자 — 줄은 글에 넣은 \n에서만
  return out;
};

export const profileFor = (code: string): LangProfile => {
  const base = PROFILES[code] ?? 라틴(code, code);
  return { ...base, ...fromFile(code) };
};

export const allFontFiles = () => Object.values(PROFILES).flatMap((p) => p.files ?? []);

/** 글자 폭 어림(그 언어 굵은 글자 1em 기준 몇 em인가). 한글 · 한자 · 가나는 1, 그 밖은 프로필 em. */
export const textEm = (s: string, p: LangProfile) =>
  [...s].reduce((w, c) => {
    const cp = c.codePointAt(0) ?? 0;
    if (c === ' ') return w + 0.28;
    if ((cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0x2e80 && cp <= 0x9fff) || (cp >= 0xff00 && cp <= 0xffef)) return w + 1;
    if (/[0-9.,!?·:;'"«»“”()\-=/]/.test(c)) return w + 0.45;
    return w + p.em;
  }, 0);

/** 폭 width에 maxSize부터 줄여 한 줄로 맞춘 글자 크기(minSize 아래로는 안 줄인다 — 그때는 줄바꿈에 맡긴다). */
export const fitSize = (s: string, p: LangProfile, width: number, maxSize: number, minSize: number) => {
  const longest = Math.max(...s.split('\n').map((l) => textEm(l, p)), 1);
  return Math.max(minSize, Math.min(maxSize, Math.floor(width / longest)));
};

/** 줄 나누기 어림 — 화면에서도 이 줄 그대로 그린다(브라우저가 다르게 나누지 않게). 글에 넣은 \n은 늘 줄을 바꾼다.
 *  space: 띄어쓰기에서만 · phrase: \n에서만(한 덩이가 넘치면 글자를 줄인다) · char: 아무 글자 사이. */
export const wrapLines = (s: string, p: LangProfile, widthEm: number): string[] => {
  const out: string[] = [];
  for (const para of s.split('\n')) {
    if (p.breaks === 'phrase') { out.push(para); continue; }
    const units = p.breaks === 'space' ? para.split(' ') : [...para];
    const glue = p.breaks === 'space' ? ' ' : '';
    let line = '';
    for (const u of units) {
      const next = line ? line + glue + u : u;
      if (line && textEm(next, p) > widthEm) { out.push(line); line = u; } else line = next;
    }
    out.push(line);
  }
  return out;
};

/** 상자(폭 width, 최대 maxLines줄)에 들어가는 가장 큰 글자 크기와 그때의 줄. 줄 수가 같으면 줄 길이를 고르게 다시 나눈다. */
export const fitBox = (s: string, p: LangProfile, width: number, maxSize: number, minSize: number, maxLines: number) => {
  for (let size = maxSize; size >= minSize; size -= 2) {
    const lines = wrapLines(s, p, (width * 0.94) / size);
    if (lines.length <= maxLines && lines.every((l) => textEm(l, p) * size <= width * 0.97)) return { size, lines: balance(lines, p) };
  }
  const lines = wrapLines(s, p, (width * 0.94) / minSize);
  return { size: minSize, lines: balance(lines, p), over: lines.length > maxLines };
};

// 두 줄이면 띄어쓰기 자리를 옮겨 두 줄 길이를 고르게(「긴 첫 줄 + 낱말 하나」를 막는다).
const balance = (lines: string[], p: LangProfile): string[] => {
  if (lines.length !== 2 || p.breaks !== 'space') return lines;
  const words = lines.join(' ').split(' ');
  let best = lines;
  let bestW = Math.max(...lines.map((l) => textEm(l, p)));
  for (let i = 1; i < words.length; i++) {
    const pair = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
    const w = Math.max(...pair.map((l) => textEm(l, p)));
    if (w < bestW) [best, bestW] = [pair, w];
  }
  return best;
};
