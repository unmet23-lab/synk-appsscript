// Architectural finishes use metres along each original face, not the largest
// box dimension or world XY projections. All maps stay opaque and share the
// scene's prefiltered sky; no reflection camera, texture download or extra draw.
export function architecturalFaceUv({u,v,w,h,d,nx,ny,nz,shape='box',wood=false,floorPitch=3.7}) {
  let width,height;
  if(shape==='prism'||shape==='column'||shape==='planter') {
    width=Math.abs(ny)>.5?w*2:Math.PI*(w+d);
    height=Math.abs(ny)>.5?d*2:h;
  } else if(Math.abs(ny)>.5) {width=w;height=d;}
  else if(Math.abs(nx)>.5) {width=d;height=h;}
  else {width=w;height=h;}
  width=Math.max(.001,width);height=Math.max(.001,height);
  const cellW=width/Math.max(1,Math.round(width/3.4));
  const cellH=height/Math.max(1,Math.round(height/floorPitch));
  return {uv:[u*width,v*height],cell:wood?[width,height]:[cellW,cellH],width,height};
}

export function configureCityMaterials(materials,{twilight={value:0}}={}) {
  const detail={value:1};
  const sharedVertex='attribute vec2 cityUv; attribute vec2 cityCell; attribute float citySeed; varying vec2 vCityMetric; varying vec2 vCityCell; varying float vCitySeed;\n';
  const sharedFragment='uniform float cityMaterialDetail; varying vec2 vCityMetric; varying vec2 vCityCell; varying float vCitySeed;\n';
  const functions=`
    float cityHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float cityEdge(vec2 p) { vec2 f=fract(p); return min(min(f.x,1.0-f.x),min(f.y,1.0-f.y)); }
    vec3 cityBump(vec3 n,float height) {
      vec3 dx=dFdx(-vViewPosition),dy=dFdy(-vViewPosition);
      vec3 rx=cross(dy,n),ry=cross(n,dx);
      float determinant=dot(dx,rx);
      vec3 gradient=sign(determinant)*(dFdx(height)*rx+dFdy(height)*ry);
      return normalize(abs(determinant)*n-gradient);
    }
  `;
  const patch=(material,kind,build)=>{
    material.onBeforeCompile=shader=>{
      shader.uniforms.cityMaterialDetail=detail;
      shader.uniforms.cityTwilight=twilight;
      shader.vertexShader=sharedVertex+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCityMetric=cityUv;vCityCell=cityCell;vCitySeed=citySeed;');
      shader.fragmentShader=sharedFragment+'uniform float cityTwilight;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('void main() {',functions+'\nvoid main() {');
      build(shader);
    };
    material.customProgramCacheKey=()=>`city-architectural-${kind}-v9`;
    material.userData.finish={version:9,metricUv:true,opaque:true,kind};
  };
  for(const kind of ['stone','pale'])patch(materials[kind],kind,shader=>{
    const scale=kind==='stone'?'vec2(1.65,.72)':'vec2(.92,2.20)';
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 cityTile=vCityMetric/${scale};
      float cityPanel=cityHash(floor(cityTile)+vec2(vCitySeed*.017));
      float cityAA=max(fwidth(cityTile.x),fwidth(cityTile.y));
      float cityJoint=1.0-smoothstep(.007,.014+cityAA*.45,cityEdge(cityTile));
      // Residential lime plaster keeps a continuous face. The same material
      // batch still supplies the larger commercial stone panel joints.
      float cityPlaster=step(vCityCell.y,0.0);
      cityJoint*=1.0-cityPlaster;
      cityPanel=mix(cityPanel,.45,cityPlaster);
      float cityDistanceFade=1.0-smoothstep(55.0,150.0,length(vViewPosition));
      float cityGrain=0.0;
      if(cityMaterialDetail>.01) {
        float cityMicroAA=1.0-smoothstep(.007,.033,length(fwidth(vCityMetric)));
        cityGrain=(cityHash(floor(vCityMetric*95.0))-.5)*cityMicroAA*cityDistanceFade*cityMaterialDetail;
      }
      diffuseColor.rgb *= .938+cityPanel*.055-cityJoint*.12+cityGrain*.032;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=clamp(roughnessFactor+(cityPanel-.5)*.065+cityJoint*.15+cityPlaster*.17,.48,.96);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      if(cityMaterialDetail>.01) {
        float cityRelief=((1.0-cityJoint)*.0038+cityGrain*.0007)*cityMaterialDetail;
        normal=cityBump(normal,cityRelief);
      }
    `);
  });
  patch(materials.timber,'oak',shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 cityWood=vCityCell.x>=vCityCell.y?vCityMetric.yx:vCityMetric;
      float cityPlank=floor(cityWood.x/.16);
      float cityPlankTint=cityHash(vec2(cityPlank,vCitySeed));
      float cityWoodAA=length(fwidth(cityWood));
      float cityBoardEdge=1.0-smoothstep(.009,.023+cityWoodAA*2.0,min(fract(cityWood.x/.16),1.0-fract(cityWood.x/.16)));
      float cityWoodGrain=0.0;
      if(cityMaterialDetail>.01) {
        float cityGrainFade=(1.0-smoothstep(.005,.025,cityWoodAA))*cityMaterialDetail;
        cityWoodGrain=(sin(cityWood.x*470.0+sin(cityWood.y*1.7)*1.8)+sin(cityWood.x*159.0+cityWood.y*.7)*.42)*cityGrainFade;
      }
      diffuseColor.rgb *= vec3(.88,.83,.75)+cityPlankTint*.14-cityBoardEdge*.105+cityWoodGrain*.033;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=clamp(roughnessFactor+cityPlankTint*.045+cityBoardEdge*.08,.52,.93);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      if(cityMaterialDetail>.01)normal=cityBump(normal,cityWoodGrain*.00032+(1.0-cityBoardEdge)*.0010);
    `);
  });
  patch(materials.bronze,'satin-bronze',shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float cityBrush=0.0;
      if(cityMaterialDetail>.01) {
        float cityBrushFade=1.0-smoothstep(.006,.028,length(fwidth(vCityMetric)));
        cityBrush=sin(vCityMetric.y*420.0+vCityMetric.x*.15)*cityBrushFade*cityMaterialDetail;
      }
      diffuseColor.rgb *= .97+cityBrush*.013;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=clamp(roughnessFactor+cityBrush*.022,.24,.42);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      if(cityMaterialDetail>.01)normal=cityBump(normal,cityBrush*.00011);
    `);
  });
  for(const kind of ['glass','darkGlass'])patch(materials[kind],kind,shader=>{
    const roomDetails=kind==='darkGlass'?`
      float cityStyle=floor(cityRoomHash*4.0);
      if(cityStyle<1.0) {
        // A bookshop: muted book spines on three recessed oak shelves.
        vec2 cityBookUv=vec2(cityHit.x*7.5,cityHit.y*2.5);
        float cityShelf=1.0-smoothstep(.04,.085,abs(fract(cityBookUv.y)-.07));
        float cityBook=(1.0-smoothstep(.82,.94,fract(cityBookUv.x)))*step(.16,fract(cityBookUv.y))*step(fract(cityBookUv.y),.83);
        float cityBookTone=cityHash(floor(cityBookUv)+vec2(vCitySeed));
        vec3 cityBookColor=mix(vec3(.095,.143,.130),vec3(.22,.146,.105),cityBookTone);
        cityWall=mix(cityWall,cityBookColor,cityBook*cityBack*.72);
        cityWall=mix(cityWall,vec3(.11,.076,.044),cityShelf*cityBack*.90);
      } else if(cityStyle<2.0) {
        // A cafe counter is a closer plane, so it moves differently from the
        // back wall as the chase camera travels past the window.
        float cityCounterT=(-.28-cityOrigin.z)/cityRay.z;
        vec3 cityCounterP=cityOrigin+cityRay*cityCounterT;
        float cityCounter=step(cityCounterT,cityExit)*step(abs(cityCounterP.x),.88)*step(-.91,cityCounterP.y)*step(cityCounterP.y,-.38);
        float cityCounterFlute=.88+.12*sin(cityCounterP.x*32.0);
        cityWall=mix(cityWall,vec3(.16,.111,.059)*cityCounterFlute,cityCounter*.88);
      } else if(cityStyle<3.0) {
        // Linen at the sides, with a quiet warm display panel behind it.
        float cityCurtain=smoothstep(.67,.79,abs(cityHit.x))*(1.0-cityFloor);
        float cityFold=.88+.12*sin(cityHit.x*47.0);
        cityWall=mix(cityWall,vec3(.24,.213,.167)*cityFold,cityCurtain*.84);
      } else {
        float cityBarLine=(1.0-smoothstep(.025,.075,abs(cityHit.y-.18)))*cityBack;
        float cityBottle=step(.15,fract(cityHit.x*6.0))*step(fract(cityHit.x*6.0),.62)*step(.20,cityHit.y)*step(cityHit.y,.48)*cityBack;
        cityWall=mix(cityWall,vec3(.074,.115,.101),cityBottle*.76);
        cityWall=mix(cityWall,vec3(.25,.155,.065),cityBarLine*.74);
      }
    `:`
      float cityCurtain=smoothstep(.74,.86,abs(cityHit.x))*step(.34,cityRoomHash)*(1.0-cityFloor);
      float cityFold=.92+.08*sin(cityHit.x*42.0);
      cityWall=mix(cityWall,vec3(.19,.184,.164)*cityFold,cityCurtain*.68);
      float cityBlind=(1.0-smoothstep(.015,.045,abs(fract(cityHit.y*9.0)-.10)))*step(.83,cityRoomHash)*cityBack;
      cityWall*=1.0-cityBlind*.22;
    `;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 cityWindowUv=vCityMetric/max(vCityCell,vec2(.025));
      vec2 cityWindowCell=fract(cityWindowUv);
      vec2 cityWindowAA=fwidth(cityWindowUv);
      float cityWindowX=smoothstep(.008,.015+cityWindowAA.x*.60,min(cityWindowCell.x,1.0-cityWindowCell.x));
      float cityWindowY=smoothstep(.014,.024+cityWindowAA.y*.60,min(cityWindowCell.y,1.0-cityWindowCell.y));
      float cityPane=cityWindowX*cityWindowY;
      float cityRoomHash=cityHash(floor(cityWindowUv)+vec2(vCitySeed*.19,vCitySeed*.007));
      diffuseColor.rgb *= mix(vec3(.23,.25,.24),vec3(.96),cityPane);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=mix(.36,.105,cityPane);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
      metalnessFactor=mix(.72,.035,cityPane);
    `);
    // One analytical room-box intersection, only for the near facade at medium
    // or high quality. There is no ray loop, secondary camera or texture fetch.
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      float cityFacing=clamp(dot(normal,normalize(vViewPosition)),0.0,1.0);
      float cityFresnel=.165+.66*pow(1.0-cityFacing,5.0);
      vec3 cityRoomColor=vec3(.071,.084,.078)*(1.0+cityRoomHash*.08);
      float cityRoomDepthFade=(1.0-smoothstep(55.0,160.0,length(vViewPosition)))*cityMaterialDetail;
      if(cityMaterialDetail>.01) {
        vec3 cityDpX=dFdx(-vViewPosition),cityDpY=dFdy(-vViewPosition);
        vec2 cityDuX=dFdx(vCityMetric),cityDuY=dFdy(vCityMetric);
        // Derivatives remain outside this distance-dependent branch. The
        // analytical room and furnishing math only runs on a near window.
        if(cityRoomDepthFade>.003) {
        float cityOrientation=sign(cityDuX.x*cityDuY.y-cityDuX.y*cityDuY.x);
        vec3 cityTangent=normalize((cityDpX*cityDuY.y-cityDpY*cityDuX.y)*cityOrientation);
        vec3 cityBitangent=normalize((-cityDpX*cityDuY.x+cityDpY*cityDuX.x)*cityOrientation);
        vec3 cityView=normalize(vViewPosition);
        vec3 cityRay=vec3(-dot(cityView,cityTangent)*.83,-dot(cityView,cityBitangent)*1.12,-max(cityFacing,.015));
        cityRay=sign(cityRay+vec3(.00001))*max(abs(cityRay),vec3(.001));
        vec3 cityOrigin=vec3(cityWindowCell*2.0-1.0,1.0);
        vec3 cityDistance=(sign(cityRay)-cityOrigin)/cityRay;
        float cityExit=min(min(cityDistance.x,cityDistance.y),cityDistance.z);
        vec3 cityHit=cityOrigin+cityRay*cityExit;
        float cityFloor=1.0-smoothstep(-.985,-.965,cityHit.y);
        float cityCeiling=smoothstep(.965,.985,cityHit.y);
        float cityBack=1.0-smoothstep(-.985,-.965,cityHit.z);
        vec3 cityWall=vec3(.138,.145,.127);
        cityWall=mix(cityWall,vec3(.065,.075,.068),cityFloor);
        cityWall=mix(cityWall,vec3(.18,.199,.185),cityCeiling);
        float cityPictureX=mix(-.35,.38,cityRoomHash);
        float cityPicture=(1.0-smoothstep(.24,.30,abs(cityHit.x-cityPictureX)))*(1.0-smoothstep(.17,.22,abs(cityHit.y-.17)))*cityBack*step(.46,cityRoomHash);
        cityWall=mix(cityWall,vec3(.086,.127,.126),cityPicture*.72);
        float citySkirting=(1.0-smoothstep(.026,.05,abs(cityHit.y+.67)))*(1.0-cityFloor);
        cityWall*=1.0-citySkirting*.25;
        ${roomDetails}
        cityWall*=vec3(.70,.86,.85);
        cityRoomColor=mix(cityRoomColor,cityWall,cityRoomDepthFade);
        }
      }
      float cityRoomLit=${kind==='darkGlass'?'step(.62,cityRoomHash)':'step(.84,cityRoomHash)'};
      // Warm interior light stays below the coherent sky reflection. Large
      // distant towers should not turn into a checkerboard of cream squares.
      cityRoomColor+=vec3(.105,.050,.021)*cityRoomLit*cityTwilight;
      // The sunset reflection remains visible through the darker coating;
      // most rooms stay unlit instead of one continuous cream-colored wall.
      vec3 cityReflected=radiance*${kind==='darkGlass'?'vec3(.35,.48,.47)':'vec3(.62,.80,.84)'}*cityFresnel*(.82+cityRoomHash*.18);
      vec3 cityGlass=cityRoomColor*(1.0-cityFresnel)+cityReflected+reflectedLight.directSpecular*.38;
      outgoingLight=mix(outgoingLight,cityGlass,cityPane*.97);
      #include <opaque_fragment>
    `);
  });
  return {setQuality(quality){detail.value=quality==='low'?0:quality==='balanced'?.62:1;},detail,
    stats:{version:9,metricUv:true,extraDrawCalls:0,extraTriangles:0,downloadedTextures:0,interiorRays:1}};
}
