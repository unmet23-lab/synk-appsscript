import { Composition } from 'remotion';
import './lib/fonts';
import { F, Film, HERO, TOTAL } from './y46/Film';

export const RemotionRoot: React.FC = () => (
  <>
    {/* Y46 본편(11-13): npx remotion render src/index.ts main out/y46_r1.mp4 */}
    <Composition id="main" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true, voice: true, bare: false }} />
    {/* 음악만(음악층 검사) */}
    <Composition id="musiconly" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true, voice: false, bare: false }} />
    {/* 핵심 장면 먼저(글 · 말 없이 실제 견적 395,000원 아래 손님 화면 「40만원」이 쿵 — 4.6초): npx remotion render src/index.ts hero ../장면/장면_v1.mp4 */}
    <Composition id="hero" component={Film} durationInFrames={F(HERO.len)} fps={30} width={1080} height={1920} defaultProps={{ bgm: false, voice: true, bare: true }} />
  </>
);
