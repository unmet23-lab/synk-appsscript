import * as THREE from 'three';

// Procedural cloud volumes projected onto a surrounding dome; all views remain spatial.
const noise = `
float hash(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=mat2(1.6,1.2,-1.2,1.6)*p+17.3;a*=.5;}return v;}`;

export function createAtmosphere(scene) {
  const uniforms = { time: { value: 0 } };
  const skyMaterial = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec3 vDirection;uniform float time;${noise}
    void main(){
      vec3 d=normalize(vDirection);float h=max(0.,d.y);
      vec3 zenith=vec3(.007,.015,.052), horizon=vec3(.055,.093,.159);
      vec3 c=mix(horizon,zenith,smoothstep(-.08,.65,h));
      vec2 p=d.xz/(.38+max(d.y,0.)) * 2.8;
      vec2 warp=vec2(fbm(p*.6+7.2),fbm(p*.6-4.8));
      float low=fbm(p+warp*1.2+vec2(time*.002,0.));
      float fine=fbm(p*2.6+warp*.4+vec2(time*.003,1.7));
      float cloud=smoothstep(.32,.81,low*.78+fine*.22)*smoothstep(-.05,.08,d.y);
      float rim=smoothstep(.43,.66,low)-smoothstep(.61,.82,low);
      c=mix(c,vec3(.054,.088,.163)+rim*.024,cloud*.9);
      vec3 moonDirection=normalize(vec3(-.47,.38,-1.));
      float moonDistance=length(d-moonDirection);
      float moonDisc=1.-smoothstep(.026,.029,moonDistance);
      float halo=exp(-moonDistance*13.)*.08;
      float moonGrain=.78+.22*fbm(d.xy*210.);
      c+=vec3(.73,.74,.67)*(moonDisc*.75*moonGrain+halo)*(1.-cloud*.85);
      vec2 starUV=vec2(atan(d.x,d.z),asin(d.y))*145.;vec2 id=floor(starUV);
      vec2 point=vec2(hash(id),hash(id+91.2))*.7+.15;
      float star=1.-smoothstep(.012,.09,length(fract(starUV)-point));
      star*=step(.982,hash(id+31.7))*smoothstep(.14,.48,h)*(1.-cloud);
      c+=vec3(.47,.55,.66)*star;
      gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(190, 80, 48), skyMaterial);
  sky.position.y = 4; sky.renderOrder = -20; scene.add(sky);

  const fogMaterial = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 vUv;uniform float time;${noise}
    void main(){float n=fbm(vUv*vec2(9.,2.)+vec2(time*.002,0.));float edge=pow(sin(vUv.x*3.14159),.7)*pow(sin(vUv.y*3.14159),2.);float a=edge*smoothstep(.28,.71,n)*.15;gl_FragColor=vec4(.36,.45,.56,a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`,
  });
  const fogs = [];
  for (const [x,y,z,w,h] of [[-35,1.6,-30,60,5],[-20,2.7,-48,63,7],[-34,.9,-10,30,2.7],[-2,.35,-6,24,.85]]) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w,h),fogMaterial); mesh.position.set(x,y,z);mesh.rotation.y=-.12;scene.add(mesh);fogs.push(mesh);
  }
  return {
    update(time, reduced) { if (!reduced) uniforms.time.value = time; },
    setQuality(low) { fogs.forEach(o => { o.visible = !low; }); },
    dispose() { sky.geometry.dispose(); skyMaterial.dispose(); fogs.forEach(o => o.geometry.dispose()); fogMaterial.dispose(); },
  };
}
