import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Felt} from './shared';
import {theme} from './theme';

export const Cover: React.FC = () => <AbsoluteFill style={{background: theme.paper, color: theme.black, fontFamily: theme.font}}>
  <div style={{position: 'absolute', left: 88, top: 246, fontSize: 30, fontWeight: 600, opacity: .58, letterSpacing: '.04em'}}>YUHO BUILDS · 01</div>
  <div style={{position: 'absolute', left: 88, right: 105, top: 433, fontSize: 104, fontWeight: 800, lineHeight: 1.18, letterSpacing: '-.055em'}}>번역하려고<br/>결제한 AI로<br/>첫 앱 만들기</div>
  <div style={{position: 'absolute', left: 88, top: 900, width: 842, height: 433, borderRadius: 43, overflow: 'hidden', color: theme.paper}}><Felt dark/><div style={{position: 'absolute', left: 43, top: 40, fontSize: 30, opacity: .7}}>아무것도 모르던 6월</div><div style={{position: 'absolute', left: 43, top: 151, fontSize: 64, lineHeight: 1.2, fontWeight: 700}}>번역 → 출석 앱</div><div style={{position: 'absolute', left: 43, bottom: 46, fontSize: 35, opacity: .72}}>찍고, 물어보고, 따라 해보고.</div></div>
  <div style={{position: 'absolute', left: 88, top: 1495, fontSize: 35, fontWeight: 600}}>@yuhobuilds</div>
</AbsoluteFill>;
