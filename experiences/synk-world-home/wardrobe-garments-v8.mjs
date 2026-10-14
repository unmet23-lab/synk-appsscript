import * as THREE from './scene-assets/three.module.js';

// Each garment has its own pattern, thickness and construction. The approved body is not edited.
export function buildWardrobeGarmentV8({group,item,mobile,detail,at,front,curvePoints,skin,mesh,cord,button,stitching,pocket,fabric,dyeMaterial,edge,brass,lining}){
  const TAU=Math.PI*2,rows=mobile?22:34,cols=mobile?64:96;
  const strip=(fn,width,material,name)=>mesh(group,skin((u,v)=>{const p=fn(v);p[0]+=(u-.5)*width;return p;},24,6,.015),material,name);
  const hem=(fn,material,count=90)=>{cord(group,curvePoints(t=>fn(t,.99),count),.0035,material);stitching(group,t=>fn(t,.965),material,count,.0017);};
  function pile(fn,kind,count,surfaceLift){
    if(!detail)return;
    count=mobile?Math.ceil(count*.16):count;
    const wool=kind==='wool-felt',geometry=new THREE.ConeGeometry(wool?.0007:.00055,1,5),material=dyeMaterial(new THREE.MeshPhysicalMaterial({color:item.color,roughness:.98,sheen:wool?.72:.88,sheenRoughness:.88,sheenColor:new THREE.Color(item.color).lerp(new THREE.Color('#ffffff'),.20),transparent:true,opacity:wool?.63:.54,depthWrite:false}));
    const fibres=new THREE.InstancedMesh(geometry,material,count),dummy=new THREE.Object3D(),up=new THREE.Vector3(0,1,0);let seed=wool?1731:8245;
    const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    for(let i=0;i<count;i++){
      const u=.012+random()*.976,v=.025+random()*.95,p=new THREE.Vector3(...fn(u,v)),du=new THREE.Vector3(...fn(u+.001,v)).sub(new THREE.Vector3(...fn(u-.001,v))),dv=new THREE.Vector3(...fn(u,v+.001)).sub(new THREE.Vector3(...fn(u,v-.001)));
      const normal=dv.clone().cross(du).normalize(),length=wool?.004+random()*.0055:.0015+random()*.0021;
      const direction=normal.clone().multiplyScalar(wool?.78:.54).addScaledVector(dv.normalize(),wool?(random()-.5)*.6:.74).addScaledVector(du.normalize(),(random()-.5)*(wool?.55:.18)).normalize();
      dummy.position.copy(p).addScaledVector(normal,surfaceLift).addScaledVector(direction,length*.5);dummy.quaternion.setFromUnitVectors(up,direction);dummy.scale.set(1,length,1);dummy.updateMatrix();fibres.setMatrixAt(i,dummy.matrix);
      const tone=.82+random()*.35;fibres.setColorAt(i,new THREE.Color(tone,tone,tone));
    }
    fibres.name=wool?'wool-individual-crossing-nap':'velvet-directional-short-pile';fibres.castShadow=false;fibres.receiveShadow=true;fibres.computeBoundingSphere();group.add(fibres);
  }

  if(item.key==='linen'){
    const mat=fabric('linen-detail',item.color,[2.8,2.3]),facing=dyeMaterial(fabric('linen-detail',item.trimColor,[2.6,1.2]),1);
    const wood=new THREE.MeshStandardMaterial({color:'#806246',roughness:.73});
    const panel=(u,v)=>{const a=.105+u*(TAU-.21),top=1.095-.026*Math.cos(a),y=top*(1-v)+(.372+.020*Math.cos(a*3))*v;
      return at(a,y,.052+.013*Math.sin(a*11+v*4)*Math.sin(v*Math.PI)+.013*Math.sin(v*Math.PI));};
    mesh(group,skin(panel,rows,cols,.024),mat,'linen-open-front-shirt-pattern');hem(panel,edge);
    for(const side of [-1,1]){
      const lapel=(u,v)=>{const a=side*(.105+.30*v),y=1.107-.249*v+(u-.5)*.080;return at(a,y,.073+.041*Math.sin(v*Math.PI)+.012*Math.sin(u*Math.PI));};
      mesh(group,skin(lapel,22,8,.027),facing,'linen-folded-shirt-lapel');stitching(group,t=>lapel(.90,t),edge,28,.0017);
      const placket=(u,v)=>{const a=side*(.106+(u-.5)*.054),y=1.080-v*.682;return at(a,y,.079+.007*Math.sin(v*5));};
      mesh(group,skin(placket,28,6,.017),facing,'linen-double-turned-placket');stitching(group,t=>placket(side<0?.85:.15,t),edge,54,.0016);
      const bag=(u,v)=>{const x=side*.268+(u-.5)*.262,y=.762-v*.214+Math.pow(Math.abs(u-.5)*2,4)*v*v*.028;
        return front(x,y,.089+.026*Math.sin(u*Math.PI)*Math.sin(v*Math.PI));};
      pocket(group,bag,mat,edge,lining);
    }
    for(const y of [1.014,.862,.710,.558])button(group,front(-.084,y,.103),wood,.015);
    // A sewn shoulder yoke and centre-back pleat make the rear a real shirt, too.
    stitching(group,t=>at(Math.PI+(t-.5)*2.65,.968+.012*Math.cos(t*TAU),.068),edge,70,.0016);
    const pleat=(u,v)=>at(Math.PI+(u-.5)*.075,1.015-v*.596,.081+.012*Math.sin(u*Math.PI));
    mesh(group,skin(pleat,26,7,.018),mat,'linen-centre-back-box-pleat');
    return true;
  }

  if(item.key==='corduroy'){
    const mat=fabric('corduroy-detail',item.color,[3.3,1.2]),trim=dyeMaterial(fabric('corduroy-detail',item.trimColor,[2,.7]),1);
    const bib=(u,v)=>{const w=.287+.256*Math.sin(v*1.35),x=(u*2-1)*w,y=1.053-v*.723+.027*Math.pow(Math.abs(u-.5)*2,4)*v*v;
      return front(x,y,.061+.010*Math.sin(v*8)*Math.sin(u*Math.PI));};
    mesh(group,skin(bib,rows,40,.038),mat,'corduroy-rounded-overall-bib');hem(bib,edge,58);
    for(const u of [.015,.985])stitching(group,t=>bib(u,t),edge,48,.0020);
    if(detail){
      // Actual rounded wales catch side light independently of the normal map.
      const ribMat=dyeMaterial(new THREE.MeshStandardMaterial({color:item.color,roughness:.94}));
      for(let i=1;i<(mobile?25:37);i++){
        const u=i/(mobile?25:37);cord(group,curvePoints(t=>{const p=bib(u,.03+t*.92);p[2]+=.012;return p;},24),mobile?.0023:.0028,ribMat);
      }
    }
    for(const side of [-1,1]){
      const strap=(u,v)=>at(side*(.31+v*(Math.PI-.62)),1.081+.045*Math.sin(v*Math.PI)+(u-.5)*.077,.061);
      mesh(group,skin(strap,34,8,.026),mat,'corduroy-wide-shoulder-strap');
      for(const u of [.08,.92])stitching(group,t=>strap(u,t),edge,42,.0018);
      const buckle=mesh(group,new THREE.TorusGeometry(.024,.004,6,16),brass,'corduroy-brass-strap-buckle');buckle.position.set(...front(side*.244,1.016,.091));buckle.scale.set(.78,1.18,1);
      button(group,front(side*.245,.978,.099),brass,.014);
      const bag=(u,v)=>{const x=side*.236+(u-.5)*.249,y=.744-v*.225+Math.pow(Math.abs(u-.5)*2,4)*v*v*.019;return front(x,y,.093+.024*Math.sin(u*Math.PI)*Math.sin(v*Math.PI));};
      pocket(group,bag,mat,edge,lining);
      button(group,bag(.05,.09),brass,.009);button(group,bag(.95,.09),brass,.009);
    }
    const waist=(u,v)=>at(Math.PI+(u-.5)*3.9,.759+(v-.5)*.082,.060);
    mesh(group,skin(waist,8,58,.027),trim,'corduroy-back-waist-panel');
    const back=(u,v)=>at(Math.PI+(u-.5)*.82,.987-v*.273,.063+.018*Math.sin(u*Math.PI));
    mesh(group,skin(back,20,20,.035),mat,'corduroy-rear-bib');hem(back,edge,35);
    return true;
  }

  if(item.key==='quilted'){
    const mat=fabric('quilted-detail',item.color,[2.4,1.0]),trim=dyeMaterial(fabric('cotton-detail',item.trimColor,[3,.5]),1);
    const top=a=>1.090-.038*Math.cos(a),bottom=.378;
    for(let row=0;row<4;row++){
      const panel=(u,v)=>{const a=.088+u*(TAU-.176),t=(row+v)/4,y=top(a)*(1-t)+bottom*t;
        const loft=.080*Math.pow(Math.sin(Math.PI*v),.8);return at(a,y,.049+loft+.005*Math.sin(a*12)*Math.sin(Math.PI*v));};
      mesh(group,skin(panel,mobile?10:16,cols,.041),mat,'quilted-loft-panel-'+row);
      stitching(group,t=>panel(t,.028),edge,mobile?76:104,.0018);
    }
    const collar=(u,v)=>{const a=.10+u*(TAU-.20),y=1.096-.019*Math.cos(a)+v*.101;return at(a,y,.080+.051*Math.sin(v*Math.PI));};
    mesh(group,skin(collar,14,cols,.040),mat,'quilted-padded-standing-collar');hem(collar,edge);
    for(const side of [-1,1]){
      strip(v=>front(side*.049,1.080-v*.689,.102),.036,trim,'quilted-zipper-tape');
      const teeth=[];for(let i=0;i<43;i++){const y=1.055-i*.0147;teeth.push(front(side*.018,y,.125),front(side*.030,y,.125));}
      // One instanced draw for the small metal zipper teeth.
      const geometry=new THREE.BoxGeometry(.012,.005,.006),zip=new THREE.InstancedMesh(geometry,brass,teeth.length/2),dummy=new THREE.Object3D();
      for(let i=0;i<teeth.length;i+=2){dummy.position.set(...teeth[i]);dummy.updateMatrix();zip.setMatrixAt(i/2,dummy.matrix);}zip.name='quilted-independent-zip-teeth';zip.castShadow=true;group.add(zip);
      const welt=(u,v)=>{const x=side*(.275+v*.086)+(u-.5)*.034,y=.729-v*.149;return front(x,y,.144);};
      mesh(group,skin(welt,15,5,.022),trim,'quilted-angled-pocket-welt');
    }
    const pull=mesh(group,new THREE.TorusGeometry(.023,.005,7,18),brass,'quilted-zip-pull');pull.position.set(...front(0,1.008,.142));pull.scale.set(.64,1.16,1);
    const hemBand=(u,v)=>at(.08+u*(TAU-.16),.380+(v-.5)*.049,.069);
    mesh(group,skin(hemBand,6,cols,.027),trim,'quilted-bound-bottom-edge');
    return true;
  }

  if(item.key==='velvet'){
    const mat=fabric('velvet-detail',item.color,[2.5,1.8]),piping=dyeMaterial(fabric('velvet-detail',item.trimColor,[2.5,.7]),1);
    const shell=(u,v)=>{const a=.13+u*(TAU-.26),top=1.133-.030*Math.cos(a),bottom=.598+.039*Math.cos(a*6),y=top*(1-v)+bottom*v;
      return at(a,y,.083+.103*Math.pow(v,1.15)+.022*Math.cos(a*8+.45)*Math.sin(v*Math.PI));};
    mesh(group,skin(shell,rows,cols,.036),mat,'velvet-short-draped-capelet');
    pile(shell,'velvet',12000,.020);
    cord(group,curvePoints(t=>shell(t,.983),100),.008,piping);stitching(group,t=>shell(t,.947),edge,90,.0016);
    const collar=(u,v)=>{const a=.125+u*(TAU-.25),y=1.126-.032*Math.cos(a)+(v-.5)*.065;return at(a,y,.099+.018*Math.sin(v*Math.PI));};
    mesh(group,skin(collar,10,cols,.033),piping,'velvet-rounded-bound-neckline');
    for(const u of [.01,.99])cord(group,curvePoints(t=>shell(u,t),38),.006,piping);
    const ceramic=new THREE.MeshPhysicalMaterial({color:'#f0e5d7',roughness:.23,clearcoat:.38,clearcoatRoughness:.19});
    const clasp=mesh(group,new THREE.SphereGeometry(.031,22,14),ceramic,'velvet-porcelain-neck-clasp');clasp.position.set(...front(0,1.063,.144));clasp.scale.set(1.2,.87,.48);
    const loop=mesh(group,new THREE.TorusGeometry(.042,.004,6,22),brass,'velvet-clasp-mount');loop.position.set(...front(0,1.062,.140));loop.scale.set(1.05,.72,1);
    return true;
  }

  if(item.key==='silk'){
    const mat=fabric('silk-detail',item.color,[3.1,.7]),trim=dyeMaterial(fabric('silk-detail',item.trimColor,[2,.6]),1);
    const wrap=(u,v)=>{const a=u*TAU,y=1.111-v*.074-.020*Math.cos(a);return at(a,y,.066+.014*Math.sin(v*Math.PI));};
    mesh(group,skin(wrap,10,cols,.009),mat,'silk-thin-folded-neck-wrap');
    for(const v of [.05,.95])cord(group,curvePoints(t=>wrap(t,v),80),.0024,trim,true);
    const knot=mesh(group,new THREE.SphereGeometry(.041,24,16),mat,'silk-compressed-side-knot');knot.position.set(...front(.30,1.020,.124));knot.scale.set(1.03,.63,.71);knot.rotation.z=-.27;
    for(const side of [-1,1]){
      const length=side<0?.283:.380;
      const tail=(u,v)=>{const w=(.13-.040*v),x=.30+side*.040+(u-.5)*w+side*.065*Math.sin(v*2.0),y=.998-v*length;
        return front(x,y,.103+.051*Math.sin(v*Math.PI)+.023*Math.sin(u*TAU+v*1.5));};
      mesh(group,skin(tail,28,10,.008),mat,'silk-asymmetric-scarf-tail');
      for(const u of [.018,.982])cord(group,curvePoints(t=>tail(u,t),32),.0023,trim);
      stitching(group,t=>tail(t,.97),edge,20,.0012);
      const end=(u,v)=>{const p=tail(u,.90+v*.067);p[2]+=.006;return p;};mesh(group,skin(end,4,10,.008),trim,'silk-rolled-contrast-hem');
    }
    return true;
  }

  if(item.key==='wool-felt'){
    const mat=fabric('wool-felt-detail',item.color,[3.4,.8]),trim=dyeMaterial(fabric('wool-felt-detail',item.trimColor,[2,.8]),1);
    const wrap=(u,v)=>{const a=u*TAU,y=1.138-v*.161-.030*Math.cos(a);return at(a,y,.079+.036*Math.sin(v*Math.PI)+.005*Math.cos(a*8));};
    mesh(group,skin(wrap,16,cols,.045),mat,'wool-full-bodied-woven-neck-wrap');
    pile(wrap,'wool-felt',4500,.024);
    for(const v of [.035,.97])cord(group,curvePoints(t=>wrap(t,v),96),.0045,mat,true);
    for(const side of [-1,1]){
      const tail=(u,v)=>{const x=.350+side*.085+(u-.5)*.203+side*.023*Math.sin(v*3),y=1.001-v*(side<0?.320:.503);
        return front(x,y,.133+.023*Math.sin(v*3.4)+.009*Math.sin(u*Math.PI));};
      mesh(group,skin(tail,28,16,.037),mat,'wool-thick-overlapped-muffler-tail');
      pile(tail,'wool-felt',2100,.020);
      const end=(u,v)=>tail(u,.905+v*.060);mesh(group,skin(end,4,16,.022),trim,'wool-stitched-contrast-border');
      stitching(group,t=>tail(t,.884),edge,28,.0023);
      for(const u of [.045,.955])stitching(group,t=>tail(u,t),edge,42,.0021);
      for(let i=0;i<11;i++){const p=tail((i+.5)/11,1);cord(group,[p,[p[0]+.004,p[1]-.027,p[2]+.010],[p[0]-.004,p[1]-.052,p[2]+.010]],.0038,mat);}
    }
    return true;
  }
  return false;
}
