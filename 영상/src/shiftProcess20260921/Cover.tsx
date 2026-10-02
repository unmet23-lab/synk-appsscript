import React from 'react';
import {AbsoluteFill} from 'remotion';
import {OriginalWindow} from './shared';
import {theme} from './theme';
export const Cover:React.FC=()=> <AbsoluteFill style={{backgroundColor:theme.black,color:theme.paper,fontFamily:theme.font}}>
  <div style={{position:'absolute',left:90,top:410,fontSize:33,fontWeight:600}}>만들고 고친 과정 01</div>
  <div style={{position:'absolute',left:90,right:90,top:520,fontSize:90,fontWeight:800,lineHeight:1.2,letterSpacing:'-.04em'}}>커버를 올리려다<br/>다시 배치한 이유</div>
  <OriginalWindow which="before" x={2360} y={50} sourceWidth={800} top={860} height={470}/>
  <div style={{position:'absolute',left:90,top:1410,fontSize:38,fontWeight:600}}>@yuhobuilds · SYNK</div>
</AbsoluteFill>;
