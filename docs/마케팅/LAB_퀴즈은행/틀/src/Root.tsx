import { Composition } from 'remotion';
import './fonts';
import { EPISODE } from './episode';
import { Film, SceneOnly } from './Film';
import { SCENE_LEN, TOTAL } from './timeline';

// 판본마다 컴포지션 하나(quiz-<언어>). 첫 판본은 몽골어(mn) — tools/음악층.js가 이 파일에서 처음 나오는 컴포지션 이름 글자를 읽으므로 mn 줄을 글자로 둔다(이 주석에 그 꼴을 쓰지 않는다 — 11-10 주석의 예시를 컴포지션으로 읽어 소리 렌더가 실패했다).
// 맨 끝의 장면 컴포지션은 「한 장면 먼저」 심사용(제목 · 글 없이 첫 문제 장면만) — 음악층은 이름에 scene이 든 것을 건너뛴다.
export const RemotionRoot: React.FC = () => {
  const others = EPISODE.langs.filter((l) => l !== 'mn');
  return (
    <>
      {EPISODE.langs.includes('mn') ? (
        <Composition id="quiz-mn" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ ep: EPISODE, lang: 'mn' }} />
      ) : null}
      {others.map((l) => (
        <Composition key={l} id={`quiz-${l}`} component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ ep: EPISODE, lang: l }} />
      ))}
      <Composition id="scene-only" component={SceneOnly} durationInFrames={SCENE_LEN} fps={30} width={1080} height={1920} defaultProps={{ ep: EPISODE }} />
    </>
  );
};
