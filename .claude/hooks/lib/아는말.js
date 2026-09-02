'use strict';
/**
 * 아는말 — 유호님이 «이미 아시는» 낱말. 여기 든 것만 검사를 통과한다.
 *
 * ■ 🔴 이 목록의 방향이 설계의 전부다 (유호 픽 2026-09-03)
 *   처음 떠올린 설계는 **「어려운 낱말 목록」**이었다. 그건 틀린 방향이다 —
 *   목록을 내가 만들면 **내가 어려운 줄 모르는 낱말은 애초에 목록에 안 들어가고**,
 *   장치는 「0건 깨끗하다」고 답한다([[zero-is-a-success-face-taxonomy]] 를 내 손으로 짓는 꼴).
 *   09-03 당일 실측이 그대로 이것이었다: 나는 「자」가 어려운 줄 몰랐고, 목록을 만들었다면
 *   거기 안 넣었을 것이며, 유호님은 **첫 턴에 되물으셨다.**
 *
 *   ⇒ 뒤집는다. **기본값은 «전부 낯설다»**이고, 이 목록에 든 것만 빠져나간다.
 *      · 내 눈이 틀리는 모습이 «놓침»이 아니라 «시끄러움»으로 나타난다.
 *      · 시끄러운 건 이 파일에 한 줄 더해서 고친다. 놓치는 건 못 고친다.
 *      · 여기 «잘못 넣은» 낱말은 유호님이 되물으시는 순간 드러나고, 그때 뺀다.
 *        즉 목록이 시간이 갈수록 **유호님 눈에 가까워진다.**
 *
 * ■ 넣는 기준 — 좁게 시작한다
 *   「아마 아실 것」은 넣지 않는다. 확신이 서는 것만. 좁으면 시끄럽고, 넓으면 새는데,
 *   **시끄러운 쪽이 고칠 수 있는 쪽**이다. clasp·master·Apps Script 를 일부러 뺀 이유다.
 *
 * ■ 뺄 때 (되물음이 나왔을 때)
 *   유호님이 「그게 뭐야」 하신 낱말을 여기서 지우고, 기억 `plain-words-to-yuho-standing`
 *   의 되물음 표에 적는다. 두 곳이 한 벌이다.
 */

// 대소문자를 무시하고 견준다. 실물 이름(파일·명령)은 여기 넣지 않는다 —
// 그건 «바꾸지 않고 뜻만 붙이는» 대상이라 걸려야 정상이다.
const 아는말 = [
  // 우리 것
  'SYNK', 'SHIFT', 'LAB', 'TOPIK', 'EPS', 'K-Startup',
  // 유호님이 손수 쓰시는 프로그램
  'Blender', 'Canva', 'Figma', 'Notion', 'Excel', 'Word', 'Windows', 'Chrome',
  'YouTube', 'TikTok', 'Instagram', 'Facebook', 'Gmail', 'Google', 'GitHub',
  'Supabase', 'Expo', 'Glide', 'Remotion', 'Lottie', 'Skia',
  // AI 이름
  'AI', 'ChatGPT', 'GPT', 'Claude', 'Gemini', 'Codex',
  // 일상 약어
  'PC', 'USB', 'PDF', 'HTML', 'CSS', 'URL', 'SNS', 'DM', 'FAQ', 'ID', 'QR',
  'TV', 'VR', 'AR', 'OK', 'CD', 'DVD',
  // 단위
  'GB', 'MB', 'KB', 'TB', 'RAM', 'GPU', 'CPU', 'SSD', 'px', 'cm', 'mm', 'kg', 'ml',
  // 우리 일에서 매일 나오는 말
  'git', 'push', 'PR',
];

const 아는말집합 = new Set(아는말.map((w) => w.toLowerCase()));

module.exports = { 아는말, 아는말집합 };
