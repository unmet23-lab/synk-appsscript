// 「매진 임박」 Remotion 장면들. 홈쇼핑 끼어들기 넷(H1 · H2 · H3 · HE)은 따로 보고, 가편집(Film · Band916)이 그대로 가져다 쓴다.
import React from 'react';
import { Composition } from 'remotion';
import './lib/fonts';
import { H1, H2, H3, HE, LEN } from './hs/scenes';
import { Band916, FILM_LEN, Film } from './film/Film';

const HD = { width: 1920, height: 1080, fps: 24 };

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="H1" component={H1} durationInFrames={LEN.H1} {...HD} />
    <Composition id="H2" component={H2} durationInFrames={LEN.H2} {...HD} />
    <Composition id="H3" component={H3} durationInFrames={LEN.H3} {...HD} />
    <Composition id="HE" component={HE} durationInFrames={LEN.HE} {...HD} />
    <Composition id="Film" component={Film} durationInFrames={FILM_LEN} {...HD} />
    <Composition id="Band916" component={Band916} durationInFrames={FILM_LEN} width={1080} height={1920} fps={24} />
  </>
);
