import { Composition } from 'remotion';
import './lib/fonts';
import { Film } from './Film';
import { TOTAL } from './t';

// 훅 A = 인스타(107GB를 두고 왔어요), 훅 C = 유튜브(외장 SSD 없이 통째로). 기획.md 「정한 것」
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="move-A" component={Film} defaultProps={{ hook: 'A' as const }} durationInFrames={TOTAL} fps={30} width={1080} height={1920} />
    <Composition id="move-C" component={Film} defaultProps={{ hook: 'C' as const }} durationInFrames={TOTAL} fps={30} width={1080} height={1920} />
  </>
);
