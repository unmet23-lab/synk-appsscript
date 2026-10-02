// Offline geometry/call budget only. This is not a GPU or phone FPS benchmark.
import * as THREE from '../vendor/three.module.js';
import {buildCoastalCity} from '../cityscape.js';
import {createCoastalBoats} from '../seascape-boats.js';
import {createLandscapeHeight} from '../landscape.js';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const pathX=s=>Math.sin(s/235)*25+Math.sin(s/580)*31;
const pathY=s=>23+Math.sin(s/280)*2.8+Math.sin(s/100)*1.2;
const groundHeight=createLandscapeHeight(pathX,pathY);
const city=buildCoastalCity(THREE,{pathX,groundHeight}),boats=createCoastalBoats(THREE,{pathX,groundHeight});
const modes=['high','balanced','low'],peaks=Object.fromEntries(modes.map(q=>[q,{city:{triangles:0,calls:0},boats:{triangles:0,calls:0},combined:{triangles:0,calls:0}}]));
city.setTheme('sunset');
const record=(out,triangles,calls,s,t)=>{if(triangles>out.triangles){out.triangles=triangles;out.trianglesAt={s,t};}if(calls>out.calls){out.calls=calls;out.callsAt={s,t};}};
for(let t=0;t<=600;t+=60){
  if(t)for(let step=0;step<600;step++)boats.update({dt:.1,playerS:350});
  for(const quality of modes)for(let s=0;s<=2250;s+=5){
    const c=city.update({playerS:s,quality}),b=boats.update({playerS:s,quality,motion:false,dt:0});
    record(peaks[quality].city,c.visibleTriangles,c.drawCalls,s,t);
    record(peaks[quality].boats,b.visibleTriangles,b.drawCalls,s,t);
    record(peaks[quality].combined,c.visibleTriangles+b.visibleTriangles,c.drawCalls+b.drawCalls,s,t);
  }
}
const sourceHashes={};for(const name of ['cityscape.js','city-materials.js','seascape-boats.js','landscape.js'])sourceHashes[name]=createHash('sha256').update(await readFile(new URL('../'+name,import.meta.url))).digest('hex');
const report={version:8,method:'No camera/frustum: player s0..2250 by5m, boat simulation t0..600s by60s. Each time sample advances through dt0.1s. Component maxima can occur at different positions. Only city and boats; not total game render cost.',sourceHashes,storedTriangles:{city:city.stats.storedTriangles,boats:boats.stats.storedTriangles},peaks};
await writeFile(new URL('evening-v8-budgets.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));city.dispose();boats.dispose();
