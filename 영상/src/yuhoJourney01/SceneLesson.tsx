import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Arrow, Glass, Page, Sub, Title, appear} from './shared';
import {theme} from './theme';
import {SceneProps} from './types';

export const SceneLesson: React.FC<SceneProps> = ({scene}) => {
  const f = useCurrentFrame();
  const intro = scene.id === '15' || /지금 다시 시작/.test(scene.text);
  if (intro) return <Page chapter="지금 해볼 방법" tag="지금 해볼 요청 예시">
    <Title top={359} size={104}>{'지금 다시\n시작한다면.'}</Title>
    <Glass style={{left: 88, top: 819, width: 848, height: 231, opacity: appear(f, 17)}}><div style={{padding: '67px 40px', fontSize: 60, fontWeight: 700}}>첫 요청부터 이렇게.</div></Glass>
  </Page>;
  return <Page chapter="지금 다시 시작한다면" tag="지금 해볼 요청 예시">
    <Title>{'가장 작은\n첫 단계부터.'}</Title>
    <div style={{position: 'absolute', left: 89, top: 731, fontSize: 49, opacity: .52}}>출석 · 알림 · 학생 관리</div>
    <Arrow x={473} y={834} length={91} vertical value={appear(f, 27)}/>
    <Glass style={{left: 88, top: 986, width: 848, height: 216, opacity: appear(f, 50)}}><div style={{padding: '62px 39px', fontSize: 58, fontWeight: 700, color: theme.deepBlue}}>우선, 출석 하나 남기기.</div></Glass>
    <Sub top={553} size={43}>부모님께 알림도 보내고 싶지만,</Sub>
  </Page>;
};
