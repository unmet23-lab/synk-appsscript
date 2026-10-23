// 「매진 임박」 Remotion 장면들. 홈쇼핑 끼어들기 넷(H1 · H2 · H3 · HE)은 따로 보고, 가편집(Film · Band916)이 그대로 가져다 쓴다.
// 이름 끝 -2는 2안 제품(꽉 진공 밀폐용기, hs/product.ts) — 공포 컷 · 소리는 1안과 같다.
import React from 'react';
import { Composition } from 'remotion';
import './lib/fonts';
import { H1, H2, H3, HE, LEN } from './hs/scenes';
import { P2 } from './hs/product';
import { Band916, FILM_LEN, Film } from './film/Film';
import { E1V3, E2V3, H1V3, H2V3, H3V3, LEN_V3 } from './hs/v3';
import { Band916V3, FILM_V3_LEN, FilmV3, HEADS } from './film/FilmV3';

const HD = { width: 1920, height: 1080, fps: 24 };
const HEAD_ID: Record<string, string> = { 기본: '', 전제: '-premise', 오도: '-mislead', 이름표: '-label' };
const V916 = { width: 1080, height: 1920, fps: 24 };

const H1v2: React.FC = () => <H1 p={P2} />;
const H2v2: React.FC = () => <H2 p={P2} />;
const H3v2: React.FC = () => <H3 p={P2} />;
const HEv2: React.FC = () => <HE p={P2} />;
const Filmv2: React.FC = () => <Film p={P2} />;
const Band916v2: React.FC = () => <Band916 p={P2} />;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="H1" component={H1} durationInFrames={LEN.H1} {...HD} />
    <Composition id="H2" component={H2} durationInFrames={LEN.H2} {...HD} />
    <Composition id="H3" component={H3} durationInFrames={LEN.H3} {...HD} />
    <Composition id="HE" component={HE} durationInFrames={LEN.HE} {...HD} />
    <Composition id="Film" component={Film} durationInFrames={FILM_LEN} {...HD} />
    <Composition id="Band916" component={Band916} durationInFrames={FILM_LEN} {...V916} />
    <Composition id="H1-2" component={H1v2} durationInFrames={LEN.H1} {...HD} />
    <Composition id="H2-2" component={H2v2} durationInFrames={LEN.H2} {...HD} />
    <Composition id="H3-2" component={H3v2} durationInFrames={LEN.H3} {...HD} />
    <Composition id="HE-2" component={HEv2} durationInFrames={LEN.HE} {...HD} />
    <Composition id="Film-2" component={Filmv2} durationInFrames={FILM_LEN} {...HD} />
    <Composition id="Band916-2" component={Band916v2} durationInFrames={FILM_LEN} {...V916} />
    {/* 콘티 v3(10-22 반응 조사) — 2안 제품, 쇼호스트 + 멀티캠 홈쇼핑, 36.0초. 9:16은 머리글 넷(기본 · 전제 · 오도 · 이름표) */}
    <Composition id="H1-3" component={H1V3} durationInFrames={LEN_V3.H1} {...HD} />
    <Composition id="H2-3" component={H2V3} durationInFrames={LEN_V3.H2} {...HD} />
    <Composition id="H3-3" component={H3V3} durationInFrames={LEN_V3.H3} {...HD} />
    <Composition id="E1-3" component={E1V3} durationInFrames={LEN_V3.E1} {...HD} />
    <Composition id="E2-3" component={E2V3} durationInFrames={LEN_V3.E2} {...HD} />
    <Composition id="Film-3" component={FilmV3} durationInFrames={FILM_V3_LEN} {...HD} />
    {/* 장면 이름에 한글을 못 써서(Remotion은 영문 · 숫자 · 한자만) 머리글 판 이름은 영문으로 */}
    {Object.keys(HEADS).map((h) => (
      <Composition key={h} id={`Band916-3${HEAD_ID[h] ?? ''}`} component={Band916V3} defaultProps={{ head: h }} durationInFrames={FILM_V3_LEN} {...V916} />
    ))}
  </>
);
