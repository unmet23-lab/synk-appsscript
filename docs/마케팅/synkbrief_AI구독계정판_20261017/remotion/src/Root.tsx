import { Composition } from 'remotion';
import './lib/fonts';
import { Film, TOTAL } from './Film';
import { Film5, TOTAL5 } from './v5/Film5';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="motion-test" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} />
    <Composition id="motion-test-v5" component={Film5} durationInFrames={TOTAL5} fps={30} width={1080} height={1920} />
  </>
);
