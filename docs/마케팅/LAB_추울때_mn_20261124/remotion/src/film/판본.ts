// 판본(나라별 글, 11-10 LAB 하루 두 편 · 설계 6 · 20) — src/film/판본/<KEY>.json 하나가 판본 하나다(처음부터 판본 틀로 만든 편).
// LAB 몽골 M65 「추울 때 네 마디」(11-24). 몽골어는 세 겹 검수(../../../게시/검문/)를 거친 글만 판본/MN.json에.
// 키는 계정 원장(docs/마케팅/sns-계정.json) LAB 계정의 rotationVersion, 없으면 countryCode. 같은 영어라도 나라마다 판본이 따로다.
// 그림 · 한국어(말의 한글) · 소리 · 박자 · 카메라는 정본 하나(data.ts · Film.tsx)이고, 판본은 글 자리와 글꼴만 바꾼다(원본 동결).
// 글이 다 찬 판본만 낸다 — 빈 칸이 있으면 Root가 컴포지션을 등록하지 않고, 편 폴더의 판본렌더.mjs가 그 키를 건너뛰며 빈 칸을 알린다.
// `_`로 시작하는 칸(_설명 · _한도 · _원문)은 글 쓰는 사람을 위한 안내라 읽지 않는다. 키릴 읽는 법은 우리 몽골 편 규칙(ㅓ=ө · ㅐㅔ=э · ㅜ=у · ㅡ=ы · 받침 ㅇ=н · ㅈ=ж).
// 읽는 법(…Read · reads)은 정본 글꼴(Inter Tight 기울임)로 그린다 — 몽골판만 키릴, 다른 판은 로마자다.
export type LocPack = {
  lang: string; // 언어(계정 원장 language)
  font: string; // 그 나라 글 서체 줄(키릴 · 로마자는 Inter Tight · SUIT, 그 밖의 문자는 시스템 글꼴을 뒤에)
  lineH: number; // 그 나라 글의 줄 높이 하한 — 머리 글 · 뜻 줄은 max(1.14, lineH), 끝 줄은 max(1.2, lineH). 몽골판 1.14
  hook: string; // 0~3.2초 머리 글 「추울 때 하는 네 마디」(줄 바꿈 문자로 두 줄)
  hookSize: number; // 몽골판 84
  temp: string; // 0.5~3.2초 온도계 곁 「밖은 영하 5도」
  tempSize: number; // 몽골판 58
  gauge: string; // 3.2초~ 왼쪽 온도계 게이지 이름표 「친구의 추위 단계」(줄 바꿈 문자로 두 줄까지)
  gaugeSize: number; // 몽골판 34
  sits: string[]; // 상황 칸 넷의 위 글(3.2 · 7.7 · 12.5 · 17.5초) — 갑자기 찬 바람 · 버스는 15분 뒤 · 30분 지남 · 집에 오자마자
  sitSize: number; // 몽골판 50
  reads: string[]; // 친구 네 마디의 읽는 법 — 추워~ · 손 시려… · 얼어 죽겠다! · 이불 밖은 위험해…
  means: string[]; // 그 뜻 넷(셋째 · 넷째는 둘째 줄에 「(= …)」)
  meanSize: number; // 몽골판 52
  inviteRead: string; // 17.75~19.4초 몽글 「편의점 가자~!」의 읽는 법
  inviteMean: string; // 그 뜻
  mongRead: string; // 22.7~25.3초 몽글 「몽골은 영하 30도야~」의 읽는 법
  mongMean: string; // 그 뜻
  shockRead: string; // 25.4~28.6초 친구 「삼… 삼십 도?!」의 읽는 법
  shockMean: string; // 그 뜻
  smallSize: number; // 작은 말 뜻 글자 크기 — 몽골판 54
  end: string; // 28.85초~끝 끝 줄(크림색)
  endSize: number; // 몽골판 64
  coverAt: number; // 표지(cover.png)로 뜰 초
  // 나라 인사 카드(11-12, 선택 — Greeting.tsx). hello가 빈 글이면 인사 없이 원본 그대로다.
  hello: string;
  helloName: string;
  helloRead: string;
  helloVo: string;
  helloSec: number;
};

// ── 아래는 여러 편이 같은 꼴로 쓴다(편마다 칸 표만 다르다) ──
// 칸 꼴: 글(빈 글 안 됨) · 글?(선택 — 비우면 그 자리를 그리지 않음) · 수 · 참거짓 · 글들(개수 고정, 선택이면 빈 글 됨) · 수들
type 칸 = '글' | '글?' | '수' | '참거짓' | { 글들: number; 선택?: boolean } | { 수들: number };
const 칸표: Record<keyof LocPack, 칸> = {
  lang: '글', font: '글', lineH: '수', hook: '글', hookSize: '수', temp: '글', tempSize: '수', gauge: '글', gaugeSize: '수',
  sits: { 글들: 4 }, sitSize: '수', reads: { 글들: 4 }, means: { 글들: 4 }, meanSize: '수',
  inviteRead: '글', inviteMean: '글', mongRead: '글', mongMean: '글', shockRead: '글', shockMean: '글', smallSize: '수',
  end: '글', endSize: '수', coverAt: '수',
  hello: '글?', helloName: '글?', helloRead: '글?', helloVo: '글?', helloSec: '수',
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
  // 나라 인사 — 인사말이 있으면 나라 이름 · 읽는 법 · 목소리 글도 있어야 하고 길이는 0~3초
  if (typeof p.hello === 'string' && p.hello.trim()) {
    for (const k of ['helloName', 'helloRead', 'helloVo']) if (typeof p[k] !== 'string' || !(p[k] as string).trim()) out.push(`${k}: 빈 글(인사가 켜진 판본)`);
    if (!(typeof p.helloSec === 'number' && p.helloSec > 0 && p.helloSec <= 3)) out.push('helloSec: 0~3초의 수가 아님');
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
