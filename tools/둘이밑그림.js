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

  /* 🔴 09-05 유호 확정 — 「저 뒤에 [가] 이건 빼주고 배경은 라디오에 쓰이는 배경 중 하나를 골라서」.
   *   자수 글자 「가」 판은 걷었다(앞서 세 번 굽는 동안 저쪽이 산호·기하무늬로 다시 그렸고,
   *   네 번째에 제대로 나왔지만 유호님이 배경 쪽을 고르셨다).
   *   🔑 배경 = `docs/라디오/무대/citypop.png` — 라디오24 무대 일곱 중 하나다. 고른 까닭 셋:
   *     ① 음악이 시티팝이라 결이 맞는다 ② 앞 컷들의 따뜻한 나무·빛과 이어진다
   *     ③ 노을은 «하루의 끝»이라 영상의 마무리와 겹친다.
   *   ⚠ 배경도 우리가 구운 «펠트 실물»이라 재질이 캐릭터와 한 몸이다(CSS 흉내가 아니다). */
  const 무대 = path.join(뿌리, 'docs', '라디오', '무대', (process.env.SYNK_무대 || 'citypop') + '.png');
  const 무대있나 = fs.existsSync(무대);
  if (!무대있나) console.log(`🟠 라디오 무대를 못 찾았다(${무대}) — 크림 단색으로 짓는다.`);

  const 낼것 = path.join(낼곳, '둘이나란히.png');
  const 입력 = ['-i', 몽글, '-i', 까몽];
  /* 캐릭터는 «바닥에 서게» 아래쪽에 놓는다 — 무대 그림의 모래·물가가 화면 아랫부분이다. */
  let 필터;
  if (무대있나) {
    입력.push('-i', 무대);
    /* 🔴 620px 로 놓았더니 저쪽이 카메라를 빼서 결과에서는 화면의 20% 가 됐다(09-05).
     *   밑그림에서 «크게» 놓아야 그만큼 덜 빠진다. 780px = 화면 높이의 72%. */
    필터 = '[2:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080[bg];'
      + '[0:v]scale=-1:780[a];[1:v]scale=-1:740[b];'
      + '[bg][a]overlay=x=250:y=255[t];[t][b]overlay=x=1010:y=290';
  } else {
    필터 = 'color=c=0xE8DCC8:s=1920x1080[bg];'
      + '[0:v]scale=-1:700[a];[1:v]scale=-1:670[b];'
      + '[bg][a]overlay=x=330:y=300[t];[t][b]overlay=x=1090:y=330';
  }
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...입력, '-filter_complex', 필터,
    '-frames:v', '1', 낼것]);

  const 확인 = path.join(낼곳, '_확인.jpg');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', 낼것, '-vf', 'scale=900:-1', 확인]);
  console.log(`✅ ${낼것}`);
  console.log(`   확인용 ${확인}`);
})();
