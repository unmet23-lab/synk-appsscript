// Sky and water share the same panorama and light direction. A single water
// pass avoids reflection cameras, fullscreen blur and expensive cloud raymarching.
export function createAtmosphere(THREE,{daySky,sunsetSky,time,sunDirection,shoreOffset,ROAD_END}) {
  const shared={map:{value:daySky},sun:{value:sunDirection},golden:{value:0}};
  const skyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:shared,
    vertexShader:`varying vec2 vUv;varying vec3 vDirection;
      void main(){vUv=uv;vDirection=mat3(modelMatrix)*position;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 vUv;varying vec3 vDirection;
      uniform sampler2D map;uniform vec3 sun;uniform float golden;
      void main(){vec2 skyUv=vec2(vUv.x,clamp(.5+(vUv.y-.5)*1.5,0.,1.));
        vec3 col=texture2D(map,skyUv).rgb;
        float alignment=dot(normalize(vDirection),sun);
        float disc=smoothstep(cos(.0055),cos(.0041),alignment)*golden;
        float halo=pow(max(0.,alignment),520.)*.13*golden;
        col+=vec3(1.,.61,.28)*(disc*5.+halo);
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>}`});
  const sky=new THREE.Mesh(new THREE.SphereGeometry(4000,32,20),skyMaterial);
  sky.name='coastal-panoramic-sky';sky.renderOrder=-10;sky.frustumCulled=false;
  const samples=512,pixels=new Uint8Array(samples*4);
  for(let i=0;i<samples;i++){const z=-150+i/(samples-1)*(ROAD_END+500),value=Math.round(shoreOffset(z)/128*255);pixels.set([value,value,value,255],i*4);}
  const shoreMap=new THREE.DataTexture(pixels,samples,1,THREE.RGBAFormat);
  shoreMap.minFilter=shoreMap.magFilter=THREE.LinearFilter;shoreMap.needsUpdate=true;
  const waterMaterial=new THREE.ShaderMaterial({uniforms:{time,sun:shared.sun,sky:shared.map,golden:shared.golden,skyRotation:{value:0},shoreMap:{value:shoreMap},shoreRange:{value:ROAD_END+500}},
    vertexShader:`varying vec3 vWorld;void main(){vec4 p=modelMatrix*vec4(position,1.);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader:`varying vec3 vWorld;uniform float time;uniform vec3 sun;
      uniform sampler2D sky;uniform float golden;uniform float skyRotation;
      uniform sampler2D shoreMap;uniform float shoreRange;
      void main(){vec2 p=vWorld.xz;float distanceToEye=length(vWorld-cameraPosition);
        float footprint=length(fwidth(p));
        float fine=(1.-smoothstep(65.,380.,distanceToEye))*(1.-smoothstep(.4,2.3,footprint));
        float a=dot(p,vec2(.121,.073))+sin(dot(p,vec2(-.038,.043)))*1.7-time*.73;
        float b=dot(p,vec2(-.054,.167))+sin(dot(p,vec2(.049,.027)))*1.9+time*.49;
        float c=dot(p,vec2(.319,-.137))-time*1.13;
        vec2 slope=vec2(.0055,.0035)*cos(a)+vec2(-.003,.006)*cos(b);
        slope+=vec2(.009,-.005)*cos(c)*fine;
        slope+=vec2(.003,.004)*sin(dot(p,vec2(.811,.593))+time*1.6)*fine;
        vec3 n=normalize(vec3(slope.x,1.,slope.y));
        vec3 view=normalize(cameraPosition-vWorld);
        float fresnel=.035+.88*pow(1.-max(0.,dot(n,view)),4.);
        float roadX=sin(p.y/235.)*25.+sin(p.y/580.)*31.;
        float edge=texture2D(shoreMap,vec2(clamp((p.y+150.)/shoreRange,0.,1.),.5)).r*128.;
        float shore=p.x-roadX-edge;
        float depth=smoothstep(2.,110.,shore);
        vec3 colour=mix(vec3(.015,.235,.215),vec3(.008,.075,.155),depth);
        float caustic=pow(max(0.,sin(a*3.1+sin(b))*sin(b*2.3-cos(c))),5.);
        colour+=vec3(.018,.052,.030)*caustic*fine*(1.-depth);
        vec3 reflected=reflect(-view,n);float yawCos=cos(skyRotation),yawSin=sin(skyRotation);
        reflected.xz=mat2(yawCos,yawSin,-yawSin,yawCos)*reflected.xz;
        vec2 uv=vec2(atan(-reflected.z,reflected.x)/6.2831853+.5,asin(clamp(reflected.y,-1.,1.))/3.14159265+.5);
        uv.y=clamp(.5+(uv.y-.5)*1.5,0.,1.);
        vec3 reflection=texture2D(sky,uv,1.2).rgb;
        colour=mix(colour,reflection,fresnel*.46);
        float glitter=pow(max(0.,dot(reflect(-sun,n),view)),golden>.5?140.:210.);
        colour+=mix(vec3(1.,.96,.82),vec3(1.4,.68,.27),golden)*glitter*.75;
        float wash=shore-1.3-sin(time*.63+p.y*.071)*1.15;
        float surf=(1.-smoothstep(.18,2.1+min(footprint,.9),abs(wash)));
        surf*=smoothstep(-.2,.72,sin(p.y*.54+sin(p.y*.139)*2.7));
        surf*=.36+.12*cos(time*1.2+p.y*.22);
        colour=mix(colour,vec3(.62,.80,.76),surf);
        colour=mix(colour,reflection,smoothstep(1600.,4900.,distanceToEye)*.15);
        gl_FragColor=vec4(colour,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>}`});
  const ocean=new THREE.Mesh(new THREE.PlaneGeometry(8000,10000),waterMaterial);
  ocean.name='spectral-coastal-water';ocean.rotation.x=-Math.PI/2;ocean.position.set(2500,-2.2,2200);
  function setTheme(theme){const golden=theme==='sunset';shared.map.value=golden?sunsetSky:daySky;shared.golden.value=golden?1:0;
    sky.rotation.y=golden?.075:theme==='bloom'?4.6:4.2;waterMaterial.uniforms.skyRotation.value=sky.rotation.y;}
  return {sky,ocean,setTheme};
}
