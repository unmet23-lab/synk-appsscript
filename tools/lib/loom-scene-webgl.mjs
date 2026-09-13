// Loom's reusable 2.5D scene renderer. No model calls, per-frame texture generation,
// React updates, video loops, or external runtime dependencies.
// Texture coordinates follow the moving surface; the canonical texture never changes.
const VERTEX = `#version 300 es
precision highp float; precision highp int;
in vec2 aUV; in float aDepth;
uniform vec2 uViewport; uniform vec4 uRect; uniform int uType;
uniform vec4 uPose; uniform vec2 uLook; uniform float uWind; uniform float uTime; uniform vec4 uEyeA; uniform vec4 uEyeB;
out vec2 vUV; out float vDepth; out vec2 vScreen;
void main(){
  vec2 p=aUV; vUV=aUV; vDepth=aDepth;
  // Camera, horizon, trunks and ground are stationary. Attention belongs to the
  // character, including when its target is an automatically passing seed.
  if(uType==1){
    float foot=.858; float h=max(0.,foot-p.y); float mid=exp(-pow((p.y-.52)/.32,2.));
    float free=1.-smoothstep(.65,.83,aUV.y);
    float z=max(0.,aDepth-.10);
    float turned=.5+(p.x-.5)*cos(uPose.x*1.5)+sin(uPose.x)*z*.24;
    p.x=mix(p.x,turned,free);
    p.x+=uPose.y*h*free;
    p.x+=(p.x-.5)*(uPose.w*1.1+uPose.z*.55)*mid*free;
    p.y+=(h*uPose.z-h*uPose.w*1.4)*free;
    // Only the upper felt responds. The three real contact lobes never slide.
    p.x+=uWind*.002*h*free;
    vec2 ea=(aUV-uEyeA.xy)/uEyeA.zw, eb=(aUV-uEyeB.xy)/uEyeB.zw;
    float eye=max(exp(-dot(ea,ea)*2.),exp(-dot(eb,eb)*2.));
    p+=vec2(uLook.x*.0045,uLook.y*.003)*eye;
  }
  vec2 pixel=uRect.xy+p*uRect.zw; vScreen=pixel;
  gl_Position=vec4(pixel.x/uViewport.x*2.-1.,1.-pixel.y/uViewport.y*2.,0.,1.);
}`;
const FRAGMENT = `#version 300 es
precision highp float; precision highp int;
in vec2 vUV; in float vDepth; in vec2 vScreen;
uniform sampler2D uTexture; uniform int uType;
uniform vec4 uColor; uniform float uLight; uniform float uTime; uniform float uRotation;
uniform vec4 uBackgroundRect;
uniform vec4 uEffect; uniform float uPulse;
uniform vec4 uStems[5]; uniform float uStemRadius[5]; uniform int uStemCount;
out vec4 outColor;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
void main(){
  if(uType<2){
    vec4 c=texture(uTexture,vUV);
    if(c.a<.004)discard;
    if(uType==1){
      // Constant scene grading; wind does not pump the whole image's brightness.
      float luma=dot(c.rgb,vec3(.2126,.7152,.0722));
      c.rgb=mix(c.rgb,vec3(luma),.075)*vec3(1.0,.986,.958);
      float groundShade=smoothstep(.62,.86,vUV.y);
      c.rgb*=1.-groundShade*.14;
      c.rgb+=vec3(.008,.010,.004)*groundShade;
    }
    outColor=c;
  }else if(uType==2){
    vec2 p=(vUV-.5)*2.;
    float a=exp(-dot(p,p)*3.8)*(1.-smoothstep(.70,1.,length(p)))*uColor.a;
    outColor=vec4(uColor.rgb,a);
  }else if(uType==5){
    // Only the photographed light changes, without a new moving particle or halo.
    vec2 uv=(vScreen-uBackgroundRect.xy)/uBackgroundRect.zw;
    vec2 d=(uv-uEffect.xy)/uEffect.zw;
    float mask=exp(-dot(d,d)*1.6)*(1.-smoothstep(.7,1.,length(d)));
    vec4 c=texture(uTexture,uv);
    c.rgb*=1.+uPulse;
    outColor=vec4(c.rgb,mask);
  }else if(uType==6){
    // Narrow stem/seed-head masks only. The camera and the surrounding ground
    // have zero displacement; all clumps share the scene clock and breeze.
    vec2 uv=(vScreen-uBackgroundRect.xy)/uBackgroundRect.zw;
    vec2 position=uv*uBackgroundRect.zw;
    float mask=0.;
    for(int i=0;i<5;i++){
      if(i>=uStemCount)break;
      vec2 a=uStems[i].xy*uBackgroundRect.zw,b=uStems[i].zw*uBackgroundRect.zw;
      vec2 axis=b-a;float along=clamp(dot(position-a,axis)/max(dot(axis,axis),.001),0.,1.);
      float d=length(position-mix(a,b,along))/max(uStemRadius[i],.001);
      mask=max(mask,1.-smoothstep(.48,1.,d));
    }
    vec2 root=uEffect.xy*uBackgroundRect.zw,top=uEffect.zw*uBackgroundRect.zw;
    vec2 axis=top-root;float height=clamp(dot(position-root,axis)/max(dot(axis,axis),.001),0.,1.);
    float bend=height*height*smoothstep(.02,.16,height)*uPulse;
    vec4 c=texture(uTexture,uv-vec2(bend*mask/uBackgroundRect.z,0.));
    outColor=vec4(c.rgb,mask);
  }else if(uType==4){
    // The original ground's fibers overlap a few pixels at the real contacts.
    // UVs are in screen space, so this pass and the unmoving background agree.
    vec2 uv=(vScreen-uBackgroundRect.xy)/uBackgroundRect.zw;
    vec4 c=texture(uTexture,uv);
    float tip=.14+hash(floor(vScreen*1.3))*.15;
    float cover=smoothstep(tip,.76,vUV.y);
    cover*=smoothstep(0.,.18,vUV.x)*(1.-smoothstep(.82,1.,vUV.x));
    outColor=vec4(c.rgb,cover);
  }else{
    vec2 p=(vUV-.5)*2.;float r=length(p);
    float angle=atan(p.y,p.x)+uRotation;
    float fibers=pow(.5+.5*sin(angle*39.+sin(angle*17.)*2.),7.);
    float core=exp(-r*r*10.);
    float fuzz=exp(-r*r*5.)*fibers*.29;
    float alpha=(core+fuzz)*(1.-smoothstep(.45,1.,r))*uColor.a;
    outColor=vec4(uColor.rgb,alpha);
  }
}`;

