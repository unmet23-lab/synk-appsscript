import { Composition } from 'remotion';
import './lib/fonts';
import { TOTAL, VocabFilm } from './vocab/VocabFilm';

// LAB 「아는 단어 총동원」(10-21): 퀴즈 #4 프로젝트를 복사해 색·글자·소리 부품(kids/theme·lib)만 쓰고 화면은 vocab/에 새로 짰다.
// 소리는 두 판이 같은 한국어(묻는 사람 범수 · 학습자 하나), 화면 글만 판마다 다르다(vocab/data.ts).
export const RemotionRoot: React.FC = () => (
  <>
    {/* 영어판(YouTube @synkkorean) */}
    <Composition id="vocab-en" component={VocabFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ lang: 'en' as const }} />
    {/* 몽골어판(인스타 @synk.mn · 페북 synkworld) */}
    <Composition id="vocab-mn" component={VocabFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ lang: 'mn' as const }} />
  </>
);
