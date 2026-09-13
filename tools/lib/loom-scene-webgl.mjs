// Loom's reusable 2.5D scene renderer. No model calls, per-frame texture generation,
// React updates, video loops, or external runtime dependencies.
// Texture coordinates follow the moving surface; the canonical texture never changes.
const VERTEX = `#version 300 es
precision highp float; precision highp int;
in vec2 aUV; in float aDepth;
uniform vec2 uViewport; uniform vec4 uRect; uniform int uType;
uniform vec4 uPose; uniform vec2 uLook; uniform float uWind; uniform float uTime; uniform vec4 uEyeA; uniform vec4 uEyeB;
out vec2 vUV; out float vDepth;
void main(){
  vec2 p=aUV; vUV=aUV; vDepth=aDepth;
  if(uType==0){
    float side=pow(abs(p.x-.5)*2.,5.);
    float canopy=pow(1.-p.y,1.7);
    float ground=smoothstep(.48,1.,p.y);
    // Rooted trees and foreground grasses share wind but have distinct stiffness.
    p.x+=uWind*(side*canopy*.007+ground*.0015*sin(p.y*14.+p.x*9.-uTime*1.1));
    p.y+=uWind*side*canopy*.0008;
    // Only user-caused, bounded view change: no perpetual camera sway.
    p+=vec2(uLook.x*.004,uLook.y*.0016)*(side*.5+ground*.35);
  } else if(uType==1){
    float foot=.858; float h=max(0.,foot-p.y); float mid=exp(-pow((p.y-.52)/.32,2.));
    float z=max(0.,aDepth-.10);
    p.x=.5+(p.x-.5)*cos(uPose.x*1.5)+sin(uPose.x)*z*.24;
    p.x+=uPose.y*h;
    p.x+=(p.x-.5)*(uPose.w*1.1+uPose.z*.55)*mid;
    p.y+=h*uPose.z-h*uPose.w*1.4;
    // Lower seam trails the coherent breeze, while the planted centre stays still.
    float hem=smoothstep(.68,.88,aUV.y)*pow(abs(aUV.x-.5)*2.,1.3);
    p.x+=uWind*.008*hem;
    p.y+=uWind*.0014*hem*sin(aUV.x*13.+uTime*.7);
    vec2 ea=(aUV-uEyeA.xy)/uEyeA.zw, eb=(aUV-uEyeB.xy)/uEyeB.zw;
    float eye=max(exp(-dot(ea,ea)*2.),exp(-dot(eb,eb)*2.));
    p+=vec2(uLook.x*.0045,uLook.y*.003)*eye;
  }
  vec2 pixel=uRect.xy+p*uRect.zw;
  gl_Position=vec4(pixel.x/uViewport.x*2.-1.,1.-pixel.y/uViewport.y*2.,0.,1.);
}`;
const FRAGMENT = `#version 300 es
precision highp float; precision highp int;
in vec2 vUV; in float vDepth;
uniform sampler2D uTexture; uniform int uType;
uniform vec4 uColor; uniform float uLight; uniform float uTime; uniform float uRotation;
out vec4 outColor;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
void main(){
  if(uType<2){
    vec4 c=texture(uTexture,vUV);
    if(c.a<.004)discard;
    float exposure=1.+(uLight-1.)*.23;
    if(uType==0){c.rgb*=exposure;}
    else{
      // The source lighting stays intact; only a subtle shared warm illumination varies.
      c.rgb*=vec3(1.005,.984,.96)*exposure;
      c.rgb+=vec3(.012,.008,.002)*pow(max(0.,1.-vUV.x),2.);
    }
    outColor=c;
  }else if(uType==2){
    vec2 p=(vUV-.5)*2.;
    float a=exp(-dot(p,p)*3.8)*(1.-smoothstep(.70,1.,length(p)))*uColor.a;
    outColor=vec4(uColor.rgb,a);
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
    this.uniforms=Object.fromEntries(['Viewport','Rect','Type','Pose','Look','Wind','Time','Texture','Color','Light','Rotation','EyeA','EyeB'].map(k=>[k,gl.getUniformLocation(this.program,'u'+k)]));
    for(const [i,key]of['EyeA','EyeB'].entries()){const[x,y,w,h]=manifest.character.masks[i].target;gl.uniform4f(this.uniforms[key],(x+w/2)/1024,(y+h/2)/1024,w/2048,h/2048);}
    this.meshes={background:mesh(gl,64,40),character:mesh(gl,manifest.character.depth.N,manifest.character.depth.N,manifest.character.depth.z),quad:mesh(gl,1,1)};
    for(const m of Object.values(this.meshes)){gl.bindVertexArray(m.vao);gl.bindBuffer(gl.ARRAY_BUFFER,m.vb);for(const [name,size,offset]of[['aUV',2,0],['aDepth',1,8]]){const loc=gl.getAttribLocation(this.program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,12,offset);}}
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    this.dpr=Math.min(devicePixelRatio||1,2);this.stats={frames:0,drawCalls:0,textureUploads:0,webgl:'WebGL 2',renderMode:'2.5D surface deformation'};
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
    this.draw(0,[(w-bw)/2,(h-bh)/2,bw,bh],this.meshes.background,this.textures.background);
    // Distant suspended fibers, all advected by the same wind.
    for(let i=0;i<17;i++){
      const phase=(i*.61803398875)%1;const px=((phase*w+pose.wind*14+Math.sin(t*.12+i)*13)%w+w)%w;
      const py=h*(.28+((i*.379)%1)*.57)+Math.sin(t*.22+i*1.9)*8;
      const sz=2+(i%4)*1.4;this.draw(3,[px,py,sz*2,sz*2],this.meshes.quad,null,[1,.91,.63,.20+(i%3)*.08],t*.2+i);
    }
    const {x:cx,foot,size}=this.characterCenter;
    // Sun behind-left: broad cast shadow falls forward-right, contact shadow remains at the seam.
    this.draw(2,[cx-size*.16,foot-size*.035,size*.65,size*.18],this.meshes.quad,null,[.17,.13,.10,.21]);
    this.draw(2,[cx-size*.325,foot-size*.043,size*.65,size*.073],this.meshes.quad,null,[.17,.13,.10,.32+pose.compression*2]);
    this.draw(1,this.characterRect,this.meshes.character,pose.blink>.47?this.textures.closed:this.textures.body);
    // One wandering seed is also the character's shared attention target.
    if(pose.leaf.visible){
      const px=w*(.5+pose.leaf.x*.32),py=h*(.46+pose.leaf.y*.25),sz=Math.max(12,Math.min(w,h)*.025);
      this.draw(3,[px-sz/2,py-sz/2,sz,sz],this.meshes.quad,null,[1,.94,.69,.92],pose.leaf.rotation);
      this.draw(3,[px-sz,py-sz,sz*2,sz*2],this.meshes.quad,null,[1,.82,.42,.12],pose.leaf.rotation);
    }
    this.stats.frames++;this.lastPose={...pose};
  }
  dispose(){if(this.disposed)return;const gl=this.gl;for(const t of Object.values(this.textures||{}))gl.deleteTexture(t);for(const m of Object.values(this.meshes)){gl.deleteBuffer(m.vb);gl.deleteBuffer(m.ib);gl.deleteVertexArray(m.vao);}gl.deleteProgram(this.program);this.disposed=true;}
}
