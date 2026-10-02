/* Loom: reusable screen-space network renderer. No textures or external runtime.
 * RGB arrays accept 0..255 (or normalized 0..1). All geometry uses CSS pixels.
 * Layer order: analytic lines, material stitches, dots/glows/rings, glass nucleus.
 * Atlas owns projection, layout, labels, input, motion clock and accessibility.
 */
(function (root) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const LINE_VS = `
precision highp float;
attribute vec2 aPosition;
attribute vec2 aLocal;
attribute vec2 aExtent;
attribute vec4 aColor;
uniform vec2 uViewport;
varying vec2 vLocal;
varying vec2 vExtent;
varying vec4 vColor;
void main(){
  vLocal=aLocal; vExtent=aExtent; vColor=aColor;
  gl_Position=vec4(aPosition.x/uViewport.x*2.-1.,1.-aPosition.y/uViewport.y*2.,0.,1.);
}`;
  const LINE_FS = `
precision highp float;
varying vec2 vLocal;
varying vec2 vExtent;
varying vec4 vColor;
uniform float uAA;
void main(){
  // Pixel-integrated coverage retains the energy of lines narrower than one pixel.
  float vSide=abs(vLocal.y);
  float coverage=clamp((vExtent.y-vSide)/uAA+.5,0.,1.)
    -clamp((-vExtent.y-vSide)/uAA+.5,0.,1.);
  coverage*=clamp((vExtent.x-abs(vLocal.x))/uAA+.5,0.,1.);
  float a=coverage*vColor.a;
  if(a<.0005)discard;
  gl_FragColor=vec4(vColor.rgb*a,a);
}`;
  const STITCH_VS = `
precision highp float;
attribute vec2 aPosition;
attribute vec2 aLocal;
attribute vec2 aExtent;
attribute vec4 aColor;
attribute vec3 aFiber;
uniform vec2 uViewport;
varying vec2 vLocal;
varying vec2 vExtent;
varying vec4 vColor;
varying vec3 vFiber;
void main(){
  vLocal=aLocal; vExtent=aExtent; vColor=aColor; vFiber=aFiber;
  gl_Position=vec4(aPosition.x/uViewport.x*2.-1.,1.-aPosition.y/uViewport.y*2.,0.,1.);
}`;
  const STITCH_FS = `
precision highp float;
varying vec2 vLocal;
varying vec2 vExtent;
varying vec4 vColor;
varying vec3 vFiber;
uniform float uAA;
float capsule(vec2 p){return length(vec2(max(abs(p.x)-vExtent.x,0.),p.y))-vExtent.y;}
void main(){
  float radius=vExtent.y, width=radius*2.;
  vec2 tangent=vFiber.yz, normal=vec2(-tangent.y,tangent.x);
  float quality=smoothstep(1.05,3.1,width/uAA);
  // Thread-space coordinates never depend on frame time or screen pixel position.
  float along=vLocal.x+vFiber.x;
  float twist=along/max(width*2.65,2.0)*6.2831853;
  float ny=clamp(vLocal.y/max(radius,.001),-.999,.999);
  float theta=asin(ny);
  float strand=cos(theta*3.-twist);
  float fiber=sin(theta*8.5-twist*2.0)*.5+.5;
  float surface=quality*(sin(twist*2.1+theta*3.)*.028+fiber*.016)*width;
  float distance=capsule(vLocal)-surface;
  float coverage=clamp(.5-distance/uAA,0.,1.);
  // Conserve thin-thread coverage below one physical pixel.
  coverage=min(coverage,width/uAA);
  float nx=max(abs(vLocal.x)-vExtent.x,0.)*sign(vLocal.x)/max(radius,.001);
  float nz=sqrt(max(.001,1.-min(nx*nx+ny*ny,.999)));
  vec2 light=vec2(-.42,-.57);
  float lighting=clamp(nx*dot(tangent,light)+ny*dot(normal,light)+nz*.77,0.,1.);
  float shade=.43+lighting*.70;
  shade*=1.-quality*pow(.5-.5*strand,3.)*.24;
  vec3 rgb=vColor.rgb*shade;
  // Broad diffuse yarn reflection, with three gently twisted plies; no neon rim.
  rgb+=mix(vColor.rgb,vec3(1.),.48)*pow(lighting,9.)*(.085+quality*.045);
  rgb+=vColor.rgb*quality*pow(.5+.5*strand,6.)*.105;
  rgb*=1.-quality*fiber*.035;
  float fringe=exp(-max(distance,0.)/max(width*.10,.09));
  fringe*=quality*.078*(.30+.70*pow(.5+.5*sin(twist*3.7),4.));
  fringe*=1.-smoothstep(width*.12+uAA*.3,width*.35+uAA*.6,distance);
  float body=clamp(coverage+fringe*(1.-coverage),0.,1.)*vColor.a;
  vec2 shadowShift=vec2(dot(tangent,vec2(.19,.40)),dot(normal,vec2(.19,.40)))*width;
  float shadow=(1.-smoothstep(-uAA*.2,uAA*.9+width*.22,capsule(vLocal-shadowShift)));
  shadow*=vColor.a*.18*(1.-body);
  float alpha=body+shadow;
  if(alpha<.0005)discard;
  gl_FragColor=vec4(rgb*body+vec3(.008,.014,.019)*shadow,alpha);
}`;
  const PARTICLE_VS = `
precision highp float;
attribute vec2 aPosition;
attribute vec2 aLocal;
attribute vec3 aShape;
attribute vec4 aColor;
uniform vec2 uViewport;
varying vec2 vLocal;
varying vec3 vShape;
varying vec4 vColor;
void main(){
  vLocal=aLocal; vShape=aShape; vColor=aColor;
  gl_Position=vec4(aPosition.x/uViewport.x*2.-1.,1.-aPosition.y/uViewport.y*2.,0.,1.);
}`;
  const PARTICLE_FS = `
precision highp float;
varying vec2 vLocal;
varying vec3 vShape;
varying vec4 vColor;
uniform float uAA;
void main(){
  float distance=length(vLocal), radius=vShape.x, kind=vShape.y;
  float coverage;
  if(kind<.5){
    coverage=clamp((radius-distance)/uAA+.5,0.,1.);
  }else if(kind<1.5){
    float r=distance/max(radius,.001), rr=r*r;
    coverage=(exp(-rr*5.5)*.32+exp(-rr*34.)*.34+exp(-rr*220.)*.34);
    coverage*=1.-smoothstep(.72,1.,r);
  }else{
    coverage=clamp((vShape.z*.5-abs(distance-radius))/uAA+.5,0.,1.);
  }
  float a=coverage*vColor.a;
  if(a<.0004)discard;
  gl_FragColor=vec4(vColor.rgb*a,a);
}`;
  const NUCLEUS_VS = `
precision highp float;
attribute vec2 aCorner;
uniform vec2 uViewport;
uniform vec2 uCenter;
uniform float uRadius;
varying vec2 vP;
void main(){
  vP=aCorner*1.9;
  vec2 p=uCenter+vP*uRadius;
  gl_Position=vec4(p.x/uViewport.x*2.-1.,1.-p.y/uViewport.y*2.,0.,1.);
}`;
  const NUCLEUS_FS = `
precision highp float;
varying vec2 vP;
uniform float uTime;
uniform float uEnergy;
uniform float uPixel;
uniform vec3 uAccent;
uniform float uSilver;
uniform float uInnerLight;
float gauss(vec2 p,vec2 at,vec2 scale){vec2 q=(p-at)/scale;return exp(-dot(q,q)*2.);}
void main(){
  vec2 p=vP;
  float r=length(p), r2=dot(p,p), t=uTime, energy=uEnergy;
  // The 1.9R quad is mostly atmosphere. Outside the antialiased silhouette the
  // sphere has zero opacity, so preserve its exact halo without interior shading.
  if(r>=1.+uPixel){
    float outside=max(r-1.,0.);
    float halo=(exp(-outside*7.5)*.061+exp(-r2*1.65)*.020);
    halo*=smoothstep(.70,1.05,r)*(1.-smoothstep(1.47,1.88,r));
    halo*=.88+energy*.08;
    if(halo<.0004)discard;
    vec3 atmosphere=mix(vec3(.23,.43,.66),vec3(.41,.44,.48),clamp(uSilver,0.,1.));
    gl_FragColor=vec4(atmosphere*halo,halo);
    return;
  }
  float sphere=1.-smoothstep(1.-uPixel,1.+uPixel,r);
  float z=sqrt(max(0.,1.-min(r2,1.)));
  vec3 n=normalize(vec3(p.x,-p.y,max(z,.0001)));
  vec3 light=normalize(vec3(-.48,.66,.65));
  float diffuse=max(dot(n,light),0.);
  float fresnel=pow(1.-z,3.1);
  float breath=.963+.037*sin(t*.61);
  float vitality=(.77+energy*.25)*breath;
  // Finish affects the shell palette; engine pigment belongs to interior light.
  float silver=clamp(uSilver,0.,1.);
  float response=silver*smoothstep(.25,1.75,energy);
  // Higher energy expands the interior's volume; its peak radiance saturates.
  vitality=mix(vitality,(.85+.28*energy/(.65+energy))*breath,silver);
  vec3 innerBase=mix(vec3(.26,.55,.93),vec3(.75,.77,.79),silver);
  vec3 inner=mix(innerBase,clamp(uAccent*.89+vec3(.045),0.,1.),mix(.29,.62,silver));
  vec3 pale=mix(mix(vec3(.69,.84,.98),vec3(.90,.92,.94),silver),inner,.14);
  vec3 body=mix(mix(vec3(.020,.034,.068),vec3(.032,.034,.037),silver),
    mix(vec3(.075,.125,.220),vec3(.114,.121,.135),silver),diffuse*.72);
  body+=mix(vec3(.10,.18,.31),vec3(.17,.18,.20),silver)*pow(diffuse,10.)*.36;
  // A stable softbox and a second, softer reflection reveal the outer glass shell.
  float reflection=gauss(p,vec2(-.27+sin(t*.08)*.012,-.48),vec2(.45,.125));
  float reflectionSoft=gauss(p,vec2(-.31,-.43),vec2(.57,.29));
  body+=mix(vec3(.73,.84,.94),vec3(.84,.855,.88),silver)*reflection*.48;
  body+=mix(vec3(.15,.23,.34),vec3(.215,.23,.25),silver)*reflectionSoft*.40;
  float crescent=pow(max(0.,dot(normalize(vec2(-.56,-.83)),normalize(p+vec2(.0001)))),5.);
  body+=mix(vec3(.34,.52,.73),vec3(.47,.51,.56),silver)*fresnel*(.30+crescent*.85);
  body+=mix(vec3(.23,.44,.70),vec3(.395,.43,.48),silver)*fresnel*gauss(p,vec2(.62,.52),vec2(.67,.82))*.67;
  float interior=1.-smoothstep(.78,1.005,r);
  vec2 coreCenter=vec2(sin(t*.12)*.028,.065+cos(t*.09)*.020);
  float coreRadius=.255+response*.085;
  vec2 coreP=(p-coreCenter)/coreRadius;
  float coreR2=dot(coreP,coreP), coreR=sqrt(coreR2);
  float coreZ=sqrt(max(0.,1.-min(coreR2,1.)));
  float coreMask=1.-smoothstep(.58,1.08,coreR);
  // A smaller luminous body sits behind the front threads. Its shaded shoulder
  // and partial refracted rim establish a second surface inside the outer glass.
  float coreLight=exp(-coreR2*1.65)*(.54+.46*clamp(-coreP.x*.31+coreP.y*.43+coreZ*.72,0.,1.));
  float coreShoulder=exp(-pow((coreR-.84)/.095,2.))*clamp(coreP.x*.34+coreP.y*.63,0.,1.);
  body*=1.-silver*coreMask*.075;
  body+=mix(inner,pale,.12)*(coreLight*.22+coreShoulder*.083)*silver*vitality*interior;
  vec2 source=vec2(.14+sin(t*.18)*.16,.14+cos(t*.13)*.13);
  source=mix(source,coreCenter+vec2(.07,.08),silver*.70);
  float volume=gauss(p,source,vec2(.53+response*.11,.48+response*.10));
  body+=inner*volume*.125*vitality*interior;
  // A bounded accent in the existing interior only: no new wave or moving geometry.
  float innerLight=clamp(uInnerLight,0.,1.)*silver;
  body+=mix(inner,pale,.12)*(coreLight*.072+volume*.028)*innerLight*interior;
  // Two refracted layers precess at different depths. Their phase, width and
  // transmission differ, so the light visibly passes through a volume, not a disc.
  for(int layer=0;layer<2;layer++){
    float depth=float(layer);
    float angle=mix(-.66,.91,depth)+sin(t*(.085-depth*.018)+depth*1.7)*(.14+depth*.035);
    mat2 rot=mat2(cos(angle),-sin(angle),sin(angle),cos(angle));
    vec2 q=rot*(p*(1.+z*(.25-depth*.12)));
    q+=rot*(p-coreCenter)*silver*coreMask*(.17-depth*.08);
    q.x+=sin(t*.11+depth*2.1)*.055*z;
    float bend=sin(q.x*(3.55+depth*.42)+t*(.28-depth*.10)+depth*1.3)*(.14-depth*.035);
    bend+=sin(q.x*6.4-t*.17+depth)*.031;
    float axis=.055+depth*.16+sin(t*.12+depth*2.)*.046;
    float line=q.y-bend-axis;
    float focusX=.19+sin(t*.19+depth*1.8)*.35;
    float focus=.42+.58*exp(-pow((q.x-focusX)/.49,2.));
    float envelope=interior*focus*(1.-smoothstep(.73,1.17,abs(q.x)));
    float transmission=mix(1.,.40,depth)*vitality;
    transmission*=1.-silver*depth*(.08+coreMask*.50);
    float veil=exp(-pow(line/(.103+depth*.034),2.));
    body+=inner*veil*envelope*transmission*.22;
    float filaments=0.;
    float layerTime=t*(1.+silver*(.10-depth*.31));
    for(int i=0;i<5;i++){
      float fi=float(i)-2.;
      float offset=fi*(.028+depth*.012)+sin(q.x*4.5+fi*.68+layerTime*.20+depth)*.012;
      float distance=abs(line-offset);
      float width=max(uPixel*(.63+depth*.20),.0045+depth*.002);
      width*=1.+silver*(coreZ*.13*(1.-depth)-depth*.05);
      float thread=exp(-pow(distance/width,2.));
      float diffusion=exp(-pow(distance/(width*3.5+.008),2.));
      float weight=(.30-.035*abs(fi))*(1.+sin(q.x*2.9-layerTime*.30+fi*.58)*.12);
      float clarity=1.+(1.-depth)*(.40+.18*(1.-min(abs(fi),1.)));
      filaments+=(thread*clarity+diffusion*.17)*weight;
    }
    body+=mix(inner,pale,.32-depth*.12)*filaments*envelope*transmission;
  }
  // A bent lower caustic is the transmitted image of those internal light layers.
  float causticRadius=.70+sin(t*.14)*.018+response*.03;
  float caustic=exp(-pow((length((p-vec2(-.035,-.025))*vec2(1.,1.13))-causticRadius)/.018,2.));
  float lower=smoothstep(-.12,.53,p.y)*smoothstep(-.68,.25,p.x);
  body+=inner*caustic*lower*interior*.31*vitality;
  float refracted=gauss(p,vec2(.35+sin(t*.12)*.035,.48),vec2(.28,.18));
  body+=pale*refracted*.076*vitality;
  float rim=exp(-pow((r-.984)/max(uPixel*1.3,.009),2.));
  body+=mix(vec3(.41,.60,.79),vec3(.56,.60,.65),silver)*rim*(.21+crescent*.49);
  // Atmosphere is radial and fully transparent at the quad boundary.
  float outside=max(r-1.,0.);
  float halo=(exp(-outside*7.5)*.061+exp(-r2*1.65)*.020);
  halo*=smoothstep(.70,1.05,r)*(1.-smoothstep(1.47,1.88,r));
  halo*=.88+energy*.08;
  float opacity=sphere*.988;
  vec3 rgb=body*opacity+mix(vec3(.23,.43,.66),vec3(.41,.44,.48),silver)*halo*(1.-opacity);
  float alpha=opacity+halo*(1.-opacity);
  if(alpha<.0004)discard;
  gl_FragColor=vec4(rgb,alpha);
}`;

  function shader(gl, type, source, modern) {
    let text = source;
    if (modern) {
      text = '#version 300 es\n' + text.replace(/attribute /g, 'in ').replace(/varying /g, type === gl.VERTEX_SHADER ? 'out ' : 'in ');
      if (type === gl.FRAGMENT_SHADER) text = text.replace('precision highp float;', 'precision highp float;\nout vec4 fragColor;').replace(/gl_FragColor/g, 'fragColor');
    }
    const value = gl.createShader(type);
    gl.shaderSource(value, text); gl.compileShader(value);
    if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(value); gl.deleteShader(value); throw new Error('Loom shader: ' + error);
    }
    return value;
  }
  function program(gl, vs, fs, modern) {
    const value = gl.createProgram(); let vertex, fragment;
    try {
      vertex = shader(gl, gl.VERTEX_SHADER, vs, modern); fragment = shader(gl, gl.FRAGMENT_SHADER, fs, modern);
      gl.attachShader(value, vertex); gl.attachShader(value, fragment); gl.linkProgram(value);
      if (!gl.getProgramParameter(value, gl.LINK_STATUS)) throw new Error('Loom program: ' + gl.getProgramInfoLog(value));
    } catch (error) { gl.deleteProgram(value); throw error; }
    finally { if (vertex) gl.deleteShader(vertex); if (fragment) gl.deleteShader(fragment); }
    return value;
  }
  function batch(size, stride) { return { data: new Float32Array(size), used: 0, stride, buffer: null, bytes: 0, count: 0 }; }
  function reserve(value, extra) {
    if (value.used + extra <= value.data.length) return;
    let capacity = value.data.length;
    while (capacity < value.used + extra) capacity *= 2;
    const next = new Float32Array(capacity); next.set(value.data); value.data = next;
  }

  class LoomNetworkRenderer {
    constructor(canvas, options) {
      this.canvas = canvas; this.options = options || {};
      this.supported = false; this.lost = false; this.destroyed = false;
      this.width = 1; this.height = 1; this.dpr = 1; this.time = 0;
      this.lines = batch(131072, 10); this.particles = batch(32768, 11);
      this.stitches = batch(262144, 13);
      this.arcX = new Float64Array(97); this.arcY = new Float64Array(97); this.arcLength = new Float64Array(97);
      this.arcPoint = new Float64Array(4);
      this.orb = { visible: false, x: 0, y: 0, radius: 0, time: 0, energy: 1, red: .26, green: .55, blue: .93, silver: 0, innerLight: 0 };
      const attributes = { alpha: true, antialias: false, premultipliedAlpha: true, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' };
      this.gl = canvas.getContext('webgl2', attributes); this.modern = Boolean(this.gl);
      if (!this.gl) this.gl = canvas.getContext('webgl', attributes);
      if (!this.gl) throw new Error('Loom network: WebGL is unavailable.');
      const precision = this.gl.getShaderPrecisionFormat(this.gl.FRAGMENT_SHADER, this.gl.HIGH_FLOAT);
      if (!precision || precision.precision === 0) throw new Error('Loom network requires highp fragment precision.');
      this.stats = { drawCalls: 0, vertices: 0, points: 0, segments: 0, stitches: 0, frames: 0, renderer: this.modern ? 'WebGL 2 / Loom analytic AA' : 'WebGL 1 / Loom analytic AA' };
      this.onLost = event => {
        event.preventDefault(); this.lost = true; this.supported = false;
        if (this.options.onContextLost) this.options.onContextLost(event);
      };
      this.onRestored = () => {
        if (this.destroyed) return;
        try {
          this.initialize(); this.lost = false; this.supported = true;
          this.resize(this.width, this.height, this.dpr);
          if (this.options.onContextRestored) this.options.onContextRestored();
        } catch (error) {
          this.lost = true; this.supported = false;
          if (this.options.onContextLost) this.options.onContextLost(error);
        }
      };
      try { this.initialize(); this.supported = true; }
      catch (error) { this.disposeResources(); throw error; }
      canvas.addEventListener('webglcontextlost', this.onLost, false);
      canvas.addEventListener('webglcontextrestored', this.onRestored, false);
    }

    initialize() {
      const gl = this.gl;
      this.lineProgram = program(gl, LINE_VS, LINE_FS, this.modern);
      this.stitchProgram = program(gl, STITCH_VS, STITCH_FS, this.modern);
      this.particleProgram = program(gl, PARTICLE_VS, PARTICLE_FS, this.modern);
      this.nucleusProgram = program(gl, NUCLEUS_VS, NUCLEUS_FS, this.modern);
      this.lineUniforms = this.uniforms(this.lineProgram, ['Viewport', 'AA']);
      this.stitchUniforms = this.uniforms(this.stitchProgram, ['Viewport', 'AA']);
      this.particleUniforms = this.uniforms(this.particleProgram, ['Viewport', 'AA']);
      this.nucleusUniforms = this.uniforms(this.nucleusProgram, ['Viewport', 'Center', 'Radius', 'Time', 'Energy', 'Pixel', 'Accent', 'Silver', 'InnerLight']);
      this.lineLayout = this.layout(this.lineProgram, [['aPosition', 2, 0], ['aLocal', 2, 8], ['aExtent', 2, 16], ['aColor', 4, 24]]);
      this.stitchLayout = this.layout(this.stitchProgram, [['aPosition', 2, 0], ['aLocal', 2, 8], ['aExtent', 2, 16], ['aColor', 4, 24], ['aFiber', 3, 40]]);
      this.particleLayout = this.layout(this.particleProgram, [['aPosition', 2, 0], ['aLocal', 2, 8], ['aShape', 3, 16], ['aColor', 4, 28]]);
      this.cornerLocation = gl.getAttribLocation(this.nucleusProgram, 'aCorner');
      this.lines.buffer = gl.createBuffer(); this.lines.bytes = 0;
      this.stitches.buffer = gl.createBuffer(); this.stitches.bytes = 0;
      this.particles.buffer = gl.createBuffer(); this.particles.bytes = 0;
      this.quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.clearColor(0, 0, 0, 0);
    }

    uniforms(value, names) {
      const output = {};
      for (const name of names) output[name] = this.gl.getUniformLocation(value, 'u' + name);
      return output;
    }
    layout(value, entries) { return entries.map(entry => [this.gl.getAttribLocation(value, entry[0]), entry[1], entry[2]]); }

    resize(width, height, dpr) {
      this.width = Math.max(1, Number(width) || 1); this.height = Math.max(1, Number(height) || 1);
      this.dpr = clamp(Number(dpr) || 1, .5, 2);
      const w = Math.round(this.width * this.dpr), h = Math.round(this.height * this.dpr);
      if (this.canvas.width !== w) this.canvas.width = w;
      if (this.canvas.height !== h) this.canvas.height = h;
      if (!this.lost && !this.destroyed) this.gl.viewport(0, 0, w, h);
    }

    begin(timeSeconds) {
      this.time = Number(timeSeconds) || 0; this.lines.used = this.particles.used = this.stitches.used = 0;
      this.lines.count = this.particles.count = this.stitches.count = 0; this.orb.visible = false;
      this.stats.drawCalls = this.stats.vertices = this.stats.points = this.stats.segments = this.stats.stitches = 0;
    }

    line(ax, ay, bx, by, rgb, alpha, width) {
      if (!(alpha > 0) || !(width > 0)) return;
      const dx = bx - ax, dy = by - ay, length = Math.sqrt(dx * dx + dy * dy);
      if (length < .001 || !Number.isFinite(length)) return;
      const nx = -dy / length, ny = dx / length, tx = dx / length, ty = dy / length;
      const pad = .6 / this.dpr, half = width * .5, side = half + pad;
      const cx = (ax + bx) * .5, cy = (ay + by) * .5, along = length * .5 + pad;
      const scale = Math.max(rgb[0], rgb[1], rgb[2]) > 1 ? 1 / 255 : 1;
      const r = rgb[0] * scale, g = rgb[1] * scale, b = rgb[2] * scale, a = clamp(alpha, 0, 1);
      const batch = this.lines; reserve(batch, 60); let at = batch.used; const data = batch.data;
      for (let i = 0; i < 6; i++) {
        const sx = i === 0 || i === 2 || i === 3 ? -1 : 1;
        const sy = i === 0 || i === 1 || i === 4 ? -1 : 1;
        const x = along * sx, y = side * sy;
        data[at++] = cx + tx * x + nx * y; data[at++] = cy + ty * x + ny * y;
        data[at++] = x; data[at++] = y; data[at++] = length * .5; data[at++] = half;
        data[at++] = r; data[at++] = g; data[at++] = b; data[at++] = a;
      }
      batch.used = at; batch.count++;
    }

    curve(curve, rgb, alpha, width) {
      if (!(alpha > 0) || !(width > 0)) return;
      const a = curve.a, b = curve.b, c = curve.c;
      const length = Math.hypot(c.x - a.x, c.y - a.y) + Math.hypot(b.x - c.x, b.y - c.y);
      const count = length > 290 ? 24 : length > 145 ? 20 : 16;
      let x = a.x, y = a.y;
      for (let i = 1; i <= count; i++) {
        const t = i / count, k = 1 - t;
        const nextX = k * k * a.x + 2 * k * t * c.x + t * t * b.x;
        const nextY = k * k * a.y + 2 * k * t * c.y + t * t * b.y;
        this.line(x, y, nextX, nextY, rgb, alpha, width); x = nextX; y = nextY;
      }
    }

    // One raised yarn capsule. The endpoints describe its outer tips, not cap centers.
    emitStitch(ax, ay, bx, by, rgb, alpha, width, phase) {
      const dx = bx - ax, dy = by - ay, length = Math.hypot(dx, dy);
      if (!(length > .035)) return;
      const scale = Math.max(rgb[0], rgb[1], rgb[2]) > 1 ? 1 / 255 : 1;
      this.yarnCapsule((ax + bx) * .5, (ay + by) * .5, dx / length, dy / length, length,
        rgb[0] * scale, rgb[1] * scale, rgb[2] * scale, clamp(alpha, 0, 1), width, phase);
    }

    yarnCapsule(cx, cy, tx, ty, length, r, g, b, a, width, phase) {
      const nx = -ty, ny = tx;
      const radius = Math.min(width, length) * .5, straight = Math.max(0, length * .5 - radius);
      const pad = width * .48 + .9 / this.dpr, side = radius + pad, along = length * .5 + pad;
      const value = this.stitches; reserve(value, 78); let at = value.used; const data = value.data;
      for (let i = 0; i < 6; i++) {
        const sx = i === 0 || i === 2 || i === 3 ? -1 : 1;
        const sy = i === 0 || i === 1 || i === 4 ? -1 : 1;
        const x = along * sx, y = side * sy;
        data[at++] = cx + tx * x + nx * y; data[at++] = cy + ty * x + ny * y;
        data[at++] = x; data[at++] = y; data[at++] = straight; data[at++] = radius;
        data[at++] = r; data[at++] = g; data[at++] = b; data[at++] = a;
        data[at++] = phase; data[at++] = tx; data[at++] = ty;
      }
      value.used = at; value.count++;
    }

    /** Physical yarn stitches. Options use CSS px: length, gap, phase.
     * Defaults: length=max(3.8,width*3.1), gap=max(1.7,width*.92), phase=0.
     * Recommended width .65..3; accepted .25..12. Tips stay within the path.
     * Adjacent path calls can continue the pattern with phase=prior path length.
     */
    stitch(ax, ay, bx, by, rgb, alpha, width, options) {
      if (!(alpha > 0) || !(width > 0) || !Number.isFinite(ax + ay + bx + by + width)) return;
      const dx = bx - ax, dy = by - ay, total = Math.hypot(dx, dy);
      if (total < .05) return;
      width = clamp(width, .25, 12);
      const threadLength = options && Number.isFinite(options.length) ? clamp(options.length, width, 64) : Math.max(3.8, width * 3.1);
      const gap = options && Number.isFinite(options.gap) ? clamp(options.gap, .25, 200) : Math.max(1.7, width * .92);
      const phase = options && Number.isFinite(options.phase) ? options.phase : 0;
      const period = threadLength + gap, offset = ((phase % period) + period) % period;
      const ux = dx / total, uy = dy / total;
      const scale = Math.max(rgb[0], rgb[1], rgb[2]) > 1 ? 1 / 255 : 1;
      const r = rgb[0] * scale, g = rgb[1] * scale, b = rgb[2] * scale, opacity = clamp(alpha, 0, 1);
      for (let start = -offset; start < total; start += period) {
        const from = Math.max(0, start), to = Math.min(total, start + threadLength);
        if (to - from < .05) continue;
        const middle = (from + to) * .5;
        this.yarnCapsule(ax + ux * middle, ay + uy * middle, ux, uy, to - from, r, g, b, opacity, width, middle + phase);
      }
    }

    arcAt(distance, count, outputOffset, curve) {
      let lo = 0, hi = count;
      const lengths = this.arcLength;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (lengths[mid] < distance) lo = mid; else hi = mid; }
      const fraction = clamp((distance - lengths[lo]) / Math.max(.00001, lengths[hi] - lengths[lo]), 0, 1);
      const t = (lo + fraction) / count, k = 1 - t;
      this.arcPoint[outputOffset] = k * k * curve.a.x + 2 * k * t * curve.c.x + t * t * curve.b.x;
      this.arcPoint[outputOffset + 1] = k * k * curve.a.y + 2 * k * t * curve.c.y + t * t * curve.b.y;
    }

    /** The complete quadratic curve is measured first. Spacing never resets at
     * tessellation boundaries; all capsules share one continuous thread coordinate.
     */
    stitchCurve(curve, rgb, alpha, width, options) {
      if (!(alpha > 0) || !(width > 0) || !Number.isFinite(width)) return;
      const a = curve.a, b = curve.b, c = curve.c;
      if (!Number.isFinite(a.x + a.y + b.x + b.y + c.x + c.y)) return;
      const bound = Math.hypot(c.x - a.x, c.y - a.y) + Math.hypot(b.x - c.x, b.y - c.y);
      if (bound < .05) return;
      const count = clamp(Math.ceil(bound / 7), 32, 96);
      let x = a.x, y = a.y, total = 0;
      this.arcX[0] = x; this.arcY[0] = y; this.arcLength[0] = 0;
      for (let i = 1; i <= count; i++) {
        const t = i / count, k = 1 - t;
        const px = k * k * a.x + 2 * k * t * c.x + t * t * b.x;
        const py = k * k * a.y + 2 * k * t * c.y + t * t * b.y;
        total += Math.hypot(px - x, py - y);
        this.arcX[i] = px; this.arcY[i] = py; this.arcLength[i] = total; x = px; y = py;
      }
      width = clamp(width, .25, 12);
      const threadLength = options && Number.isFinite(options.length) ? clamp(options.length, width, 64) : Math.max(3.8, width * 3.1);
      const gap = options && Number.isFinite(options.gap) ? clamp(options.gap, .25, 200) : Math.max(1.7, width * .92);
      const phase = options && Number.isFinite(options.phase) ? options.phase : 0;
      const period = threadLength + gap, offset = ((phase % period) + period) % period;
      for (let start = -offset; start < total; start += period) {
        const from = Math.max(0, start), to = Math.min(total, start + threadLength);
        if (to - from < .05) continue;
        this.arcAt(from, count, 0, curve); this.arcAt(to, count, 2, curve);
        this.emitStitch(this.arcPoint[0], this.arcPoint[1], this.arcPoint[2], this.arcPoint[3], rgb, alpha, width, (from + to) * .5 + phase);
      }
    }

    particle(x, y, radius, rgb, alpha, kind, width) {
      if (!(alpha > 0) || !(radius > 0) || !Number.isFinite(x + y + radius)) return;
      const extent = radius + (kind === 1 ? 0 : (kind === 2 ? width * .5 : 0) + 1 / this.dpr);
      const scale = Math.max(rgb[0], rgb[1], rgb[2]) > 1 ? 1 / 255 : 1;
      const r = rgb[0] * scale, g = rgb[1] * scale, b = rgb[2] * scale, a = clamp(alpha, 0, 1);
      const batch = this.particles; reserve(batch, 66); let at = batch.used; const data = batch.data;
      for (let i = 0; i < 6; i++) {
        const sx = i === 0 || i === 2 || i === 3 ? -1 : 1;
        const sy = i === 0 || i === 1 || i === 4 ? -1 : 1;
        const lx = extent * sx, ly = extent * sy;
        data[at++] = x + lx; data[at++] = y + ly; data[at++] = lx; data[at++] = ly;
        data[at++] = radius; data[at++] = kind; data[at++] = width;
        data[at++] = r; data[at++] = g; data[at++] = b; data[at++] = a;
      }
      batch.used = at; batch.count++;
    }

    dot(x, y, radius, rgb, alpha) { this.particle(x, y, radius, rgb, alpha, 0, 0); }
    glow(x, y, size, rgb, alpha) { this.particle(x, y, size * .5, rgb, alpha, 1, 0); }
    ring(x, y, radius, rgb, alpha, width) { this.particle(x, y, radius, rgb, alpha, 2, Math.max(.1, width || .6)); }

    // Accent accepts RGB bytes or normalized RGB and only pigments inner light.
    // Finish: omitted/0 = legacy lapis; 'silver'/1 = neutral silver glass;
    // numbers between 0 and 1 blend those finishes without changing geometry.
    // Optional innerLight (0..1, default 0) adds a restrained silver-only inner glow.
    nucleus(x, y, radius, time, energy, rgb, finish, innerLight) {
      const orb = this.orb; orb.visible = radius > 0;
      orb.x = x; orb.y = y; orb.radius = radius;
      orb.time = Number.isFinite(time) ? time : this.time;
      orb.energy = Number.isFinite(energy) ? clamp(energy, 0, 2) : 1;
      orb.silver = finish === 'silver' ? 1 : Number.isFinite(finish) ? clamp(finish, 0, 1) : 0;
      orb.innerLight = Number.isFinite(innerLight) ? clamp(innerLight, 0, 1) : 0;
      if (rgb && Number.isFinite(rgb[0]) && Number.isFinite(rgb[1]) && Number.isFinite(rgb[2])) {
        const scale = Math.max(rgb[0], rgb[1], rgb[2]) > 1 ? 1 / 255 : 1;
        orb.red = clamp(rgb[0] * scale, 0, 1); orb.green = clamp(rgb[1] * scale, 0, 1); orb.blue = clamp(rgb[2] * scale, 0, 1);
      } else {
        orb.red = .26 + (216 / 255 - .26) * orb.silver;
        orb.green = .55 + (223 / 255 - .55) * orb.silver;
        orb.blue = .93 + (230 / 255 - .93) * orb.silver;
      }
    }

    upload(batch, layout) {
      const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, batch.buffer);
      if (batch.bytes !== batch.data.byteLength) {
        gl.bufferData(gl.ARRAY_BUFFER, batch.data.byteLength, gl.DYNAMIC_DRAW); batch.bytes = batch.data.byteLength;
      }
      // WebGL 2 uploads only live data, without allocating a per-frame subarray view.
      if (this.modern) gl.bufferSubData(gl.ARRAY_BUFFER, 0, batch.data, 0, batch.used);
      else gl.bufferSubData(gl.ARRAY_BUFFER, 0, batch.data);
      for (const entry of layout) {
        gl.enableVertexAttribArray(entry[0]); gl.vertexAttribPointer(entry[0], entry[1], gl.FLOAT, false, batch.stride * 4, entry[2]);
      }
      const count = batch.used / batch.stride;
      gl.drawArrays(gl.TRIANGLES, 0, count); this.stats.drawCalls++; this.stats.vertices += count;
      for (const entry of layout) gl.disableVertexAttribArray(entry[0]);
    }

    end() {
      if (this.destroyed || this.lost || !this.supported) return this.stats;
      const gl = this.gl;
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (this.lines.used) {
        gl.useProgram(this.lineProgram);
        gl.uniform2f(this.lineUniforms.Viewport, this.width, this.height); gl.uniform1f(this.lineUniforms.AA, 1 / this.dpr);
        this.upload(this.lines, this.lineLayout);
      }
      if (this.stitches.used) {
        gl.useProgram(this.stitchProgram);
        gl.uniform2f(this.stitchUniforms.Viewport, this.width, this.height); gl.uniform1f(this.stitchUniforms.AA, 1 / this.dpr);
        this.upload(this.stitches, this.stitchLayout);
      }
      if (this.particles.used) {
        gl.useProgram(this.particleProgram);
        gl.uniform2f(this.particleUniforms.Viewport, this.width, this.height); gl.uniform1f(this.particleUniforms.AA, 1 / this.dpr);
        this.upload(this.particles, this.particleLayout);
      }
      if (this.orb.visible) {
        const orb = this.orb, u = this.nucleusUniforms;
        gl.useProgram(this.nucleusProgram); gl.uniform2f(u.Viewport, this.width, this.height);
        gl.uniform2f(u.Center, orb.x, orb.y); gl.uniform1f(u.Radius, orb.radius);
        gl.uniform1f(u.Time, orb.time); gl.uniform1f(u.Energy, orb.energy); gl.uniform1f(u.Pixel, 1 / (orb.radius * this.dpr));
        gl.uniform3f(u.Accent, orb.red, orb.green, orb.blue);
        gl.uniform1f(u.Silver, orb.silver);
        gl.uniform1f(u.InnerLight, orb.innerLight);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.enableVertexAttribArray(this.cornerLocation);
        gl.vertexAttribPointer(this.cornerLocation, 2, gl.FLOAT, false, 8, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6); gl.disableVertexAttribArray(this.cornerLocation);
        this.stats.drawCalls++; this.stats.vertices += 6;
      }
      this.stats.points = this.particles.count; this.stats.segments = this.lines.count; this.stats.stitches = this.stitches.count; this.stats.frames++;
      return this.stats;
    }

    disposeResources() {
      const gl = this.gl;
      if (this.lineProgram) gl.deleteProgram(this.lineProgram);
      if (this.stitchProgram) gl.deleteProgram(this.stitchProgram);
      if (this.particleProgram) gl.deleteProgram(this.particleProgram);
      if (this.nucleusProgram) gl.deleteProgram(this.nucleusProgram);
      if (this.lines.buffer) gl.deleteBuffer(this.lines.buffer);
      if (this.stitches.buffer) gl.deleteBuffer(this.stitches.buffer);
      if (this.particles.buffer) gl.deleteBuffer(this.particles.buffer);
      if (this.quad) gl.deleteBuffer(this.quad);
    }

    destroy() {
      if (this.destroyed) return;
      this.destroyed = true; this.supported = false;
      this.canvas.removeEventListener('webglcontextlost', this.onLost, false);
      this.canvas.removeEventListener('webglcontextrestored', this.onRestored, false);
      if (!this.lost) this.disposeResources();
    }
  }
  root.LoomNetworkRenderer = LoomNetworkRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
