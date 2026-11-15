import { Composition } from 'remotion';
import './lib/fonts';
import { F, Film, TOTAL } from './y54/Film';
import { HERO } from './y54/timeline';

export const RemotionRoot: React.FC = () => (
  <>
    {/* Y54 본편(11-15): npx remotion render src/index.ts main out/y54_r1.mp4 */}
    <Composition id="main" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true, voice: true, bare: false, hero: false }} />
    {/* 음악만(음악층 검사) */}
    <Composition id="musiconly" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true, voice: false, bare: false, hero: false }} />
    {/* 핵심 장면 먼저(글 · 말 없이 — 등이 제멋대로 꺼졌다 켜졌다 · 고리 번쩍 · 횟수): npx remotion render src/index.ts hero ../장면/장면_v1.mp4 */}
    <Composition id="hero" component={Film} durationInFrames={F(HERO.len)} fps={30} width={1080} height={1920} defaultProps={{ bgm: false, voice: false, bare: false, hero: true }} />
  </>
);
