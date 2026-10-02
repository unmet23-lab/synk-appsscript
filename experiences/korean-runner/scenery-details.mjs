import * as T from './vendor/three.module.js';

export const DETAIL_CLEARANCE=Object.freeze({courseHalfWidth:4.1,overheadHeight:5.4});
const THEMES=['blossom','snow','moonlight'],TILE_COUNT=10,TILE_LENGTH=25,COURSE_LENGTH=250;
const WHITE=0xF4F7ED,WOOD=0xA38369;

// All three scenes are authored once. Replaying a course or trying on a scene never
// creates another mesh, geometry, texture, light or material.
export function createSceneryDetails({scene,felt}){
  const geometries={ball:new T.SphereGeometry(1,12,8),cylinder:new T.CylinderGeometry(1,1,1,10),cone:new T.ConeGeometry(1,1,8),ring:new T.TorusGeometry(1,.035,5,20)};
  const root=new T.Group();root.name='windrun-scenery-details';scene.add(root);
  const glow=felt(0xFFE0A4).clone();glow.emissive.setHex(0xC39242);glow.emissiveIntensity=.24;
  const manifests=Object.fromEntries(THEMES.map(theme=>[theme,[]]));
  function add(theme,tile,kind,color,position,scale,rotation=[0,0,0],detail=false){manifests[theme].push({tile,kind,color,position,scale,rotation,detail});}
  function branch(theme,tile,a,b,radius=.09,detail=false){const mid=new T.Vector3(...a).add(new T.Vector3(...b)).multiplyScalar(.5),direction=new T.Vector3(...b).sub(new T.Vector3(...a));const quaternion=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),direction.clone().normalize()),euler=new T.Euler().setFromQuaternion(quaternion);add(theme,tile,'cylinder',WOOD,mid.toArray(),[radius,direction.length(),radius],[euler.x,euler.y,euler.z],detail);}
  function bloom(theme,tile,x,y,z,scale=.18,detail=false){for(let k=0;k<5;k++){const angle=k*Math.PI*2/5;add(theme,tile,'ball',k%2?0xF1C1CB:0xE8AABA,[x+Math.sin(angle)*scale,y+Math.cos(angle)*scale,z],[scale*.68,scale*.85,scale*.38],[0,0,-angle],detail);}add(theme,tile,'ball',0xF3D79F,[x,y,z+scale*.25],[scale*.50,scale*.50,scale*.35],[0,0,0],detail);}
  function lantern(tile,x,y,z,color=0xFFE0A4,scale=1,detail=false){
    add('moonlight',tile,'ball',color,[x,y,z],[.26*scale,.34*scale,.26*scale],[0,0,0],detail);
    for(const offset of [-.31,.31])add('moonlight',tile,'cylinder',WOOD,[x,y+offset*scale,z],[.15*scale,.045*scale,.15*scale],[0,0,0],detail);
    add('moonlight',tile,'cylinder',color===0xFFE0A4?0xDAAE75:color,[x,y-.48*scale,z],[.025*scale,.22*scale,.025*scale],[0,0,0],detail);
    add('moonlight',tile,'ring',0xD5AF76,[x,y,z],[.26*scale,.26*scale,.26*scale],[Math.PI/2,0,0],detail);
  }
  for(let tile=0;tile<TILE_COUNT;tile++){
    // Pink boughs form a tunnel above the running corridor, with their trunks outside it.
    if(tile%2===0){
      for(const side of [-1,1]){
        add('blossom',tile,'cylinder',WOOD,[side*6.1,2.5,-10],[.18,5,.18],[0,0,-side*.07]);
        branch('blossom',tile,[side*6.1,4.2,-10],[side*5.0,5.8,-10],.11);
        branch('blossom',tile,[side*5.0,5.8,-10],[side*3.0,6.7,-10],.085);
        branch('blossom',tile,[side*3.0,6.7,-10],[side*.1,6.9,-10],.065);
      }
      for(let k=0;k<11;k++){const x=-5.5+k*1.1,y=6.25+Math.sin(k/10*Math.PI)*.65;add('blossom',tile,'ball',[0xE8AABA,0xF1C1CB,0xF5D4D5][k%3],[x,y,-10],[.91,.53,.98]);if(k%2===0)add('blossom',tile,'ball',0xF1C1CB,[x+.14,y+.22,-11.1],[.85,.54,.8],[0,0,0],true);}
    }
    for(const side of [-1,1]){
      for(const z of [-4,-17]){
        add('blossom',tile,'ball',0x87A58A,[side*5.55,.35,z],[.68,.39,.75]);
        add('blossom',tile,'ball',0xA1B698,[side*6.15,.34,z+.3],[.65,.35,.65],[0,0,0],true);
        for(let k=0;k<3;k++){const x=side*(5.25+k*.28),y=.72+(k%2)*.1;add('blossom',tile,'cylinder',0x769A7D,[x,.43,z+.1],[.018,.8,.018]);bloom('blossom',tile,x,y,z+.3,.13,k===2);}
      }
      // The snow caps follow the existing house centres, yaw and curved roof profile.
      const houseIndex=tile+(side===1?1:0),houseX=side*(8.6+(houseIndex%3)),yaw=side*.08;
      for(let k=0;k<5;k++){const dx=-2.22+k*1.11,y=3.14+.95*Math.pow(1-Math.abs(dx)/2.55,.78)+.22*Math.pow(Math.abs(dx)/2.55,10);add('snow',tile,'ball',WHITE,[houseX+dx*Math.cos(yaw),y,-2-dx*Math.sin(yaw)],[.71,.18,2.03],[0,yaw,0]);}
      for(let k=0;k<3;k++){const z=-1-k*8;add('snow',tile,'ball',WHITE,[side*(12.65+(k%2)*.25),.06,z],[1.1,.31,2.7]);add('snow',tile,'ball',0xE4EEE8,[side*(5.55+(k%2)*.25),.04,z-2],[.72,.26,1.4],[0,0,0],k===2);}
      if(tile%2===0){
        const x=side*5.85,z=-12;
        add('snow',tile,'ball',WHITE,[x,.45,z],[.42,.46,.40]);add('snow',tile,'ball',WHITE,[x,1.06,z],[.31,.34,.30]);add('snow',tile,'ball',WHITE,[x,1.50,z],[.25,.25,.24]);
        for(const eye of [-1,1])add('snow',tile,'ball',0x405666,[x+eye*.079,1.54,z+.231],[.025,.027,.018]);
        for(const y of [.93,1.13])add('snow',tile,'ball',0x547386,[x,y,z+.282],[.023,.025,.02]);
        add('snow',tile,'cone',0xE4A270,[x,1.48,z+.28],[.044,.17,.044],[Math.PI/2,0,0]);
        add('snow',tile,'cylinder',0x7196AA,[x,1.745,z],[.27,.065,.27]);add('snow',tile,'cylinder',0x7196AA,[x,1.84,z],[.17,.19,.17]);
        add('snow',tile,'cylinder',0xEAA797,[x,1.25,z],[.32,.105,.32]);add('snow',tile,'ball',0xEAA797,[x+.21,1.08,z+.20],[.07,.23,.055],[0,0,.10]);
        branch('snow',tile,[x-.28,1.02,z],[x-.65,1.26,z],.023,true);branch('snow',tile,[x+.28,1.02,z],[x+.65,1.26,z],.023,true);
      }
      // Closely spaced lantern stands make the moonlight route a visible festival parade.
      for(let k=0;k<3;k++){const x=side*(5.25+(k%2)*.18),z=-2-k*8,height=2.25+(k%2)*.45;add('moonlight',tile,'cylinder',WOOD,[x,height/2,z],[.045,height,.045],[0,0,0],k===2);branch('moonlight',tile,[x,height,z],[x+side*.43,height,z],.03,k===2);lantern(tile,x+side*.33,height-.32,z,k%2?0xEAAE9F:0xFFE0A4,.90,k===2);}
    }
    if(tile%3===1){
      for(const side of [-1,1])add('moonlight',tile,'cylinder',WOOD,[side*5.0,3.65,-16],[.065,7.3,.065]);
      for(let k=0;k<10;k++){const x=-4.7+k*9.4/9,nextX=-4.7+(k+1)*9.4/9,y=7.1-Math.sin(k/9*Math.PI)*.45,nextY=7.1-Math.sin((k+1)/9*Math.PI)*.45;if(k<9)branch('moonlight',tile,[x,y,-16],[nextX,nextY,-16],.019);if(k>0&&k<9){add('moonlight',tile,'cylinder',WOOD,[x,y-.25,-16],[.013,.50,.013]);lantern(tile,x,y-.72,-16,k%3===0?0x91B5B9:k%2?0xEAAE9F:0xFFE0A4,.77,k%2===0);}}
    }
  }
  const groups={},pools={},dummy=new T.Object3D();
  for(const theme of THEMES){const group=new T.Group();group.name='scenery-detail-'+theme;root.add(group);groups[theme]=group;pools[theme]=[];const buckets=new Map();for(const item of manifests[theme]){const key=item.kind+':'+item.color;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(item);}for(const [key,items]of buckets){items.sort((a,b)=>Number(a.detail)-Number(b.detail));const first=items[0],material=first.color===0xFFE0A4?glow:felt(first.color),mesh=new T.InstancedMesh(geometries[first.kind],material,items.length);mesh.name=theme+'-'+key;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);pools[theme].push({mesh,items,essential:items.filter(i=>!i.detail).length});}}
  let current='village',lastDistance=NaN,lastQuality=null,lastReduced=null,disposed=false;
  function update(distance,{quality='experience',reduced=false}={}){if(disposed)return;if(distance===lastDistance&&quality===lastQuality&&reduced===lastReduced)return;lastDistance=distance;lastQuality=quality;lastReduced=reduced;if(!pools[current])return;for(const pool of pools[current]){const count=quality==='experience'&&!reduced?pool.items.length:pool.essential;pool.mesh.count=count;for(let i=0;i<count;i++){const a=pool.items[i];dummy.position.set(a.position[0],a.position[1],16-((a.tile*TILE_LENGTH+distance)%COURSE_LENGTH)+a.position[2]);dummy.scale.set(...a.scale);dummy.rotation.set(...a.rotation);dummy.updateMatrix();pool.mesh.setMatrixAt(i,dummy.matrix);}pool.mesh.instanceMatrix.needsUpdate=true;}}
  function setTheme(theme){current=THEMES.includes(theme)?theme:'village';for(const [key,g]of Object.entries(groups))g.visible=key===current;const previous=lastDistance;lastDistance=NaN;update(Number.isFinite(previous)?previous:0,{quality:lastQuality||'experience',reduced:!!lastReduced});}
  function dispose(){if(disposed)return;disposed=true;root.removeFromParent();for(const themePools of Object.values(pools))for(const pool of themePools)pool.mesh.dispose();Object.values(geometries).forEach(geometry=>geometry.dispose());glow.dispose();}
  setTheme('village');
  return {setTheme,update,dispose,get info(){const active=pools[current]||[];return {theme:current,tiles:TILE_COUNT,capacity:Object.fromEntries(THEMES.map(t=>[t,manifests[t].length])),activeInstances:active.reduce((sum,pool)=>sum+pool.mesh.count,0),drawCalls:active.length,bufferCount:Object.values(pools).reduce((sum,p)=>sum+p.length,0),quality:lastQuality,reduced:lastReduced,disposed};}};
}
