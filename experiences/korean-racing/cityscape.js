import {architecturalFaceUv,configureCityMaterials} from './city-materials.js';

// A sea-facing Korean coastal district, built from authored architectural parts.
// Positive world road offset is the sea, so all buildings stay on negative X.
// No transparent glass sorting, dynamic lights, external assets or per-frame
// mesh creation: whole blocks share material batches and three detail tiers.
export function buildCoastalCity(THREE, {pathX, groundHeight, roadEnd = 2250} = {}) {
  if (!THREE || typeof pathX !== 'function' || typeof groundHeight !== 'function') throw new TypeError('Coastal city needs THREE and the current road and ground functions.');
  if (!Number.isFinite(roadEnd) || roadEnd < 600) throw new RangeError('The coastal district needs at least 600m of road.');
  const group = new THREE.Group(); group.name = 'coastal-city-district';
  const scaleS = roadEnd / 2250, blocks = [], footprints = [], features = [], walks=[], activityAnchors=[];
  const disposed = new Set(), object = new THREE.Object3D(), clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const twilight = {value: .68}; let theme = 'coast', lastQuality = 'high', lastS = -Infinity;
  const materials = {
    stone: new THREE.MeshStandardMaterial({color: 0xbdb8aa, roughness: .72, metalness: .02, vertexColors: true}),
    pale: new THREE.MeshStandardMaterial({color: 0xcec9bd, roughness: .61, metalness: .035, vertexColors: true}),
    bronze: new THREE.MeshStandardMaterial({color: 0x8d826a, roughness: .30, metalness: .90, envMapIntensity:.82, vertexColors: true}),
    glass: new THREE.MeshStandardMaterial({color: 0x87989d, roughness: .105, metalness: .035, envMapIntensity: 1.0, vertexColors: true}),
    darkGlass: new THREE.MeshStandardMaterial({color: 0x788583, roughness: .12, metalness: .035, envMapIntensity: .90, vertexColors: true}),
    timber: new THREE.MeshStandardMaterial({color: 0x796148, roughness: .70, vertexColors: true}),
    green: new THREE.MeshStandardMaterial({color: 0x557463, roughness: .87, vertexColors: true}),
    lamp: new THREE.MeshStandardMaterial({color: 0xffeac2, emissive: 0xffca85, emissiveIntensity: .64, roughness: .38}),
    sign: new THREE.MeshBasicMaterial({color: 0xf0e2c8, map: makeSignAtlas(THREE), side: THREE.DoubleSide}),
    contact: new THREE.MeshBasicMaterial({color:0x263633,map:contactTexture(THREE),transparent:true,opacity:.23,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),
  };
  const materialFinish=configureCityMaterials(materials,{twilight});
  const templates = {
    box: new THREE.BoxGeometry(1,1,1),
    prism: new THREE.CylinderGeometry(1,1,1,8,1,false),
    column: new THREE.CylinderGeometry(1,1,1,8),
    planter: new THREE.CylinderGeometry(1,1.08,1,8),
    dome: new THREE.SphereGeometry(1,8,5,0,Math.PI*2,0,Math.PI*.5),
    plane: new THREE.PlaneGeometry(1,1),
    groundQuad: new THREE.PlaneGeometry(1,1).rotateX(-Math.PI*.5),
    pitchedRoof: makePitchedRoof(THREE),
  };
  const buckets = new Map();
  function bucket(block, tier, key) {
    const id = `${block}:${tier}:${key}`;
    if (!buckets.has(id)) buckets.set(id, {block,tier,key,position:[],normal:[],uv:[],color:[],cityUv:[],cityCell:[],citySeed:[]});
    return buckets.get(id);
  }
  function part(block,tier,key,geometry,x,y,z,w,h,d,yaw=0,tint=1,atlas=null,pitch=0) {
    const b = bucket(block,tier,key), base = templates[geometry];
    object.position.set(x,y,z); object.rotation.set(0,yaw,0);if(pitch)object.rotateX(pitch); object.scale.set(w,h,d); object.updateMatrix();
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(object.matrix), point = new THREE.Vector3(), normal = new THREE.Vector3();
    const pos = base.attributes.position, ns = base.attributes.normal, uv = base.attributes.uv;
    const count = base.index?.count ?? pos.count;
    for (let j=0; j<count; j++) {
      const i = base.index ? base.index.getX(j) : j;
      point.fromBufferAttribute(pos,i).applyMatrix4(object.matrix); normal.fromBufferAttribute(ns,i).applyMatrix3(normalMatrix).normalize();
      b.position.push(point.x,point.y,point.z); b.normal.push(normal.x,normal.y,normal.z);
      const u = uv?.getX(i) ?? 0, v = uv?.getY(i) ?? 0;
      b.uv.push(atlas!==null ? (u+atlas%2)/2 : u, atlas!==null ? (v+3-Math.floor(atlas/2))/4 : v);
      const face=architecturalFaceUv({u,v,w,h,d,nx:ns.getX(i),ny:ns.getY(i),nz:ns.getZ(i),shape:geometry,wood:key==='timber',floorPitch:block==='skyline'?3.3:3.7});
      b.cityUv.push(...face.uv);b.cityCell.push(...face.cell);b.citySeed.push((Math.sin(x*.131+z*.017+y*.071)*43758.5453)%997);
      b.color.push(...(Array.isArray(tint)?tint:[tint,tint,tint]));
    }
  }
  function block(id,s) {
    const root = new THREE.Group(); root.name = `coastal-city-${id}`; group.add(root);
    const result = {id,s:s*scaleS,root,meshes:[],bounds:null}; blocks.push(result); return result;
  }
  function groundPad(s, offset, width, depth, kind) {
    const angle = Math.atan2(pathX(s+.5)-pathX(s-.5),1), x = pathX(s)+offset;
    let minY = Infinity, maxY = -Infinity;
    const c = Math.cos(angle), sn = Math.sin(angle), pad = {x,z:s,halfW:width*.5,halfD:depth*.5,yaw:angle,kind};
    for (const u of [-width*.5,0,width*.5]) for (const v of [-depth*.5,0,depth*.5]) {
      const wx = x+c*u+sn*v, wz = s-sn*u+c*v, y = groundHeight(wx,wz); minY=Math.min(minY,y); maxY=Math.max(maxY,y);
      if (wx-pathX(wz) > -8.5) throw new RangeError('An architectural footprint crosses the protected road shoulder.');
    }
    pad.minGround=minY; pad.maxGround=maxY; pad.baseY=maxY+.035; footprints.push(pad); return pad;
  }
  function at(pad,u,y,v) {
    const c=Math.cos(pad.yaw), sn=Math.sin(pad.yaw);
    return [pad.x+c*u+sn*v,pad.baseY+y,pad.z-sn*u+c*v];
  }
  function pointAt(pad,u,y,v,yaw=pad.yaw) {const p=at(pad,u,y,v);return {x:p[0],y:p[1],z:p[2],yaw};}
  function buildingPart(b,tier,key,geometry,pad,u,y,v,w,h,d,tint=1,atlas=null) {
    part(b.id,tier,key,geometry,...at(pad,u,y,v),w,h,d,pad.yaw,tint,atlas);
  }
  function festoon(b,pad,u,start,end,height,tier='detail') {
    // One gently sagging cable, with bulbs attached to that same curve. These
    // are merged opaque surfaces, not point lights or billboards.
    const segments=8, sag=.24;
    const cableY=t=>height-sag*4*t*(1-t);
    for(let i=0;i<segments;i++) {
      const a=i/segments,c=(i+1)/segments,m=(a+c)*.5;
      // Tilt each small box along the curve instead of disconnected horizontal
      // steps. The cable and hanging bulbs still use the existing batches.
      const dz=(end-start)/segments,dy=cableY(c)-cableY(a);
      part(b.id,tier,'bronze','box',...at(pad,u,(cableY(a)+cableY(c))*.5,start+(end-start)*m),.022,.025,Math.hypot(dz,dy)+.015,pad.yaw,.65,null,-Math.atan2(dy,dz));
      if(i%2===0) {
        buildingPart(b,tier,'bronze','column',pad,u,cableY(m)-.085,start+(end-start)*m,.010,.17,.010,.7);
        buildingPart(b,tier,'lamp','dome',pad,u,cableY(m)-.21,start+(end-start)*m,.065,.10,.065,1);
      }
    }
  }
  function foundation(b,pad,width,depth) {
    const depthY=Math.max(.7,pad.maxGround-pad.minGround+.5);
    const shop=pad.kind==='shop',coreWidth=shop?width-7.1:width;
    buildingPart(b,'shell','stone','box',pad,0,-depthY*.5,0,coreWidth,depthY,depth,shop?[.56,.60,.60]:.76);
    buildingPart(b,'shell','stone','box',pad,0,.12,0,coreWidth+.12,.24,depth+.12,.84);
    if(!shop)return pad;
    const half=(width-8)*.5;let frontMax=-Infinity,frontMin=Infinity;
    for(const u of [half+.5,half+4.4])for(const v of [-depth*.5,depth*.5]){
      const [x,,z]=at(pad,u,0,v),height=groundHeight(x,z);frontMax=Math.max(frontMax,height);frontMin=Math.min(frontMin,height);
    }
    const terraceTop=frontMax+.18,terrace={...pad,baseY:terraceTop-.24};pad.terraceY=terraceTop;
    const thickness=Math.max(.32,terrace.baseY-frontMin+.20);
    buildingPart(b,'shell','stone','box',terrace,half+2.35,-thickness*.5,0,4.1,thickness,depth,.68);
    buildingPart(b,'shell','stone','box',terrace,half+2.35,.12,0,4.18,.24,depth+.08,.82);
    return terrace;
  }
  function promenade(b,start,end) {
    // Paving follows the current terrain point for point; neither the road
    // heights nor the coast are flattened to make room for the architecture.
    const data=bucket(b.id,'shell','stone');
    const strips=Math.ceil((end-start)/5), offsets=[-18.1,-13.7,-9.3];
    for(let k=0;k<strips;k++)for(let j=0;j<2;j++) {
      const s0=start+(end-start)*k/strips,s1=start+(end-start)*(k+1)/strips;
      const corners=[[pathX(s0)+offsets[j],s0],[pathX(s0)+offsets[j+1],s0],[pathX(s1)+offsets[j],s1],[pathX(s1)+offsets[j+1],s1]];
      for(const n of [0,2,1,1,2,3]) {
        const [x,z]=corners[n],y=groundHeight(x,z)+.045;
        data.position.push(x,y,z);data.normal.push(0,1,0);data.uv.push(x*.25,z*.25);data.cityUv.push(x-pathX(z),z);data.cityCell.push(1.65,.72);data.citySeed.push(0);
        const shade=(k+j)%3===0?.80:.86;data.color.push(shade,shade,shade);
      }
    }
    walks.push({start,end,inner:-9.3,outer:-18.1});
  }
  function surfaceHeightAt(x,z) {
    const offset=x-pathX(z),walk=walks.find(w=>z>=w.start&&z<=w.end&&offset>=w.outer-.01&&offset<=w.inner+.01);
    if(!walk)return groundHeight(x,z)+.045;
    const count=Math.ceil((walk.end-walk.start)/5),step=(walk.end-walk.start)/count;
    const cell=clamp(Math.floor((z-walk.start)/step),0,count-1),z0=walk.start+cell*step,z1=z0+step,t=clamp((z-z0)/step,0,1);
    const center=pathX(z0)+(pathX(z1)-pathX(z0))*t,off=x-center,column=off< -13.7?0:1;
    const x0=[-18.1,-13.7][column],x1=x0+4.4,u=clamp((off-x0)/(x1-x0),0,1);
    const y00=groundHeight(pathX(z0)+x0,z0)+.045,y10=groundHeight(pathX(z0)+x1,z0)+.045;
    const y01=groundHeight(pathX(z1)+x0,z1)+.045,y11=groundHeight(pathX(z1)+x1,z1)+.045;
    return u+t<=1?y00+u*(y10-y00)+t*(y01-y00):y11+(1-u)*(y01-y11)+(1-t)*(y10-y11);
  }
  // Four walkable pockets, with park/view breaks instead of an endless wall.
  const streetPlan = [
    {s:380,count:5,offset:-26}, {s:730,count:5,offset:-29},
    {s:1130,count:6,offset:-28}, {s:1540,count:6,offset:-32},
  ];
  streetPlan.forEach((plan,index) => {
    const b=block(`promenade-${index}`,plan.s), spacing=24*scaleS;
    promenade(b,plan.s*scaleS-plan.count*spacing*.5-9,plan.s*scaleS+plan.count*spacing*.5+9);
    for (let j=0;j<plan.count;j++) {
      const s=plan.s*scaleS+(j-(plan.count-1)*.5)*spacing;
      const width=14+(j%3)*1.6, depth=18+(j%2)*2.5, floors=2+(j+index)%3, height=floors*3.7;
      const style=(index+j)%4;
      const pad=groundPad(s,plan.offset-(j%2)*4,width+8,depth+7,'shop');
      const terrace=foundation(b,pad,width+8,depth+7);
      // Wide stone entry treads bridge the natural grade to each terrace pad.
      const entry=at(terrace,width*.5+6.2,0,0), rise=Math.max(0,terrace.baseY+.24-groundHeight(entry[0],entry[2]));
      const steps=Math.max(2,Math.min(6,Math.ceil(rise/.28)));
      for(let step=0;step<steps;step++) {
        const top=rise*(steps-step)/steps;
        buildingPart(b,'shell','stone','box',terrace,width*.5+4.2+step*.36,.24-rise+top*.5,0,.40,Math.max(.12,top),3.2,.84);
      }
      features.push({kind:'shop',s,x:pad.x,z:pad.z,y:pad.baseY,height,floors,width,depth,style});
      // Recessed glass on all sides, travertine frame and a staggered top floor.
      const facadeTones=[[.93,.91,.87],[.88,.91,.89],[.88,.85,.78],[.86,.89,.91]];
      buildingPart(b,'shell','pale','box',pad,0,height*.5+.24,0,width,height,depth,facadeTones[(j+index)%4]);
      buildingPart(b,'shell','darkGlass','box',pad,width*.5+.04,2.02,0,.14,3.3,depth*.80,.9);
      buildingPart(b,'shell','glass','box',pad,width*.5+.04,(height+3.7)*.5,0,.13,height-4.05,depth*.84,1);
      buildingPart(b,'shell','glass','box',pad,0,height*.55,depth*.5+.025,width*.8,height*.69,.12,.85);
      // The approaching chase camera sees the -Z gable first. Treat it as a
      // glazed, inhabited corner facade too, rather than a blank side wall.
      buildingPart(b,'shell','glass','box',pad,0,(height+1)*.5,-depth*.5-.035,width*.79,height-1.4,.14,.90);
      buildingPart(b,'shell','bronze','box',pad,0,.66,-depth*.5-.12,width*.82,.94,.15,.74);
      buildingPart(b,'shell','pale','box',pad,0,height-.18,-depth*.5-.17,width*.90,.22,.27,.91);
      // A return awning wraps the street corner, varied by the shop's mass.
      buildingPart(b,'shell','bronze','box',pad,width*.035,3.74,-depth*.5-.50,width*.93,.16,1.12,.90);
      for (const side of [-1,1]) buildingPart(b,'shell','pale','box',pad,side*width*.43,height*.5,-depth*.5-.17,.39,height,.32,.84);
      for (const sign of [-1,1]) {
        buildingPart(b,'shell','pale','box',pad,width*.5+.24,height*.5,sign*(depth*.5-.4),.48,height,.7,.88);
      }
      const awningHeight=style===1?3.44:style===2?3.92:3.75;
      buildingPart(b,'shell',style===1?'timber':'bronze','box',pad,width*.5+1.45,awningHeight,0,3.05,.20,depth+1.3,style===1?.75:1);
      // Shadowed stone recess and a real framed entry door instead of a
      // continuous unbroken dark strip across the shop's ground floor.
      buildingPart(b,'shell','bronze','box',pad,width*.5+.16,1.70,0,.24,2.90,2.35,.73);
      buildingPart(b,'shell','glass','box',pad,width*.5+.30,1.68,0,.075,2.60,1.96,.90);
      // Street-level shopfront lives on the low pedestrian terrace. It screens
      // the hillside retaining core with an inhabited recessed display, rather
      // than exposing a tall bright podium to the chase camera.
      const storefrontHeight=Math.max(2.4,Math.min(3.1,pad.baseY+.16-(terrace.baseY+.24)));
      buildingPart(b,'shell','darkGlass','box',terrace,width*.5+.59,.24+storefrontHeight*.5,0,.14,storefrontHeight,depth*.82,.91);
      buildingPart(b,'shell',style===1?'timber':'bronze','box',terrace,width*.5+.74,.25+storefrontHeight,0,.28,.18,depth*.90,.86);
      for(const side of [-1,1])buildingPart(b,'shell',style===1?'timber':'bronze','box',terrace,width*.5+.76,.24+storefrontHeight*.5,side*depth*.42,.23,storefrontHeight,.24,.90);
      buildingPart(b,'detail','bronze','box',terrace,width*.5+.69,1.64,0,.08,2.6,2.0,.84);
      buildingPart(b,'detail','glass','box',terrace,width*.5+.75,1.60,0,.06,2.45,1.80,.93);
      buildingPart(b,'detail','bronze','box',terrace,width*.5+.80,1.51,.67,.08,.64,.055,.9);
      const roofConfigs=[[-.22,1.65,.53,.66,'pale'],[-.12,2.15,.70,.69,'timber'],[-.28,3.45,.43,.58,'bronze'],[-.09,2.85,.67,.74,'pale']];
      const [roofOffset,roofHeight,roofWidth,roofDepth,roofMaterial]=roofConfigs[style];
      buildingPart(b,'shell',roofMaterial,'box',pad,width*roofOffset,height+roofHeight*.5,-depth*.12,width*roofWidth,roofHeight,depth*roofDepth,style===1?.78:.94);
      buildingPart(b,'shell','bronze','box',pad,width*roofOffset,height+roofHeight+.08,-depth*.12,width*(roofWidth+.04),.16,depth*(roofDepth+.045),.83);
      // Four actual facade families share the same existing material palette.
      if(style===1){
        for(const sign of [-1,1])buildingPart(b,'shell','timber','box',pad,width*.5+.30,1.94,sign*depth*.42,.24,3.4,depth*.13,.73);
        buildingPart(b,'shell','timber','box',pad,0,1.93,-depth*.5-.26,width*.92,.34,.14,.76);
      }else if(style===2){
        buildingPart(b,'shell','bronze','box',pad,width*.5+.34,height-.26,0,.23,.35,depth*.92,.91);
        for(const sign of [-1,1])buildingPart(b,'shell','bronze','box',pad,width*.5+.35,height*.5,sign*depth*.40,.16,height-.56,.16,.92);
      }else if(style===3){
        for(let v=-depth*.33;v<depth*.35;v+=2.75)buildingPart(b,'shell','pale','box',pad,width*.5+.37,(height+3.7)*.5,v,.38,height-3.7,.11,.87);
      }
      // Fine facade details appear only when the player can resolve them.
      for (let k=1;k<floors;k++) {
        buildingPart(b,'detail','pale','box',pad,width*.5+.19,k*3.7+.17,0,.46,.19,depth*.97,.86);
        buildingPart(b,'detail','pale','box',pad,0,k*3.7+.17,-depth*.5-.18,width*.89,.19,.30,.83);
        buildingPart(b,'detail','bronze','box',pad,width*.5+.57,k*3.7+.87,0,.10,.08,depth*.90,1);
        for (let v=-depth*.38;v<depth*.41;v+=3.4) buildingPart(b,'detail','bronze','box',pad,width*.5+.17,k*3.7+1.9,v,.12,3.35,.10,.85);
      }
      for(let u=-width*.31;u<=width*.34;u+=3.1) buildingPart(b,'detail','bronze','box',pad,u,(height+1)*.5,-depth*.5-.15,.085,height-1.4,.085,.87);
      buildingPart(b,'detail','timber','box',terrace,width*.5+.85,storefrontHeight+.24,0,.14,.50,depth*.66,.87);
      // Small environmental signs, separate from the learning interface.
      // A plane faces local +Z; road-facing signs need a local +X rotation.
      const signPos=at(terrace,width*.5+.94,storefrontHeight+.26,0);
      part(b.id,'detail','sign','plane',...signPos,depth*.46,.46,1,pad.yaw+Math.PI*.5,1,(j+index)%8);
      buildingPart(b,'detail','lamp','box',pad,width*.5+2.55,awningHeight-.15,0,.065,.065,depth*.70);
      buildingPart(b,'detail','bronze','box',pad,width*.5+.37,1.61,.72,.09,.65,.07,1);
      buildingPart(b,'detail','timber','box',terrace,width*.5+1.15,.54,depth*.33,2.05,.60,3.5,.80);
      for (const side of [-1,1]) {
        buildingPart(b,'detail','bronze','planter',terrace,width*.5+1.55,.69,side*(depth*.5+1.6),.6,.9,.6,1);
        buildingPart(b,'detail','green','dome',terrace,width*.5+1.55,1.14,side*(depth*.5+1.6),.84,.96,.84,.93);
      }
      // Bistro terrace tables, paired chairs, slim railing and roof planting.
      if(j===0) for (const side of [-1,1]) {
        const u=width*.5+2.25,v=side*depth*.24;
        buildingPart(b,'activity','contact','groundQuad',terrace,u,.242,v,1.65,1,2.9,1);
        buildingPart(b,'activity','timber','column',terrace,u,1.055,v,.64,.09,.64,.92);
        buildingPart(b,'activity','bronze','column',terrace,u,.67,v,.065,.85,.065,1);
        const guests=[];
        for (const chairSide of [-1,1]) {
          const chairV=v+chairSide*.94;
          buildingPart(b,'activity','timber','box',terrace,u,.775,chairV,.48,.07,.48,.92);
          buildingPart(b,'activity','timber','box',terrace,u,1.08,chairV+chairSide*.21,.48,.60,.075,.92);
          for(const a of [-.18,.18])for(const z of [-.18,.18]) buildingPart(b,'activity','bronze','box',terrace,u+a,.51,chairV+z,.04,.54,.04,.86);
          guests.push({...pointAt(terrace,u,.24,chairV,pad.yaw+(chairSide===1?Math.PI:0)),seatHeight:.57});
        }
        activityAnchors.push({id:`${b.id}-table-${side}`,kind:'table',blockId:b.id,...pointAt(terrace,u,.24,v),guests,tableTop:pointAt(terrace,u,1.10,v)});
      }
      if(j===1||j===2){
        const kind=j===1?'cheer':'party',positions=[];
        const count=kind==='party'?3:2;
        for(let person=0;person<count;person++) {
          if(kind==='party') {
            const triangle=[[-.65,0],[.40,-1.05],[.40,1.05]], [du,dv]=triangle[person];
            positions.push(pointAt(terrace,width*.5+2.15+du,.24,dv,pad.yaw+Math.atan2(-du,-dv)));
          } else {
            const z=s+(person-(count-1)*.5)*2.2,x=pathX(z)-11.9;
            positions.push({x,y:surfaceHeightAt(x,z),z,yaw:Math.PI*.5});
          }
        }
        const center=kind==='cheer'?{x:pathX(s)-11.9,y:surfaceHeightAt(pathX(s)-11.9,s),z:s,yaw:Math.PI*.5}:pointAt(terrace,width*.5+2.15,.24,0);
        activityAnchors.push({id:`${b.id}-${kind}`,kind,blockId:b.id,...center,positions});
      }
      if(j===2){
        // A waist-height counter leaves the conversation floor and road view
        // clear. Two small terraces have warm festoon bulbs under the canopy.
        const u=width*.5+2.1,v=-depth*.33;
        buildingPart(b,'activity','timber','box',terrace,u,.69,v,1.17,.90,2.8,.88);
        buildingPart(b,'activity','bronze','box',terrace,u,1.18,v,1.32,.09,2.95,.83);
        for(let panel=-1.20;panel<=1.21;panel+=.24)buildingPart(b,'activity','timber','box',terrace,u+.60,.68,v+panel,.048,.86,.12,.65);
        buildingPart(b,'activity','bronze','box',terrace,u+.79,.46,v,.065,.065,2.42,.86);
        for(const side of [-1,1])buildingPart(b,'activity','bronze','box',terrace,u+.67,.46,v+side*1.02,.25,.045,.06,.85);
        for(const z of [-.85,0,.85])buildingPart(b,'activity','lamp','column',terrace,u,1.305,v+z,.075,.16,.075,1);
        if(index<2){
          for(const side of [-1,1])buildingPart(b,'activity','bronze','column',terrace,width*.5+3.25,1.81,side*4.1,.045,3.14,.045,.87);
          buildingPart(b,'activity','bronze','box',terrace,width*.5+3.25,3.37,0,.029,.029,8.24,.82);
          for(let bulb=0;bulb<9;bulb++){
            const z=-3.9+bulb*.975,y=3.23-Math.sin((bulb+1)*Math.PI/10)*.18;
            buildingPart(b,'activity','bronze','column',terrace,width*.5+3.25,(y+3.37)*.5,z,.014,3.37-y,.014,.85);
            buildingPart(b,'activity','lamp','column',terrace,width*.5+3.25,y-.045,z,.058,.095,.058,1);
          }
        }
      }
      buildingPart(b,'detail','green','box',pad,width*roofOffset,height+roofHeight+.40,depth*(roofDepth*.5-.12-.06),width*(roofWidth-.08),.48,.64,.93);
      buildingPart(b,'detail','bronze','box',pad,width*roofOffset,height+roofHeight+.62,depth*(roofDepth*.5-.12-.04),width*(roofWidth-.02),.07,.075,.84);
      // A single warm lamp strip serves each storefront, with no PointLight.
    }
    for(let walker=0;walker<2;walker++) {
      const startS=plan.s*scaleS+(walker===0?-52:3),endS=startS+43,offset=-10.6;
      const roadPoint=z=>{const x=pathX(z)+offset;return {x,y:surfaceHeightAt(x,z),z};};
      const start=roadPoint(startS),end=roadPoint(endS),path=Array.from({length:9},(_,i)=>roadPoint(startS+(endS-startS)*i/8));
      activityAnchors.push({id:`${b.id}-walk-${walker}`,kind:'walk',blockId:b.id,...start,yaw:Math.atan2(end.x-start.x,end.z-start.z),start,end,path,roadRelativeOffset:offset,phase:walker*.43});
    }
  });
  // A quiet residential pocket between the first two commercial blocks. The
  // homes share one material batch per detail tier and stay below the skyline.
  // Their compact footprints keep the hillside foundation low and leave the
  // existing footpaths, people and open coastal view intact.
  const homes=block('harbour-homes',550);
  [498,551,609].forEach((rawS,i)=>{
    const s=rawS*scaleS,width=9.6+i*.8,depth=11.2+(i%2)*1.0,height=6.2+(i%2)*.7;
    const pad=groundPad(s,-25.5-(i%2)*1.5,width+5,depth+4,'home');
    const coreDepth=Math.max(.55,pad.maxGround-pad.minGround+.22);
    buildingPart(homes,'shell','stone','box',pad,0,-coreDepth*.5,0,width+.4,coreDepth,depth+.4,[.65,.68,.64]);
    buildingPart(homes,'shell','stone','box',pad,0,.11,0,width+.7,.22,depth+.7,.83);
    // The entry descends to this exact patch of terrain. It is not a floating
    // door or a full-width bright retaining wall on the coastal slope.
    const approach=at(pad,0,0,-depth*.5-1.70),entryRise=Math.max(.16,pad.baseY+.22-groundHeight(approach[0],approach[2]));
    const entrySteps=Math.max(2,Math.min(7,Math.ceil(entryRise/.25))),run=1.7/entrySteps;
    for(let step=0;step<entrySteps;step++) {
      const top=.22-entryRise*(step/entrySteps),v=-depth*.5-(step+.5)*run;
      const p=at(pad,0,0,v),bottom=groundHeight(p[0],p[2])-pad.baseY-.08,thickness=Math.max(.12,top-bottom);
      buildingPart(homes,'shell','stone','box',pad,0,top-thickness*.5,v,2.48,thickness,run+.025,.79);
    }
    for(const side of [-1,1]) {
      // Low planted containers also soften the base in the near-camera view.
      const u=side*width*.29,v=-depth*.5-.57,p=at(pad,u,0,v);
      const groundY=groundHeight(p[0],p[2])-pad.baseY;
      buildingPart(homes,'detail','stone','box',pad,u,groundY+.26,v,1.65,.52,.84,.73);
      buildingPart(homes,'detail','green','dome',pad,u,groundY+.52,v,.97,.48,.51,[.82,.88,.72]);
    }
    const tones=[[.96,.91,.79],[.82,.88,.86],[.91,.83,.72]];
    buildingPart(homes,'shell','pale','box',pad,0,height*.5+.22,0,width,height,depth,tones[i]);
    const roofHeight=i===1?.72:1.72;
    if(i===1) {
      buildingPart(homes,'shell','bronze','box',pad,0,height+.36,0,width+.7,.28,depth+.75,.80);
      buildingPart(homes,'shell','pale','box',pad,-width*.20,height+1.06,depth*.17,width*.48,1.30,depth*.48,tones[i]);
      buildingPart(homes,'shell','bronze','box',pad,-width*.20,height+1.76,depth*.17,width*.54,.13,depth*.54,.79);
    } else {
      buildingPart(homes,'shell','timber','pitchedRoof',pad,0,height+.22,0,width+1,roofHeight,depth+.95,i===0?[.85,.64,.49]:[.58,.66,.67]);
      buildingPart(homes,'detail','bronze','box',pad,0,height+roofHeight+.22,0,.18,.12,depth+1.02,.78);
      buildingPart(homes,'detail','stone','box',pad,-width*.27,height+1.50,depth*.22,.72,1.75,.83,.77);
    }
    // Real recessed openings on +X and -Z: both are visible from the chase
    // camera. Upper windows have room depth and independently lit panes.
    for(const v of [-depth*.27,depth*.27]) {
      buildingPart(homes,'shell','timber','box',pad,width*.5+.025,4.66,v,.13,2.25,2.54,.77);
      buildingPart(homes,'shell','glass','box',pad,width*.5+.105,4.68,v,.065,1.96,2.26,.93);
      buildingPart(homes,'detail','stone','box',pad,width*.5+.18,3.56,v,.37,.16,2.74,.92);
    }
    for(const u of [-width*.255,width*.255]) {
      buildingPart(homes,'shell','timber','box',pad,u,4.63,-depth*.5-.045,2.62,2.20,.13,.75);
      buildingPart(homes,'shell','glass','box',pad,u,4.64,-depth*.5-.12,2.30,1.92,.075,.93);
      buildingPart(homes,'detail','bronze','box',pad,u,4.65,-depth*.5-.165,.065,1.95,.045,.74);
    }
    buildingPart(homes,'shell','darkGlass','box',pad,width*.5+.05,1.65,0,.13,2.65,depth*.60,.94);
    buildingPart(homes,'shell','timber','box',pad,0,1.64,-depth*.5-.06,2.12,2.84,.15,.73);
    buildingPart(homes,'shell','darkGlass','box',pad,0,1.77,-depth*.5-.15,1.63,2.26,.06,.86);
    buildingPart(homes,'shell','bronze','box',pad,0,3.23,-depth*.5-.56,3.2,.13,1.25,.86);
    // Balcony slab, continuous handrail and a few clearly separated uprights.
    const balconyV=depth*.10,balconyDepth=depth*.72;
    buildingPart(homes,'shell','stone','box',pad,width*.5+.83,3.38,balconyV,1.80,.20,balconyDepth,.85);
    buildingPart(homes,'shell','bronze','box',pad,width*.5+1.63,4.43,balconyV,.07,.07,balconyDepth,.84);
    for(const side of [-1,1])buildingPart(homes,'shell','bronze','box',pad,width*.5+.82,4.43,balconyV+side*balconyDepth*.5,1.70,.07,.07,.84);
    for(let v=-balconyDepth*.5;v<=balconyDepth*.5+.01;v+=balconyDepth/4)buildingPart(homes,'detail','bronze','box',pad,width*.5+1.63,3.94,balconyV+v,.045,.99,.045,.79);
    for(const v of [-depth*.22,depth*.29]) {
      buildingPart(homes,'detail','bronze','box',pad,width*.5+1.23,3.74,v,.62,.50,1.08,.79);
      buildingPart(homes,'detail','green','dome',pad,width*.5+1.23,3.99,v,.43,.54,.68,[.75,.88,.77]);
    }
    // The middle house has a small evening pergola; the other two keep the
    // skyline clean. Lamps are retained in balanced quality near the homes.
    if(i===1) {
      for(const v of [-depth*.24,depth*.36])buildingPart(homes,'detail','bronze','box',pad,width*.5+1.62,4.91,v,.085,2.85,.085,.80);
      buildingPart(homes,'detail','bronze','box',pad,width*.5+1.62,6.33,depth*.06,.10,.10,depth*.60+.15,.8);
      festoon(homes,pad,width*.5+1.57,-depth*.24,depth*.36,6.24);
    }
    features.push({kind:'home',s,x:pad.x,z:pad.z,y:pad.baseY,height:height+(i===1?1.825:2.375),width,depth,style:i,blockId:homes.id});
  });
  // Tall glass sits behind the shopping street, leaving the sea horizon open.
  // Distinct paired wings, rotated octagonal faces, terraces and offset crowns
  // make a skyline instead of a random repeated box extrusion.
  const towerPlan = [
    [565,-85,69,17,23,0], [640,-116,96,18,26,1], [745,-79,83,17,25,2],
    [830,-137,112,20,29,3], [900,-94,66,22,26,1], [1030,-121,121,20,29,2],
    [1140,-77,79,19,25,0], [1270,-113,109,19,28,3], [1405,-89,87,20,26,2],
    [1510,-137,114,21,29,1], [1610,-86,71,22,27,0], [1730,-115,93,19,24,3],
  ];
  const skyline=block('skyline',1120);
  towerPlan.forEach(([rawS,offset,height,width,depth,style],i) => {
    const s=rawS*scaleS, pad=groundPad(s,offset,width+13,depth+14,'tower');
    foundation(skyline,pad,width+13,depth+14);
    features.push({kind:'tower',s,x:pad.x,z:pad.z,y:pad.baseY,height,width,depth,style});
    buildingPart(skyline,'shell','stone','box',pad,0,3.1,0,width+11,6.2,depth+12,.89);
    buildingPart(skyline,'shell','darkGlass','box',pad,(width+11)*.5+.03,3.3,0,.15,4.9,depth+7,.9);
    const isOctagon=style===1||style===3, bodyHeight=height-8;
    if (isOctagon) {
      buildingPart(skyline,'shell','glass','prism',pad,-width*.07,bodyHeight*.5+6,0,width*.56,bodyHeight,depth*.56,.91+(i%3)*.045);
      buildingPart(skyline,'shell','pale','prism',pad,-width*.07,height-1.4,0,width*.565,.55,depth*.565,.93);
    } else {
      buildingPart(skyline,'shell','glass','box',pad,-width*.16,bodyHeight*.5+6,0,width*.74,bodyHeight,depth,.91+(i%3)*.035);
      buildingPart(skyline,'shell','darkGlass','box',pad,width*.30,bodyHeight*.39+6,depth*.08,width*.31,bodyHeight*.78,depth*.79,.96);
      buildingPart(skyline,'shell','pale','box',pad,-width*.16,height-1.4,0,width*.77,.55,depth*1.025,.93);
    }
    // A stepped rooftop and narrow vertical sail create a coastal silhouette.
    const crownHeight=style===2?8:4.3;
    buildingPart(skyline,'shell','bronze','box',pad,-width*.22,height+crownHeight*.5-1,-depth*.15,width*.41,crownHeight,depth*.62,.94);
    buildingPart(skyline,'shell','pale','box',pad,width*.36,height*.54,depth*.28,.44,height*.83,depth*.19,.87);
    buildingPart(skyline,'detail','pale','box',pad,width*.45,height*.37+6,0,.22,height*.72,.40,.9);
    for (let k=1;k<=3;k++) {
      buildingPart(skyline,'detail','bronze',isOctagon?'prism':'box',pad,isOctagon?-width*.07:-width*.16,height*(.24+k*.19),0,
        isOctagon?width*.57:width*.78,.26,isOctagon?depth*.57:depth*1.04,.78);
    }
    buildingPart(skyline,'detail','lamp','box',pad,-width*.22,height+crownHeight-1.05,-depth*.47,width*.41,.13,.13);
  });
  for(const anchor of activityAnchors)anchor.blockS=blocks.find(b=>b.id===anchor.blockId).s;
  // Geometry ownership is entirely local; no caller-owned materials or assets.
  for (const b of buckets.values()) {
    const geometry=new THREE.BufferGeometry();
    for (const [key,itemSize] of [['position',3],['normal',3],['uv',2],['color',3],['cityUv',2],['cityCell',2],['citySeed',1]]) geometry.setAttribute(key,new THREE.Float32BufferAttribute(b[key],itemSize));
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,materials[b.key]); mesh.name=`city-${b.block}-${b.tier}-${b.key}`;
    mesh.receiveShadow=b.key!=='sign'&&b.key!=='contact'; mesh.castShadow=false; mesh.userData.cityTier=b.tier;
    if(b.key==='contact')mesh.renderOrder=2;
    const owner=blocks.find(block=>block.id===b.block); owner.root.add(mesh); owner.meshes.push(mesh);
  }
  for (const b of blocks) b.bounds=new THREE.Box3().setFromObject(b.root);
  for (const geometry of Object.values(templates)) geometry.dispose();
  buckets.clear();
  const stats={shops:features.filter(f=>f.kind==='shop').length,homes:features.filter(f=>f.kind==='home').length,towers:towerPlan.length,blocks:streetPlan.length,quality:'high',theme,
    storedTriangles:0,visibleTriangles:0,drawCalls:0,shadowDrawCalls:0,visibleShops:0,roadMinimumClearance:Infinity,materials:materialFinish.stats,materialDetail:1};
  for (const b of blocks) for (const mesh of b.meshes) stats.storedTriangles+=mesh.geometry.attributes.position.count/3;
  for (const b of blocks) for (const mesh of b.meshes) {
    const p=mesh.geometry.attributes.position;
    for(let i=0;i<p.count;i++) stats.roadMinimumClearance=Math.min(stats.roadMinimumClearance,pathX(p.getZ(i))-p.getX(i));
  }
  group.userData.features=features; group.userData.footprints=footprints; group.userData.walks=walks; group.userData.stats=stats;group.userData.activityAnchors=activityAnchors;
  const frustum=new THREE.Frustum(), projection=new THREE.Matrix4();
  function update({playerS=75,quality='high',camera=null}={}) {
    const q=['high','balanced','low'].includes(quality)?quality:'balanced';
    materialFinish.setQuality(q);stats.materialDetail=materialFinish.detail.value;
    lastQuality=q; lastS=playerS; stats.theme=theme;stats.quality=q;stats.visibleTriangles=0;stats.drawCalls=0;stats.shadowDrawCalls=0;stats.visibleShops=0;
    if (camera) {camera.updateMatrixWorld(); projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(projection);}
    const limits=q==='high'?{shell:1150,detail:260,tiny:130}:q==='balanced'?{shell:900,detail:190,tiny:0}:{shell:650,detail:0,tiny:0};
    for (const b of blocks) {
      const skyline=b.id==='skyline', distance=Math.abs(b.s-playerS), ahead=b.s-playerS;
      b.root.visible=theme!=='bloom'&&(skyline||ahead>-125&&distance<limits.shell)&&(camera?frustum.intersectsBox(b.bounds):true);
      for (const mesh of b.meshes) {
        const tier=mesh.userData.cityTier;
        const activityRange=q==='high'?260:q==='balanced'?200:140;
        mesh.visible=tier==='shell'||tier==='detail'&&distance<limits.detail||tier==='tiny'&&limits.tiny>0&&distance<limits.tiny||tier==='activity'&&distance<activityRange;
        mesh.castShadow=q==='high'&&!skyline&&distance<165&&tier==='shell'&&(mesh.material===materials.pale||mesh.material===materials.stone);
        if(b.root.visible&&mesh.visible){stats.visibleTriangles+=mesh.geometry.attributes.position.count/3;stats.drawCalls++;stats.shadowDrawCalls+=mesh.castShadow?1:0;}
      }
      if(b.root.visible&&!skyline)stats.visibleShops+=features.filter(f=>f.kind==='shop'&&Math.abs(f.s-b.s)<90*scaleS).length;
    }
    group.visible=theme!=='bloom'; return stats;
  }
  function setTheme(next='coast') {
    theme=next; twilight.value=next==='sunset'?1:next==='coast'?.68:0;
    materials.lamp.emissiveIntensity=next==='sunset'?1.1:next==='coast'?.64:.08;
    materials.sign.color.setHex(next==='sunset'?0xfff3db:0xe4dece);
    update({playerS:lastS,quality:lastQuality});
  }
  function containsFootprint(x,z,margin=0) {
    return walks.some(w=>z>=w.start-margin&&z<=w.end+margin&&x-pathX(z)>=w.outer-margin&&x-pathX(z)<=w.inner+margin)||footprints.some(p=>{const dx=x-p.x,dz=z-p.z,c=Math.cos(p.yaw),s=Math.sin(p.yaw);
      return Math.abs(c*dx-s*dz)<=p.halfW+margin&&Math.abs(s*dx+c*dz)<=p.halfD+margin;});
  }
  function dispose() {
    group.traverse(mesh=>{if(mesh.geometry&&!disposed.has(mesh.geometry)){mesh.geometry.dispose();disposed.add(mesh.geometry);}});
    for(const material of Object.values(materials)){if(material.map&&!disposed.has(material.map)){material.map.dispose();disposed.add(material.map);}material.dispose();}
    group.clear();
  }
  update({playerS:75,quality:'high'});
  return {group,setTheme,update,stats,containsFootprint,surfaceHeightAt,dispose};
}

