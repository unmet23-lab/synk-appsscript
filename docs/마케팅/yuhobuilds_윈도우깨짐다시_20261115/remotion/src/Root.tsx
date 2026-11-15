import { Composition } from 'remotion';
import './lib/fonts';
import { Film, TOTAL } from './y37/Film';
import { HeroScene, HERO_LEN } from './y37/Hero';

export const RemotionRoot: React.FC = () => (
  <>
    {/* Y37 본편(11-12, 한 판이 모든 계정): 원본 qp_2Qe4grTc 뼈대 — npx remotion render src/index.ts main out/y37_r1.mp4 */}
    <Composition id="main" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true }} />
    {/* 음악만(음악층 검사): npx remotion render src/index.ts main out/music.mp4 --props='{"bgm":true}' 대신 아래 musiconly */}
    {/* 핵심 장면 먼저(11-12): npx remotion render src/index.ts hero ../장면/장면_v2.mp4 */}
    <Composition id="hero" component={HeroScene} durationInFrames={HERO_LEN} fps={30} width={1080} height={1920} />
  </>
);
