import React from 'react';
import {Page,Headline,Note,Label,FeltHero} from './shared';
export const Scene01Hook:React.FC=()=> <Page step="01">
  <Headline size={88}>{'커버를 올리려다\n다시 배치한 이유'}</Headline>
  <FeltHero top={610} height={575} scale={1.55}/>
  <Label top={1207}>수정 전 원본 · 부분 확대</Label>
</Page>;
