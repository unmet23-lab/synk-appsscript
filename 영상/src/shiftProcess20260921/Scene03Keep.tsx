import React from 'react';
import {Img,staticFile,interpolate,useCurrentFrame} from 'remotion';
import {Page,Headline,Note,Label,OriginalWindow,clamp,ease} from './shared';
import {ASSET} from './theme';
export const Scene03Keep:React.FC=()=>{const f=useCurrentFrame();return <Page step="03" dark>
  <Headline>{'그림과 문구는\n그대로 두고'}</Headline>
  <Label top={575} dark>유지한 문구 · 수정 전 원본 확대</Label>
  <OriginalWindow which="before" x={610} sourceWidth={1420} top={630}/>
  <Label top={985} dark>유지한 소품 · 수정 전 원본 확대</Label>
  <OriginalWindow which="before" x={2430} y={85} sourceWidth={690} top={1040} height={360}/>
</Page>;};
