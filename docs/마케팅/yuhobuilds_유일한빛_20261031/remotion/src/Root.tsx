import { Composition } from 'remotion';
import './lib/fonts';
import { CoverStill, LightFilm } from './y25/Film';
import { TOTAL } from './y25/time';

export const RemotionRoot: React.FC = () => (
  <>
    {/* Y25(10-31, 한 판이 모든 계정): 원본 Ls0r557jclc 뼈대 — npx remotion render src/index.ts main out/y25_r1.mp4 */}
    <Composition id="main" component={LightFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true }} />
    {/* 표지: npx remotion still src/index.ts cover out/cover.png */}
    <Composition id="cover" component={CoverStill} durationInFrames={1} fps={30} width={1080} height={1920} />
  </>
);
