import { Composition } from 'remotion';
import './lib/fonts';
import { Film, HERO_LEN, HeroScene, TOTAL } from './y75/Film';

export const RemotionRoot: React.FC = () => (
  <>
    {/* Y75 본편(11-21): npx remotion render src/index.ts main out/y75_r1.mp4 */}
    <Composition id="main" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true, voice: true }} />
    {/* 음악만(음악층 검사) */}
    <Composition id="musiconly" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true, voice: false }} />
    {/* 핵심 장면 먼저(글 · 말 없이): npx remotion render src/index.ts hero ../장면/장면_v1.mp4 */}
    <Composition id="hero" component={HeroScene} durationInFrames={Math.round(HERO_LEN * 30)} fps={30} width={1080} height={1920} />
  </>
);
