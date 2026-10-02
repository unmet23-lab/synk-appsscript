import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {getContentCatalog} from './content-engine.mjs';

const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../../../..');
const guide=JSON.parse(readFileSync(new URL('./workroom-guide.json',import.meta.url),'utf8'));
const sources=new Map(guide.sources.map(source=>[source.id,source]));
for(const series of getContentCatalog().series)sources.set('series-'+series.id,{id:'series-'+series.id,title:series.name+' 제작 양식',path:series.sourcePath.split('#')[0]});

export function workroomGuide(at=new Date().toISOString()){
  const guide=JSON.parse(readFileSync(new URL('./workroom-guide.json',import.meta.url),'utf8')),catalog=getContentCatalog();
  return {...structuredClone(guide),sources:[...sources.values()],series:catalog.series,guidelines:catalog.guidelines,
    observedTrends:{...structuredClone(guide.observedTrends),needsRefresh:Date.parse(at)-Date.parse(guide.observedTrends.checkedAt+'T00:00:00+09:00')>=86400000},
    trendNotes:guide.trendNotes.map(note=>({...note,needsRefresh:Date.parse(at)-Date.parse(note.checkedAt+'T00:00:00+09:00')>=7*86400000}))};
}
export function workroomSource(id){
  const source=sources.get(id);if(!source){const error=new Error('제작 기준을 찾을 수 없어요.');error.status=404;throw error;}
  return {...source,text:readFileSync(resolve(root,source.path),'utf8')};
}
