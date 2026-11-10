// 판본(나라별 글, 11-10 LAB 하루 두 편 · 설계 6 · 20) — src/film/판본/<KEY>.json 하나가 판본 하나다.
// 키는 계정 원장(docs/마케팅/sns-계정.json) LAB 계정의 rotationVersion, 없으면 countryCode. 같은 영어라도 나라마다 판본이 따로다.
// 그림 · 한국어(말풍선 한글 · 목소리) · 소리 · 박자는 정본 하나(data.ts · Film.tsx)이고, 판본은 글 자리와 글꼴만 바꾼다(원본 동결).
// 글이 다 찬 판본만 낸다 — 빈 칸이 있으면 Root가 컴포지션을 등록하지 않고, 편 폴더의 판본렌더.mjs가 그 키를 건너뛰며 빈 칸을 알린다.
// `_`로 시작하는 칸(_설명 · _한도)은 글 쓰는 사람을 위한 안내라 읽지 않는다.
export type LocPack = {
  lang: string; // 언어(계정 원장 language)
  font: string; // 그 나라 글 서체 줄(한글 · 키릴 · 로마자는 Inter Tight · SUIT, 그 밖의 문자는 시스템 글꼴을 뒤에)
  lineH: number;
  hookMotion: boolean; // 첫 화면 김 · 당김 · 미리 보기 딱지(두 채널 판 v5부터) — 몽골판(10-31 v8)만 false
  hook: string; // 첫 2초 카드(0~3.2초)
  hookSize: number;
  gauge: string;
  sits: string[]; // 상황 칸 넷(차례대로)
  sitSize: number;
  reads: string[]; // 말풍선 읽는 법 넷(몽골판만 키릴, 다른 판은 로마자)
  means: string[]; // 말풍선 뜻 넷
  meanSize: number;
  endRead: string;
  endMn: string; // 「네, 사장님~」의 뜻(칸 이름은 몽골판 때 그대로)
  endMnSize: number; // 그 글자 크기 — 몽골판(10-31 v8) 44, 두 채널 · 영어판 48
  end1: string; // 끝 카드 첫 줄(25.3초~)
  end2: string; // 끝 카드 둘째 줄(산호색)
  endSize: number;
  inner: string; // 끝 화산 옆 「(속으로) 억울해!!」 딱지의 괄호 안(선택 — 비우면 딱지 없음: 몽골판 v8)
  ask: string; // 끝 질문(선택) — 끝 카드 아래 셋째 줄, 비우면 없음
  askSize: number;
  coverAt: number; // 표지(cover.png)로 뜰 초 — 새 판본은 첫 2초 카드 자리
};

// ── 아래는 다섯 편이 같은 꼴로 쓴다(편마다 칸 표만 다르다) ──
// 칸 꼴: 글(빈 글 안 됨) · 글?(선택 — 비우면 그 자리를 그리지 않음) · 수 · 참거짓 · 글들(개수 고정, 선택이면 빈 글 됨) · 수들
type 칸 = '글' | '글?' | '수' | '참거짓' | { 글들: number; 선택?: boolean } | { 수들: number };
const 칸표: Record<keyof LocPack, 칸> = {
  lang: '글', font: '글', lineH: '수', hookMotion: '참거짓', hook: '글', hookSize: '수', gauge: '글', sits: { 글들: 4 }, sitSize: '수',
  reads: { 글들: 4 }, means: { 글들: 4 }, meanSize: '수', endRead: '글', endMn: '글', endMnSize: '수', end1: '글', end2: '글', endSize: '수', inner: '글?',
  ask: '글?', askSize: '수', coverAt: '수',
};

// 판본 글에서 빈 칸 · 틀린 꼴을 찾는다(없으면 빈 배열)
export const 빈칸 = (p: Record<string, unknown>): string[] => {
  const out: string[] = [];
  for (const [k, kind] of Object.entries(칸표) as [string, 칸][]) {
    const v = p[k];
    if (kind === '글' || kind === '글?') {
      if (typeof v !== 'string') out.push(`${k}: 글이 아님`);
      else if (kind === '글' && !v.trim()) out.push(`${k}: 빈 글`);
    } else if (kind === '수') {
      if (typeof v !== 'number' || !Number.isFinite(v)) out.push(`${k}: 수가 아님`);
    } else if (kind === '참거짓') {
      if (typeof v !== 'boolean') out.push(`${k}: true/false가 아님`);
    } else if ('수들' in kind) {
      if (!Array.isArray(v) || v.length !== kind.수들 || v.some((x) => typeof x !== 'number' || !Number.isFinite(x))) out.push(`${k}: 수 ${kind.수들}개가 아님`);
    } else if (!Array.isArray(v) || v.length !== kind.글들) out.push(`${k}: 글 ${kind.글들}개가 아님`);
    else
      v.forEach((x, i) => {
        if (typeof x !== 'string') out.push(`${k}[${i}]: 글이 아님`);
        else if (!kind.선택 && !x.trim()) out.push(`${k}[${i}]: 빈 글`);
      });
  }
  return out;
};

// 판본 폴더의 JSON을 번들 때 모두 묶는다(rspack · webpack의 require.context — 파일을 더하면 다음 번들에 저절로 든다)
type 묶음 = { keys(): string[]; (id: string): unknown };
declare global {
  namespace NodeJS {
    interface Require {
      context(dir: string, deep: boolean, re: RegExp): 묶음;
    }
  }
}
const ctx: 묶음 = require.context('./판본', false, /^\.\/[A-Z]{2}\.json$/);
const 키들: string[] = [...new Set(ctx.keys().map((k: string) => k.replace(/^.*\/([A-Z]{2})\.json$/, '$1')))].sort();
export const 판본들: { key: string; pack: LocPack }[] = 키들
  .map((key) => ({ key, raw: ctx(`./${key}.json`) as Record<string, unknown> }))
  .filter(({ raw }) => 빈칸(raw).length === 0)
  .map(({ key, raw }) => ({ key, pack: Object.fromEntries(Object.keys(칸표).map((k) => [k, raw[k]])) as LocPack }));
