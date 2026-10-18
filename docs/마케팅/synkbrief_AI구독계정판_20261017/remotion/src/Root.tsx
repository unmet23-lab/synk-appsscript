import { Composition } from 'remotion';
import './lib/fonts';
import { Film, TOTAL } from './Film';

export const RemotionRoot: React.FC = () => (
  <Composition id="motion-test" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} />
);
