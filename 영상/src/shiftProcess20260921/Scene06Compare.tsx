import React from 'react';
import {Page,Headline,Note,Label,FullBanner,Wipe} from './shared';
export const Scene06Compare:React.FC=()=> <Page step="06">
  <Headline>{'다시 올리고\n프로필에서 확인'}</Headline>
  <Label top={568}>수정 전 원본</Label>
  <FullBanner which="before" top={624}/>
  <Label top={807}>수정 후 원본</Label>
  <FullBanner which="after" top={863}/>
  <Label top={1052}>로고·글자·소품 · 원본 비교</Label>
  <Wipe x={1000} sourceWidth={1650} top={1108} start={25} end={170}/>
  <Label top={1410}>9월 19일 공개 확인 기록 · 화면은 원본</Label>
</Page>;
