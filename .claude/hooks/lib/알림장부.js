'use strict';
/**
 * 알림장부 — 「내가 지은 알림이 실제로 뜬 적이 있나」를 세기 위한 한 줄 적기.
 *
 * ■ 왜 있나 (09-03 · 유호님 「2주 뒤 세는 것도 자동으로 되게 해줘」)
 *   그날 알림 둘을 지으며 「2주 뒤에 몇 번 떴는지 세서 값이 0이면 걷겠다」고 적었다.
 *   그런데 그 약속이 **내 기억에만** 걸려 있었다 — 유호님이 안 물으시면 안 세진다.
 *   ⇒ 뜬 사실을 그 자리에서 적고, 판정도 기계가 꺼내게 한다(tools/알림값점검.js).
 *
 * ■ 장부는 git 밖이다
 *   추적하면 알림이 뜰 때마다 미커밋이 하나 생겨 `git status` 가 영영 안 깨끗해진다.
 *   선례 = .claude/세션끝장부.jsonl · .claude/모델장부.jsonl (둘 다 .gitignore 에 있다).
 *   ⚠ 임시 폴더가 아니라 여기 두는 이유: 임시 폴더는 주기적으로 걷어내는데(수십 GB 로 쌓인다),
 *     2주를 견뎌야 하는 기록이라 그 청소에 쓸려 나가면 「0건」이 «못 쟀다»와 같은 얼굴이 된다.
 */
const fs = require('fs');
const path = require('path');

const 장부이름 = '알림장부.jsonl';

/**
 * 알림이 «실제로 유호님 화면에 나간» 그 자리에서 부른다.
 * @param {string} 종류 - '맥락' | '재활용' | '모델' | '도구판'
 * @param {object} [값] - 그때의 숫자(나중에 「얼마나 심했나」를 볼 재료)
 */
function 적기(종류, 값) {
  try {
    const 뿌리 = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const 줄 = { 시각: new Date().toISOString(), 종류, ...(값 || {}) };
    fs.appendFileSync(path.join(뿌리, '.claude', 장부이름), JSON.stringify(줄) + '\n', 'utf8');
  } catch { /* 못 적어도 알림 자체를 막지 않는다 — 세는 것이 알리는 것보다 아래다 */ }
}

module.exports = { 적기, 장부이름 };
