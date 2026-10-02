// Continuous screenshot plane; cursor tip, focus outline and image share coordinates.
// Cursor entry / tap / target ignition follows the installed oversized-cursor primitive.
for(const scene of scenes.filter(s=>s.camera)){
 const q='#'+scene.id,c=scene.camera,t=scene.start,D=scene.duration;
 const world=q+' .camera-world',target=q+' .cam-target',pointer=q+' .cam-pointer';
 const wide={scale:936/1280,x:0,y:(780-720*936/1280)/2};
 const pose=r=>{const [x,y,w,h]=r,k=Math.min(936/w,780/h);return {scale:k,x:468-(x+w/2)*k,y:390-(y+h/2)*k};};
 tl.fromTo(world,wide,{...wide,duration:.01},t);
 tl.fromTo(target,{opacity:0},{opacity:1,duration:.25},t+.45);
 tl.to(world,{...pose(c.focus),duration:.75,ease:'power3.inOut'},t+.9);
 tl.fromTo(q+' .phase-focus',{backgroundColor:'#edf2fc',color:'#53647f'},{backgroundColor:'#315fbe',color:'#ffffff',duration:.25},t+.9);
 tl.fromTo(pointer,{opacity:0,x:c.point[0]+80,y:c.point[1]+70},{opacity:1,x:c.point[0]-4.75,y:c.point[1]-4.4,duration:.48,ease:'power3.out'},t+1.65);
 tl.to(pointer+' svg',{scale:.78,duration:.1,yoyo:true,repeat:1},t+2.2);
 tl.fromTo(pointer+' i',{opacity:1,scale:.2},{opacity:0,scale:2.6,duration:.5,immediateRender:false},t+2.2);
 tl.to(target,{borderColor:'#93ffbf',duration:.18},t+2.2);
 tl.fromTo(q+' .phase-act',{backgroundColor:'#edf2fc',color:'#53647f'},{backgroundColor:'#315fbe',color:'#ffffff',duration:.25},t+2.15);
 if(c.mask)tl.to(q+' .cam-mask',{opacity:0,duration:.25},t+2.25);
 if(c.nextFocus){
  if(c.nextFile)tl.fromTo(q+' .cam-next',{opacity:0},{opacity:1,duration:.22},t+2.65);
  tl.to(world,{...pose(c.nextFocus),duration:.6,ease:'power3.inOut'},t+2.7);
  const r=c.rect,n=c.nextRect;
  tl.to(target,{x:n[0]-r[0],y:n[1]-r[1],scaleX:n[2]/r[2],scaleY:n[3]/r[3],borderColor:'#79a8ff',duration:.6,ease:'power3.inOut'},t+2.7);
  tl.to(pointer,{x:c.nextPoint[0]-4.75,y:c.nextPoint[1]-4.4,duration:.65,ease:'power3.inOut'},t+2.75);
  tl.to(q+' .camera-label .first,'+q+' .cam-action .first',{opacity:0,duration:.15},t+2.7);
  tl.fromTo(q+' .camera-label .next,'+q+' .cam-action .next',{opacity:0},{opacity:1,duration:.2},t+2.85);
  tl.to(pointer+' svg',{scale:.78,duration:.1,yoyo:true,repeat:1},t+4);
  tl.fromTo(pointer+' i',{opacity:1,scale:.2},{opacity:0,scale:2.6,duration:.5,immediateRender:false},t+4);
  tl.to(target,{borderColor:'#93ffbf',duration:.18},t+4);
 }
 if(c.confirmPoint){
  const r=c.rect,n=c.confirmRect;
  tl.to(target,{x:n[0]-r[0],y:n[1]-r[1],scaleX:n[2]/r[2],scaleY:n[3]/r[3],borderColor:'#79a8ff',duration:.35},t+4.25);
  tl.to(pointer,{x:c.confirmPoint[0]-4.75,y:c.confirmPoint[1]-4.4,duration:.35,ease:'power3.inOut'},t+4.25);
  tl.to(pointer+' svg',{scale:.78,duration:.1,yoyo:true,repeat:1},t+4.65);
  tl.to(target,{borderColor:'#93ffbf',duration:.15},t+4.65);
 }
 tl.to(pointer,{opacity:0,duration:.2},t+D-.95);
 tl.to(world,{...wide,duration:.7,ease:'power3.inOut'},t+D-.85);
 tl.to(q+' .phase-wide',{backgroundColor:'#315fbe',color:'#ffffff',duration:.25},t+D-.85);
}

