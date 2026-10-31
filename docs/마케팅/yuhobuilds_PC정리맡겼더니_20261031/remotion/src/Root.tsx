import { Composition } from 'remotion';
import './lib/fonts';
import { CoverStill, PcFilm } from './y27/Film';
import { HeroScene, HERO_LEN } from './y27/Hero';
import { TOTAL } from './y27/time';

export const RemotionRoot: React.FC = () => (
  <>
    {/* Y27(10-31, 한 판이 모든 계정): 원본 UzmsVkfKjbg 뼈대 — npx remotion render src/index.ts main out/y27_r1.mp4 */}
    <Composition id="main" component={PcFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true }} />
    {/* 표지: npx remotion still src/index.ts cover out/cover.png */}
    <Composition id="cover" component={CoverStill} durationInFrames={1} fps={30} width={1080} height={1920} />
    {/* 핵심 장면 먼저(10-31): npx remotion render src/index.ts hero ../장면/장면_v2.mp4 */}
    <Composition id="hero" component={HeroScene} durationInFrames={HERO_LEN} fps={30} width={1080} height={1920} />
  </>
);
