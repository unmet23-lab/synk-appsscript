// 판본(나라별 글, 11-10 LAB 하루 두 편 · 설계 6 · 20) — src/film/판본/<KEY>.json 하나가 판본 하나다(11-20 처음부터 판본 틀로 만든 편).
// LAB 몽골 M63 「배달 시킬 때 네 마디」. 몽골어는 세 겹 검수(../../../게시/검문/)를 거친 글만 판본/MN.json에.
// 키는 계정 원장(docs/마케팅/sns-계정.json) LAB 계정의 rotationVersion, 없으면 countryCode. 같은 영어라도 나라마다 판본이 따로다.
// 그림 · 한국어(말의 한글) · 소리 · 박자 · 카메라는 정본 하나(data.ts · Film.tsx)이고, 판본은 글 자리와 글꼴만 바꾼다(원본 동결).
// 글이 다 찬 판본만 낸다 — 빈 칸이 있으면 Root가 컴포지션을 등록하지 않고, 편 폴더의 판본렌더.mjs가 그 키를 건너뛰며 빈 칸을 알린다.
// `_`로 시작하는 칸(_설명 · _한도 · _원문)은 글 쓰는 사람을 위한 안내라 읽지 않는다. 키릴 읽는 법은 우리 몽골 편 규칙(ㅓ=ө · ㅐㅔ=э · ㅜ=у · ㅡ=ы · 받침 ㅇ=н · ㅈ=ж).
// 읽는 법(reads · msgRead · naRead)은 정본 글꼴(Inter Tight 기울임)로 그린다 — 몽골판만 키릴, 다른 판은 로마자다.
export type LocPack = {
  lang: string; // 언어(계정 원장 language)
  font: string; // 그 나라 글 서체 줄
  lineH: number; // 그 나라 글의 줄 높이 하한 — 머리 글 · 뜻 줄은 max(1.14, lineH), 끝 줄은 max(1.2, lineH). 몽골판 1.14
  hook: string; // 0~1.8초 머리 글 「배달 요청 사항에 쓰는 네 마디」(줄 바꿈 문자로 두 줄)
  hookSize: number; // 몽골판 80
  mate: string; // 0~1.8초 잠든 룸메이트 곁 작은 이름표 「룸메이트 · 자는 중」(한 줄 · 짧게)
  memo: string; // 1.8~4.0초 첫째 마디 칸(지난번 매웠던 떡볶이 — 회상) 위 왼쪽 작은 표시 「💭 지난번」
  reads: string[]; // 네 마디의 읽는 법 — 덜 맵게 해 주세요 · 문 앞에 놔 주세요 · 벨 누르지 말아 주세요 · 도착하면 문자 주세요
  means: string[]; // 그 뜻 넷
  meanSize: number; // 몽골판 54
  smell: string; // 14.1~14.6초 얼굴 가까이 칸 아래 「👃 냄새!」(한 낱말 · 짧게)
  riderNote: string; // 10.25~11.4초 기사 장면 위 한 줄 「벨을 누르지 않았다」(🤫 표시와 함께 · 한 줄 · 짧게)
  msgFrom: string; // 11.5~13.0초 문자 상자 머리 「📱 기사님이 보낸 문자」(작은 한 줄 · 이해 시험 v3 둘이 「도착했어요」가 누구 말인지 짚음)
  msgRead: string; // 11.5~13.0초 폰에 뜬 문자 「도착했어요」의 읽는 법
  msgMean: string; // 그 뜻(한 줄)
  naRead: string; // 14.6초~ 벌떡 일어난 룸메이트 「나도…!」의 읽는 법
  naMean: string; // 그 뜻(한 줄)
  smallSize: number; // 문자 · 「나도」 뜻 글자 크기 — 몽골판 50
  end: string; // 15.6초~끝 끝 줄(크림색) — 지난 두 편과 다른 한마디
  endSize: number; // 몽골판 62
  coverAt: number; // 표지(cover.png)로 뜰 초
  // 나라 인사 카드(11-12, 선택 — Greeting.tsx). hello가 빈 글이면 인사 없이 원본 그대로다.
  hello: string;
  helloName: string;
  helloRead: string;
  helloVo: string;
  helloSec: number;
};

// ── 아래는 여러 편이 같은 꼴로 쓴다(편마다 칸 표만 다르다) ──
type 칸 = '글' | '글?' | '수' | '참거짓' | { 글들: number; 선택?: boolean } | { 수들: number };
const 칸표: Record<keyof LocPack, 칸> = {
  lang: '글', font: '글', lineH: '수', hook: '글', hookSize: '수', mate: '글', memo: '글',
  reads: { 글들: 4 }, means: { 글들: 4 }, meanSize: '수',
  smell: '글', riderNote: '글', msgFrom: '글', msgRead: '글', msgMean: '글', naRead: '글', naMean: '글', smallSize: '수',
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
