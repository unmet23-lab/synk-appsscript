(() => {
  'use strict';
  const data = window.ATLAS_DATA;
  const $ = id => document.getElementById(id);
  const labels = { core:'이해와 판단', strata:'배움의 지도', loom:'장면과 감각', vellum:'말과 반응', trail:'경험의 기억', prism:'집계와 발견', temper:'변화의 확인', reed:'목소리와 소리' };
  const state = { view:'explore', selected:null, scenario:null, step:0, paused:matchMedia('(prefers-reduced-motion: reduce)').matches };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let graph;
  let previewOwner=null,previewKind=null,previewId=null;
  const create = (tag, text, cls) => { const el=document.createElement(tag); if(text)el.textContent=text;if(cls)el.className=cls;return el; };
  function setThreadColor(element,engine) {
    const color=engine?.color||'#B9D8F2';
    element.style.setProperty('--thread',color);
    element.style.setProperty('--thread-rgb',[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)).join(','));
    element.style.setProperty('--thread-light',engine?.threadHighlight||'#E9F5FF');
    element.style.setProperty('--thread-shadow',engine?.threadShadow||'#52657F');
  }
  function engineSignal() {
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');svg.classList.add('engine-signal');
    const layers=[
      ['circle','signal-halo',{cx:12,cy:12,r:5.8}],
      ['circle','signal-orbit',{cx:12,cy:12,r:8.2}],
      ['path','signal-arc',{d:'M4.9 7.9A8.2 8.2 0 0 1 12 3.8'}],
      ['circle','signal-core',{cx:12,cy:12,r:2.3}],
      ['circle','signal-glint',{cx:11.5,cy:11.5,r:.8}]
    ];
    for(const [tag,name,attributes] of layers){const part=document.createElementNS(svg.namespaceURI,tag);part.setAttribute('class',name);for(const [key,value] of Object.entries(attributes))part.setAttribute(key,value);svg.append(part);}
    return svg;
  }
  function syncPreview(id) {
    previewId=data.engines.some(engine=>engine.id===id)?id:null;
    document.querySelectorAll('.engine-button,.related button[data-engine]').forEach(button=>button.classList.toggle('is-preview',button.dataset.engine===previewId));
  }
  function clearPreview() {
    previewOwner=null;previewKind=null;
    graph?.hoverEngine(null);syncPreview(null);
  }
  function bindEnginePreview(button,id) {
    const preview=kind=>{previewOwner=button;previewKind=kind;if(graph)graph.hoverEngine(id);else syncPreview(id);};
    button.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'||event.pointerType==='pen')preview('pointer');});
    button.addEventListener('pointerleave',()=>{
      if(previewOwner!==button||previewKind!=='pointer')return;
      const focused=document.activeElement;
      if(focused?.matches('.engine-button:focus-visible,.related button[data-engine]:focus-visible')) {
        previewOwner=focused;previewKind='keyboard';
        if(graph)graph.hoverEngine(focused.dataset.engine);else syncPreview(focused.dataset.engine);
      } else clearPreview();
    });
    button.addEventListener('pointerdown',()=>clearPreview());
    button.addEventListener('focus',()=>{if(button.matches(':focus-visible'))preview('keyboard');});
    button.addEventListener('blur',()=>{if(previewOwner===button)clearPreview();});
  }
  function flash() { $('inspector').classList.remove('flash'); requestAnimationFrame(()=>$('inspector').classList.add('flash')); }
  function updateDock() {
    $('observatory').dataset.detail=String(Boolean(state.selected)||state.view==='story');
    setThreadColor($('inspector'),data.engines.find(engine=>engine.id===state.selected));
    const related = new Set(data.relations.filter(r=>r.from===state.selected||r.to===state.selected).flatMap(r=>[r.from,r.to]));
    document.querySelectorAll('.engine-button').forEach(button=>{
      const active=button.dataset.engine===state.selected;
      button.setAttribute('aria-pressed',String(active));
      button.classList.toggle('is-related',!active&&related.has(button.dataset.engine));
    });
    syncPreview(previewId);
  }
  function selectEngine(id) {
    const restoreFocus=$('related').contains(document.activeElement);
    if(id==='atlas')id=null;
    if(id&&!data.engines.some(e=>e.id===id))return;
    clearPreview();
    state.selected=id; state.scenario=null; graph?.setScenario(null); graph?.select(id);
    if(state.view!=='explore')setView('explore');
    $('inspector').dataset.engine=id||'';
    const engine=data.engines.find(e=>e.id===id);
    $('detail-title').replaceChildren(); $('related').replaceChildren();
    if(engine) {
      $('panel-index').textContent=String(data.engines.indexOf(engine)+1).padStart(2,'0')+' / ENGINE CONNECTION';
      $('detail-title').append(create('span',engine.name,'engine-name'),document.createTextNode(engine.role));
      $('detail-description').textContent=engine.description;
      $('related').append(create('span','함께 연결되는 엔진','related-caption'));
      const peers=[...new Set(data.relations.filter(r=>r.from===id||r.to===id).map(r=>r.from===id?r.to:r.from))];
      peers.forEach(peer=>{const found=data.engines.find(e=>e.id===peer);const btn=create('button');btn.type='button';btn.dataset.engine=peer;setThreadColor(btn,found);btn.append(engineSignal(),document.createTextNode(found.name+' ↗'));const relation=data.relations.find(r=>(r.from===id&&r.to===peer)||(r.to===id&&r.from===peer));btn.title=relation.reason;btn.setAttribute('aria-label',found.name+' 연결 보기: '+relation.reason);bindEnginePreview(btn,peer);btn.addEventListener('click',()=>selectEngine(peer));$('related').append(btn);});
      $('stage-caption').textContent=engine.name.toUpperCase()+' / CONNECTED TO ATLAS';
    } else {
      $('panel-index').textContent='01 — 08 / CONNECTED SYSTEM';
      $('detail-title').textContent='연결이 경험이 되는 곳';
      $('detail-description').replaceChildren(document.createTextNode('각자의 역할을 가진 엔진들이 Atlas에서 만나 한 사람에게 맞는'),document.createElement('br'),document.createTextNode('경험으로 이어집니다.'));
      const start=create('button','Core부터 살펴보기 ↗','text-action');start.type='button';start.addEventListener('click',()=>selectEngine('core'));$('related').append(start);
      $('stage-caption').textContent='EIGHT ENGINES. ONE EXPERIENCE.';
    }
    updateDock();flash();
    if(restoreFocus&&id)$('engine-nav').querySelector(`[data-engine="${id}"]`)?.focus({preventScroll:true});
  }
  function setView(view) {
    clearPreview();
    state.view=view;
    $('observatory').dataset.detail=String(Boolean(state.selected)||view==='story');
    document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));
    $('explore-panel').hidden=view!=='explore';$('story-panel').hidden=view!=='story';
    $('inspector').dataset.engine=view==='explore'?(state.selected||''):'';
    if(view==='story') {
      if(!state.scenario)showPicker();
    } else { state.scenario=null;graph?.setScenario(null);graph?.select(state.selected); }
    flash();
  }
  function showPicker(returnFocus=false){
    clearPreview();
    const previous=state.scenario?.id;
    state.scenario=null;state.selected=null;graph?.select(null);graph?.setScenario(null);updateDock();
    $('scenario-picker').hidden=false;$('story-player').hidden=true;$('story-back').hidden=true;
    $('stage-caption').textContent='FROM CONNECTION TO EXPERIENCE.';
    if(returnFocus)$('scenario-picker').querySelector(previous?`[data-scenario="${previous}"]`:'button')?.focus({preventScroll:true});
  }
  function chooseScenario(scenario) {
    state.scenario=scenario;state.step=0;
    $('scenario-picker').hidden=true;$('story-player').hidden=false;$('story-back').hidden=false;
    $('story-name').textContent=scenario.title;
    $('story-progress').replaceChildren();
    for(let i=0;i<=scenario.steps.length;i++){
      const button=create('button');button.type='button';button.setAttribute('aria-label',i===scenario.steps.length?'마지막: 나에게 돌아오는 경험':`${i+1}단계: ${scenario.steps[i].label}`);
      setThreadColor(button,data.engines.find(engine=>engine.id===scenario.steps[i]?.engine));
      button.addEventListener('click',()=>{state.step=i;renderStep();});$('story-progress').append(button);
    }
    renderStep();
    $('next-step').focus({preventScroll:true});
  }
  function renderStep(){
    clearPreview();
    const scenario=state.scenario;const final=state.step===scenario.steps.length;
    $('story-step').replaceChildren();
    if(final){
      $('story-step').append(create('span','ATLAS → YOUR EXPERIENCE','story-step-label'),create('h3','나에게 돌아오는 경험'),create('p',scenario.result));
      state.selected=null;graph?.select(null);graph?.setScenario(scenario.engines);
      $('next-step').replaceChildren(document.createTextNode('다시 따라가기'),create('span','↻'));
    }else{
      const step=scenario.steps[state.step];const engine=data.engines.find(e=>e.id===step.engine);
      $('story-step').append(create('span',`${String(state.step+1).padStart(2,'0')} / ${engine.name.toUpperCase()}`,'story-step-label'),create('h3',step.label),create('p',step.description));
      state.selected=step.engine;graph?.setScenario(scenario.engines);graph?.select(step.engine);
      $('next-step').replaceChildren(document.createTextNode(state.step===scenario.steps.length-1?'경험으로 이어지기':'다음 연결'),create('span','→'));
    }
    [...$('story-progress').children].forEach((button,i)=>{if(i===state.step)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');button.classList.toggle('past',i<state.step);});
    $('stage-caption').textContent=final?'CONNECTED, AROUND YOU.':`EXPERIENCE PATH / ${String(state.step+1).padStart(2,'0')}`;
    updateDock();flash();
  }
  function syncMotion(){graph?.setPaused(state.paused);}
  data.engines.forEach((engine,index)=>{
    const button=create('button',null,'engine-button');button.type='button';button.dataset.engine=engine.id;button.setAttribute('aria-label',`${engine.name} · ${labels[engine.id]} 연결 보기`);button.setAttribute('aria-pressed','false');
    setThreadColor(button,engine);
    const ordinal=create('span',null,'ordinal mono');ordinal.append(engineSignal(),create('span',String(index+1).padStart(2,'0')));
    button.append(ordinal,create('strong',engine.name),create('small',labels[engine.id]));
    bindEnginePreview(button,engine.id);
    button.addEventListener('click',()=>selectEngine(state.view==='explore'&&state.selected===engine.id?null:engine.id));$('engine-nav').append(button);
  });
  data.scenarios.forEach((scenario,index)=>{
    const button=create('button',null,'scenario-card');button.type='button';button.dataset.scenario=scenario.id;const copy=create('span');copy.append(create('strong',scenario.title),create('small',scenario.subtitle));button.append(copy,create('span','↗'));button.addEventListener('click',()=>chooseScenario(scenario));$('scenario-picker').append(button);
  });
  try {graph=new window.AtlasConstellation($('constellation'),{engines:data.engines,relations:data.relations,onSelect:id=>selectEngine(id),onHover:syncPreview,getFocusEngine:()=>previewKind==='keyboard'&&previewOwner===document.activeElement&&previewOwner.matches(':focus-visible')?previewOwner.dataset.engine:null});syncMotion();}
  catch(error){console.error('Atlas visualization failed:',error);$('stage-caption').textContent='엔진 버튼으로 연결을 살펴보세요';}
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{setView(button.dataset.view);if(button.dataset.view==='explore')selectEngine(state.selected);}));
  $('start-exploring').addEventListener('click',()=>selectEngine('core'));
  $('story-back').addEventListener('click',()=>showPicker(true));
  $('next-step').addEventListener('click',()=>{state.step=state.step===state.scenario.steps.length?0:state.step+1;renderStep();});
  $('zoom-in').addEventListener('click',()=>graph?.zoomBy(1.15));$('zoom-out').addEventListener('click',()=>graph?.zoomBy(1/1.15));
  $('reset-view').addEventListener('click',()=>{graph?.reset();selectEngine(null);});
  reduced.addEventListener('change',event=>{state.paused=event.matches;syncMotion();});
  $('engine-nav').addEventListener('keydown',event=>{
    const buttons=[...$('engine-nav').querySelectorAll('button')];let i=buttons.indexOf(document.activeElement);if(i<0)return;
    if(event.key==='ArrowRight'||event.key==='ArrowDown')i=(i+1)%buttons.length;
    else if(event.key==='ArrowLeft'||event.key==='ArrowUp')i=(i-1+buttons.length)%buttons.length;
    else if(event.key==='Home')i=0;else if(event.key==='End')i=buttons.length-1;else return;
    event.preventDefault();buttons[i].focus();
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('about-dialog').open){graph?.reset();selectEngine(null);}});
  $('about-open').addEventListener('click',()=>$('about-dialog').showModal());
  $('about-close').addEventListener('click',()=>$('about-dialog').close());
  $('about-dialog').addEventListener('click',event=>{if(event.target===$('about-dialog')){const rect=$('about-dialog').getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)$('about-dialog').close();}});
  document.fonts.ready.then(()=>{if(graph&&!graph.destroyed){graph.labelSprites.clear();graph.requestDraw();}});
  window.addEventListener('blur',clearPreview);
  window.addEventListener('pagehide',event=>{if(!event.persisted)graph?.destroy();});
  window.atlasPreview={getState:()=>({...state,scenario:state.scenario?.id||null}),getSummary:()=>graph?.getSummary(),getHubPositions:()=>graph?.getHubPositions(),getFeaturePositions:()=>graph?.getFeaturePositions()};
})();
