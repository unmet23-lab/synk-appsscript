import {Timing, VideoProps, Visual} from './types';

const parts: {visual: Visual; seconds: number; text: string}[] = [
  {visual: 'hook', seconds: 9, text: '번역하려고 결제한 AI로 출석 앱을 만들기 시작한 이야기'},
  {visual: 'payment', seconds: 9, text: '2026년 6월 2일, 번역을 위한 첫 결제'},
  {visual: 'setting', seconds: 10, text: '몽골 울란바토르 스카이라인에듀 부원장'},
  {visual: 'translation', seconds: 9, text: '친구 없이 심심하던 때, 번역에 가끔 사용'},
  {visual: 'inquiries', seconds: 10, text: '학생 문의가 많아져 앞으로 관리가 걱정'},
  {visual: 'purpose', seconds: 11, text: '출석을 기록하고 부모님께 알림이 가면 좋겠다'},
  {visual: 'purpose', seconds: 8, text: '함께 일하는 선생님도 편해지면 좋겠다'},
  {visual: 'tools', seconds: 10, text: 'Glide와 Google Sheets로 앱을 만들어 보기'},
  {visual: 'confusion', seconds: 8, text: '개발도 코딩도 전혀 모르는 완전 초보'},
  {visual: 'confusion', seconds: 8, text: '도구 설정에서 헤맴'},
  {visual: 'screenshots', seconds: 10, text: '찍고 물어보고 따라 해보기'},
  {visual: 'loop', seconds: 13, text: '다음 화면이면 또 찍기'},
  {visual: 'hours', seconds: 11, text: '하루 17~18시간 붙잡고 있었던 것 같다는 회고'},
  {visual: 'joke', seconds: 8, text: '심심함은 해결. 앱은 만드는 중'},
  {visual: 'lesson', seconds: 9, text: '지금 다시 시작한다면 가장 작은 첫 단계부터'},
  {visual: 'prompt', seconds: 14, text: '선생님이 학생의 출석을 기록하는 걸 만들고 싶어. 나는 개발을 처음 해. 가장 작은 첫 단계부터 설명해줘.'},
  {visual: 'lesson', seconds: 7, text: '우선 출석 하나를 남기는 것부터'},
  {visual: 'action', seconds: 16, text: '내가 겪는 불편 하나와 첫 단계를 물어보기'},
  {visual: 'ending', seconds: 13, text: '번역에서 첫 앱으로. 다음은 도구를 켜고 설정한 이야기'},
];
let offset = 0;
const scenes = parts.map((p, i) => {const item = {id: `scene-${String(i + 1).padStart(2, '0')}`, start: offset, duration: p.seconds * 30, visual: p.visual, text: p.text}; offset += item.duration; return item;});
export const defaultTiming: Timing = {fps: 30, durationInFrames: offset, audioFile: null, audioStartFrame: 0, scenes};
export const defaultProps: VideoProps = {timing: defaultTiming, captions: []};
