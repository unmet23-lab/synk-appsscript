import React from 'react';
import {Img, staticFile, useCurrentFrame} from 'remotion';
import {ASSET, theme} from './theme';
import {Felt, Glass, Page, Sub, Title, appear, rise} from './shared';
import {SceneProps} from './types';

export const ScenePayment: React.FC<SceneProps> = () => {
  const f = useCurrentFrame();
  return <Page chapter="첫 결제" tag="남아 있는 첫 결제 기록">
    <Title size={94}>{'2026년\n6월 2일.'}</Title>
    <Sub top={548} size={44}>처음 원했던 건 딱 하나.</Sub>
    <div style={{position: 'absolute', left: 88, top: 692, width: 850, height: 460, borderRadius: 36, overflow: 'hidden', color: theme.paper, opacity: appear(f, 22), translate: `0 ${rise(f, 22, 25)}px`}}><Felt dark/><div style={{position: 'absolute', left: 48, top: 38, fontSize: 32, fontWeight: 600, opacity: .73}}>첫 Claude 결제</div>
      <Glass dark style={{left: 43, top: 105, width: 756, height: 173, background: theme.black}}>
        {/* Literal date-only crop: source image 1532 × 562. No amount, account, or invoice link is exposed. */}
        <div style={{position: 'absolute', left: 34, top: 19, width: 675, height: 132, overflow: 'hidden'}}><Img src={staticFile(ASSET + 'receipt.png')} style={{position: 'absolute', maxWidth: 'none', width: 1532 * 3, height: 562 * 3, left: -28 * 3, top: -494 * 3}}/></div>
      </Glass>
      <div style={{position: 'absolute', left: 48, top: 310, fontSize: 82, fontWeight: 800, letterSpacing: '-.04em'}}>번역.</div>
    </div>
  </Page>;
};
