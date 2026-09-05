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
const 정본방 = path.join(뿌리, 'docs', '캐릭터', '정본_4K_후보');
const 낼곳 = path.join(뿌리, '영상', 'out', '홍보_4K_v2', '_밑그림');

/* 실제 파일 이름을 «읽어서» 쓴다 — 이름을 코드에 박으면 한글 정규화 차이로 못 찾는 일이 있다. */
function 찾기(누구) {
  const 목록 = fs.readdirSync(정본방);
  const 것 = 목록.find((n) => {
    const s = n.normalize('NFC');
    return s.includes(누구) && s.includes('본체') && s.includes('누끼');
  });
  if (!것) throw new Error(`${누구} 누끼 판을 못 찾았다 — ${정본방}`);
  return path.join(정본방, 것);
}

(async () => {
  fs.mkdirSync(낼곳, { recursive: true });
  const 몽글 = 찾기('몽글');
  const 까몽 = 찾기('까몽');
  console.log(`몽글 = ${path.basename(몽글)}`);
  console.log(`까몽 = ${path.basename(까몽)}`);

  const 낼것 = path.join(낼곳, '둘이나란히.png');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', 몽글, '-i', 까몽,
    '-filter_complex',
    /* 바탕은 크림 단색으로 둔다 — 컷5(몽글) 실측에서 저쪽이 단색 배경을 나무 바닥과 창빛으로
     * 잘 채웠다. 배경을 그려 넣으면 오히려 그 그림에 갇힌다. */
    'color=c=0xE8DCC8:s=1920x1080[bg];'
    + '[0:v]scale=-1:700[a];[1:v]scale=-1:670[b];'
    + '[bg][a]overlay=x=330:y=300[t];[t][b]overlay=x=1090:y=330',
    '-frames:v', '1', 낼것]);

  const 확인 = path.join(낼곳, '_확인.jpg');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', 낼것, '-vf', 'scale=900:-1', 확인]);
  console.log(`✅ ${낼것}`);
  console.log(`   확인용 ${확인}`);
})();
