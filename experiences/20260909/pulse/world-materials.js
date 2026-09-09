import * as THREE from 'three';

export async function createFeltMaterials(renderer) {
  let tile, source = 'procedural fallback';
  try {
    tile = await new THREE.TextureLoader().loadAsync(new URL('./assets/felt-fibers-v2.png', import.meta.url).href);
    source = 'SYNK needle felt fibres v2';
  } catch {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#898989'; ctx.fillRect(0,0,256,256);
    let seed = 419;
    const random = () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    for (let n=0;n<18000;n++) {
      const x=random()*256,y=random()*256,a=random()*6.283,l=2+random()*10;
      ctx.strokeStyle=`rgba(230,230,230,${.08+random()*.2})`;ctx.lineWidth=.6;
      ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+Math.cos(a+.5)*l,y+Math.sin(a+.5)*l,x+Math.cos(a)*l,y+Math.sin(a)*l);ctx.stroke();
    }
    tile = new THREE.CanvasTexture(canvas);
  }
  tile.wrapS = tile.wrapT = THREE.RepeatWrapping;
  tile.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 12);
  const colorTile = tile.clone(); colorTile.colorSpace = THREE.SRGBColorSpace;
  const materials = [];
  function felt(color, roughness = .96, bump = .08) {
    const material = new THREE.MeshPhysicalMaterial({
      color, map: colorTile, bumpMap: tile, bumpScale: bump * .63,
      roughness: Math.max(.72,roughness), metalness: 0,
      sheen: .82, sheenRoughness: .93, sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xc7bfb2),.17),
    });
    // Keep the fibre photograph as surface variation, without baking its grey
    // illumination into every coloured object. Native derivative bump receives scene light.
    material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 feltSample=texture2D(map,vMapUv);
          vec3 fibreHeight=clamp((feltSample.rgb-vec3(.10))*1.9,0.,1.);
          diffuseColor.rgb*=mix(vec3(.58),vec3(1.55),fibreHeight);
          diffuseColor.a*=feltSample.a;
        #endif`);
    };
    material.customProgramCacheKey = () => 'synk-felt-physical-v2';
    materials.push(material); return material;
  }
  return { felt, tile, source, dispose() { materials.forEach(m=>m.dispose());tile.dispose();colorTile.dispose(); } };
}
