#!/usr/bin/env node
/* 「둘이 나란히」 컷의 첫 프레임 밑그림 — 정본 누끼 둘을 16:9 판에 나란히 놓는다.
 *
 * ■ 왜 필요한가
 *   글로만 「코랄 캐릭터와 검은 고양이가 나란히」라고 쓰면 저쪽이 «닮은 딴것»을 만든다.
 *   정본을 첫 프레임으로 박아야 우리 몽글이·까몽이가 나온다.
 *
 * ■ 09-05 1차가 왜 탈락했나
 *   캐릭터를 470px(화면 높이의 43%)로 놓았는데 저쪽이 카메라를 크게 빼서 결과에서는
 *   둘이 화면의 15% 밖에 안 됐다. 「명품의 여백」은 «주인공이 보이는» 여백이지 빈 화면이 아니다.
 *   ⇒ 밑그림에서 더 크게 놓고(700px = 65%), 지시문에서도 카메라를 못 빼게 막는다.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const 뿌리 = path.join(__dirname, '..');
/* 🔴 09-05 오후에 옆 세션이 `정본_4K_후보` 를 `정본_4K` 로 승격시키면서 누끼 판을 걷었다.
 *   그래서 폴더를 «찾고», 누끼가 없으면 `tools/마스코트누끼.js` 로 그 자리에서 만든다. */
const 후보방 = ['정본_4K', '정본_4K_후보'].map((n) => path.join(뿌리, 'docs', '캐릭터', n));
const 정본방 = 후보방.find((p) => fs.existsSync(p));
const 낼곳 = path.join(뿌리, '영상', 'out', '홍보_4K_v2', '_밑그림');

/* 실제 파일 이름을 «읽어서» 쓴다 — 이름을 코드에 박으면 한글 정규화 차이로 못 찾는 일이 있다. */
function 찾기(누구) {
  if (!정본방) throw new Error(`정본 4K 폴더를 못 찾았다: ${후보방.join(' · ')}`);
  for (const 방 of [path.join(정본방, '누끼'), 정본방]) {
    if (!fs.existsSync(방)) continue;
    const 것 = fs.readdirSync(방).find((n) => {
      const s = n.normalize('NFC');
      return s.includes(누구) && s.includes('본체');
    });
    if (것) return path.join(방, 것);
  }
  throw new Error(`${누구} 본체를 못 찾았다 — 누끼가 없으면 먼저: `
    + `node tools/마스코트누끼.js --입력 docs/캐릭터/정본_4K --출력 docs/캐릭터/정본_4K/누끼 ${누구}_본체.png`);
}

(async () => {
  fs.mkdirSync(낼곳, { recursive: true });
  const 몽글 = 찾기('몽글');
  const 까몽 = 찾기('까몽');
  console.log(`몽글 = ${path.basename(몽글)}`);
  console.log(`까몽 = ${path.basename(까몽)}`);

  /* 🔴 09-05 유호 제안 「이 배경 뒤에 한국어 관련 오브제를 넣으면 간접적으로 명품느낌으로 어필」.
   *   말로 설명하지 않고 배경이 대신 말하는 것이 명품 광고의 방법이라 그대로 받았다.
   *   🔑 **AI 에게 한글을 만들라고 시키지 않는다** — 깨진 자모가 나온다. 대신 08-20 에 블렌더로
   *      구워 둔 «자수 글자 「가」»(글자공방)를 실물로 넣는다. 진짜 한글이고 재질도 우리 펠트다. */
  const 가 = path.join(뿌리, 'docs', '캐릭터', '글자공방_0820', '자수글자_v1.png');
  const 글자있나 = fs.existsSync(가);
  if (!글자있나) console.log('🟠 자수 글자 「가」를 못 찾았다 — 글자 없이 짓는다.');

  const 낼것 = path.join(낼곳, '둘이나란히.png');
  /* 바탕은 크림 단색으로 둔다 — 컷5(몽글) 실측에서 저쪽이 단색 배경을 나무 바닥과 창빛으로
   * 잘 채웠다. 배경을 그려 넣으면 오히려 그 그림에 갇힌다.
   * 「가」 패널은 뒤쪽 왼편에 «세워 둔 액자»처럼 놓는다 — 주인공 둘을 가리지 않는 자리다. */
  const 입력 = ['-i', 몽글, '-i', 까몽];
  let 필터 = 'color=c=0xE8DCC8:s=1920x1080[bg];'
    + '[0:v]scale=-1:700[a];[1:v]scale=-1:670[b];';
  if (글자있나) {
    입력.push('-i', 가);
    // 검은 여백을 잘라내 패널만 남긴다(원본 1800×1400 · 패널이 가운데 88% 를 채운다).
    필터 += '[2:v]crop=iw*0.84:ih*0.76:iw*0.08:ih*0.12,scale=-1:300[g];'
      + '[bg][g]overlay=x=45:y=215[bg2];'
      + '[bg2][a]overlay=x=330:y=300[t];[t][b]overlay=x=1090:y=330';
  } else {
    필터 += '[bg][a]overlay=x=330:y=300[t];[t][b]overlay=x=1090:y=330';
  }
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...입력, '-filter_complex', 필터,
    '-frames:v', '1', 낼것]);

  const 확인 = path.join(낼곳, '_확인.jpg');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', 낼것, '-vf', 'scale=900:-1', 확인]);
  console.log(`✅ ${낼것}`);
  console.log(`   확인용 ${확인}`);
})();
