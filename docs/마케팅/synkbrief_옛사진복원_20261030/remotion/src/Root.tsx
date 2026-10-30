import { AbsoluteFill, Audio, Composition, OffthreadVideo, Sequence, interpolate, staticFile } from 'remotion';
import './lib/fonts';
import { Before, Film, TOTAL, V1_FROM } from './Film';

// 장면 심사용 — 핵심 장면만(제작 절차 「한 장면 먼저」 ①): 제목 · 이름표 · 자막 없이 그 장면의 소리째.
// 바랜 옛 사진(카운트다운 「1」) → 0.7초에 녹아 V1(「살아 움직이게 해 줘」만 — 크게 웃고 지어낸 목소리로 손님을 맞음) → 끝에 아들 목소리 한 줄.
const SCENE_LEN = 192;
const SCENE_V1 = 2.2; // V1 2.2초부터 — 「날씨가 많이 춥죠?」 · 손짓 · 다가가며 크게 웃음
const SceneOnly: React.FC = () => (
  <AbsoluteFill style={{ background: '#1b1612' }}>
    <Sequence from={12}>
      <OffthreadVideo src={staticFile('img/V1.mp4')} startFrom={Math.round(SCENE_V1 * 30)} style={{ width: 1080, height: 1920 }}
        volume={(x) => interpolate(x, [0, 80, 90], [1, 1, 0.15], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
    </Sequence>
    <Sequence from={-140} durationInFrames={172}>
      <Before fadeAt={160} />
    </Sequence>
    <Sequence from={100}>
      <Audio src={staticFile('vo/v02.wav')} />
    </Sequence>
    <Audio src={staticFile('bgm.mp3')} volume={0.12} />
  </AbsoluteFill>
);

export const RemotionRoot: React.FC = () => (
  <>
    {/* 본편 하나(인스타 · 유튜브 · 틱톡 같은 영상 — 끝 말이 캡션 · DM · 고정 댓글을 가리키지 않는다) */}
    <Composition id="b19" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} />
    <Composition id="scene" component={SceneOnly} durationInFrames={SCENE_LEN} fps={30} width={1080} height={1920} />
  </>
);

void V1_FROM;
