import * as THREE from './scene-assets/three.module.js';

async function loadBakedBytes({signal,timeoutMs}){
  signal?.throwIfAborted();
  const request=new AbortController(),abort=()=>request.abort(signal.reason);
  const timeout=new Error('WARDROBE_ENVIRONMENT_TIMEOUT');
  const timer=setTimeout(()=>request.abort(timeout),Number.isFinite(timeoutMs)?Math.max(1,timeoutMs):5000);
  let rejectCancelled;
  const cancelled=new Promise((_,reject)=>{rejectCancelled=()=>reject(request.signal.reason);});
  request.signal.addEventListener('abort',rejectCancelled,{once:true});
  signal?.addEventListener('abort',abort,{once:true});
  try{
    const loading=(async()=>{
      const response=await fetch(new URL('./assets/wardrobe-environment-v1.bin.gz',import.meta.url),{signal:request.signal});
      if(!response.ok)throw Error('WARDROBE_ENVIRONMENT_ASSET');
      request.signal.throwIfAborted();
      // Abort both fetch and the decoding pipe, including a body that stops
      // sending bytes after its response headers have already arrived.
      return await new Response(response.body.pipeThrough(new DecompressionStream('gzip'),{signal:request.signal})).arrayBuffer();
    })();
    const bytes=await Promise.race([loading,cancelled]);
    request.signal.throwIfAborted();return bytes;
  }finally{
    clearTimeout(timer);signal?.removeEventListener('abort',abort);request.signal.removeEventListener('abort',rejectCancelled);
  }
}

// The fixed fitting-room PMREM, baked from the original two white panels and
// #dfe7e7 background. Half-float values preserve the original linear lighting.
// Each stage owns its GPU texture; the small compressed asset is HTTP-cacheable.
export async function loadWardrobeEnvironment(renderer,{signal,timeoutMs=5000}={}){
  try{
    const bytes=await loadBakedBytes({signal,timeoutMs});
    signal?.throwIfAborted();
    if(bytes.byteLength!==768*1024*8)throw Error('WARDROBE_ENVIRONMENT_SIZE');
    const texture=new THREE.DataTexture(new Uint16Array(bytes),768,1024,THREE.RGBAFormat,THREE.HalfFloatType);
    texture.name='Wardrobe baked PMREM';texture.mapping=THREE.CubeUVReflectionMapping;
    texture.colorSpace=THREE.LinearSRGBColorSpace;texture.minFilter=texture.magFilter=THREE.LinearFilter;
    texture.generateMipmaps=false;texture.flipY=false;texture.needsUpdate=true;
    return {texture,source:'baked',dispose:()=>texture.dispose()};
  }catch(error){
    signal?.throwIfAborted();
    // Missing/offline assets retain the original appearance and supported path.
    if(renderer.getContext().isContextLost())throw Error('WARDROBE_CONTEXT_LOST');
    const scene=new THREE.Scene();scene.background=new THREE.Color('#dfe7e7');
    const material=new THREE.MeshBasicMaterial({color:'#ffffff'});
    for(const [w,h,position]of [[5,4,[-3,3,4]],[4,3,[3,2,-3]]]){
      const panel=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);panel.position.set(...position);panel.lookAt(0,1,0);scene.add(panel);
    }
    const generator=new THREE.PMREMGenerator(renderer);
    try{const target=generator.fromScene(scene,.08);return {texture:target.texture,source:'procedural-fallback',dispose:()=>target.dispose()};}
    finally{generator.dispose();scene.traverse(object=>object.geometry?.dispose());material.dispose();}
  }
}
