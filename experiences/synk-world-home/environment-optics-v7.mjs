import * as THREE from './scene-assets/three.module.js';

// Material-only approximations: the existing sun and environment provide the
// light. No scene copy, reflection target, bloom or extra frame loop is used.
export function createEnvironmentOptics({ foliage, water, backdrop }) {
  const time = { value: 0 }, sunDirection = { value: new THREE.Vector3() }, sunColor = { value: new THREE.Color() };
  const hazeColor = { value: new THREE.Color() };
  // A static distant skyline atlas comes from the actual instance transforms.
  // This is a restrained facade reflection approximation, not a second camera
  // or a real-time reflection of nearby/animated objects.
  const reflectionCanvas = document.createElement('canvas'); reflectionCanvas.width = 512; reflectionCanvas.height = 128;
  const reflectionContext = reflectionCanvas.getContext('2d'), matrix = new THREE.Matrix4(), position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3(), color = new THREE.Color();
  const skyline = backdrop.group.getObjectByName('beveled-riverfront-architecture');
  for (let i = 0; i < skyline.count; i++) {
    skyline.getMatrixAt(i, matrix); matrix.decompose(position, rotation, scale); skyline.getColorAt(i, color);
    const x = (position.x + 55) / 110 * 512, top = (12 - position.y - scale.y / 2) / 14 * 128;
    const width = Math.max(1, scale.x / 110 * 512), height = scale.y / 14 * 128;
    reflectionContext.fillStyle = color.clone().multiplyScalar(.78).getStyle(); reflectionContext.fillRect(x - width / 2, top, width, height);
    reflectionContext.fillStyle = '#75979a';
    for (let y = top + 2; y < top + height - 1; y += 3) reflectionContext.fillRect(x - width * .34, y, width * .68, 1);
  }
  const reflectionMap = new THREE.CanvasTexture(reflectionCanvas); reflectionMap.colorSpace = THREE.SRGBColorSpace;
  reflectionMap.name = 'distant-city-reflection-v7';
  const reflectionTint = { value: new THREE.Color() };
  let disposed = false;
  const worldPosition = (shader, tag) => {
    shader.vertexShader = `varying vec3 v${tag}World;\n` + shader.vertexShader;
    shader.fragmentShader = `varying vec3 v${tag}World;\n` + shader.fragmentShader;
    shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
      vec4 ${tag}Position=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
        ${tag}Position=instanceMatrix*${tag}Position;
      #endif
      v${tag}World=(modelMatrix*${tag}Position).xyz;`);
  };
  const previousLeaf = foliage.onBeforeCompile, previousKey = foliage.customProgramCacheKey.bind(foliage);
  const leafKey = previousKey();
  foliage.onBeforeCompile = (shader, renderer) => {
    previousLeaf.call(foliage, shader, renderer);
    shader.uniforms.uLeafSunDirection = sunDirection; shader.uniforms.uLeafSunColor = sunColor;
    shader.fragmentShader = 'uniform vec3 uLeafSunDirection;uniform vec3 uLeafSunColor;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      vec3 leafSunView=normalize((viewMatrix*vec4(uLeafSunDirection,0.0)).xyz);
      float leafBackLight=pow(max(0.0,-dot(normal,leafSunView)),1.6);
      reflectedLight.directDiffuse+=diffuseColor.rgb*uLeafSunColor*vec3(.72,1.0,.39)*leafBackLight*.32;`);
  };
  foliage.customProgramCacheKey = () => `${leafKey}-thin-leaf-v7`; foliage.needsUpdate = true;

  water.metalness = .04; water.roughness = .23; water.ior = 1.333;
  water.color.set('#527e87'); water.clearcoat = .26; water.clearcoatRoughness = .27; water.envMapIntensity = 1.15;
  water.onBeforeCompile = shader => {
    shader.uniforms.uRiverTime = time; shader.uniforms.uRiverReflection = { value: reflectionMap }; shader.uniforms.uRiverReflectionTint = reflectionTint;
    worldPosition(shader, 'River');
    shader.fragmentShader = 'uniform float uRiverTime;uniform sampler2D uRiverReflection;uniform vec3 uRiverReflectionTint;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      vec2 riverP=vRiverWorld.xz;
      float riverA=dot(riverP,vec2(.76,1.54))+uRiverTime*.24;
      float riverB=dot(riverP,vec2(-1.83,.57))-uRiverTime*.18;
      float riverC=dot(riverP,vec2(4.12,2.35))+sin(riverA)*.32+uRiverTime*.36;
      vec3 riverSlope=vec3(cos(riverA)*.010-cos(riverB)*.007+cos(riverC)*.003,0.0,cos(riverA)*.014+cos(riverB)*.008+cos(riverC)*.002);
      normal=normalize(normal+(viewMatrix*vec4(riverSlope,0.0)).xyz);`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float riverBand=sin(vRiverWorld.x*.7+vRiverWorld.z*1.8+sin(vRiverWorld.x*1.3)*.3);
      diffuseColor.rgb*=.96+riverBand*.025;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      vec3 riverRay=normalize(vRiverWorld-cameraPosition);
      float riverHit=(-26.0-vRiverWorld.z)/min(riverRay.z,-.001);
      vec3 riverReflected=vRiverWorld+riverRay*riverHit;
      float reflectedHeight=-2.32-riverReflected.y;
      vec2 riverUV=vec2((riverReflected.x+55.0)/110.0,(reflectedHeight+2.0)/14.0);
      riverUV+=vec2(sin(riverC)*.0014,sin(riverA+riverB)*.004);
      vec4 riverCity=texture2D(uRiverReflection,riverUV,1.3);
      float riverMask=step(0.0,riverHit)*step(0.0,riverUV.x)*step(riverUV.x,1.0)*step(0.0,riverUV.y)*step(riverUV.y,1.0);
      float riverFresnel=.35+.65*pow(1.0-max(dot(normal,normalize(vViewPosition)),0.0),3.0);
      outgoingLight=mix(outgoingLight,riverCity.rgb*uRiverReflectionTint,riverCity.a*riverMask*riverFresnel*.31);
      #include <opaque_fragment>`);
  };
  water.customProgramCacheKey = () => 'synk-river-dielectric-v7'; water.needsUpdate = true;

  const atmosphereMaterials = [...backdrop.ridgeMaterials, ...backdrop.buildingMaterials];
  for (const material of atmosphereMaterials) {
    const previous = material.onBeforeCompile, cacheKey = material.customProgramCacheKey();
    material.onBeforeCompile = (shader, renderer) => {
      previous.call(material, shader, renderer); worldPosition(shader, 'Air');
      shader.uniforms.uAirColor = hazeColor;
      shader.fragmentShader = 'uniform vec3 uAirColor;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
        float airDistance=length(cameraPosition-vAirWorld);
        float groundHaze=(1.0-exp(-max(airDistance-20.0,0.0)*.008))*(.35+.65*exp(-max(vAirWorld.y,0.0)*.22));
        outgoingLight=mix(outgoingLight,uAirColor,groundHaze*.46);
        #include <opaque_fragment>`);
    };
    material.customProgramCacheKey = () => `${cacheKey}-height-haze-v7`; material.needsUpdate = true;
  }
  function setSun(direction, color, sunset) {
    sunDirection.value.copy(direction).normalize(); sunColor.value.copy(color);
    hazeColor.value.set(sunset ? '#c9b8a8' : '#bdced2');
    reflectionTint.value.set(sunset ? '#bfa48c' : '#a6c2c9');
  }
  return {
    update(dt, reduced) { if (!disposed && !reduced) time.value += dt; }, setSun,
    metrics: () => ({ revision: 7, waterTime: time.value, reflectionAtlas: [512, 128], reflectedBuildings: backdrop.group.userData.landscapeStats.buildings, reflectedFacadeParts: skyline.count, extraRenderTargets: 0, extraLights: 0, disposed }),
    dispose() { if (disposed) return; disposed = true; reflectionMap.dispose(); },
  };
}
