import React from 'react';
import {Composition, registerRoot} from 'remotion';
import data from '../../../docs/홍보물/계정별콘텐츠_20260909/콘텐츠원고.json';
import {AccountVideo} from './Video';
import {videoIds, type ContentItem} from './types';

const items = (data as unknown as {items: ContentItem[]}).items;
const AccountRoot: React.FC = () => <>{videoIds.map((id) => {
  const item = items.find((entry) => entry.id === id);
  if (!item || !item.scenes?.length) throw new Error(`Missing approved video script: ${id}`);
  return <Composition key={id} id={`account-${id}`} component={AccountVideo} defaultProps={{item}}
    width={1080} height={1920} fps={30} durationInFrames={item.scenes.reduce((n, scene) => n + Math.round(scene.duration * 30), 0)} />;
})}</>;

registerRoot(AccountRoot);
