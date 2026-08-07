// 표 — 마크다운 표 한 줄을 칸으로 가르는 **단 하나의 통로**.
//
// 왜 있나: 이 저장소의 표는 백틱 인용이 빽빽하다(`local_xxx`·`2>&1|docs/…`·`git commit -a`).
// 그런데 표를 읽는 곳마다 `줄.split('|')` 로 갈랐고, 백틱 **안**의 파이프까지 칸막이로 세면
// 그 뒤 칸이 통째로 한 칸씩 밀린다. 밀린 뒤에도 오류는 안 난다 — 값이 있는 다른 칸을 읽을 뿐이라
// **모양은 정상이고 새는 방향은 언제나 「통과」다.**
//
// 실측 2026-08-07 (한 줄짜리 원인이 네 곳에서 동시에 터졌다):
//   · tools/friction.js       — 살아있는 신호 F193 이 「해소됨」으로 읽혀 --open 에서 통째로 사라졌다.
//                               resolve 는 잘린 신고문을 그대로 되써 뒷부분을 조용히 지운다(append-only 유실).
//   · hooks/lib/session-report — 인계문의 「상태/다음」이 그 자리에서 잘려 나갔다(다음 세션이 받는 첫 화면).
//   · hooks/track-collision    — 파일 선언 칸이 밀려, 겹침을 재는 가드가 엉뚱한 칸을 잰다.
//   · hooks/board-guard        — 상태 칸이 밀려 200자 검사는 짧게 재고(누수) 완료 줄은 활성으로 센다.
//
// 그래서 규칙을 프로즈로 적지 않고 통로를 하나로 만든다 — 새로 표를 읽는 곳은 여기를 쓴다.
'use strict';

/** 코드 범위(백틱)를 **길이를 보존한 채** 공백으로 덮는다 — 덮은 판의 자리 번호로 원문을 자를 수 있다. */
function 코드덮기(text) {
  return String(text).replace(/```[\s\S]*?```|`[^`\n]*`/g, (m) => ' '.repeat(m.length));
}

/* 자리는 UTF-16 단위로만 센다 — 표에 이모지(🔴·⚠·✅)가 흔한데
 * [...s] 처럼 코드포인트로 세면 서로게이트 쌍에서 덮은 판과 원문의 자리가 어긋난다. */
function 자리들(raw) {
  const 덮은 = 코드덮기(raw);
  const out = [];
  for (let i = 0; i < 덮은.length; i++) if (덮은[i] === '|') out.push(i);
  return out;
}

/** 표 한 줄 → 칸 배열. 양끝 `|` 는 버린다. 백틱 안의 파이프는 칸막이가 아니다. */
function 칸나누기(줄) {
  const t = String(줄).trim().replace(/^\|/, '').replace(/\|$/, '');
  const out = [];
  let cur = 0;
  for (const i of 자리들(t)) { out.push(t.slice(cur, i)); cur = i + 1; }
  out.push(t.slice(cur));
  return out.map((c) => c.trim());
}

/** 칸에 넣기 전 소독. 표를 깨뜨리는 건 **날 파이프뿐**이라 백틱 안은 그대로 둔다. */
function 칸안전(s) {
  const t = String(s).replace(/\n/g, ' ');
  const 덮은 = 코드덮기(t);
  let out = '';
  for (let i = 0; i < t.length; i++) out += 덮은[i] === '|' ? '/' : t[i];
  return out.trim();
}

module.exports = { 코드덮기, 칸나누기, 칸안전 };
