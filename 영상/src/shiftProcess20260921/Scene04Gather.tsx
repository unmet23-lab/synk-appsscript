import React from 'react';
import {Page,Headline,Note,Label,OriginalWindow,Wipe} from './shared';
export const Scene04Gather:React.FC=()=> <Page step="04">
  <Headline>{'조금 줄이고\n가운데로 모으고'}</Headline>
  <Label top={570}>수정 전 원본</Label>
  <OriginalWindow which="before" x={1950} sourceWidth={1200} top={625} width={1080}/>
  <Label top={1035}>같은 영역 · 같은 배율로 비교</Label>
  <Wipe x={1950} sourceWidth={1200} top={1090} width={1080} start={15} end={90}/>
</Page>;
