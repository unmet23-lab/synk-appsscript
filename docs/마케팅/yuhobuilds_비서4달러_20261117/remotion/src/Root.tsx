import { AbsoluteFill, Composition, useCurrentFrame } from 'remotion';
import './lib/fonts';
import { Film, TOTAL } from './y63/Film';
import { READ, ReadScene } from './y63/ReadScene';
import { STAGE } from './y63/Tower';

const Hero: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: STAGE }}>
      <ReadScene t={f / 30} />
    </AbsoluteFill>
  );
};

export const RemotionRoot: React.FC = () => (
  <>
    {/* Y63 본편(11-17): npx remotion render src/index.ts main out/y63_r1.mp4 */}
    <Composition id="main" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true, voice: true }} />
    {/* 음악만(음악층 검사) */}
    <Composition id="musiconly" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true, voice: false }} />
    {/* 핵심 장면 먼저(글 · 말 없이): npx remotion render src/index.ts hero ../장면/장면_v1.mp4 */}
    <Composition id="hero" component={Hero} durationInFrames={Math.round(READ.len * 30)} fps={30} width={1080} height={1920} />
  </>
);
