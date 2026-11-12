import { Composition } from 'remotion';
import './lib/fonts';
import { Film, HERO_LEN, TOTAL } from './y44/Film';

export const RemotionRoot: React.FC = () => (
  <>
    {/* Y44 본편(11-13): npx remotion render src/index.ts main out/y44_r1.mp4 */}
    <Composition id="main" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true, voice: true, bare: false }} />
    {/* 음악만(음악층 검사) */}
    <Composition id="musiconly" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true, voice: false, bare: false }} />
    {/* 핵심 장면 먼저(글 · 말 없이 셔터가 닫히는 5초): npx remotion render src/index.ts hero ../장면/장면_v1.mp4 */}
    <Composition id="hero" component={Film} durationInFrames={HERO_LEN} fps={30} width={1080} height={1920} defaultProps={{ bgm: false, voice: true, bare: true }} />
  </>
);
