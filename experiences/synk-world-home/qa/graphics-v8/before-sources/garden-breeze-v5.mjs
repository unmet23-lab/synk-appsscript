import * as THREE from './scene-assets/three.module.js';

// Bend only leaf tips on the GPU; roots stay attached. The shadow pass uses
// exactly the same deformation, so leaves never drift away from their shadows.
export function createGardenBreeze(root, foliageMaterial) {
  const clock = { value: 0 }, strength = { value: 0 };
  const bend = shader => {
    shader.uniforms.uGardenTime = clock; shader.uniforms.uGardenBreeze = strength;
    shader.vertexShader = 'uniform float uGardenTime;uniform float uGardenBreeze;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 leafAnchor=vec3(0.0);
      #ifdef USE_INSTANCING
        leafAnchor=instanceMatrix[3].xyz;
      #endif
      leafAnchor=(modelMatrix*vec4(leafAnchor,1.0)).xyz;
      float leafPhase=leafAnchor.x*2.3+leafAnchor.z*1.7+leafAnchor.y*.8;
      float leafBend=(sin(uGardenTime*.72+leafPhase)+sin(uGardenTime*1.13+leafPhase*1.8)*.32)*uv.y*uv.y*uGardenBreeze;
      transformed.x+=leafBend;
      transformed.z+=leafBend*.28;
    `);
  };
  const previous = foliageMaterial.onBeforeCompile;
  foliageMaterial.onBeforeCompile = (shader, renderer) => { previous.call(foliageMaterial, shader, renderer); bend(shader); };
  foliageMaterial.customProgramCacheKey = () => 'synk-leaf-breeze-v5'; foliageMaterial.needsUpdate = true;
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  depth.onBeforeCompile = bend; depth.customProgramCacheKey = () => 'synk-leaf-shadow-v5';
  root.traverse(node => { if (node.isMesh && node.material === foliageMaterial) node.customDepthMaterial = depth; });
  return {
    update(dt, reduced) { strength.value = reduced ? 0 : .048; if (!reduced) clock.value += dt; },
    dispose() { depth.dispose(); },
  };
}
