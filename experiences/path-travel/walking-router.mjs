// OSM snapshot routing, not live turn-by-turn guidance or accessibility certification.
export const WALKING_NOTICE = '지도에 기록된 길로 계산한 예상입니다. 신호·혼잡·공사와 시설 안 걷기는 별도이며 현장 안내를 확인해 주세요.';
export function meters(a,b){
  const x=(a[0]-b[0])*Math.PI/180*Math.cos((a[1]+b[1])*Math.PI/360), y=(a[1]-b[1])*Math.PI/180;
  return Math.hypot(x,y)*6371000;
}
class Heap {
  values=[];
  push(item){let i=this.values.length;this.values.push(item);while(i){const p=(i-1)>>1;if(this.values[p][0]<=item[0])break;this.values[i]=this.values[p];i=p;}this.values[i]=item;}
  pop(){const first=this.values[0],last=this.values.pop();if(this.values.length){let i=0;while(i*2+1<this.values.length){let c=i*2+1;if(c+1<this.values.length&&this.values[c+1][0]<this.values[c][0])c++;if(this.values[c][0]>=last[0])break;this.values[i]=this.values[c];i=c;}this.values[i]=last;}return first;}
}
const coord=p=>[p.lon??p.coordinates?.lon,p.lat??p.coordinates?.lat];
export function createWalkingRouter(data){
  if(data?.version!==1||!Array.isArray(data.nodes)||!Array.isArray(data.ways))throw new TypeError('보행 지도 자료를 확인해 주세요.');
  const nodes=data.nodes, adjacency=nodes.map(()=>[]),nearestCache=new Map(),routes=new Map();
  for(const way of data.ways){
    if(way.kind==='park'||way.foot==='no'||['private','no'].includes(way.access))continue;
    const uncertain=['primary','secondary','tertiary'].includes(way.kind)&&!['yes','both','left','right','separate'].includes(way.sidewalk)&&!['yes','designated','permissive'].includes(way.foot);
    for(let i=1;i<way.n.length;i++){
      const a=way.n[i-1],b=way.n[i],d=meters(nodes[a],nodes[b]);
      if(!Number.isFinite(d)||d>1500)continue;
      const edge={distance:d,steps:way.stairs,uncertain};
      adjacency[a].push({to:b,...edge});adjacency[b].push({to:a,...edge});
    }
  }
  function nearest(point){
    const key=point.join(',');if(nearestCache.has(key))return nearestCache.get(key);
    let best=-1,dist=Infinity;nodes.forEach((node,i)=>{if(!adjacency[i].length)return;const d=meters(node,point);if(d<dist){dist=d;best=i;}});
    const value={index:best,distance:dist};nearestCache.set(key,value);return value;
  }
  function search(start,stepFree){
    const key=start+':'+stepFree;if(routes.has(key))return routes.get(key);
    const cost=new Float64Array(nodes.length).fill(Infinity),dist=new Float64Array(nodes.length).fill(Infinity),prev=new Int32Array(nodes.length).fill(-1),uncertain=new Uint8Array(nodes.length),steps=new Uint8Array(nodes.length),heap=new Heap();
    cost[start]=0;dist[start]=0;heap.push([0,start]);
    while(heap.values.length){const [score,from]=heap.pop();if(score!==cost[from])continue;
      for(const edge of adjacency[from]){if(stepFree&&edge.steps)continue;
        const next=score+edge.distance*(edge.uncertain?1.35:1);
        if(next>=cost[edge.to])continue;
        cost[edge.to]=next;dist[edge.to]=dist[from]+edge.distance;prev[edge.to]=from;uncertain[edge.to]=uncertain[from]||edge.uncertain;steps[edge.to]=steps[from]||edge.steps;heap.push([next,edge.to]);
      }
    }
    const result={dist,prev,uncertain,steps};routes.set(key,result);return result;
  }
  const routeLeg=(from,to,{stepFree=false}={})=>{
    const a=coord(from),b=coord(to);if([...a,...b].some(x=>!Number.isFinite(x)))return null;
    const origin=nearest(a),end=nearest(b);if(origin.index<0||end.index<0||Math.max(origin.distance,end.distance)>300)return null;
    const result=search(origin.index,stepFree),routeDistance=result.dist[end.index];if(!Number.isFinite(routeDistance))return null;
    const indices=[];for(let n=end.index;n>=0;n=result.prev[n]){indices.push(n);if(n===origin.index)break;}indices.reverse();
    const distance=routeDistance+origin.distance+end.distance;
    return {distanceMeters:Math.round(distance),minMinutes:Math.max(1,Math.ceil(distance/75)),maxMinutes:Math.max(2,Math.ceil(distance/50+3)),coordinates:[a,...indices.map(i=>nodes[i]),b],source:'osm-walking-network',estimated:true,sourceAt:data.sourceTimestamp,unknownAccess:!!result.uncertain[end.index]||stepFree,steps:!!result.steps[end.index],connectorMeters:Math.round(origin.distance+end.distance),label:'지도 기반 도보 예상',notice:WALKING_NOTICE};
  };
  routeLeg.data=data;
  return routeLeg;
}
