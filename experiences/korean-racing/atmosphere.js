// Sky, environment capture and water use one panorama grade and sun direction.
// The ocean remains one two-triangle pass, without reflection cameras.
const skyGrade = `
  vec3 coastalSkyGrade(vec3 colour,float altitude,float golden){
    float upper=smoothstep(.12,.78,max(0.,altitude));
    float horizon=1.-smoothstep(.015,.30,max(0.,altitude));
    // Keep cloud detail and original gold highlights, with subtle violet above.
    vec3 twilight=colour*mix(vec3(1.015,.99,.98),vec3(1.01,.955,1.055),upper);
    float luminance=dot(colour,vec3(.2126,.7152,.0722));
    twilight+=vec3(.021,.003,.012)*horizon*(1.-smoothstep(.20,.72,luminance));
    return mix(colour,twilight,golden);
  }`;

export function createAtmosphere(THREE,{daySky,sunsetSky,time,sunDirection,shoreOffset,groundHeight,pathX,ROAD_END}) {
  if(typeof shoreOffset!=='function'||!Number.isFinite(ROAD_END)||ROAD_END<100)throw new TypeError('Atmosphere needs the real shoreline and a finite course length.');
  const shared={map:{value:daySky},sun:{value:sunDirection},golden:{value:0}};
  const skyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:shared,
    vertexShader:`varying vec2 vUv;varying vec3 vDirection;
      void main(){vUv=uv;vDirection=mat3(modelMatrix)*position;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 vUv;varying vec3 vDirection;
      uniform sampler2D map;uniform vec3 sun;uniform float golden;
      ${skyGrade}
      void main(){vec2 skyUv=vec2(vUv.x,clamp(.5+(vUv.y-.5)*1.5,0.,1.));
        vec3 direction=normalize(vDirection);
        vec3 col=coastalSkyGrade(texture2D(map,skyUv).rgb,direction.y,golden);
        float alignment=dot(direction,sun);
        float disc=smoothstep(cos(.0055),cos(.0041),alignment)*golden;
        float halo=pow(max(0.,alignment),520.)*.10*golden;
        col+=vec3(1.,.61,.28)*(disc*5.+halo);
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>}`});
  const sky=new THREE.Mesh(new THREE.SphereGeometry(4000,32,20),skyMaterial);
  sky.name='coastal-panoramic-sky';sky.renderOrder=-10;sky.frustumCulled=false;
  const samples=512,pixels=new Uint8Array(samples*4),sampledDepth=typeof groundHeight==='function'&&typeof pathX==='function';
  for(let i=0;i<samples;i++){
    const z=-150+i/(samples-1)*(ROAD_END+500),offset=shoreOffset(z);
    if(!Number.isFinite(offset)||offset<0||offset>128)throw new RangeError('Shoreline sample is outside the 0 to 128 metre coast strip.');
    const value=Math.round(offset/128*255);
    // Pack the actual shelf depths in the spare RGB strip channels. The same
    // single texture read now describes shoreline and water depth; no second
    // map, offscreen depth pass or per-frame terrain sampling is needed.
    const depths=[4,12,30].map((distance,j)=>{
      const depth=sampledDepth?-2.2-groundHeight(pathX(z)+offset+distance,z):[4,7,10][j];
      if(!Number.isFinite(depth))throw new RangeError('Invalid coastal water depth.');
      return Math.round(Math.max(0,Math.min(32,depth))/32*255);
    });
    pixels.set([value,...depths],i*4);
  }
  const shoreMap=new THREE.DataTexture(pixels,samples,1,THREE.RGBAFormat);
  shoreMap.minFilter=shoreMap.magFilter=THREE.LinearFilter;shoreMap.needsUpdate=true;
  const waterMaterial=new THREE.ShaderMaterial({uniforms:{time,sun:shared.sun,sky:shared.map,golden:shared.golden,skyRotation:{value:0},skyBasis:{value:new THREE.Vector2(1,0)},shoreMap:{value:shoreMap},shoreRange:{value:ROAD_END+500},waterDetail:{value:1}},
    vertexShader:`varying vec3 vWorld;void main(){vec4 p=modelMatrix*vec4(position,1.);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader:`varying vec3 vWorld;uniform float time;uniform vec3 sun;
      uniform sampler2D sky;uniform float golden;uniform vec2 skyBasis;
      uniform sampler2D shoreMap;uniform float shoreRange;uniform float waterDetail;
      ${skyGrade}
      void main(){vec2 p=vWorld.xz;vec3 toEye=cameraPosition-vWorld;float distanceToEye=length(toEye);
        vec3 view=toEye/max(.001,distanceToEye);
        float footprint=length(fwidth(p));
        float fine=(1.-smoothstep(75.,460.,distanceToEye))*(1.-smoothstep(.45,2.5,footprint));
        // Keep crossed mid-sized ripples readable beyond the near water. Their
        // long-wave modulation breaks up parallel mirror-like horizon bands.
        float swellA=dot(p,vec2(.033,.014))-time*.32;
        float swellB=dot(p,vec2(-.016,.051))+time*.27;
        vec2 swellSin=sin(vec2(swellA,swellB));
        float a=dot(p,vec2(.157,.087))+.78*swellSin.y-time*.84;
        float b=dot(p,vec2(-.103,.247))+.66*swellSin.x+time*.63;
        float midFilter=1.-smoothstep(1.8,9.,footprint);
        vec2 slope=vec2(.030,.013)*cos(swellA)+vec2(-.010,.030)*cos(swellB);
        slope+=(vec2(.047,.026)*cos(a)+vec2(-.026,.053)*cos(b))
          *(.74+.26*swellSin.x*swellSin.y)*midFilter;
        if(waterDetail>.1&&fine>.015){
          float capillary=dot(p,vec2(.73,-.41))+sin(a)*.7-time*1.7;
          slope+=(vec2(.012,-.007)*cos(capillary)+vec2(.005,.009)*sin(dot(p,vec2(.51,.94))+time*1.39))*fine*waterDetail;
        }
        vec3 n=normalize(vec3(-slope.x,1.,-slope.y));
        float grazing=1.-max(0.,dot(n,view));float grazing2=grazing*grazing;
        float fresnel=.035+.92*grazing2*grazing2;
        // Smooth high-frequency glints before they become isolated hot pixels.
        float glintFilter=1.-smoothstep(.018,.12,length(fwidth(slope)));
        float roadX=sin(p.y/235.)*25.+sin(p.y/580.)*31.;
        vec4 coast=texture2D(shoreMap,vec2(clamp((p.y+150.)/shoreRange,0.,1.),.5));
        float edge=coast.r*128.;
        float shore=p.x-roadX-edge;
        vec3 shelf=coast.gba*32.;
        float metres=mix(0.,shelf.x,clamp(shore/4.,0.,1.));
        metres=mix(metres,shelf.y,clamp((shore-4.)/8.,0.,1.));
        metres=mix(metres,shelf.z,clamp((shore-12.)/18.,0.,1.));
        metres+=max(0.,shore-30.)*.16;
        float depth=smoothstep(.7,15.,metres);
        vec3 shallows=mix(vec3(.023,.235,.223),vec3(.041,.183,.185),golden);
        vec3 deep=mix(vec3(.008,.075,.137),vec3(.024,.062,.121),golden);
        vec3 colour=mix(shallows,deep,depth);
        // Restrained sand/rock variation belongs to shallow water only. Filter
        // it by world footprint so distant bays do not shimmer with fine noise.
        float shelfLight=(.5+.5*sin(p.y*.073+sin(p.x*.11)))*(1.-smoothstep(2.,10.,metres));
        colour+=mix(vec3(.017,.030,.014),vec3(.024,.023,.009),golden)*shelfLight;
        float crest=(swellSin.x*.5+.5)*(swellSin.y*.5+.5);
        colour+=mix(vec3(.006,.018,.017),vec3(.011,.012,.020),golden)*crest;
        if(waterDetail>.1&&fine>.015&&depth<.98){
          float caustic=pow(max(0.,sin(a*2.1+sin(b))*sin(b*1.7)),5.);
          colour+=vec3(.022,.047,.029)*caustic*fine*(1.-depth)*waterDetail;
        }
        vec3 reflected=reflect(-view,n);float reflectedAltitude=reflected.y;
        reflected.xz=mat2(skyBasis.x,skyBasis.y,-skyBasis.y,skyBasis.x)*reflected.xz;
        vec2 uv=vec2(atan(-reflected.z,reflected.x)/6.2831853+.5,asin(clamp(reflected.y,-1.,1.))/3.14159265+.5);
        uv.y=clamp(.5+(uv.y-.5)*1.5,0.,1.);
        vec3 reflection=coastalSkyGrade(texture2D(sky,uv,1.2).rgb,reflectedAltitude,golden);
        colour=mix(colour,reflection,fresnel*mix(.72,.87,golden));
        // Broad sun path plus restrained highlights follow the same normals.
        float sunMatch=max(0.,dot(reflect(-sun,n),view));
        float shimmer=pow(sunMatch,mix(145.,82.,golden))*.49;
        shimmer+=pow(sunMatch,390.)*.64*(.4+.6*fine)*glintFilter;
        colour+=mix(vec3(1.,.94,.77),vec3(1.32,.68,.34),golden)*shimmer;
        // Foam tracks the actual coast, with broken wash and receding lace.
        if(shore<8.&&distanceToEye<1600.){
          float surge=sin(time*.53+p.y*.039+sin(p.y*.013));
          float shoal=1.-smoothstep(2.,9.,shelf.x);
          float wash=shore-(.8+shoal*.55)-surge*(.65+shoal*.55);
          float foamWidth=.65+shoal*.95+min(footprint,.65);
          float breaking=(1.-smoothstep(.14,foamWidth,abs(wash)));
          float foamPatch=.42+.58*smoothstep(-.55,.65,sin(p.y*.31+sin(p.y*.073)*2.4));
          float surf=breaking*foamPatch*(.23+.10*cos(time*.91+p.y*.12));
          if(waterDetail>.1&&fine>.015){
            float lace=(1.-smoothstep(.09,.58+min(footprint,.8),abs(wash-2.25)));
            surf+=lace*smoothstep(.1,.85,sin(p.y*.74-time*.31))*.09*fine*waterDetail*(.35+.65*shoal);
          }
          vec3 foam=mix(vec3(.62,.79,.77),vec3(.72,.71,.66),golden);
          colour=mix(colour,foam,surf*(1.-smoothstep(850.,1600.,distanceToEye)));
        }
        colour=mix(colour,reflection,smoothstep(1800.,4900.,distanceToEye)*.20);
        gl_FragColor=vec4(colour,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>}`});
  const ocean=new THREE.Mesh(new THREE.PlaneGeometry(8000,10000),waterMaterial);
  ocean.name='spectral-coastal-water';ocean.rotation.x=-Math.PI/2;ocean.position.set(2500,-2.2,2200);
  const stats={version:9,waterTriangles:2,waterPasses:1,reflectionCameras:0,shoreTextureBytes:pixels.byteLength,sampledDepth,depthSamples:sampledDepth?samples*3:0,detail:1,theme:'coast'};
  function setTheme(theme){const golden=theme==='sunset';shared.map.value=golden?sunsetSky:daySky;shared.golden.value=golden?1:0;
    sky.rotation.y=golden?.075:theme==='bloom'?4.6:4.2;waterMaterial.uniforms.skyRotation.value=sky.rotation.y;
    waterMaterial.uniforms.skyBasis.value.set(Math.cos(sky.rotation.y),Math.sin(sky.rotation.y));stats.theme=theme;}
  function setQuality(quality){waterMaterial.uniforms.waterDetail.value=quality==='low'?0:quality==='balanced'?.62:1;stats.detail=waterMaterial.uniforms.waterDetail.value;}
  function dispose(){sky.geometry.dispose();skyMaterial.dispose();ocean.geometry.dispose();waterMaterial.dispose();shoreMap.dispose();}
  return {sky,ocean,setTheme,setQuality,stats,dispose};
}
