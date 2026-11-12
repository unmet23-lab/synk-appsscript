import { Composition } from 'remotion';
import './lib/fonts';
import { Film, TOTAL } from './y39/Film';
import { HeroScene, HERO_LEN } from './y39/Hero';

export const RemotionRoot: React.FC = () => (
  <>
    {/* Y39 본편(11-13): 원본 3Wo7N1FpLas 뼈대 — npx remotion render src/index.ts main out/y39_r1.mp4 */}
    <Composition id="main" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true, voice: true }} />
    {/* 음악만(음악층 검사) */}
    <Composition id="musiconly" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true, voice: false }} />
    {/* 핵심 장면 먼저: npx remotion render src/index.ts hero ../장면/장면_v1.mp4 */}
    <Composition id="hero" component={HeroScene} durationInFrames={HERO_LEN} fps={30} width={1080} height={1920} />
  </>
);