function shader(gl,type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
function image(src){return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error(`Asset unavailable: ${src}`));i.src=src;});}
function mesh(gl,n,m,depth){
  const points=[],indices=[];
  for(let y=0;y<=m;y++)for(let x=0;x<=n;x++)points.push(x/n,y/m,depth?depth[y*(n+1)+x]||0:0);
  for(let y=0;y<m;y++)for(let x=0;x<n;x++){const a=y*(n+1)+x;indices.push(a,a+n+1,a+1,a+1,a+n+1,a+n+2);}
  const vao=gl.createVertexArray();gl.bindVertexArray(vao);
  const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points),gl.STATIC_DRAW);
  const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
  return {vao,vb,ib,count:indices.length};
}

/** Render-ready assets are separate from the reusable clock/behaviour engine. */
export class LoomSceneRenderer {
  static async create(canvas,manifest){
    const renderer=new LoomSceneRenderer(canvas,manifest);
    await renderer.load();return renderer;
  }
  constructor(canvas,manifest){
    this.canvas=canvas;this.manifest=manifest;
    const gl=canvas.getContext('webgl2',{alpha:false,antialias:true,powerPreference:'low-power',preserveDrawingBuffer:true});
    if(!gl)throw new Error('WebGL 2 is unavailable');this.gl=gl;
    this.program=gl.createProgram();
    for(const [type,src] of [[gl.VERTEX_SHADER,VERTEX],[gl.FRAGMENT_SHADER,FRAGMENT]]){const s=shader(gl,type,src);gl.attachShader(this.program,s);gl.deleteShader(s);}
    gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(this.program));
    gl.useProgram(this.program);
    this.uniforms=Object.fromEntries(['Viewport','Rect','Type','Pose','Look','Wind','Time','Texture','Color','Light','Rotation','EyeA','EyeB','BackgroundRect','Effect','Pulse','StemCount'].map(k=>[k,gl.getUniformLocation(this.program,'u'+k)]));
    this.uniforms.Stems=gl.getUniformLocation(this.program,'uStems[0]');this.uniforms.StemRadius=gl.getUniformLocation(this.program,'uStemRadius[0]');
    this.environment=manifest.environment||{lights:[],grasses:[]};
    for(const [i,key]of['EyeA','EyeB'].entries()){const[x,y,w,h]=manifest.character.masks[i].target;gl.uniform4f(this.uniforms[key],(x+w/2)/1024,(y+h/2)/1024,w/2048,h/2048);}
    this.meshes={background:mesh(gl,64,40),character:mesh(gl,manifest.character.depth.N,manifest.character.depth.N,manifest.character.depth.z),quad:mesh(gl,1,1)};
    for(const m of Object.values(this.meshes)){gl.bindVertexArray(m.vao);gl.bindBuffer(gl.ARRAY_BUFFER,m.vb);for(const [name,size,offset]of[['aUV',2,0],['aDepth',1,8]]){const loc=gl.getAttribLocation(this.program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,12,offset);}}
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    this.dpr=Math.min(devicePixelRatio||1,2);this.stats={frames:0,drawCalls:0,textureUploads:0,webgl:'WebGL 2',renderMode:'2.5D surface deformation',camera:'fixed',background:'local light and grass masks only',contactPoints:3,lights:this.environment.lights.length,grassClumps:this.environment.grasses.length,maxGrassDisplacementCssPx:1.3};
    this.disposed=false;this.resize();
  }
  texture(source){const gl=this.gl,t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.generateMipmap(gl.TEXTURE_2D);this.stats.textureUploads++;return t;}
  async load(){
    const [bg,body,closed]=await Promise.all([image(this.manifest.background.src),image(this.manifest.character.src),image(this.manifest.character.closed)]);
    this.bgImage=bg;this.bodyImage=body;
    this.textures={background:this.texture(bg),body:this.texture(body)};
    const c=document.createElement('canvas');c.width=body.width;c.height=body.height;
    const ctx=c.getContext('2d');ctx.drawImage(body,0,0);
    const ratio=body.width/1024;
    for(const {target,offset,scale=1} of this.manifest.character.masks){
      const[x,y,w,h]=target.map(v=>v*ratio);ctx.save();ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);ctx.clip();
      ctx.drawImage(closed,offset[0]*ratio,offset[1]*ratio,body.width*scale,body.height*scale);ctx.restore();
    }
    // Pixel audit on the exact in-memory composite before upload.
    const original=document.createElement('canvas');original.width=c.width;original.height=c.height;const o=original.getContext('2d');o.drawImage(body,0,0);
    const a=o.getImageData(0,0,c.width,c.height).data,composite=ctx.getImageData(0,0,c.width,c.height),b=composite.data;let outsideChanges=0,alphaChanges=0;
    // Existing eyelid art can have different alpha inside its eye. Keep the common body alpha exactly.
    for(let i=3;i<b.length;i+=4)b[i]=a[i];
    ctx.putImageData(composite,0,0);
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
      const i=(y*c.width+x)*4;if(a[i+3]!==b[i+3])alphaChanges++;
      const inEye=this.manifest.character.masks.some(({target:[ex,ey,ew,eh]})=>Math.pow((x/ratio-ex-ew/2)/(ew/2+2),2)+Math.pow((y/ratio-ey-eh/2)/(eh/2+2),2)<=1);
      if(!inEye&&(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3]))outsideChanges++;
    }
    this.eyeAudit={outsideChanges,alphaChanges,coordinateSpace:c.width,boundaryAllowance:'2 source pixels for elliptical antialiasing'};
    this.textures.closed=this.texture(c);this.ready=true;
  }
  resize(){
    const r=this.canvas.getBoundingClientRect();this.width=Math.max(1,r.width);this.height=Math.max(1,r.height);
    this.canvas.width=Math.round(this.width*this.dpr);this.canvas.height=Math.round(this.height*this.dpr);this.gl.viewport(0,0,this.canvas.width,this.canvas.height);
    const mobile=this.width<600;const size=Math.min(this.height*(mobile?.55:.64),this.width*(mobile?.91:.52));
    const cx=this.width*(mobile?.54:.60),foot=this.height*(mobile?.84:.855);
    this.characterRect=[cx-size*.5,foot-size*.858,size,size];
    this.characterCenter={x:cx,y:foot-size*.40,foot,size};
  }
  hitTest(x,y){const r=this.characterRect;const u=(x-r[0])/r[2],v=(y-r[1])/r[3];return u>.14&&u<.88&&v>.12&&v<.88;}
  draw(type,rect,m,tex,color=[1,1,1,1],rotation=0){
    const gl=this.gl,u=this.uniforms;gl.uniform1i(u.Type,type);gl.uniform4fv(u.Rect,rect);gl.uniform4fv(u.Color,color);gl.uniform1f(u.Rotation,rotation);
    if(tex)gl.bindTexture(gl.TEXTURE_2D,tex);gl.bindVertexArray(m.vao);gl.drawElements(gl.TRIANGLES,m.count,gl.UNSIGNED_SHORT,0);this.stats.drawCalls++;
  }
  render(pose){
    if(!this.ready||this.disposed)return;
    const gl=this.gl,u=this.uniforms,w=this.width,h=this.height,t=pose.time;
    gl.useProgram(this.program);gl.uniform2f(u.Viewport,w,h);gl.uniform4f(u.Pose,pose.turn,pose.lean,pose.compression,pose.breathe);gl.uniform2f(u.Look,pose.lookX,pose.lookY);gl.uniform1f(u.Wind,pose.wind);gl.uniform1f(u.Time,t);gl.uniform1f(u.Light,pose.light);gl.uniform1i(u.Texture,0);
    gl.clearColor(.031,.024,.02,1);gl.clear(gl.COLOR_BUFFER_BIT);this.stats.drawCalls=0;
    const factor=Math.max(w/this.bgImage.width,h/this.bgImage.height)*1.018,bw=this.bgImage.width*factor,bh=this.bgImage.height*factor;
    const backgroundRect=[(w-bw)/2,(h-bh)/2,bw,bh];
    gl.uniform4fv(u.BackgroundRect,backgroundRect);
    this.draw(0,backgroundRect,this.meshes.background,this.textures.background);
    this.renderEnvironment(pose,backgroundRect);
    const {x:cx,foot,size}=this.characterCenter;
    // Sun behind-left: broad cast shadow falls forward-right, contact shadow remains at the seam.
    this.draw(2,[cx-size*.24,foot-size*.045,size*.72,size*.20],this.meshes.quad,null,[.17,.14,.10,.26]);
    this.draw(2,[cx-size*.35,foot-size*.044,size*.70,size*.082],this.meshes.quad,null,[.17,.14,.10,.22]);
    // Alpha-measured contact lobes, rather than one shadow concentrated centrally.
    const contacts=[[.237,.8444],[.488,.8515625],[.737,.84049]];
    for(const [x,y] of contacts){
      const px=this.characterRect[0]+x*size,py=this.characterRect[1]+y*size;
      this.draw(2,[px-size*.105,py-size*.015,size*.21,size*.031],this.meshes.quad,null,[.14,.12,.085,.42+pose.compression]);
    }
    this.draw(1,this.characterRect,this.meshes.character,pose.blink>.47?this.textures.closed:this.textures.body);
    for(const [x,y] of contacts){
      const px=this.characterRect[0]+x*size,py=this.characterRect[1]+y*size;
      this.draw(4,[px-size*.09,py-size*.006,size*.18,size*.020],this.meshes.quad,this.textures.background);
    }
    // One wandering seed is also the character's shared attention target.
    if(pose.leaf.visible){
      const px=w*(.5+pose.leaf.x*.32),py=h*(.46+pose.leaf.y*.25),sz=Math.max(12,Math.min(w,h)*.025);
      this.draw(3,[px-sz/2,py-sz/2,sz,sz],this.meshes.quad,null,[1,.94,.69,.92],pose.leaf.rotation);
      this.draw(3,[px-sz,py-sz,sz*2,sz*2],this.meshes.quad,null,[1,.82,.42,.12],pose.leaf.rotation);
    }
    this.stats.frames++;this.lastPose={...pose};
  }
  renderEnvironment(pose,bg){
    const gl=this.gl,u=this.uniforms,t=pose.time;
    const box=(x,y,w,h)=>[bg[0]+x*bg[2],bg[1]+y*bg[3],w*bg[2],h*bg[3]];
    this.environmentState={lightLevels:[],grassDisplacements:[]};
    for(const [index,grass] of this.environment.grasses.entries()){
      const segments=(grass.segments||[grass]).slice(0,5),points=new Float32Array(20),radii=new Float32Array(5);
      let left=1,right=0,top=1,bottom=0;
      for(const [i,s] of segments.entries()){
        points.set([...s.root,...s.tip],i*4);radii[i]=s.radius*bg[2];
        const rx=s.radius+2/bg[2],ry=rx*bg[2]/bg[3];
        left=Math.min(left,s.root[0]-rx,s.tip[0]-rx);right=Math.max(right,s.root[0]+rx,s.tip[0]+rx);
        top=Math.min(top,s.root[1]-ry,s.tip[1]-ry);bottom=Math.max(bottom,s.root[1]+ry,s.tip[1]+ry);
      }
      const stiffness=Math.max(0,Math.min(1,grass.stiffness??.5));
      const sway=Math.max(-1.3,Math.min(1.3,(pose.wind*3.1+.13*Math.sin(t*.8+index*.7))*(1-stiffness*.3)));
      gl.uniform4fv(u.Effect,[...grass.root,...grass.tip]);gl.uniform1f(u.Pulse,sway);
      gl.uniform1i(u.StemCount,segments.length);gl.uniform4fv(u.Stems,points);gl.uniform1fv(u.StemRadius,radii);
      this.draw(6,box(left,top,right-left,bottom-top),this.meshes.quad,this.textures.background);
      this.environmentState.grassDisplacements.push(sway);
    }
    for(const light of this.environment.lights){
      const phase=light.phase||0,period=Math.max(6,light.period||8);
      const pulse=.10*(.75*Math.sin(t*Math.PI*2/period+phase)+.25*Math.sin(t*Math.PI*2/(period*1.37)+phase*1.7));
      const [x,y]=light.center,[rx,ry]=light.radius;
      gl.uniform4fv(u.Effect,[x,y,rx,ry]);gl.uniform1f(u.Pulse,pulse);
      this.draw(5,box(x-rx,y-ry,rx*2,ry*2),this.meshes.quad,this.textures.background);
      this.environmentState.lightLevels.push(pulse);
    }
  }
  dispose(){if(this.disposed)return;const gl=this.gl;for(const t of Object.values(this.textures||{}))gl.deleteTexture(t);for(const m of Object.values(this.meshes)){gl.deleteBuffer(m.vb);gl.deleteBuffer(m.ib);gl.deleteVertexArray(m.vao);}gl.deleteProgram(this.program);this.disposed=true;}
}
