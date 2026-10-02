// The photographic coast scan is reduced offline; all placements share its
// two geometries and one material, with no extra lighting or shadow pass.
function softenScanEdge(geometry,halfWidth,halfDepth){
  const position=geometry.attributes.position,normal=geometry.attributes.normal;
  const submergedY=-1.6;
  const edgeWeight=(x,z)=>{
    // A gently uneven ellipse hides the rectangular capture boundary. Use
    // the same world-sized profile for both LODs so their waterline agrees.
    const radius=Math.hypot(x/halfWidth,z/halfDepth);
    const contour=radius*(1+.035*Math.sin(x*.15+z*.13)+.02*Math.sin(z*.31-x*.07));
    const t=Math.max(0,Math.min(1,(contour-.64)/.25));
    return t*t*(3-2*t);
  };
  for(let i=0;i<position.count;i++){
    const x=position.getX(i),y=position.getY(i),z=position.getZ(i),weight=edgeWeight(x,z);
    if(!weight||y<=submergedY)continue;
    position.setY(i,y+(submergedY-y)*weight);
    // Transform the scan normals through the deformation rather than
    // recalculating across UV seams and losing its photographic shading.
    const epsilon=.02,dy=1-weight;
    const dx=(submergedY-y)*(edgeWeight(x+epsilon,z)-edgeWeight(x-epsilon,z))/(2*epsilon);
    const dz=(submergedY-y)*(edgeWeight(x,z+epsilon)-edgeWeight(x,z-epsilon))/(2*epsilon);
    const nx=normal.getX(i),ny=normal.getY(i),nz=normal.getZ(i);
    const tx=nx*dy-ny*dx,tz=nz*dy-ny*dz,length=Math.hypot(tx,ny,tz);
    if(length>1e-8)normal.setXYZ(i,tx/length,ny/length,tz/length);
    else normal.setXYZ(i,0,1,0);
  }
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
}
export function createCoastalRocks(THREE,{source,pathX,groundHeight}){
  const near=source.getObjectByName('coastal-rock-near'),far=source.getObjectByName('coastal-rock-far');
  if(!near?.isMesh||!far?.isMesh)throw new TypeError('Coastal scan needs both prepared levels of detail.');
  const group=new THREE.Group();group.name='photographic-coastal-rock-shelves';
  const highGeometry=near.geometry.clone(),lowGeometry=far.geometry.clone();
  highGeometry.computeBoundingBox();const centre=highGeometry.boundingBox.getCenter(new THREE.Vector3());
  const size=highGeometry.boundingBox.getSize(new THREE.Vector3());
  for(const geometry of [highGeometry,lowGeometry]){geometry.translate(-centre.x,0,-centre.z);softenScanEdge(geometry,size.x/2,size.z/2);}
  const material=near.material.clone();material.envMapIntensity=.78;material.side=THREE.FrontSide;
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying float vCoastalHeight;').replace('#include <project_vertex>','vCoastalHeight=(modelMatrix*vec4(transformed,1.)).y;\n#include <project_vertex>');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vCoastalHeight;').replace('#include <color_fragment>','#include <color_fragment>\nfloat dryCoast=smoothstep(-2.35,-.55,vCoastalHeight);diffuseColor.rgb*=mix(vec3(.67,.72,.70),vec3(1.),dryCoast);').replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor*=mix(.62,1.,smoothstep(-2.35,-.55,vCoastalHeight));');
  };material.customProgramCacheKey=()=> 'scanned-coast-wet-v7';
  const specs=[{s:172,scale:.8,yaw:.21},{s:550,scale:1,yaw:-.16,offshore:49,y:-1.5},{s:895,scale:.85,yaw:.46},{s:1375,scale:.95,yaw:-.24},{s:1980,scale:.8,yaw:.3}];
  const meshes=specs.map(({s,scale,yaw,offshore=29,y=-2.75})=>{
    const mesh=new THREE.Mesh(lowGeometry,material);mesh.name='coast-scan-'+s;
    mesh.position.set(pathX(s)+groundHeight.shoreOffset(s)+offshore,y,s);mesh.scale.set(.9*scale,2.5*scale,.68*scale);mesh.rotation.y=yaw;mesh.receiveShadow=true;
    mesh.userData.s=s;mesh.updateMatrixWorld(true);group.add(mesh);return mesh;
  });
  const highTriangles=highGeometry.index.count/3,lowTriangles=lowGeometry.index.count/3;
  const stats={version:7,placements:meshes.length,nearTriangles:highTriangles,farTriangles:lowTriangles,visible:0,triangles:0,drawCalls:0,shadowDrawCalls:0};
  const frustum=new THREE.Frustum(),matrix=new THREE.Matrix4();
  function update({playerS=75,quality='high',camera}={}){
    if(camera){camera.updateMatrixWorld();frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));}
    stats.visible=stats.triangles=0;
    for(const mesh of meshes){const distance=Math.abs(mesh.userData.s-playerS);mesh.geometry=quality!=='low'&&distance<(quality==='high'?180:105)?highGeometry:lowGeometry;
      mesh.visible=distance<(quality==='low'?440:760)&&(!camera||frustum.intersectsObject(mesh));if(mesh.visible){stats.visible++;stats.triangles+=mesh.geometry.index.count/3;}}
    stats.drawCalls=stats.visible;
  }
  function dispose(){highGeometry.dispose();lowGeometry.dispose();material.dispose();}
  return {group,stats,update,dispose};
}
