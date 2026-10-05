// Adult pedestrians and terrace guests share nine instanced batches. Their
// authored activities are anchored to cityscape's real seats and pavements.
export function buildCityLife(THREE, {anchors = [], groundHeight, pathX, surfaceHeightAt = null} = {}) {
  if (!THREE || typeof groundHeight !== 'function' || typeof pathX !== 'function') throw new TypeError('City life needs THREE, groundHeight and pathX.');
  if (!Array.isArray(anchors)) throw new TypeError('City activity anchors must be an array.');
  const group = new THREE.Group(); group.name = 'coastal-city-life';
  const actors = [], clamp = (n,a,b) => Math.min(b,Math.max(a,n));
  function seed(text) { let n=2166136261; for(const c of text) n=Math.imul(n^c.charCodeAt(0),16777619); return (n>>>0)/4294967296; }
  function add(anchor,position,index) {
    if (![position.x,position.y,position.z].every(Number.isFinite)) throw new TypeError('City actors require finite world coordinates.');
    if (pathX(position.z)-position.x<9.8) throw new RangeError('City actors must remain behind the protected road shoulder.');
    const id=`${anchor.id}:${index}`, r=seed(id), height=1.66+seed(id+'height')*.22;
    const attention=seed(id+'notice'),gesture=seed(id+'greeting');
    const notices=anchor.kind==='cheer'?attention<.78:anchor.kind==='walk'?attention<.48:anchor.kind==='party'?attention<.23:false;
    const response=notices?(anchor.kind==='party'||gesture<.34?'look':'wave'):'none';
    actors.push({id,index,kind:anchor.kind,anchor,position:{...position},r,phase:r*Math.PI*2,height,scale:height/1.78,reaction:0,reactionAge:0,
      response,noticeArmed:true,noticeActive:false,noticeCount:0,noticeRange:41+seed(id+'range')*13,
      noticeDelay:.12+seed(id+'delay')*.52,noticeHold:1.05+seed(id+'hold')*.65,
      skirt:seed(id+'skirt')>.72,coat:seed(id+'coat')>.62,phaseOffset:seed(id+'offset')*21,
      skin:Math.floor(seed(id+'skin')*5),outfit:Math.floor(seed(id+'outfit')*7),hair:Math.floor(seed(id+'hair')*4)});
  }
  for(const anchor of anchors) {
    if (anchor.kind==='table') (anchor.guests||[]).forEach((p,i)=>add(anchor,p,i));
    else if (anchor.kind==='party'||anchor.kind==='cheer') (anchor.positions||anchor.spots||[]).forEach((p,i)=>add(anchor,p,i));
    else if (anchor.kind==='walk'&&anchor.start&&anchor.end) {
      if (![anchor.end.x,anchor.end.y,anchor.end.z].every(Number.isFinite)||pathX(anchor.end.z)-anchor.end.x<9.8) throw new RangeError('Pedestrian destination is outside the pavement.');
      add(anchor,anchor.start,0);
    }
  }
  const shirtColors=[0xe9e6db,0x314a63,0x6b8276,0xb48975,0x774956,0x8b959c,0xc6b8a1];
  const trouserColors=[0x36404c,0x242c38,0x716b61,0x575b60,0x273c45,0x474250,0x626154];
  const skinColors=[0xd9ab89,0xa87355,0x76503c,0xe6be9e,0xba8869], hairColors=[0x28201d,0x48352b,0x635447,0x252a30];
  const colors=new Map(); const color=n=>{if(!colors.has(n))colors.set(n,new THREE.Color(n));return colors.get(n);};
  const solid=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.84,metalness:0});
  const drink=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.28,metalness:.16});
  const contact=new THREE.MeshBasicMaterial({color:0x152b2d,transparent:true,opacity:.13,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
  // Skin, woven clothing, hair and shoes retain one shared draw batch while
  // receiving different specular widths instead of the same plastic sheen.
  solid.onBeforeCompile=shader=>{
    shader.vertexShader='attribute float lifeSurface; varying float vLifeSurface;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvLifeSurface=lifeSurface;');
    shader.fragmentShader='varying float vLifeSurface;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor = vLifeSurface < .5 ? .58 : vLifeSurface < 1.5 ? .9 : vLifeSurface < 2.5 ? .66 : .49;');
  };
  solid.customProgramCacheKey=()=> 'city-life-adult-surfaces-v2';
  function softenedBox() {
    const g=new THREE.BoxGeometry(1,1,1,2,2,2),p=g.attributes.position;
    for(let i=0;i<p.count;i++){
      const v=[p.getX(i),p.getY(i),p.getZ(i)],c=v.map(n=>clamp(n,-.39,.39)),d=v.map((n,j)=>n-c[j]),length=Math.hypot(...d)||1;
      p.setXYZ(i,...c.map((n,j)=>n+d[j]/length*.11));
    }
    g.computeVertexNormals();return g;
  }
  function tailoredBody() {
    // Waist, ribs, shoulders and neckline form an adult clothed silhouette.
    const rings=[[0,.145,.095],[.10,.16,.10],[.35,.217,.105],[.445,.232,.10],[.49,.105,.082]],pos=[],idx=[];
    for(const [y,w,d] of rings)for(let j=0;j<8;j++){const a=j*Math.PI/4;pos.push(Math.cos(a)*w,y,Math.sin(a)*d);}
    for(let i=0;i<rings.length-1;i++)for(let j=0;j<8;j++){const a=i*8+j,b=i*8+(j+1)%8;idx.push(a,b,a+8,b,b+8,a+8);}
    for(let j=1;j<7;j++){idx.push(0,j+1,j);idx.push(32,32+j,33+j);}
    for(let i=0;i<idx.length;i+=3)[idx[i+1],idx[i+2]]=[idx[i+2],idx[i+1]];
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;
  }
  const geometry={
    torso:tailoredBody(),
    limb:new THREE.CylinderGeometry(1,.84,1,8,1,false),
    sphere:new THREE.SphereGeometry(1,10,7),
    hair:new THREE.SphereGeometry(1,10,5,0,Math.PI*2,0,Math.PI*.58),
    shoe:softenedBox(),
    skirt:new THREE.CylinderGeometry(.145,.235,.38,10,1,false),
    cup:new THREE.CylinderGeometry(.035,.027,.105,8,1,false),
    liquid:new THREE.CircleGeometry(.031,8),
    shadow:new THREE.CircleGeometry(1,12),
  };
  const buckets={};
  for(const [key,g] of Object.entries(geometry)) {
    const perActor={torso:1,limb:15,sphere:20,hair:1,shoe:7,skirt:1,cup:1,liquid:1,shadow:1}[key];
    const mesh=new THREE.InstancedMesh(g,key==='shadow'?contact:['cup','liquid'].includes(key)?drink:solid,Math.max(1,actors.length*perActor));
    g.setAttribute('lifeSurface',new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1,actors.length*perActor)),1).setUsage(THREE.DynamicDrawUsage));
    mesh.name=`city-life-${key}`;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=key!=='shadow';mesh.count=0;
    buckets[key]={mesh,count:0,triangles:(g.index?.count||g.attributes.position.count)/3};group.add(mesh);
  }
  const object=new THREE.Object3D(),aVector=new THREE.Vector3(),bVector=new THREE.Vector3(),axis=new THREE.Vector3(0,1,0),up=new THREE.Vector3(),limbRotation=new THREE.Quaternion();
  const yawRotation=new THREE.Quaternion(),partRotation=new THREE.Quaternion(),localEuler=new THREE.Euler();
  const sphere=new THREE.Sphere(new THREE.Vector3(),1.8),frustum=new THREE.Frustum(),projection=new THREE.Matrix4();
  let theme='coast',clock=0,lastTime=null,lastInput={},disposed=false;
  const stats={version:9,actors:actors.length,visibleActors:0,animatedActors:0,reactingActors:0,greetingActors:0,drawCalls:0,shadowDrawCalls:0,visibleTriangles:0,storedTriangles:Object.values(buckets).reduce((n,b)=>n+b.triangles,0),quality:'high',theme,time:0};
  const poses=[]; group.userData.stats=stats;group.userData.actors=actors.map(a=>({id:a.id,kind:a.kind,height:a.height}));group.userData.poseSnapshots=poses;
  // Snapshot joints are world coordinates, permitting direct pose/seat/road QA
  // without adding a debug interface or altering any game state.
  function meshPart(key,position,scale,tint,rotation=null) {
    const bucket=buckets[key]; object.position.set(...position);object.scale.set(...scale);
    if(rotation?.isQuaternion)object.quaternion.copy(rotation);else object.rotation.set(...(rotation||[0,0,0]));
    object.updateMatrix();bucket.mesh.setMatrixAt(bucket.count,object.matrix);
    if(key!=='shadow')bucket.mesh.setColorAt(bucket.count,color(tint));
    bucket.mesh.geometry.attributes.lifeSurface.setX(bucket.count,skinColors.includes(tint)?0:hairColors.includes(tint)?2:key==='shoe'?3:1);bucket.count++;
  }
  function placement(actor,t) {
    const p=actor.position;
    let x=p.x,y=p.y,z=p.z,yaw=p.yaw??actor.anchor.yaw??0,walk=0;
    const localTime=t+actor.phaseOffset;
    if(actor.kind==='walk') {
      const {start,end}=actor.anchor,length=Math.hypot(end.x-start.x,end.z-start.z);
      // A cosine round trip must last pi * distance / peak speed; a fixed
      // short period makes a 43m pavement look like a sprinting conveyor.
      const duration=Math.max(length*Math.PI/1.45,actor.anchor.duration||0,8),angle=localTime/duration*Math.PI*2;
      const progress=(1-Math.cos(angle))*.5;
      x=start.x+(end.x-start.x)*progress;z=start.z+(end.z-start.z)*progress;
      if(Number.isFinite(actor.anchor.roadRelativeOffset))x=pathX(z)+actor.anchor.roadRelativeOffset;
      x=Math.min(x,pathX(z)-10.3);
      const pavement=typeof surfaceHeightAt==='function'?surfaceHeightAt(x,z):NaN;
      y=Number.isFinite(pavement)?pavement:groundHeight(x,z)+.045;
      // Smooth out the turnaround rather than teleporting to the path start.
      const direction=Math.sin(angle);walk=clamp(Math.abs(direction)*1.8,0,1);
      const phase=((angle%(Math.PI*2))+Math.PI*2)%(Math.PI*2),halfTurn=Math.PI*1.8/duration;
      const ease=n=>{const v=clamp(n,0,1);return v*v*(3-2*v);};
      let heading;
      if(phase<halfTurn)heading=Math.PI+Math.PI*ease((phase+halfTurn)/(2*halfTurn));
      else if(phase<Math.PI-halfTurn)heading=0;
      else if(phase<Math.PI+halfTurn)heading=Math.PI*ease((phase-Math.PI+halfTurn)/(2*halfTurn));
      else if(phase<Math.PI*2-halfTurn)heading=Math.PI;
      else heading=Math.PI+Math.PI*ease((phase-Math.PI*2+halfTurn)/(2*halfTurn));
      // Turn over 1.8 seconds while the eased trajectory is nearly still.
      // Wrapping 2pi back to zero preserves orientation without a frame snap.
      const tangent=Number.isFinite(actor.anchor.roadRelativeOffset)?Math.atan2(pathX(z+.25)-pathX(z-.25),.5):Math.atan2(end.x-start.x,end.z-start.z);
      yaw=tangent+heading;
    }
    return {x,y,z,yaw,walk};
  }
  const smooth=n=>{const v=clamp(n,0,1);return v*v*v*(v*(v*6-15)+10);};
  const lerp=(a,b,k)=>a.map((v,i)=>v+(b[i]-v)*k);
  const pulse=(t,start,rise,hold,fall)=>smooth((t-start)/rise)*(1-smooth((t-start-rise-hold)/fall));
  const rotateY=(p,a)=>[Math.cos(a)*p[0]+Math.sin(a)*p[2],p[1],-Math.sin(a)*p[0]+Math.cos(a)*p[2]];
  function pavementAt(x,z) {
    const value=typeof surfaceHeightAt==='function'?surfaceHeightAt(x,z):NaN;
    return Number.isFinite(value)?value:groundHeight(x,z)+.045;
  }
  function pathPoint(actor,travel) {
    const {start,end}=actor.anchor,length=Math.hypot(end.x-start.x,end.z-start.z),loop=2*length;
    const folded=((travel%loop)+loop)%loop,progress=folded<=length?folded/length:2-folded/length;
    const z=start.z+(end.z-start.z)*progress;
    const x=Number.isFinite(actor.anchor.roadRelativeOffset)?pathX(z)+actor.anchor.roadRelativeOffset:start.x+(end.x-start.x)*progress;
    const tangent=Number.isFinite(actor.anchor.roadRelativeOffset)?Math.atan2(pathX(z+.25)-pathX(z-.25),.5):Math.atan2(end.x-start.x,end.z-start.z);
    // Plant orientation is fixed along with position. During the swing, turn
    // the next foot progressively across the end of the walking path.
    const zone=.34;let heading;
    if(folded<zone)heading=Math.PI+Math.PI*smooth((folded+zone)/(zone*2));
    else if(folded<length-zone)heading=0;
    else if(folded<length+zone)heading=Math.PI*smooth((folded-length+zone)/(zone*2));
    else if(folded<loop-zone)heading=Math.PI;
    else heading=Math.PI+Math.PI*smooth((folded-loop+zone)/(zone*2));
    return {x,y:pavementAt(x,z),z,yaw:tangent+heading};
  }
  // Two-bone IK preserves the elbow/knee lengths throughout a gesture. The
  // preferred bend direction controls the elbow plane rather than stretching.
  function joint(start,end,upper,lower,hint) {
    const d=end.map((n,i)=>n-start[i]),raw=Math.hypot(...d),length=clamp(raw,.001,upper+lower-.001),unit=d.map(n=>n/(raw||1));
    const along=clamp((upper*upper-lower*lower+length*length)/(2*length),-upper,upper),height=Math.sqrt(Math.max(0,upper*upper-along*along));
    const projection=hint.reduce((n,v,i)=>n+v*unit[i],0),bend=hint.map((v,i)=>v-projection*unit[i]),size=Math.hypot(...bend)||1;
    return start.map((n,i)=>n+unit[i]*along+bend[i]/size*height);
  }
  function drawActor(actor,t,animated) {
    const p=actor.position,seated=actor.kind==='table',party=actor.kind==='party',s=actor.scale;
    let {x,y,z,yaw,walk}=placement(actor,t);
    const localTime=t+actor.phaseOffset,baseYaw=p.yaw??actor.anchor.yaw??0;
    const reaction=actor.reaction,look=actor.gazeAngle??baseYaw;
    // The spectator's feet stay planted. Only the upper body and head follow
    // the car; rotating the complete rig used to swivel both soles on paving.
    const gazeTurn=clamp(Math.atan2(Math.sin(look-yaw),Math.cos(look-yaw)),-.72,.72)*reaction;
    const cos=Math.cos(yaw),sin=Math.sin(yaw);
    const world=q=>[x+s*(cos*q[0]+sin*q[2]),y+s*q[1],z+s*(-sin*q[0]+cos*q[2])];
    const local=q=>{const dx=(q[0]-x)/s,dz=(q[2]-z)/s;return [cos*dx-sin*dz,(q[1]-y)/s,sin*dx+cos*dz];};
    yawRotation.setFromAxisAngle(axis,yaw);
    function part(key,position,scale,tint,rot=[0,0,0]) {
      partRotation.setFromEuler(localEuler.set(...rot)).premultiply(yawRotation);
      meshPart(key,world(position),scale.map(v=>v*s),tint,partRotation);
    }
    function limb(from,to,r,tint,depth=1) {
      aVector.set(...world(from));bVector.set(...world(to));up.subVectors(bVector,aVector);const length=up.length();
      limbRotation.setFromUnitVectors(axis,up.normalize());
      meshPart('limb',aVector.add(bVector).multiplyScalar(.5).toArray(),[r*s,length,r*s*depth],tint,limbRotation);
    }
    const groupSize=actor.anchor.guests?.length||actor.anchor.positions?.length||actor.anchor.spots?.length||1;
    const groupTime=t+seed(actor.anchor.id+'conversation')*13,turnLength=5.6,speaker=Math.floor(groupTime/turnLength)%groupSize,turnPhase=groupTime%turnLength;
    const speech=(actor.index===speaker?1:0)*pulse(turnPhase,.35,.65,3.05,1.05);
    const listen=(1-speech),gesture=Math.sin(localTime*2.1+actor.phase)*speech;
    // A complete sip has a long rest, an eased lift, a still mouth contact and
    // a relaxed return. Timing is unique to the guest, with no perpetual bob.
    const sipPeriod=19+actor.r*8,sipTime=(localTime+actor.r*11)%sipPeriod;
    const drinkLift=(seated||party)?pulse(sipTime,5,1.35,1.55,1.65):0;
    const drinkSip=(seated||party)?pulse(sipTime,6.45,.4,.85,.45):0;
    const dance=party&&actor.r>.5?(1-drinkLift)*pulse(localTime%11,1.2,1,4.2,1.4):0;
    const sway=Math.sin(localTime*1.55+actor.phase)*dance;
    let pelvisX=sway*.032,pelvisYaw=0,shoulderTurn=sway*.037+(actor.kind==='cheer'?gazeTurn*.24:0),stride=0;
    const seatHeight=Number.isFinite(p.seatHeight)?p.seatHeight:.57,hipZ=seated?-.075:0;
    let pelvisY=seated?(seatHeight+.10)/s:.925-Math.abs(sway)*.009;
    const footStates=[];
    let ankleL,ankleR;
    if(actor.kind==='walk') {
      const {start,end}=actor.anchor,length=Math.hypot(end.x-start.x,end.z-start.z),duration=Math.max(length*Math.PI/1.45,actor.anchor.duration||0,8);
      const angle=localTime/duration*Math.PI*2,cycle=Math.floor(angle/(Math.PI*2)),phase=((angle%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
      const progress=(1-Math.cos(angle))*.5,travel=cycle*2*length+(phase<=Math.PI?progress*length:2*length-progress*length),strideLength=1.12;
      stride=travel/strideLength*Math.PI*2;
      pelvisY+=.063*(1-walk)-.012*(.5+.5*Math.cos(stride*2));pelvisX=Math.sin(stride)*.012*walk;
      pelvisYaw=Math.sin(stride)*.045*walk;shoulderTurn=-Math.sin(stride+.22)*.065*walk;
      [ankleL,ankleR]=[-1,1].map((side,index)=>{
        const offset=index*.5,gait=travel/strideLength+offset,step=Math.floor(gait),phase=gait-step,stance=.60;
        const planted=(step-offset+.30)*strideLength,swing=phase>stance?(phase-stance)/(1-stance):0;
        const targetDistance=planted+strideLength*smooth(swing),point=pathPoint(actor,targetDistance),lift=Math.pow(Math.sin(Math.PI*swing),2)*.105;
        point.x+=Math.cos(point.yaw)*side*.102*s;point.z-=Math.sin(point.yaw)*side*.102*s;
        point.y=pavementAt(point.x,point.z);
        const foot=[point.x,point.y+(.08+lift)*s,point.z];
        footStates.push({side,stance:phase<=stance,phase,position:[point.x,point.y,point.z],lift,yaw:point.yaw});
        return local(foot);
      });
    } else {
      ankleL=seated?[-.108,.08/s,.43/s]:[-.102,.08,0];
      ankleR=seated?[.108,.08/s,.43/s]:[.102,.08,.025];
      if(party&&actor.r>.5){
        // One small, weight-supported step; the opposite foot remains planted.
        const stepPhase=localTime%11,step=pulse(stepPhase,2.2,.7,1.8,.7)*dance;
        ankleR[0]+=.038*step;ankleR[2]+=.025*step;
        const lifting=pulse(stepPhase,2.2,.2,.16,.34)+pulse(stepPhase,4.7,.2,.16,.34);
        ankleR[1]+=.025*lifting*dance;
      }
      for(const [index,ankle] of [ankleL,ankleR].entries())footStates.push({side:index?1:-1,stance:ankle[1]<.09,phase:0,position:world([ankle[0],0,ankle[2]]),lift:Math.max(0,ankle[1]-.08),yaw});
    }
    const upperLeg=seated?.43:actor.kind==='walk'?.46:.425,lowerLeg=seated||actor.kind==='walk'?.46:.425;
    if(actor.kind==='walk')for(const [index,ankle] of [ankleL,ankleR].entries()){
      const hipOffset=rotateY([(index?1:-1)*.092,0,0],pelvisYaw),dx=ankle[0]-pelvisX-hipOffset[0],dz=ankle[2]-hipZ-hipOffset[2];
      const reach=upperLeg+lowerLeg-.007;
      pelvisY=Math.min(pelvisY,ankle[1]+Math.sqrt(Math.max(.01,reach*reach-dx*dx-dz*dz)));
    }
    const hipPoint=(side)=>{const q=rotateY([side*.092,0,0],pelvisYaw);return [q[0]+pelvisX,pelvisY,q[2]+hipZ];};
    const hipL=hipPoint(-1),hipR=hipPoint(1);
    const kneeL=joint(hipL,ankleL,upperLeg,lowerLeg,[-.06,0,1]),kneeR=joint(hipR,ankleR,upperLeg,lowerLeg,[.06,0,1]);
    const breathe=Math.sin(localTime*1.13+actor.phase)*.003;
    const lean=seated?.028+speech*.035:speech*.019,bodyRoll=-sway*.014;
    const bodyPoint=q=>{
      const rotated=rotateY(q,shoulderTurn),c=Math.cos(lean),sn=Math.sin(lean);
      return [rotated[0]+pelvisX,rotated[1]*c-rotated[2]*sn+pelvisY+breathe,rotated[1]*sn+rotated[2]*c+hipZ];
    };
    const shoulderL=bodyPoint([-.211,.435,0]),shoulderR=bodyPoint([.211,.435,0]),headCenter=bodyPoint([0,.70,.006]);
    const headYaw=shoulderTurn+(seated||party?Math.sin(localTime*.39+actor.phase)*.065:0)+gazeTurn*.78*(1-drinkLift);
    const headPitch=(seated||party?Math.sin(localTime*1.65+actor.phase)*.035*listen:0)*(1-drinkLift);
    const headPoint=q=>{
      const c=Math.cos(headPitch),sn=Math.sin(headPitch),a=rotateY(q,headYaw),r=[a[0],a[1]*c-a[2]*sn,a[1]*sn+a[2]*c];
      return headCenter.map((n,i)=>n+r[i]);
    };
    const mouth=headPoint([0,-.042,.089]);
    let handL=bodyPoint([-.23,.435-.50,-Math.sin(stride)*.14*walk]);
    let handR=bodyPoint([.23,.435-.50,Math.sin(stride)*.14*walk]);
    let cupPosition=null,cupTilt=0;
    if(seated||party) {
      const restL=bodyPoint(seated?[-.19,.10,.27]:[-.225,-.035,.04]);
      const gestureL=bodyPoint([-.27-gesture*.025,.32+gesture*.035,.30+Math.sin(localTime*1.5)*.035]);
      handL=lerp(restL,gestureL,speech*(1-drinkLift*.6));
      cupTilt=-drinkSip*.61;
      const heldCup=bodyPoint([.175,.25,.245]);
      const mouthCup=[mouth[0],mouth[1]-.0525*Math.cos(cupTilt),mouth[2]-.0525*Math.sin(cupTilt)];
      cupPosition=lerp(heldCup,mouthCup,drinkLift);
      handR=[cupPosition[0]+.034,cupPosition[1]-.027,cupPosition[2]+.002];
    }
    let cheerBlend=0;
    if(actor.response==='wave'){
      cheerBlend=reaction*(actor.kind==='walk'?.68:1);
      const wave=Math.sin(actor.reactionAge*(4.0+actor.r*.7)+actor.phase);
      handR=lerp(handR,bodyPoint([.315+wave*.052,.72,.09]),cheerBlend);
    }
    const elbowL=joint(shoulderL,handL,.28,.265,[-1,-.18,.12]),elbowR=joint(shoulderR,handR,.28,.265,[1,-.18,.12]);
    const shirt=shirtColors[actor.outfit],trousers=trouserColors[actor.outfit],skin=skinColors[actor.skin],hair=hairColors[actor.hair];
    part('torso',[pelvisX,pelvisY+breathe,hipZ],[1,1,1],shirt,[lean,shoulderTurn,bodyRoll]);
    part('sphere',[pelvisX,pelvisY+.018,hipZ],[.151,.088,.10],trousers,[0,pelvisYaw,0]);
    for(const [index,[hip,knee,ankle]] of [[hipL,kneeL,ankleL],[hipR,kneeR,ankleR]].entries()){
      limb(hip,knee,.088,trousers,1.04);limb(knee,ankle,.063,actor.skirt?skin:trousers);
      part('sphere',knee,[.071,.067,.071],actor.skirt?skin:trousers);
      const footYaw=footStates[index].yaw-yaw,toe=rotateY([0,-.03,.060],footYaw);
      part('shoe',ankle.map((n,i)=>n+toe[i]),[.117,.10,.245],actor.outfit%3===0?0xd7d2c6:0x282c30,[0,footYaw,0]);
    }
    if(actor.skirt&&!seated)part('skirt',[pelvisX,pelvisY-.125,hipZ],[1,1,1],trousers,[0,pelvisYaw,bodyRoll]);
    for(const [side,shoulder,elbow,hand] of [[-1,shoulderL,elbowL,handL],[1,shoulderR,elbowR,handR]]){
      limb(shoulder,elbow,.070,shirt);part('sphere',shoulder,[.069,.068,.069],shirt);
      limb(elbow,hand,.043,actor.coat?shirt:skin);
      aVector.set(...world(elbow));bVector.set(...world(hand));up.subVectors(bVector,aVector).normalize();limbRotation.setFromUnitVectors(axis,up);
      meshPart('sphere',world(hand),[.034*s,.057*s,.025*s],skin,limbRotation);
      // A small thumb changes the mitten silhouette without separate fingers.
      part('sphere',[hand[0]-side*.026,hand[1]-.012,hand[2]+.013],[.014,.032,.016],skin,[.3,0,side*.4]);
      if(actor.coat){const cuff=lerp(elbow,hand,.93);part('sphere',cuff,[.044,.022,.042],0xe5dfd3);}
    }
    limb(bodyPoint([0,.49,0]),headPoint([0,-.095,0]),.050,skin);
    part('sphere',headCenter,[.089,.123,.091],skin,[headPitch,headYaw,0]);
    part('hair',headPoint([0,.033,-.008]),[.096,.108,.100],hair,[headPitch,headYaw,actor.hair===1?.09:0]);
    if(actor.hair===3)part('sphere',headPoint([0,-.006,-.092]),[.060,.066,.050],hair,[headPitch,headYaw,0]);
    part('sphere',headPoint([0,-.005,.090]),[.017,.025,.023],skin,[headPitch,headYaw,0]);
    part('sphere',headPoint([-.091,-.012,0]),[.013,.024,.016],skin,[headPitch,headYaw,0]);
    part('sphere',headPoint([.091,-.012,0]),[.013,.024,.016],skin,[headPitch,headYaw,0]);
    for(const side of [-1,1])part('sphere',headPoint([side*.033,.016,.081]),[.009,.005,.006],0x332b28,[headPitch,headYaw,0]);
    if(actor.coat){
      part('shoe',bodyPoint([-.063,.354,.105]),[.040,.205,.015],shirtColors[(actor.outfit+1)%7],[lean,shoulderTurn,-.21]);
      part('shoe',bodyPoint([.063,.354,.105]),[.040,.205,.015],shirtColors[(actor.outfit+1)%7],[lean,shoulderTurn,.21]);
    }
    let rim=null;
    if(cupPosition){
      part('cup',cupPosition,[1,1,1],actor.r>.5?0xd7c3a3:0xe8dfce,[cupTilt,0,0]);
      rim=[cupPosition[0],cupPosition[1]+.0525*Math.cos(cupTilt),cupPosition[2]+.0525*Math.sin(cupTilt)];
      part('liquid',[rim[0],rim[1]+.0005*Math.cos(cupTilt),rim[2]+.0005*Math.sin(cupTilt)],[1,1,1],actor.r>.5?0x805433:0xb09867,[-Math.PI*.5+cupTilt,0,0]);
    }
    meshPart('shadow',[x,y+.012,z],[seated?.36:.28,seated?.43:.18,1],0,[-Math.PI*.5,0,yaw]);
    poses.push({id:actor.id,kind:actor.kind,position:{x,y,z},yaw,height:actor.height,seated,seatHeight,animated,bones:{upperLeg:upperLeg*s,lowerLeg:lowerLeg*s,upperArm:.28*s,forearm:.265*s},
      motion:{speech,speaker,drinkLift,drinkSip,cheerBlend,reaction,reactionType:actor.response,reactionCount:actor.noticeCount,reactionAge:actor.reactionAge,headYaw,feet:footStates,mouth:world(mouth),cupRim:rim?world(rim):null,pelvisYaw,shoulderYaw:shoulderTurn},
      joints:{hipLeft:world(hipL),hipRight:world(hipR),kneeLeft:world(kneeL),kneeRight:world(kneeR),ankleLeft:world(ankleL),ankleRight:world(ankleR),shoulderLeft:world(shoulderL),shoulderRight:world(shoulderR),elbowLeft:world(elbowL),elbowRight:world(elbowR),handLeft:world(handL),handRight:world(handR),head:world(headCenter)}});
  }
  function update(input={}) {
    if(disposed)return stats;
    const {time=0,playerS=75,playerX=pathX(playerS),quality='high',camera=null,motion=true,paused=false,celebrating=false}=input;lastInput=input;
    const previousClock=clock;
    if(Number.isFinite(time)){if(lastTime!==null&&!paused&&motion)clock+=clamp(time-lastTime,0,.15);lastTime=time;}
    const q=['high','balanced','low'].includes(quality)?quality:'balanced';
    stats.quality=q;stats.theme=theme;stats.time=clock;stats.visibleActors=0;stats.animatedActors=0;stats.reactingActors=0;stats.greetingActors=0;stats.visibleTriangles=0;stats.drawCalls=0;poses.length=0;
    for(const b of Object.values(buckets))b.count=0;
    if(camera){camera.updateMatrixWorld();projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(projection);}
    const distance=q==='high'?260:q==='balanced'?200:140,reactionLimit=q==='low'?2:q==='balanced'?3:4;
    let activeReactions=0;for(const actor of actors)if(actor.noticeActive)activeReactions++;
    if(group.visible)for(const actor of actors) {
      const current=placement(actor,actor.frozenTime??0),offset=current.z-playerS;
      const carDistance=Math.hypot(current.x-playerX,current.z-playerS);
      // A complete departure rearms the next pass. Stopping for a listening
      // question must not make bystanders greet the same car indefinitely.
      if(motion&&!paused&&carDistance>110&&!actor.noticeArmed){
        if(actor.noticeActive)activeReactions--;
        actor.noticeArmed=true;actor.noticeActive=false;actor.reaction=0;actor.reactionAge=0;
      }
      if(offset < -28 || offset>distance)continue;
      if(Number.isFinite(actor.anchor.blockS)&&(Math.abs(actor.anchor.blockS-playerS)>=distance||actor.anchor.blockS-playerS<=-125))continue;
      // Keep both seated partners on lower tiers; reduce distant pedestrians.
      if(q==='low'&&offset>75&&actor.kind==='walk')continue;
      sphere.center.set(current.x,current.y+1,current.z);
      if(camera&&!frustum.intersectsSphere(sphere))continue;
      const animated=motion&&!paused&&Math.abs(offset)<(q==='low'?65:110);
      // Distant people remain in a stable, individual pose; near motion updates
      // every render, so no 12/18 fps skeletal stepping is exposed up close.
      if(actor.frozenTime===undefined)actor.frozenTime=0;
      if(animated)actor.frozenTime+=clock-previousClock;
      if(animated){
        const dt=clock-previousClock;
        if(dt>0&&actor.response!=='none'&&actor.noticeArmed&&carDistance<actor.noticeRange+(celebrating?4:0)&&offset>-12&&activeReactions<reactionLimit){
          actor.noticeArmed=false;actor.noticeActive=true;actor.noticeCount++;actor.reactionAge=0;activeReactions++;
        }
        if(actor.noticeActive){
          actor.reactionAge+=dt;
          actor.reaction=pulse(actor.reactionAge,actor.noticeDelay,.72,actor.noticeHold,1.05);
          if(actor.reactionAge>=actor.noticeDelay+.72+actor.noticeHold+1.05){actor.noticeActive=false;actor.reaction=0;activeReactions--;}
        }
        if(actor.noticeActive){
          if(actor.gazeAngle===undefined)actor.gazeAngle=actor.position.yaw??actor.anchor.yaw??0;
          const targetYaw=Math.atan2(playerX-current.x,playerS-current.z),delta=Math.atan2(Math.sin(targetYaw-actor.gazeAngle),Math.cos(targetYaw-actor.gazeAngle));
          actor.gazeAngle+=clamp(delta*(1-Math.exp(-dt*3.0)),-dt*1.45,dt*1.45);
        }
      }
      drawActor(actor,actor.frozenTime,animated);
      stats.visibleActors++;if(animated)stats.animatedActors++;
      if(actor.reaction>.01){stats.reactingActors++;if(actor.response==='wave')stats.greetingActors++;}
    }
    for(const b of Object.values(buckets)) {
      b.mesh.count=b.count;b.mesh.visible=b.count>0;b.mesh.instanceMatrix.needsUpdate=true;if(b.mesh.instanceColor)b.mesh.instanceColor.needsUpdate=true;
      b.mesh.geometry.attributes.lifeSurface.needsUpdate=true;
      if(b.count){stats.drawCalls++;stats.visibleTriangles+=b.triangles*b.count;}
    }
    return stats;
  }
  function setTheme(next) {theme=['coast','sunset','bloom'].includes(next)?next:'coast';group.visible=theme!=='bloom';update(lastInput);}
  function dispose() {
    if(disposed)return;disposed=true;
    for(const b of Object.values(buckets)){b.mesh.dispose?.();b.mesh.geometry.dispose();}
    solid.dispose();drink.dispose();contact.dispose();group.clear();poses.length=0;stats.visibleActors=0;stats.drawCalls=0;stats.visibleTriangles=0;
  }
  update();return {group,setTheme,update,stats,dispose};
}
