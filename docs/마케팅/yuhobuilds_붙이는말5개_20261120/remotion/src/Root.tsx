import { Composition } from 'remotion';
import './lib/fonts';
import { Film, TOTAL } from './hm/Film';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 본편(11-20): npx remotion render src/index.ts main out/r1.mp4 */}
    <Composition id="main" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true, voice: true, host: 'face' as const }} />
    {/* 몽글이 판(11-20 견줄 판): npx remotion render src/index.ts mong out/m1.mp4 */}
    <Composition id="mong" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true, voice: true, host: 'mong' as const }} />
    {/* 음악만(음악층 검사) */}
    <Composition id="musiconly" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true, voice: false, host: 'face' as const }} />
  </>
);
