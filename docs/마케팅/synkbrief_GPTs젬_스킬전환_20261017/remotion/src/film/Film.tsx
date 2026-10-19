// 본편: 청금석 무대 하나 + 장면(위로 밀기 전환) + 나레이션 + 배경음(말할 때 낮춤) + 효과음.
// 인스타는 cut="A"(훅 결과), 유튜브 쇼츠는 cut="C"(훅 틀린 것). 같은 계정에 같은 영상을 두 번 올리지 않는다.
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, interpolate, Sequence, staticFile } from 'remotion';
import { Stage, Whip } from '../lib/cine';
import { CUT } from '../timeline';
import { hitsFor, SCENES } from './scenes';

const BGM = 0.3; // 말 없는 곳(약 −10dB)
const BGM_UNDER = 0.1; // 말 아래(약 −20dB)

export const Film: React.FC<{ cut: 'A' | 'C' }> = ({ cut }) => {
  const { scenes, clips, total } = CUT[cut];
  const duck = (fr: number) => Math.max(0, ...clips.map((c) => interpolate(fr, [c.at - 5, c.at, c.end, c.end + 8], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })));
  return (
    <AbsoluteFill>
      <Stage total={total} />
      {scenes.map((s, i) => {
        const Comp = SCENES[s.key];
        return (
          <Sequence key={s.key} from={s.from} durationInFrames={s.len}>
            <Whip len={s.len} noIn={i === 0} noOut={i === scenes.length - 1}>
              <Comp s={s} />
            </Whip>
          </Sequence>
        );
      })}
      <Audio src={staticFile('bgm_full.wav')} volume={(fr) => (BGM - (BGM - BGM_UNDER) * duck(fr)) * Math.min(1, (total - fr) / 24)} />
      {clips.map((c, i) => (
        <Sequence key={`v${i}`} from={c.at} durationInFrames={c.end - c.at + 2} layout="none">
          <Audio src={staticFile(`vo/${c.id}.wav`)} trimBefore={c.trimBefore || undefined} trimAfter={c.trimAfter} />
        </Sequence>
      ))}
      {scenes.flatMap((s) =>
        hitsFor(s).map(([at, name, v], k) => (
          <Sequence key={`${s.key}-${k}`} from={s.from + at} durationInFrames={60} layout="none">
            <Audio src={staticFile(`sfx/${name}.wav`)} volume={v} />
          </Sequence>
        )),
      )}
    </AbsoluteFill>
  );
};

export const filmFrames = (cut: 'A' | 'C') => CUT[cut].total;
