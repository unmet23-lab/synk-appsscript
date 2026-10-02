import React from 'react';
import {Page,Headline,Note,Label,OriginalWindow,FullBanner} from './shared';
export const Scene07Close:React.FC=()=> <Page step="07" dark>
  <Headline>{'어떻게 보이는지\n확인하고 마무리'}</Headline>
  <OriginalWindow which="after" x={2080} sourceWidth={520} top={550} height={750}/>
  <Label top={1325} dark>수정 후 원본 · 부분 확대</Label>
  <Label top={1390} dark>AI로 SYNK를 만드는 과정</Label>
</Page>;
