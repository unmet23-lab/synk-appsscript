import React from 'react';
import {Page,Headline,Note,Label,FullBanner,OriginalWindow} from './shared';
export const Scene02Problem:React.FC=()=> <Page step="02">
  <Headline>{'원본 전체가\n보이진 않았어요'}</Headline>
  <Label top={586}>수정 전 원본 · 전체</Label>
  <FullBanner which="before" top={643}/>
  <Label top={846}>오른쪽 소품 · 부분 확대</Label>
  <OriginalWindow which="before" x={2100} sourceWidth={1100} top={902}/>
  <Label top={1345}>Behance 미리보기에서 발견 · 저장 전 취소</Label>
</Page>;
