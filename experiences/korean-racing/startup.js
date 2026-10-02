// Begin every first-view request together. Returning a settled result attaches
// the rejection handler immediately, even while fonts/world setup are pending.
export function startAssetLoad({textures,models,coarsePointer=false}) {
  const suffix=coarsePointer?'-mobile':'';
  const names=['road.jpg','road-normal.jpg','meadow-v2.jpg','terrain-normal.jpg',`azure-sky-v3${suffix}.jpg`,'cliff.jpg','cliff-normal.jpg','beach.jpg','pine-canopy-v2.webp','blossom-canopy-v2.webp',`golden-sky-v3${suffix}.jpg`];
  return Promise.all([
    ...names.map(name=>textures.loadAsync('./assets/'+name)),
    models.loadAsync('./assets/car.glb'),
    textures.loadAsync('./assets/felt/driver-felt.webp'),
    models.loadAsync('./assets/coastal-rocks-v6.glb')
  ]).then(values=>({ok:true,textures:values.slice(0,names.length),car:values[names.length],felt:values[names.length+1],rocks:values[names.length+2]}),error=>({ok:false,error}));
}

// Keep play disabled until the selected scene has compiled and rendered. A
// setting can change during either await, so only publish a stable first view.
export async function prepareFirstFrame({getState,prepare,compile,render,nextFrame}) {
  const unchanged=state=>{
    const current=getState();
    return state.length===current.length&&state.every((value,i)=>Object.is(value,current[i]));
  };
  for(;;){
    prepare();
    const state=getState();
    await compile();
    if(!unchanged(state))continue;
    render();
    await nextFrame();
    if(unchanged(state))return;
  }
}