function makePitchedRoof(THREE) {
  const a=[-.5,0,-.5],b=[.5,0,-.5],c=[0,1,-.5],d=[-.5,0,.5],e=[.5,0,.5],f=[0,1,.5];
  const faces=[[a,c,b],[d,e,f],[a,d,f],[a,f,c],[b,c,f],[b,f,e]];
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(faces.flat(2),3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(faces.flatMap(()=>[0,0,.5,1,1,0]),2));
  geometry.computeVertexNormals();return geometry;
}

function makeSignAtlas(THREE) {
  if (typeof document==='undefined'||!document.createElement) return null;
  const canvas=document.createElement('canvas'); canvas.width=1024;canvas.height=512;
  const context=canvas.getContext('2d');if(!context)return null;
  context.fillStyle='#263d42';context.fillRect(0,0,1024,512);
  const labels=['LUMI CAFÉ','PORT TABLE','MOON BAR','바다책방','SEASIDE','오후의 빛','BLUE HOUR','TERRACE'];
  labels.forEach((label,i)=>{const x=(i%2)*512,y=Math.floor(i/2)*128;
    context.fillStyle='#eadac0';context.font='500 48px sans-serif';context.textAlign='center';context.textBaseline='middle';context.fillText(label,x+256,y+64,465);});
  const texture=new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace; texture.anisotropy=2;return texture;
}

function contactTexture(THREE) {
  const size=64,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const r=Math.hypot((x+.5)/size*2-1,(y+.5)/size*2-1),i=(y*size+x)*4;
    data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(Math.pow(Math.max(0,1-r),1.6)*255);
  }
  const texture=new THREE.DataTexture(data,size,size);texture.needsUpdate=true;return texture;
}
