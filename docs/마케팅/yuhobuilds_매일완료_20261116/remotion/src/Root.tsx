import { Composition } from 'remotion';
import './lib/fonts';
import { F, Film, TOTAL } from './y55/Film';
import { HERO } from './y55/timeline';

export const RemotionRoot: React.FC = () => (
  <>
    {/* Y55 본편(11-16): npx remotion render src/index.ts main out/y55_r1.mp4 */}
    <Composition id="main" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true, voice: true, hero: false }} />
    {/* 음악만(음악층 검사) */}
    <Composition id="musiconly" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true, voice: false, hero: false }} />
    {/* 핵심 장면 먼저(글 · 말 없이 — 24칸에 +0이 쌓이고 숫자는 0 그대로 · 사흘에 완료 도장): npx remotion render src/index.ts hero ../장면/장면_v1.mp4 */}
    <Composition id="hero" component={Film} durationInFrames={F(HERO.len)} fps={30} width={1080} height={1920} defaultProps={{ bgm: false, voice: false, hero: true }} />
  </>
);
