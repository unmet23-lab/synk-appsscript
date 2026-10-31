import { Composition } from 'remotion';
import './lib/fonts';
import { Y29Film } from './y29/Film';
import { B } from './y29/time';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 같은 화면 · 같은 박자 두 판 — A: 범수 1인칭 내레이션 · B: 내레이션 없음(화면 글 + 작업 소리 + 배경음) */}
    <Composition id="A" component={Y29Film} durationInFrames={B.total} fps={30} width={1080} height={1920} defaultProps={{ cut: 'A' as const }} />
    <Composition id="B" component={Y29Film} durationInFrames={B.total} fps={30} width={1080} height={1920} defaultProps={{ cut: 'B' as const }} />
  </>
);
