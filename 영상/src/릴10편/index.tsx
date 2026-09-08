import React from 'react';
import {Composition, registerRoot} from 'remotion';
import data from '../../../docs/홍보물/릴10편_20260909/대본.json';
import {ReelVideo, ReelCover, GiftPage} from './릴';
import {Reel, seconds, giftPages} from './타입';
import '../킷/폰트';

const shape={width:1080,height:1920,fps:30};
const reels=data.reels as Reel[];
function TenReels() {
  return <>{reels.map(r=><React.Fragment key={r.id}>
    <Composition id={r.id} component={ReelVideo} durationInFrames={Math.round(seconds(r)*30)} {...shape} defaultProps={{r}}/>
    <Composition id={`${r.id}-cover`} component={ReelCover} durationInFrames={1} {...shape} defaultProps={{r}}/>
    {giftPages(r).map((_,page)=><Composition key={page} id={`${r.id}-resource-${page+1}`} component={GiftPage} durationInFrames={1} {...shape} defaultProps={{r,page}}/>)}
  </React.Fragment>)}</>;
}
registerRoot(TenReels);
