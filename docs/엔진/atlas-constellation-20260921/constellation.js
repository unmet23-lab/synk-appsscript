/* Atlas / Living Constellation — Loom GPU rendering and continuous scene motion. */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const SILVER = [211,218,225], SILVER_LIGHT = [238,242,246];
  const ease = value => { const t=clamp(value,0,1);return t*t*(3-2*t); };
  const tint = (base,accent,amount) => base.map((v,i)=>mix(v,accent[i],amount));
  const REVEAL_SEGMENTS = 24;
  const motion = window.LoomMotion;
  function random(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function rgba(c, a) { return `rgba(${c[0]},${c[1]},${c[2]},${clamp(a, 0, 1)})`; }
  function color(value) {
    const hex = String(value || '#a9cce7').replace('#', '');
    const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
    if (!/^[0-9a-f]{6}$/i.test(full)) return [174, 199, 222];
    const raw = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
    return raw;
  }
  function makeSprite(size, stops) {
    const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d'); const r = size / 2;
    const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
    stops.forEach(s => gradient.addColorStop(s[0], s[1]));
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, size, size);
    return canvas;
  }
  const FONT = '"Inter Tight", "Inter", "SUIT Variable", sans-serif';
  const KR_FONT = '"SUIT Variable", "SUIT", sans-serif';

  class AtlasConstellation {
    constructor(canvas, options) {
      if (!canvas || !canvas.getContext) throw new Error('AtlasConstellation requires a canvas.');
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: true });
      this.options = options || {};
      this.engines = (this.options.engines || []).slice(0, 8);
      this.relations = (this.options.relations || []).filter(r => this.engines.some(e => e.id === r.from) && this.engines.some(e => e.id === r.to));
      this.nodes = []; this.edges = []; this.groups = []; this.paths = [];
      this.selected = null; this.hovered = null; this.scenario = null;
      this.destroyed = false; this.visible = true; this.raf = 0; this.time = 0;
      this.lastFrame = 0; this.frameMS = 16.67; this.frames = 0;
      this.clock = motion.createClock(); this.dt = 0;
      this.samples = new Float32Array(720); this.sampleCount = 0; this.sampleCursor = 0;
      this.renderCosts = new Float32Array(720); this.renderCost = 0;
      this.width = 1; this.height = 1; this.zoom = 1; this.targetZoom = 1;
      this.yaw = -0.045; this.pitch = -0.035;
      this.targetYaw = this.yaw; this.targetPitch = this.pitch;
      this.velocityX = 0; this.velocityY = 0;
      this.pointer = null; this.labelBoxes = []; this.projectedHubs = [];
      this.featureBoxes=[];this.hoveredFeature=null;this.featureAdjacency=new Map();
      this.featurePointer=null;this.featureContact=null;
      this.labelState = new Map(); this.labelSprites = new Map(); this.hoverCandidate = null; this.hoverSince = 0;
      this.threadSprites = new Map();
      this.orbTint = SILVER.slice(); this.orbEnergy = .25;
      this.coreLight={id:null,since:0,start:null,issued:false,amount:0,count:0};this.innerLight=0;
      this.adjacency = new Map(); this.frameProjection = null;
      this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.paused = this.motionQuery.matches;
      this.introComplete=this.paused;this.introProgress=this.paused?1:0;
      this.depthField=new window.AtlasDepthField();
      this.depthState={project:this.project.bind(this),width:1,height:1,time:0,intro:0,mobile:false};
      this.glow = makeSprite(96, [[0, 'rgba(244,247,250,0.95)'], [.08, 'rgba(228,234,240,.56)'], [.24, 'rgba(199,210,221,.12)'], [.55, 'rgba(174,188,202,.028)'], [1, 'rgba(174,188,202,0)']]);
      this.build();
      this.initGPU();
      this.bind();
      this.resize();
      this.requestDraw();
    }

    initGPU() {
      this.gpuCanvas = document.createElement('canvas');
      this.gpuCanvas.className = 'loom-network-surface';
      this.gpuCanvas.setAttribute('aria-hidden', 'true');
      Object.assign(this.gpuCanvas.style, {position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none'});
      this.canvas.before(this.gpuCanvas);
      Object.assign(this.canvas.style, {position:'relative',zIndex:'1'});
      this.gpu = null; this.gpuAvailable = false;
      try {
        this.gpu = new window.LoomNetworkRenderer(this.gpuCanvas, {
          onContextLost: () => { this.gpuAvailable = false; this.requestDraw(); },
          onContextRestored: () => { this.gpuAvailable = true; this.resize(); }
        });
        this.gpuAvailable = true;
      } catch (error) { this.gpuCanvas.remove(); }
    }

    build() {
      const rnd = random(862104);
      // The constellations occupy an asymmetric volume rather than a circular menu.
      const anchors = [
        [-.52, -.55, .30], [.10, -.69, -.31], [.72, -.41, .26], [.68, .18, -.30],
        [.38, .64, .31], [-.25, .56, -.24], [-.71, .30, .24], [-.65, -.17, -.32]
      ];
      this.engines.forEach((engine, index) => {
        const original = anchors[index];
        const anchor = [original[0] - original[1] * .23, original[1] - original[0] * .08, original[2]];
        const group = { id: engine.id, engine, index, color: color(engine.color), highlight:color(engine.threadHighlight||engine.color), shadow:color(engine.threadShadow||engine.color), x: anchor[0], y: anchor[1], z: anchor[2], nodes: [], focus: 1, detail:0, hub: null };
        group.light=group.color.map((v,i)=>mix(v,group.highlight[i],.28));
        group.engaged=false;group.revealAge=0;group.reveal=new Float32Array(REVEAL_SEGMENTS);
        this.groups.push(group);
        const count = 35 + index % 4;
        for (let j = 0; j < count; j++) {
          const isHub = j === 0;
          const angle = j * 2.399963 + index * .58;
          const radius = isHub ? 0 : .04 + Math.sqrt(j / count) * (.23 + rnd() * .16);
          const bridge = j >= 29;
          const inward = bridge ? .26 + (j - 29) / (count - 29) * .52 : 0;
          const node = {
            index: this.nodes.length, group: index, localIndex: j,
            x: anchor[0] * (1 - inward) + Math.cos(angle) * radius * (bridge ? .23 : index % 2 ? 1.02 : .86),
            y: anchor[1] * (1 - inward) + Math.sin(angle) * radius * (bridge ? .18 : .78),
            z: anchor[2] * (1 - inward * .65) + (rnd() - .5) * .43,
            phase: rnd() * TAU, speed: .18 + rnd() * .19,
            size: isHub ? 2.8 : j <= 6 ? 1.45 : .65 + rnd() * .70,
            concept: j > 0 && j <= 6 ? (engine.concepts || [])[j - 1] : null,
            isHub, bridge, p: null, baseP:null, chroma:0,inspect:0,
            tissue:{x:{value:0,velocity:0},y:{value:0,velocity:0},weight:0,depth:0},links:[]
          };
          if (isHub) { node.z = anchor[2]; group.hub = node; }
          this.nodes.push(node); group.nodes.push(node);
        }
        group.nodes.forEach(node=>{node.colorDelay=Math.min(.30,Math.hypot(node.x-group.hub.x,node.y-group.hub.y,node.z-group.hub.z)*.70);});
        const pairs = new Set();
        const addEdge = (a, b, kind) => {
          if (a === b) return;
          const key = [Math.min(a.index, b.index), Math.max(a.index, b.index)].join(':');
          if (pairs.has(key)) return;
          pairs.add(key); this.edges.push({ a, b, group: index, kind, opacity: .77 + rnd() * .23,inspect:0 });
        };
        group.nodes.slice(1).forEach((node, j) => {
          if (j < 6) addEdge(group.hub, node, 'concept');
          const nearest = group.nodes.filter(n => n !== node && !n.isHub).sort((a, b) => {
            const da = (node.x - a.x) ** 2 + (node.y - a.y) ** 2 + (node.z - a.z) ** 2 * .5;
            const db = (node.x - b.x) ** 2 + (node.y - b.y) ** 2 + (node.z - b.z) ** 2 * .5;
            return da - db;
          });
          nearest.slice(0, j % 3 === 0 ? 3 : 2).forEach(n => addEdge(node, n, 'local'));
          if (j % 4 === 0) addEdge(node, group.nodes[1 + j % 6], 'concept');
        });
      });
      this.nodes.filter(n=>n.concept).forEach(node=>this.featureAdjacency.set(node.index,new Set()));
      this.edges.forEach(edge=>{
        edge.a.links.push(edge.b);edge.b.links.push(edge.a);
        this.featureAdjacency.get(edge.a.index)?.add(edge.b.index);
        this.featureAdjacency.get(edge.b.index)?.add(edge.a.index);
      });
      this.relations.forEach((relation, i) => {
        const a = this.groups.find(g => g.id === relation.from);
        const b = this.groups.find(g => g.id === relation.to);
        this.paths.push({ a, b, relation, phase: rnd(), lift: (i % 2 ? -1 : 1) * (.10 + rnd() * .16), offset: rnd() * TAU, emphasis: 0,
          origin:null,revealAge:0,reveal:new Float32Array(REVEAL_SEGMENTS),colors:Array.from({length:REVEAL_SEGMENTS},()=>SILVER.slice()) });
      });
      this.groups.forEach(g => this.adjacency.set(g.id, new Set([g.id])));
      this.relations.forEach(r => { this.adjacency.get(r.from).add(r.to); this.adjacency.get(r.to).add(r.from); });
      this.dust = Array.from({ length: 38 }, () => ({ x: (rnd() - .5) * 2.5, y: (rnd() - .5) * 2.1, z: (rnd() - .5) * 1.3, alpha: .09 + rnd() * .24, size: .3 + rnd() * .4, phase: rnd() * TAU }));
    }

    bind() {
      this.listeners = [];
      const on = (target, type, fn, options) => {
        target.addEventListener(type, fn, options); this.listeners.push(() => target.removeEventListener(type, fn, options));
      };
      this.canvas.style.touchAction = 'pan-y';
      on(this.canvas, 'pointerdown', event => {
        if (event.button !== 0 && event.pointerType !== 'touch') return;
        this.finishIntro();
        this.velocityX = this.velocityY = 0;
        this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, lastTime: event.timeStamp, dragged: false, touch: event.pointerType === 'touch', vertical: false };
      });
      on(this.canvas, 'pointermove', event => {
        if (this.pointer && this.pointer.id === event.pointerId) {
          const p = this.pointer; const dx = event.clientX - p.x; const dy = event.clientY - p.y;
          if (p.touch && !p.dragged && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) p.vertical = true;
          if (!p.vertical && !p.dragged && Math.hypot(dx, dy) > 7 && (!p.touch || Math.abs(dx) > Math.abs(dy))) {
            p.dragged = true;this.setFeatureHover(null);this.setHover(null); this.hoverCandidate = null; this.canvas.setPointerCapture(event.pointerId); this.canvas.style.cursor = 'grabbing';
          }
          if (p.dragged) {
            if (event.cancelable) event.preventDefault();
            const deltaX = event.clientX - p.lastX; const deltaY = event.clientY - p.lastY;
            this.targetYaw = clamp(this.targetYaw + deltaX * .003, -.43, .43);
            this.targetPitch = clamp(this.targetPitch - deltaY * .0025, -.28, .28);
            const eventDt = clamp((event.timeStamp - p.lastTime) / 1000, .004, .08);
            this.velocityX = motion.damp(this.velocityX, clamp(deltaX * .003 / eventDt, -1.2, 1.2), .032, eventDt);
            this.velocityY = motion.damp(this.velocityY, clamp(-deltaY * .0025 / eventDt, -.8, .8), .032, eventDt);
            if (this.paused) { this.yaw = this.targetYaw; this.pitch = this.targetPitch; }
            this.requestDraw();
          }
          p.lastX = event.clientX; p.lastY = event.clientY; p.lastTime = event.timeStamp;
        }
        if (event.pointerType !== 'touch' && (!this.pointer || !this.pointer.dragged)) {
          const rect=this.canvas.getBoundingClientRect();
          this.featurePointer={x:event.clientX-rect.left,y:event.clientY-rect.top};
          const feature=this.hitFeature(event.clientX,event.clientY);
          this.setFeatureHover(feature);
          const hit = feature===null?this.hit(event.clientX,event.clientY,true):this.groups[this.nodes[feature].group].id;
          if (hit !== this.hoverCandidate) { this.hoverCandidate = hit; this.hoverSince = performance.now(); }
          if (this.paused||feature!==null) this.setHover(hit);
          this.canvas.style.cursor = hit ? 'pointer' : 'grab';
        }
      });
      on(this.canvas, 'pointerup', event => {
        const p = this.pointer;
        if (!p || p.id !== event.pointerId) return;
        if (!p.dragged && !p.vertical) {
          const feature=this.hitFeature(event.clientX,event.clientY);
          const id=feature===null?this.hit(event.clientX,event.clientY):this.groups[this.nodes[feature].group].id;
          const next=feature===null&&id===this.selected?null:id;
          this.select(next);
          if (typeof this.options.onSelect === 'function') this.options.onSelect(next);
        }
        if (event.timeStamp - p.lastTime > 90) this.velocityX = this.velocityY = 0;
        this.pointer = null;
        if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
        this.canvas.style.cursor = this.hovered ? 'pointer' : 'grab';
      });
      on(this.canvas, 'pointercancel', () => { this.pointer = null;this.setFeatureHover(null); this.velocityX = this.velocityY = 0; this.canvas.style.cursor = 'grab'; });
      on(this.canvas, 'pointerleave', () => { if (!this.pointer || !this.pointer.dragged) this.hoverEngine(this.options.getFocusEngine?.()||null); });
      on(window,'blur',()=>{this.pointer=null;this.velocityX=this.velocityY=0;this.hoverEngine(null);this.canvas.style.cursor='grab';});
      on(this.canvas, 'wheel', event => {
        if (!event.ctrlKey && !event.metaKey) return;
        event.preventDefault(); this.zoomBy(Math.exp(-event.deltaY * .0015));
      }, { passive: false });
      on(document, 'visibilitychange', () => {
        this.lastFrame = 0; motion.resetClock(this.clock);
        if (document.hidden) this.cancelFrame(); else this.requestDraw();
      });
      const motionChange = e => { if (e.matches) this.setPaused(true); };
      if (this.motionQuery.addEventListener) on(this.motionQuery, 'change', motionChange);
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(this.canvas);
      } else on(window, 'resize', () => this.resize());
      if (typeof IntersectionObserver !== 'undefined') {
        this.intersectionObserver = new IntersectionObserver(entries => {
          this.visible = entries[0].isIntersecting; this.lastFrame = 0; motion.resetClock(this.clock);
          if (this.visible) this.requestDraw(); else this.cancelFrame();
        }, { rootMargin: '80px' });
        this.intersectionObserver.observe(this.canvas);
      }
    }

    resize() {
      if (this.destroyed) return;
      const rect = this.canvas.getBoundingClientRect();
      this.width = Math.max(1, rect.width); this.height = Math.max(1, rect.height);
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.round(this.width * this.dpr), pixelHeight = Math.round(this.height * this.dpr);
      if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
        this.canvas.width = pixelWidth; this.canvas.height = pixelHeight;
        this.labelState.clear(); this.labelSprites.clear();
      }
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.gpu?.resize(this.width, this.height, this.dpr);
      this.frameProjection = null;
      this.requestDraw();
    }

    project(x, y, z, out = {}) {
      const rotation = this.frameProjection;
      const cy = rotation ? rotation.cy : Math.cos(this.yaw), sy = rotation ? rotation.sy : Math.sin(this.yaw), cp = rotation ? rotation.cp : Math.cos(this.pitch), sp = rotation ? rotation.sp : Math.sin(this.pitch);
      const rx = x * cy + z * sy; const rz = -x * sy + z * cy;
      const ry = y * cp - rz * sp; const depth = y * sp + rz * cp;
      const perspective = 3.7 / (3.7 - depth);
      const scale = Math.min(this.width * .405, this.height * .445) * this.zoom;
      out.x=this.width*.5+rx*scale*perspective;out.y=this.height*.493+ry*scale*perspective;
      out.z=depth;out.scale=perspective;out.depth=clamp((depth+.8)/1.6,0,1);
      return out;
    }

    neighbors(id) {
      return this.adjacency.get(id) || new Set([id]);
    }

    focusFor(id) {
      const active = this.hovered || this.selected;
      if (active && active !== 'atlas') {
        if (id === active) return 1.45;
        return this.neighbors(active).has(id) ? .70 : .14;
      }
      if (this.scenario) return this.scenario.has(id) ? 1.28 : .17;
      return 1;
    }

    setHover(id) {
      if (id === this.hovered) return;
      if(id)this.finishIntro();
      this.hovered = id;
      if (typeof this.options.onHover === 'function') this.options.onHover(id);
      this.requestDraw();
    }

    // DOM controls and keyboard focus share the canvas preview state and its latch.
    hoverEngine(id) {
      this.setFeatureHover(null);
      const next=this.groups.some(g=>g.id===id)?id:null;
      this.hoverCandidate=next;this.hoverSince=performance.now()-100;
      this.setHover(next);
    }

    select(id) {
      this.finishIntro();
      this.setFeatureHover(null);
      this.selected = id === 'atlas' || this.groups.some(g => g.id === id) ? id : null;
      this.hovered = null; this.hoverCandidate = null;
      this.requestDraw();
    }

    setScenario(ids) { if(ids?.length)this.finishIntro();this.scenario = ids && ids.length ? new Set(ids) : null; this.requestDraw(); }

    setPaused(value) {
      this.paused = Boolean(value); this.lastFrame = 0; motion.resetClock(this.clock);
      if(this.paused)this.finishIntro();
      this.velocityX = this.velocityY = 0;
      if (this.paused) { this.targetYaw = this.yaw; this.targetPitch = this.pitch; this.targetZoom = this.zoom; }
      this.requestDraw();
    }

    reset() {
      this.finishIntro();
      this.setFeatureHover(null);
      Object.assign(this.coreLight,{id:null,since:this.time,start:null,issued:false,amount:0});this.innerLight=0;
      if(this.paused)this.nodes.forEach(n=>{n.tissue.x.value=n.tissue.x.velocity=n.tissue.y.value=n.tissue.y.velocity=0;});
      this.selected = null; this.hovered = null; this.hoverCandidate = null; this.scenario = null;
      this.targetZoom = 1; this.targetYaw = -.045; this.targetPitch = -.035;
      this.velocityX = this.velocityY = 0;
      if (this.paused) { this.yaw = this.targetYaw; this.pitch = this.targetPitch; this.zoom = this.targetZoom; }
      this.requestDraw();
    }

    zoomBy(factor) { this.finishIntro();this.targetZoom = clamp(this.targetZoom * (Number(factor) || 1), .76, 1.18); if(this.paused)this.zoom=this.targetZoom; this.requestDraw(); }

    finishIntro() {
      if(this.introComplete)return;
      this.introComplete=true;this.introProgress=1;
      this.canvas.style.opacity='1';if(this.gpuCanvas)this.gpuCanvas.style.opacity='1';
    }

    appearance(depth=.5) { return this.introComplete?1:ease((this.time-.50-depth*.42)/.82); }

    labelAppearance() { return this.introComplete?1:ease((this.time-1.02)/.98); }

    setFeatureHover(index) {
      const next=Number.isInteger(index)&&this.nodes[index]?.concept?index:null;
      if(next===this.hoveredFeature)return;
      this.hoveredFeature=next;
      this.featureContact=null;
      this.nodes.forEach(n=>{n.tissue.weight=0;n.tissue.depth=0;});
      if(next!==null){
        this.finishIntro();
        const node=this.nodes[next],p=node.baseP||node.p,box=this.featureBoxes.find(b=>b.index===next);
        const dx=p.x-(this.featurePointer?.x??p.x),dy=p.y-(this.featurePointer?.y??p.y),distance=Math.hypot(dx,dy);
        this.featureContact={x:p.x,y:p.y,dx:distance>3?dx/distance:Math.cos(node.phase),dy:distance>3?dy/distance:Math.sin(node.phase),box:box?{x:box.x,y:box.y,w:box.w,h:box.h}:null,since:this.time};
        node.tissue.weight=1;
        for(const neighbor of node.links){neighbor.tissue.weight=neighbor.isHub?.16:.42;neighbor.tissue.depth=1;}
        for(const neighbor of node.links)for(const outer of neighbor.links){
          if(outer!==node&&!outer.tissue.weight){outer.tissue.weight=outer.isHub?.04:.10;outer.tissue.depth=2;}
        }
      }
      this.requestDraw();
    }

    hitFeature(clientX,clientY) {
      const r=this.canvas.getBoundingClientRect(),x=clientX-r.left,y=clientY-r.top;
      const contains=(box,pad)=>x>=box.x-pad&&x<=box.x+box.w+pad&&y>=box.y-pad&&y<=box.y+box.h+pad;
      const current=this.featureBoxes.find(box=>box.index===this.hoveredFeature);
      const held=this.nodes[this.hoveredFeature],contact=this.featureContact;
      // A deformed point cannot push itself out of its own pointer target.
      if(held?.baseP&&(Math.hypot(x-held.baseP.x,y-held.baseP.y)<19||Math.hypot(x-held.p.x,y-held.p.y)<19||current&&contains(current,11)||contact?.box&&contains(contact.box,11)))return held.index;
      let nearest=null,distance=12;
      for(const node of this.nodes){
        if(!node.concept||!node.p||node.appearance<.25||this.groups[node.group].focus<.25)continue;
        const d=Math.hypot(x-node.p.x,y-node.p.y);if(d<distance){nearest=node.index;distance=d;}
      }
      if(nearest!==null)return nearest;
      for(const box of this.featureBoxes)if(contains(box,6))return box.index;
      return null;
    }

    advanceFeatureTissue(dt) {
      // Screen-space offsets share Loom's exact spring. Every line uses the same
      // displaced endpoints; no independent dash animation or free-running force loop.
      const source=this.nodes[this.hoveredFeature],contact=this.featureContact;
      const disabled=this.motionQuery.matches;
      let targetX=0,targetY=0;
      if(source&&contact){
        const p=source.baseP,dx=p.x-(this.featurePointer?.x??p.x),dy=p.y-(this.featurePointer?.y??p.y);
        const ux=contact.dx*20+dx*.45,uy=contact.dy*20+dy*.45,length=Math.hypot(ux,uy)||1;
        const age=this.time-contact.since,breath=Math.sin(age*1.8),amplitude=this.width<520?6.5:9;
        targetX=ux/length*(amplitude+breath*.85)-uy/length*Math.sin(age*1.35)*1.1;
        targetY=uy/length*(amplitude+breath*.85)+ux/length*Math.sin(age*1.35)*1.1;
      }
      const carriedX=source?.tissue.x.value||0,carriedY=source?.tissue.y.value||0;
      for(const node of this.nodes){
        const state=node.tissue,weight=state.weight,isSource=node===source;
        let x=0,y=0;
        if(source&&weight){
          x=isSource?targetX:carriedX*weight;y=isSource?targetY:carriedY*weight;
          if(!isSource){
            const dx=node.baseP.x-source.baseP.x,dy=node.baseP.y-source.baseP.y,distance=Math.hypot(dx,dy)||1;
            const expansion=Math.sin((this.time-contact.since)*1.8)*weight*.9;
            x+=dx/distance*expansion;y+=dy/distance*expansion;
          }
        }
        if(disabled){state.x.value=state.x.velocity=state.y.value=state.y.velocity=0;}
        else if(!this.paused){
          const response=isSource?.16:weight?.23+state.depth*.045:.30;
          motion.advanceSpring(state.x,x,response,dt);motion.advanceSpring(state.y,y,response,dt);
        }
        node.p.x+=state.x.value;node.p.y+=state.y.value;
      }
    }

    advanceCoreLight(active,dt) {
      const light=this.coreLight,chosen=this.groups.find(g=>g.id===active),id=chosen?.id||null;
      if(id!==light.id){
        light.id=id;light.since=this.time;light.start=null;light.issued=false;
        if(this.paused)light.amount=0;
      }
      if(this.motionQuery.matches){light.amount=0;light.start=null;light.issued=true;return;}
      if(this.paused)return;
      // One soft breath stays inside the glass. No rings, outward pulses or field lighting.
      if(chosen&&!light.issued&&this.time-light.since>=.80&&chosen.revealAge>=.72){
        light.start=this.time;light.issued=true;light.count++;
      }
      const age=light.start===null?-1:this.time-light.start;
      const target=age<0?0:.78*ease(age/.52)*(1-ease((age-.52)/1.28));
      light.amount=motion.damp(light.amount,target,target>light.amount?.12:.22,dt);
      if(age>2.5&&light.amount<.001){light.amount=0;light.start=null;}
    }

    hit(clientX, clientY, hover = false) {
      const r = this.canvas.getBoundingClientRect(); const x = clientX - r.left, y = clientY - r.top;
      if (hover && this.hovered) {
        const current = this.groups.find(g => g.id === this.hovered);
        if (current && Math.hypot(x-current.hub.p.x, y-current.hub.p.y)<40) return this.hovered;
        const label = this.labelBoxes.find(box => box.id === this.hovered);
        if (label && x>label.x-14 && x<label.x+label.w+14 && y>label.y-14 && y<label.y+label.h+14) return this.hovered;
      }
      for (const box of this.labelBoxes) if (x >= box.x - 5 && x <= box.x + box.w + 5 && y >= box.y - 6 && y <= box.y + box.h + 6) return box.id;
      const center = this.project(0, 0, 0);
      if (Math.hypot(x - center.x, y - center.y) < this.nucleusRadius()) return hover?null:'atlas';
      let best = null, distance = hover ? 17 : 23;
      for (const node of this.nodes) {
        if (!node.p) continue;
        if (hover && !node.isHub && !node.concept) continue;
        const d = Math.hypot(x - node.p.x, y - node.p.y);
        if (d < distance) { best = this.groups[node.group].id; distance = d; }
      }
      return best;
    }

    cancelFrame() { if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; } }

    requestDraw() {
      if (this.raf || this.destroyed || !this.visible || document.hidden) return;
      this.raf = requestAnimationFrame(timestamp => this.frame(timestamp));
    }

    frame(timestamp) {
      this.raf = 0;
      if (this.destroyed || !this.visible || document.hidden) return;
      const tick = motion.stepClock(this.clock, timestamp, {paused:this.paused});
      const dt = tick.dt; this.dt = dt; this.time = tick.time;
      if(!this.introComplete){
        this.introProgress=ease(this.time/2.15);
        const opacity=String(ease((this.time+.04)/.55));this.canvas.style.opacity=opacity;this.gpuCanvas.style.opacity=opacity;
        if(this.time>=2.15)this.finishIntro();
      }
      if (!this.paused && !tick.firstFrame && tick.rawDt > 0) {
        this.frameMS = motion.damp(this.frameMS, tick.rawDt * 1000, .5, Math.min(tick.rawDt,.1));
        this.samples[this.sampleCursor] = tick.rawDt * 1000;
        this.renderCosts[this.sampleCursor] = this.renderCost;
        this.sampleCursor = (this.sampleCursor + 1) % this.samples.length;
        this.sampleCount = Math.min(this.sampleCount + 1, this.samples.length);
      }
      this.lastFrame = timestamp; this.frames++;
      if (this.hoverCandidate !== this.hovered && performance.now() - this.hoverSince > 90) this.setHover(this.hoverCandidate);
      if (!this.paused) {
        if (!this.pointer || !this.pointer.dragged) {
          const yawCoast = motion.coast({value:this.targetYaw,velocity:this.velocityX},8.5,dt,-.43,.43);
          const pitchCoast = motion.coast({value:this.targetPitch,velocity:this.velocityY},9.5,dt,-.28,.28);
          this.targetYaw = yawCoast.value; this.velocityX = yawCoast.velocity;
          this.targetPitch = pitchCoast.value; this.velocityY = pitchCoast.velocity;
        }
        this.yaw = motion.damp(this.yaw,this.targetYaw,.105,dt);
        this.pitch = motion.damp(this.pitch,this.targetPitch,.105,dt);
        this.zoom = motion.damp(this.zoom,this.targetZoom,.17,dt);
      }
      this.groups.forEach(g => { const target = this.focusFor(g.id); g.focus = this.paused ? target : motion.damp(g.focus,target,.22,dt); });
      const active = this.hovered || this.selected;
      this.groups.forEach(g=>{const target=g.id===active?1:0;g.detail=this.paused?target:motion.damp(g.detail,target,target?.24:.17,dt);});
      const adjacent=this.featureAdjacency.get(this.hoveredFeature);
      this.nodes.forEach(node=>{const target=node.index===this.hoveredFeature?1:adjacent?.has(node.index)? .32:0;node.inspect=this.paused?target:motion.damp(node.inspect,target,target?.14:.22,dt);});
      this.edges.forEach(edge=>{const target=edge.a.index===this.hoveredFeature||edge.b.index===this.hoveredFeature?1:0;edge.inspect=this.paused?target:motion.damp(edge.inspect,target,target?.16:.24,dt);});
      this.advanceColor(active,dt);
      const chosen=this.groups.find(g=>g.id===active);
      const arrival=chosen?(this.paused?1:ease((chosen.revealAge-.32)/.30)):0;
      const nucleusTint=chosen?tint(SILVER,chosen.color,arrival):SILVER;
      this.orbTint=this.orbTint.map((value,i)=>this.paused?nucleusTint[i]:motion.damp(value,nucleusTint[i],chosen?.22:.18,dt));
      this.orbEnergy=this.paused?(chosen?1:.58):motion.damp(this.orbEnergy,chosen?1:.58,.42,dt);
      this.advanceCoreLight(active,dt);
      const openingLight=this.introComplete?0:.24*ease(this.time/.42)*(1-ease((this.time-.45)/.85));
      this.innerLight=Math.min(1,this.coreLight.amount+openingLight);
      this.paths.forEach(path => { const target=active&&(path.a.id===active||path.b.id===active)?1:0;path.emphasis=this.paused?target:motion.damp(path.emphasis,target,.24,dt); });
      const yaw = this.yaw + Math.sin(this.time*.075)*.024, pitch = this.pitch + Math.sin(this.time*.055)*.012;
      this.frameProjection = {cy:Math.cos(yaw),sy:Math.sin(yaw),cp:Math.cos(pitch),sp:Math.sin(pitch)};
      const start = performance.now();
      for(const node of this.nodes){
        const t=this.time,amp=node.isHub?.009:.014;
        node.baseP=this.project(node.x+Math.sin(t*node.speed+node.phase)*amp,node.y+Math.cos(t*node.speed*.79+node.phase)*amp,node.z+Math.sin(t*.12+node.phase)*.016,node.baseP||{});
        node.p=Object.assign(node.p||{},node.baseP);
        node.appearance=this.appearance(node.p.depth);
      }
      this.advanceFeatureTissue(dt);
      this.render();
      this.renderCost = performance.now() - start;
      if (!this.paused) this.requestDraw();
    }

    advanceColor(active,dt) {
      const advance=(current,target,on)=>this.paused?(on?1:0):motion.damp(current,on?Math.max(current,target):0,on?.085:.15,dt);
      this.groups.forEach(g=>{
        const engaged=active?active===g.id:Boolean(this.scenario?.has(g.id));
        if(engaged&&!g.engaged)g.revealAge=0;
        g.engaged=engaged;if(engaged)g.revealAge+=dt;
        g.nodes.forEach(n=>{n.chroma=advance(n.chroma,engaged?ease((g.revealAge-n.colorDelay)/.22):0,engaged);});
        for(let i=0;i<REVEAL_SEGMENTS;i++){
          const target=engaged?ease((g.revealAge-.04-(i+.5)/REVEAL_SEGMENTS*.46)/.20):0;
          g.reveal[i]=advance(g.reveal[i],target,engaged);
        }
      });
      this.paths.forEach(path=>{
        const origin=active&&(path.a.id===active||path.b.id===active)?active:null;
        if(origin&&origin!==path.origin)path.revealAge=0;
        path.origin=origin;if(origin)path.revealAge+=dt;
        const source=origin===path.a.id?path.a:path.b;
        for(let i=0;i<REVEAL_SEGMENTS;i++){
          const position=(i+.5)/REVEAL_SEGMENTS,distance=origin===path.a.id?position:1-position;
          const target=origin?ease((path.revealAge-.10-distance*.52)/.22):0;
          // Keep each segment's previous pigment until the new origin's wave arrives.
          // This also handles direct A-to-B hover without recoloring the whole link.
          for(let channel=0;channel<3;channel++){
            if(origin)path.colors[i][channel]=this.paused?source.light[channel]:motion.damp(path.colors[i][channel],source.light[channel],.065,dt*target);
            else if(path.reveal[i]<.002)path.colors[i][channel]=SILVER[channel];
          }
          path.reveal[i]=advance(path.reveal[i],target,Boolean(origin));
        }
      });
    }

    lightCurve(gpu,curve,reveal,accent,alpha,width) {
      // Per-segment color is batched by the shared renderer; no extra GPU draw calls.
      let previous=curve.a;
      for(let i=0;i<REVEAL_SEGMENTS;i++){
        const p=this.curveAt(curve,(i+1)/REVEAL_SEGMENTS);
        gpu.line(previous.x,previous.y,p.x,p.y,tint(SILVER,Array.isArray(accent[0])?accent[i]:accent,reveal[i]),alpha,width);
        previous=p;
      }
    }

    stitchLightCurve(gpu,curve,reveal,accent,alpha,width,options) {
      let previous=curve.a,walked=0;
      for(let i=0;i<REVEAL_SEGMENTS;i++){
        const p=this.curveAt(curve,(i+1)/REVEAL_SEGMENTS);
        if(reveal[i]>.012)gpu.stitch(previous.x,previous.y,p.x,p.y,Array.isArray(accent[0])?accent[i]:accent,alpha*reveal[i],width,{...options,phase:options.phase+walked});
        walked+=Math.hypot(p.x-previous.x,p.y-previous.y);previous=p;
      }
    }

    curvePoints(a, b, lift, offset) {
      const dx = b.x - a.x, dy = b.y - a.y;
      const distance = Math.hypot(dx, dy) || 1;
      const bend = lift * Math.min(this.width, this.height) * .48;
      return { a, b, c: { x: (a.x + b.x) * .5 - dy / distance * bend, y: (a.y + b.y) * .5 + dx / distance * bend + (offset || 0) } };
    }

    curveAt(curve, t) {
      const k = 1 - t;
      return { x: k * k * curve.a.x + 2 * k * t * curve.c.x + t * t * curve.b.x, y: k * k * curve.a.y + 2 * k * t * curve.c.y + t * t * curve.b.y };
    }

    render() {
      if (this.gpuAvailable) this.renderGPU();
      else this.renderCanvas();
    }

    renderGPU() { this.renderField(this.gpu); }

    renderField(gpu) {
      const ctx=this.ctx,w=this.width,h=this.height,t=this.time,mobile=w<520;
      ctx.clearRect(0,0,w,h);gpu.begin(t);
      const center=this.project(0,0,0),radius=this.nucleusRadius();
      Object.assign(this.depthState,{width:w,height:h,time:t,intro:this.introComplete?1:ease((t-.05)/1.12),mobile});
      this.depthField.drawBack(gpu,this.depthState);
      gpu.glow(center.x,center.y,Math.min(w,h)*1.08,[173,185,198],.048);
      for(const particle of this.dust){
        const p=this.project(particle.x+Math.sin(t*.04+particle.phase)*.018,particle.y,particle.z);
        gpu.dot(p.x,p.y,particle.size,[192,201,211],particle.alpha*.30*this.appearance(0));
      }
      this.projectedHubs=this.groups.map(g=>({id:g.id,x:g.hub.p.x,y:g.hub.p.y,depth:g.hub.p.z}));
      // Permanent relationships stay as fine light; tactile detail appears only with focus.
      for(let i=0;i<this.paths.length;i++){
        const path=this.paths[i],focus=Math.min(path.a.focus,path.b.focus),detail=path.emphasis;
        const appearing=this.appearance((path.a.hub.p.depth+path.b.hub.p.depth)*.5);
        const alpha=mix(.21*focus,.60,detail)*appearing,thread=path.colors;
        const curve=this.curvePoints(path.a.hub.p,path.b.hub.p,path.lift,0);
        this.lightCurve(gpu,curve,path.reveal,thread,alpha*(1-detail*.22),mix(.60,.88,detail));
        this.lightCurve(gpu,this.curvePoints(path.a.nodes[1+i%6].p,path.b.nodes[1+(i+2)%6].p,path.lift*.7,0),path.reveal,thread,alpha*.45,.46);
        this.lightCurve(gpu,this.curvePoints(path.a.nodes[29+i%5].p,path.b.nodes[29+(i+1)%5].p,path.lift*.86,0),path.reveal,thread,alpha*.34,.40);
        if(detail>.01)this.stitchLightCurve(gpu,curve,path.reveal,thread,detail*.40,1.30,{length:5.8,gap:3.8,phase:path.phase*8});
        const inScenario=this.scenario&&this.scenario.has(path.a.id)&&this.scenario.has(path.b.id);
        const progress=(t*.052+path.phase)%1;
        const segment=Math.min(23,Math.floor(progress*24));
        this.flowPulse(gpu,curve,progress,(.14+.64*detail+(inScenario?.22:0))*Math.min(1,focus)*appearing,detail>.5?21:13,tint(SILVER,thread[segment],path.reveal[segment]));
      }
      this.groups.forEach((group,index)=>{
        const f=group.focus*group.hub.appearance,detail=group.detail,curve=this.curvePoints(group.hub.p,center,(index%2?-1:1)*.15,0);
        this.lightCurve(gpu,curve,group.reveal,group.light,(.30+detail*.18)*f,.90+detail*.10);
        if(detail>.01){
          this.lightCurve(gpu,curve,group.reveal,group.light,.045*detail,4.8);
          this.stitchLightCurve(gpu,curve,group.reveal,group.color,.52*detail,1.8,{length:7.5,gap:4,phase:index*.72});
        }
        this.lightCurve(gpu,this.curvePoints(group.nodes[1+index%6].p,center,(index%2?-1:1)*.12,0),group.reveal,group.light,.11*f,.53);
        for(let strand=0;strand<2;strand++){
          const end={x:center.x+Math.cos(index*.79+strand*.4)*24,y:center.y+Math.sin(index*.79+strand*.4)*24};
          this.lightCurve(gpu,this.curvePoints(group.nodes[29+strand*2].p,end,(index%2?-1:1)*(.13+strand*.026),0),group.reveal,group.light,(.11-strand*.024)*f,.45);
        }
        const progress=(t*.043+index*.131)%1;
        this.flowPulse(gpu,curve,progress,(.42+detail*.34)*Math.min(1,f),detail>.5?24:18,tint(SILVER,group.light,group.reveal[Math.min(23,Math.floor(progress*24))]));
      });
      for(const edge of this.edges){
        const a=edge.a.p,b=edge.b.p,group=this.groups[edge.group],depth=(a.depth+b.depth)*.5;
        const alpha=((edge.kind==='concept'?.36:.225)*(.65+depth*.6)*group.focus*edge.opacity+edge.inspect*.08)*Math.min(edge.a.appearance,edge.b.appearance);
        gpu.line(a.x,a.y,b.x,b.y,tint(SILVER,group.light,(edge.a.chroma+edge.b.chroma)*.5),alpha,edge.kind==='concept'?.78:.59);
        if(edge.inspect>.01)gpu.stitch(a.x,a.y,b.x,b.y,group.light,edge.inspect*.24,1.15,{length:4.8,gap:3.8,phase:edge.a.index*.37});
        if(group.detail>.02&&edge.kind==='concept'&&edge.a.isHub){
          gpu.stitch(a.x,a.y,b.x,b.y,group.color,group.detail*.42*Math.min(edge.a.chroma,edge.b.chroma)*(1-edge.inspect),1.18,{length:4.8,gap:3.5,phase:edge.a.index*.37});
        }
      }
      for(const node of this.nodes){
        const group=this.groups[node.group],p=node.p,f=group.focus;
        const light=tint(SILVER,group.light,node.chroma),pigment=tint(SILVER,group.color,node.chroma);
        const bright=clamp((.49+p.depth*.5)*f+node.inspect*.18,.035,1)*node.appearance,size=node.size*p.scale*(mobile?.89:1);
        if(node.concept&&node.inspect>.02)gpu.glow(p.x,p.y,18,group.light,node.inspect*.15);
        if(node.isHub){
          const breath=.87+.13*Math.sin(t*.56+group.index*.73);
          gpu.glow(p.x,p.y,37+group.detail*12,pigment,bright*.48*breath);
          gpu.ring(p.x,p.y,6.5+group.detail*.9,light,(.26+group.detail*.19)*f*node.appearance,.65);
          gpu.dot(p.x,p.y,size+group.detail*.5,light,bright);
          gpu.dot(p.x-.4,p.y-.55,.82,tint(SILVER_LIGHT,group.highlight,node.chroma),bright);
        }else{
          if(node.localIndex<=6)gpu.glow(p.x,p.y,12,pigment,bright*.17);
          gpu.dot(p.x,p.y,size,light,bright*.85);
        }
      }
      this.depthField.drawFront(gpu,this.depthState);
      // Shared time and smoothly changing tint connect the nucleus to the active engine.
      gpu.glow(center.x,center.y,radius*3.5,this.orbTint,.19);
      gpu.nucleus(center.x,center.y,radius,t,this.orbEnergy,this.orbTint,'silver',this.innerLight);
      gpu.end();
      const title=this.textSprite('A T L A S',mobile?12:14,'500','rgb(235,239,244)',FONT);
      ctx.globalAlpha=this.introComplete?1:ease((t-.35)/.65);
      ctx.drawImage(title.canvas,center.x-title.w/2,center.y+radius+15,title.w,title.h);ctx.globalAlpha=1;
      this.drawLabels(center,mobile);
    }

    flowPulse(gpu,curve,progress,alpha,size,rgb){
      const strength=alpha*Math.pow(Math.sin(progress*Math.PI),.65),p=this.curveAt(curve,progress);
      gpu.glow(p.x,p.y,size,rgb,strength*.66);
      gpu.dot(p.x,p.y,.8,rgb.map(v=>mix(v,255,.5)),strength*.78);
      let last=p;
      for(let i=1;i<=5;i++){
        const q=this.curveAt(curve,Math.max(0,progress-i*.005));
        gpu.line(last.x,last.y,q.x,q.y,rgb,strength*(1-i/6)*.48,.78);last=q;
      }
    }

    renderCanvas() {
      if(!this.canvasPainter)this.canvasPainter=this.makeCanvasPainter();
      this.renderField(this.canvasPainter);
    }

    nucleusRadius() { return (this.width<520?clamp(this.width*.125,39,50):clamp(Math.min(this.width,this.height)*.132,68,92))*Math.sqrt(this.zoom); }

    drawCanvasNucleus(x,y,radius,t,energy,tint,innerLight=0) {
      const ctx=this.ctx;ctx.save();ctx.translate(x,y);ctx.scale(radius,radius);
      ctx.beginPath();ctx.arc(0,0,1,0,TAU);ctx.clip();
      const body=ctx.createRadialGradient(-.34,-.45,.01,.11,.18,1.2);
      body.addColorStop(0,'#333b45');body.addColorStop(.3,'#151a21');body.addColorStop(.67,'#080b11');body.addColorStop(.9,'#2d3540');body.addColorStop(1,'#a5b0bc');
      ctx.fillStyle=body;ctx.fillRect(-1,-1,2,2);
      if(innerLight>.001){
        const light=ctx.createRadialGradient(0,.08,0,0,.08,.52);
        const pigment=tint.map((v,i)=>mix(v,SILVER_LIGHT[i],.24));
        light.addColorStop(0,rgba(pigment,innerLight*.095));light.addColorStop(.4,rgba(pigment,innerLight*.043));light.addColorStop(1,rgba(pigment,0));
        ctx.fillStyle=light;ctx.fillRect(-.6,-.6,1.2,1.2);
      }
      ctx.save();ctx.rotate(-.60+Math.sin(t*.075)*.14);
      const c=tint.map((v,i)=>mix(SILVER_LIGHT[i],v,.64));
      for(let i=0;i<10;i++){
        const yy=(i-4.5)*.034+Math.sin(t*.28)*.07;
        ctx.beginPath();ctx.moveTo(-1.13,yy-.16);ctx.bezierCurveTo(-.38,yy+.73,.16,yy-.51,1.11,yy+.18);
        ctx.strokeStyle=rgba(c,(i===5?.72:.075+Math.sin(i*.7+t*.3)*.024)*(.8+energy*.3));
        ctx.lineWidth=i===5?.016:.010;ctx.stroke();
      }
      ctx.restore();
      const reflection=ctx.createRadialGradient(-.31,-.46,0,-.31,-.46,.43);
      reflection.addColorStop(0,'rgba(238,243,248,.42)');reflection.addColorStop(.25,'rgba(183,196,210,.18)');reflection.addColorStop(1,'rgba(170,186,203,0)');
      ctx.save();ctx.translate(0,-.18);ctx.scale(1,.52);ctx.fillStyle=reflection;ctx.fillRect(-1,-1,2,2);ctx.restore();
      ctx.restore();ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.strokeStyle='rgba(197,210,224,.52)';ctx.lineWidth=.7;ctx.stroke();
    }
    makeCanvasPainter() {
      const ctx=this.ctx;
      const stamp=(rgb)=>{
        rgb=rgb.map(v=>clamp(Math.round(v/8)*8,0,255));
        const key='stitch:'+rgb.map(v=>Math.round(v)).join(',');
        if(this.threadSprites.has(key))return this.threadSprites.get(key);
        const c=document.createElement('canvas');c.width=96;c.height=32;const p=c.getContext('2d');
        p.beginPath();p.roundRect(6,6,84,20,10);
        const g=p.createLinearGradient(0,6,0,26);g.addColorStop(0,rgba(rgb.map(v=>mix(v,255,.50)),.7));g.addColorStop(.28,rgba(rgb.map(v=>mix(v,255,.25)),1));g.addColorStop(.52,rgba(rgb,1));g.addColorStop(1,rgba(rgb.map(v=>v*.38),1));
        p.fillStyle=g;p.fill();p.save();p.clip();
        for(let i=-15;i<112;i+=6){p.beginPath();p.moveTo(i,3);p.bezierCurveTo(i+14,9,i-7,21,i+7,30);p.strokeStyle='rgba(255,255,255,.2)';p.lineWidth=1;p.stroke();p.beginPath();p.moveTo(i+2,3);p.bezierCurveTo(i+16,9,i-5,21,i+9,30);p.strokeStyle='rgba(0,0,0,.25)';p.stroke();}
        p.restore();if(this.threadSprites.size>=192)this.threadSprites.delete(this.threadSprites.keys().next().value);this.threadSprites.set(key,c);return c;
      };
      const stitch=(ax,ay,bx,by,rgb,alpha,width,options={})=>{
        const dx=bx-ax,dy=by-ay,distance=Math.hypot(dx,dy);if(distance<.1||alpha<.002)return;
        const length=options.length||Math.max(3.8,width*3.1),gap=options.gap||Math.max(1.7,width*.92),period=length+gap;
        const sprite=stamp(rgb);ctx.save();ctx.translate(ax,ay);ctx.rotate(Math.atan2(dy,dx));ctx.globalAlpha=clamp(alpha,0,1);
        for(let x=-(options.phase||0)%period;x<distance;x+=period){const a=Math.max(0,x),b=Math.min(distance,x+length);if(b-a<.2)continue;ctx.drawImage(sprite,a-width*.3,-width*.8,b-a+width*.6,width*1.6);}
        ctx.restore();
      };
      const stitchCurve=(curve,rgb,alpha,width,options={})=>{
        const length=options.length||Math.max(3.8,width*3.1),gap=options.gap||Math.max(1.7,width*.92),period=length+gap;
        let previous=curve.a,walked=0;
        for(let i=1;i<=56;i++){
          const p=this.curveAt(curve,i/56),d=Math.hypot(p.x-previous.x,p.y-previous.y);
          stitch(previous.x,previous.y,p.x,p.y,rgb,alpha,width,{length,gap,phase:((options.phase||0)+walked)%period});
          walked+=d;previous=p;
        }
      };
      return {begin(){},end(){},stitch,stitchCurve,
        line(ax,ay,bx,by,rgb,alpha,width){if(alpha<.003)return;ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.strokeStyle=rgba(rgb,alpha);ctx.lineWidth=width;ctx.stroke();},
        curve(curve,rgb,alpha,width){if(alpha<.003)return;ctx.beginPath();ctx.moveTo(curve.a.x,curve.a.y);ctx.quadraticCurveTo(curve.c.x,curve.c.y,curve.b.x,curve.b.y);ctx.strokeStyle=rgba(rgb,alpha);ctx.lineWidth=width;ctx.stroke();},
        ring(x,y,radius,rgb,alpha,width){if(alpha<.003)return;ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.strokeStyle=rgba(rgb,alpha);ctx.lineWidth=width;ctx.stroke();},
        nucleus:(x,y,radius,t,energy,tint,finish,innerLight)=>this.drawCanvasNucleus(x,y,radius,t,energy,tint,innerLight),
        dot(x,y,radius,rgb,alpha){if(alpha<.003)return;ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.fillStyle=rgba(rgb,alpha);ctx.fill();},
        glow:(x,y,size,rgb,alpha)=>{ctx.globalAlpha=alpha;ctx.drawImage(this.glow,x-size/2,y-size/2,size,size);ctx.globalAlpha=1;}
      };
    }
    textSprite(text, size, weight, fill, family) {
      const key=[text,size,weight,fill,family,this.dpr].join('|');
      if(this.labelSprites.has(key))return this.labelSprites.get(key);
      const pad=10, canvas=document.createElement('canvas'), context=canvas.getContext('2d');
      context.font=`${weight} ${size}px ${family}`;
      const width=context.measureText(text).width,w=Math.ceil(width+pad*2),h=Math.ceil(size+pad*2+4);
      canvas.width=Math.ceil(w*this.dpr);canvas.height=Math.ceil(h*this.dpr);
      context.setTransform(this.dpr,0,0,this.dpr,0,0);
      context.font=`${weight} ${size}px ${family}`;context.textBaseline='middle';
      context.lineWidth=3;context.lineJoin='round';context.strokeStyle='rgba(3,8,14,.9)';
      context.shadowColor='rgba(3,8,14,.98)';context.shadowBlur=5;
      context.strokeText(text,pad,h/2);context.fillStyle=fill;context.fillText(text,pad,h/2);
      const sprite={canvas,w,h,width,pad};this.labelSprites.set(key,sprite);return sprite;
    }

    drawLabels(center, mobile) {
      const ctx = this.ctx, fontSize = mobile ? 11 : 13, labelIntro=this.labelAppearance();
      this.featureBoxes.length=0;
      const boxes = this.groups.map(group => {
        const p = group.hub.p; const dx = p.x - center.x, dy = p.y - center.y;
        const sprite=this.textSprite(group.engine.name,fontSize,'500','rgb(225,231,237)',FONT);
        const len = Math.hypot(dx, dy) || 1; const width = sprite.width;
        const shiftX = dx / len * ((mobile ? 14 : 18)+width*.5), shiftY = dy / len * (mobile ? 20 : 26);
        return { id: group.id, group, sprite, x: p.x + shiftX - width * .5, y: p.y + shiftY - fontSize * .5, w: width, h: fontSize, p };
      });
      const pad = mobile ? 14 : 25;
      // Deterministic label collision resolution is run in screen space after projection.
      for (let iteration = 0; iteration < 9; iteration++) {
        for (let i = 0; i < boxes.length; i++) {
          const a = boxes[i];
          for (let j = i + 1; j < boxes.length; j++) {
            const b = boxes[j];
            const overlapX = Math.min(a.x + a.w + 9, b.x + b.w + 9) - Math.max(a.x - 9, b.x - 9);
            const overlapY = Math.min(a.y + a.h + 7, b.y + b.h + 7) - Math.max(a.y - 7, b.y - 7);
            if (overlapX > 0 && overlapY > 0) {
              const amount = overlapY * .52; const direction = a.y < b.y ? -1 : 1;
              a.y += amount * direction; b.y -= amount * direction;
            }
          }
          a.x = clamp(a.x, pad, this.width - a.w - pad);
          a.y = clamp(a.y, pad, this.height - a.h - pad);
        }
      }
      this.labelBoxes = boxes;
      boxes.forEach(box => {
        let stable=this.labelState.get(box.id);
        if(!stable){stable={x:box.x,y:box.y,alpha:1};this.labelState.set(box.id,stable);}
        stable.x=this.paused?box.x:motion.damp(stable.x,box.x,.075,this.dt);
        stable.y=this.paused?box.y:motion.damp(stable.y,box.y,.075,this.dt);
        box.x=stable.x;box.y=stable.y;
        const f = box.group.focus;
        const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
        ctx.globalAlpha=clamp(.86*f,.38,1)*labelIntro;
        ctx.drawImage(box.sprite.canvas,box.x-box.sprite.pad,cy-box.sprite.h/2,box.sprite.w,box.sprite.h);
        ctx.globalAlpha=1;
        if (Math.hypot(cx - box.p.x, cy - box.p.y) > 39) {
          ctx.beginPath(); ctx.moveTo(box.p.x, box.p.y); ctx.lineTo(cx, cy + (cy < box.p.y ? 9 : -9));
          ctx.lineWidth = .5; ctx.strokeStyle = rgba(tint(SILVER,box.group.color,box.group.hub.chroma), .16 * f*box.group.hub.appearance*labelIntro); ctx.stroke();
        }
        if (f > 1.02) {
          ctx.beginPath(); ctx.moveTo(box.x, box.y + box.h + 6); ctx.lineTo(box.x + box.w, box.y + box.h + 6);
          ctx.strokeStyle = rgba(box.group.color, clamp((f-1)*.85,0,.38)); ctx.lineWidth = .6; ctx.stroke();
        }
      });
      const taken = boxes.map(b => ({ x: b.x - 9, y: b.y - 8, w: b.w + 18, h: b.h + 16 }));
      const coreRadius=this.nucleusRadius()*1.15;
      taken.push({ x: center.x-coreRadius, y: center.y-coreRadius, w:coreRadius*2, h:coreRadius*2+44 });
      const activeId = this.hovered || this.selected;
      const candidates=this.nodes.filter(n=>n.concept).map(node=>({node,group:this.groups[node.group],active:this.groups[node.group].id===activeId}));
      candidates.sort((a,b)=>Number(b.node.index===this.hoveredFeature)-Number(a.node.index===this.hoveredFeature)||Number(b.active)-Number(a.active)).forEach(({ node, group, active }) => {
        const text = typeof node.concept === 'string' ? node.concept : node.concept.label || node.concept.name || '';
        if (!text) return;
        const sprite=this.textSprite(text,mobile?9:11,'500',node.inspect>.25?'rgb(244,247,250)':'rgb(196,207,218)',KR_FONT);
        const p = node.p, width = sprite.width, height = 12;
        const positions = [{ x: p.x + 8, y: p.y - 6 }, { x: p.x - width - 8, y: p.y - 6 }, { x: p.x - width / 2, y: p.y + 10 }, { x: p.x - width / 2, y: p.y - 22 },{x:p.x-width/2,y:p.y+27},{x:p.x-width/2,y:p.y-39},
          {x:p.x-width-18,y:p.y-28},{x:p.x+18,y:p.y-28},{x:p.x-width-18,y:p.y+16},{x:p.x+18,y:p.y+16},
          {x:p.x-width/2,y:p.y+45},{x:p.x-width/2,y:p.y-57}];
        const key='concept:'+node.index;
        let state=this.labelState.get(key);
        if(!state){state={x:positions[0].x,y:positions[0].y,alpha:0,slot:null};this.labelState.set(key,state);}
        const wanted=node.index===this.hoveredFeature||(active?node.localIndex<=(mobile?3:5):!mobile&&node.localIndex===3&&group.focus>.79);
        const valid=a=>a.x>10&&a.x+width<this.width-10&&a.y>10&&a.y+height<this.height-10&&!taken.some(b=>a.x<b.x+b.w&&a.x+width>b.x&&a.y<b.y+b.h&&a.y+height>b.y);
        // Choose a side only on first appearance. Hover priority and small tissue
        // motion may change visibility, never the label's place around its point.
        // A viewport resize clears labelState and permits a fresh layout.
        if(state.slot===null&&wanted){const slot=positions.findIndex(valid);if(slot>=0)state.slot=slot;}
        const placement=positions[state.slot??0];
        const show=wanted&&state.slot!==null&&(node.index===this.hoveredFeature||valid(placement));
        const targetAlpha=show?(active ? .91 : .49):0;
        if(state.alpha<.025){state.x=placement.x;state.y=placement.y;}
        else {state.x=this.paused?placement.x:motion.damp(state.x,placement.x,.17,this.dt);state.y=this.paused?placement.y:motion.damp(state.y,placement.y,.17,this.dt);}
        state.alpha=this.paused?targetAlpha:motion.damp(state.alpha,targetAlpha,.19,this.dt);
        if(show)taken.push({x:placement.x-4,y:placement.y-4,w:width+8,h:height+8});
        if(state.alpha>.015){
          const anchorX=clamp(p.x,state.x-3,state.x+width+3),anchorY=clamp(p.y,state.y-3,state.y+height+3);
          if(active&&Math.hypot(anchorX-p.x,anchorY-p.y)>14){ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(anchorX,anchorY);ctx.strokeStyle=rgba(group.light,(.13+node.inspect*.17)*state.alpha*labelIntro);ctx.lineWidth=.5;ctx.stroke();}
          ctx.globalAlpha=state.alpha*node.appearance*labelIntro;ctx.drawImage(sprite.canvas,state.x-sprite.pad,state.y+height/2-sprite.h/2,sprite.w,sprite.h);ctx.globalAlpha=1;
        }
        if(state.alpha*node.appearance*labelIntro>.18)this.featureBoxes.push({index:node.index,node,x:state.x,y:state.y,w:width,h:height,label:text});
      });
    }

    getHubPositions() { return this.projectedHubs.map(p => ({ ...p })); }
    getFeaturePositions() { return this.featureBoxes.map(box=>({index:box.index,engine:this.groups[box.node.group].id,label:box.label,x:box.x+box.w/2,y:box.y+box.h/2,width:box.w,height:box.h,nodeX:box.node.p.x,nodeY:box.node.p.y,baseX:box.node.baseP.x,baseY:box.node.baseP.y,displacementX:box.node.tissue.x.value,displacementY:box.node.tissue.y.value})); }

    getSummary() {
      const samples=Array.from(this.samples.slice(0,this.sampleCount)).sort((a,b)=>a-b);
      const costs=Array.from(this.renderCosts.slice(0,this.sampleCount)).sort((a,b)=>a-b);
      const at=(values,p)=>values.length?Number(values[Math.floor((values.length-1)*p)].toFixed(2)):0;
      return {
        engines: this.groups.length, nodes: this.nodes.length,
        localEdges: this.edges.length, relationships: this.paths.length,
        connections: this.edges.length + this.paths.length * 3 + this.groups.length * 4,
        decorativeDepth:this.depthField.counts,
        selected: this.selected, hovered: this.hovered,
        hoveredFeature:this.hoveredFeature===null?null:{index:this.hoveredFeature,label:typeof this.nodes[this.hoveredFeature].concept==='string'?this.nodes[this.hoveredFeature].concept:this.nodes[this.hoveredFeature].concept.label,connections:this.featureAdjacency.get(this.hoveredFeature)?.size||0},
        featureResponse:{activeEdges:this.edges.filter(e=>e.inspect>.5).length,displacedNodes:this.nodes.filter(n=>Math.hypot(n.tissue.x.value,n.tissue.y.value)>.1).length,maxDisplacement:+Math.max(...this.nodes.map(n=>Math.hypot(n.tissue.x.value,n.tissue.y.value))).toFixed(3),mode:'local spring'},
        scenario: this.scenario ? Array.from(this.scenario) : null,
        paused: this.paused, visible: this.visible && !document.hidden,
        frames: this.frames, time: Number(this.time.toFixed(3)),
        fps: this.paused ? 0 : Math.round(1000 / this.frameMS),
        renderer:this.gpuAvailable?'Loom WebGL / living light':'Canvas 2D / living light fallback',
        material:'silver glass, spatial brand color reveal and selective stitches',
        nucleusTint:this.orbTint.map(v=>Number(v.toFixed(2))),nucleusEnergy:Number(this.orbEnergy.toFixed(3)),
        cinematic:{introComplete:this.introComplete,introProgress:+this.introProgress.toFixed(3),nucleusRadius:+this.nucleusRadius().toFixed(2),labelAppearance:+this.labelAppearance().toFixed(3),innerLight:+this.innerLight.toFixed(3),highlights:this.coreLight.count},
        colorState:this.groups.map(g=>({id:g.id,hub:+g.hub.chroma.toFixed(3),near:+g.reveal[0].toFixed(3),far:+g.reveal[REVEAL_SEGMENTS-1].toFixed(3)})),
        performance:{samples:this.sampleCount,frameMedianMs:at(samples,.5),frameP95Ms:at(samples,.95),frameMaxMs:at(samples,1),over25ms:samples.filter(t=>t>25).length,cpuRenderMedianMs:at(costs,.5),cpuRenderP95Ms:at(costs,.95),gpuDrawCalls:this.gpuAvailable?this.gpu.stats.drawCalls:0,stitches:this.gpuAvailable?this.gpu.stats.stitches:0},
        width: Math.round(this.width), height: Math.round(this.height), dpr: this.dpr,
        zoom: this.zoom, targetZoom:this.targetZoom, destroyed: this.destroyed
      };
    }

    destroy() {
      this.destroyed = true; this.cancelFrame();
      this.listeners.forEach(remove => remove());
      if (this.resizeObserver) this.resizeObserver.disconnect();
      if (this.intersectionObserver) this.intersectionObserver.disconnect();
      this.gpu?.destroy(); this.gpuCanvas?.remove(); this.labelSprites.clear();this.threadSprites.clear();
      this.canvas.style.cursor = ''; this.canvas.style.touchAction = '';
    }
  }
  window.AtlasConstellation = AtlasConstellation;
})();
