import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film, FPS, TOTAL_FRAMES } from './film/Film';
import { FilmGreet, greetFrames } from './film/Greeting';
import { 판본들 } from './film/판본';

// 10-29 LAB 몽골 M11 — E9와 같은 오마주 뼈대(doci Ia6gYNDm-7o 9칸), 사장님 앞 판(기획.md 「원본 1:1」).
// 11-10 판본 틀: film/판본/<KEY>.json마다 sorry-<KEY> 하나(글이 다 찬 판본만). 옛 sorry-mn은 MN이다.
// 옛 두 채널 판(sorry-mn-zh · -my)의 글은 v7(11-01 다시 살림) 앞 아홉 칸 짜임이라 지금 열 칸과 맞지 않아(13초부터 글이 없어 렌더가 멈춤) 옮기지 않았다.
// 11-12 나라 인사 카드: 판본 글의 인사 칸(hello)이 찬 판본은 훅 앞에 인사 장면(film/Greeting.tsx)이 붙고 그만큼 길다. 빈 판본은 원본 그대로.
// 렌더는 편 폴더의 판본렌더.mjs <KEY…|전부> → 게시/판본/<KEY>/video.mp4 · cover.png
export const RemotionRoot: React.FC = () => (
  <>
    {판본들.map(({ key, pack }) =>
      pack.hello ? (
        <Composition key={key} id={`sorry-${key}`} component={FilmGreet} defaultProps={{ L: pack, k: key }} durationInFrames={TOTAL_FRAMES + greetFrames(pack)} fps={FPS} width={1080} height={1920} />
      ) : (
        <Composition key={key} id={`sorry-${key}`} component={Film} defaultProps={{ L: pack }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
      ),
    )}
  </>
);
