(function () {
  'use strict';
  const D = window.MARKET_DATA, C = window.MarketCore, S = window.MARKET_SCHEMA, posts = window.MARKET_POSTS;
  const state = {filter:'all', spotlight:'automation', communityQuery:'', savedPosts:[], savedOnly:false, serviceMode:'all', sourcePost:null, draft:{category:'content',mode:'commission'}, review:null, sellerDraft:{category:'content',modes:[]}, sellerReview:null, saved:[], savedKey:null, workStep:0};
  const main = document.querySelector('main');
  const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const won = value => Number(value).toLocaleString('ko-KR') + '원';
  const cat = id => D.categories.find(x=>x.id===id)?.label || id;
  const lineTitle = value => e(value).replace(/\n/g,'<br>');
  const button = (label, route, kind='') => '<a class="button '+kind+'" href="#'+e(route)+'">'+e(label)+'</a>';
  const note = text => '<div class="notice">'+e(text)+'</div>';
  const selectOptions = (items,value) => items.map(x=>'<option value="'+e(x.id)+'"'+(x.id===value?' selected':'')+'>'+e(x.label)+'</option>').join('');
  const filters = () => '<div class="filters" role="group" aria-label="분야 선택">'+D.categories.map(x=>'<button type="button" class="filter" data-filter="'+x.id+'" aria-pressed="'+(state.filter===x.id)+'">'+x.label+'</button>').join('')+'</div>';
  const crumb = name => '<div class="breadcrumb"><a href="#home">발견</a> / '+e(name)+'</div>';
  const rows = items => '<div class="case-list">'+items.map((x,i)=>'<a class="case-row" href="#case/'+x.id+'"><span class="case-number" aria-hidden="true">0'+(i+1)+'</span><div><h3>'+e(x.title.replace('\n',' '))+'</h3><div class="meta"><span>'+cat(x.category)+'</span><span>동선 설명용 예시</span></div></div><span class="row-arrow" aria-hidden="true">↗</span></a>').join('')+'</div>';
  function offerRows(items) {
    if (!items.length) return '<div class="empty"><h3>이 분야의 예시 상품을 준비 중입니다.</h3>'+button('내 상황으로 요청서 쓰기','request')+'</div>';
    return items.map(o=>'<div class="offer-row"><div><div class="meta">'+cat(o.category)+' · '+e(D.modes[o.mode])+' · 예시 조건</div><a href="#offer/'+o.id+'"><h3>'+e(o.title)+'</h3></a><p class="small">'+e(D.sellers.find(s=>s.id===o.sellerId).name)+'</p></div><div class="offer-price"><div class="price">'+won(o.from)+'부터<span class="small">검토용 금액 · 실제 견적 아님</span></div>'+button('내용 보기','offer/'+o.id,'text')+'</div></div>').join('');
  }
  function home() {
    const feature=D.cases.find(x=>x.id===state.spotlight)||D.cases[2];
    const index=D.cases.indexOf(feature)+1;
    const teaser={content:'제품 사진으로 시작해 광고의 흐름을 만드는 과정.',education:'팀의 보고서를 실습하며 AI 활용법을 익히는 과정.',automation:'흩어진 문의를 모으고 담당자에게 연결하는 업무 흐름.'}[feature.id];
    return `<section class="home-intro"><div><div class="eyebrow">AI COMMUNITY & WORK</div><h1>경험을 나누고.<br><span>다음 일을 함께.</span></h1></div><div class="intro-action"><p>만든 과정을 읽고,<br>나에게 맞는 도움을 찾으세요.</p>${button('내 일 의뢰하기 ↗','request','primary')}</div></section>
    <section class="experience-desk" aria-label="사례에서 시작하기"><div class="desk-bar"><span>지금 내 일과 닮은 사례는?</span><span class="small">예시 프로젝트 3</span></div><div class="desk-tabs" role="group" aria-label="사례 골라 보기">${D.cases.map((x,i)=>`<button type="button" data-spotlight="${x.id}" aria-pressed="${feature.id===x.id}"><span>0${i+1}</span>${cat(x.category)}<i aria-hidden="true">↗</i></button>`).join('')}</div>
    <div class="desk-content"><article class="case-sheet"><div class="sheet-index" aria-hidden="true">0${index}</div><div class="sheet-text"><div class="eyebrow">${e(feature.subtitle)}</div><h2>${lineTitle(feature.title)}</h2><p>${e(teaser)}</p><a class="sheet-link" href="#case/${feature.id}">이 사례의 과정 읽기 <span aria-hidden="true">↗</span></a></div></article><div class="desk-next"><span class="eyebrow">이 경험을 내 일로</span><a class="choice-link" href="#request" data-seed="${feature.id}" data-mode="commission"><div><strong>만든 사람에게 맡기기</strong><small>내 조건을 담은 요청서로</small></div><span>↗</span></a><a class="choice-link" href="#request" data-seed="${feature.id}" data-mode="learn"><div><strong>직접 하는 법 배우기</strong><small>실습과 코칭으로</small></div><span>↗</span></a><a class="choice-link" href="#services" data-service-category="${feature.category}"><div><strong>관련 자료·서비스 찾기</strong><small>구성·가격·사용권 비교</small></div><span>↗</span></a></div></div></section>`+
    '<div class="section-head"><h2>내 일과 닮은 사례</h2><p>실제 거래 전 흐름을 확인하는 예시 3개</p></div>'+filters()+rows(D.cases.filter(x=>state.filter==='all'||x.category===state.filter))+
    '<div class="section-head"><div><h2>잘한 일도, 막힌 일도.</h2><p style="margin-top:12px;max-width:none;text-align:left">작업의 과정을 공유하면 다음 사람의 출발점이 됩니다.</p></div>'+button('커뮤니티 보기','community','text')+'</div>';
  }
  function community() {
    const terms=state.communityQuery.trim().toLocaleLowerCase('ko-KR').split(/\s+/).filter(Boolean);
    const items=posts.items.filter(x=>(state.filter==='all'||x.category===state.filter)&&(!state.savedOnly||state.savedPosts.includes(x.id))&&terms.every(t=>[x.title,x.problem,x.body,x.relatedOfferProposal].join(' ').toLocaleLowerCase('ko-KR').includes(t)));
    return '<div class="page-intro"><div class="eyebrow">과정을 읽는 커뮤니티</div><h1>내 일의 실마리를<br>다른 사람의 경험에서.</h1><p>관심 있는 과정을 읽고 모아 보세요. 더 배우거나 도움을 받고 싶을 때 관련 서비스를 살펴볼 수 있습니다.</p></div>'+note('기존 제작 기록을 정리한 원고 20편입니다. 공개 전 초안이며, 고객 후기나 실제 입점 판매자의 글은 아닙니다.')+
    '<form id="community-search" role="search" aria-label="커뮤니티 원고 검색"><label class="field" for="community-query"><span>어떤 작업이 궁금하세요?</span><input id="community-query" name="query" type="search" maxlength="160" placeholder="예: 퀴즈, 자막, 광고" value="'+e(state.communityQuery)+'"></label><button class="button primary" type="submit">검색</button></form>'+filters()+
    '<div class="community-tools"><button class="button compact" type="button" data-action="saved-posts" aria-pressed="'+state.savedOnly+'">관심 글만 보기 ('+state.savedPosts.length+')</button><button class="button compact" type="button" data-action="reset-community">검색·필터 초기화</button><span class="small">관심 글은 이 창을 새로고침하기 전까지 유지됩니다.</span></div><p class="search-count" id="community-results" tabindex="-1" role="status">'+(state.communityQuery?'“'+e(state.communityQuery)+'” · ':'')+cat(state.filter)+' · '+(state.savedOnly?'관심 글 ':'')+items.length+'편</p>'+
    items.map((x,i)=>'<article class="draft-row"><span class="muted" aria-hidden="true">'+String(i+1).padStart(2,'0')+'</span><div><div class="meta">'+cat(x.category)+' · 제작 기록 '+e(x.sourceSection)+'</div><h3>'+e(x.title)+'</h3><p>'+e(x.problem)+'</p></div><div class="draft-actions"><button class="button compact" type="button" data-post="'+x.id+'">원고 읽기</button>'+savePostButton(x)+'</div></article>').join('')+
    (items.length?'':'<div class="empty"><h3>조건에 맞는 원고가 없어요.</h3><p>검색어를 줄이거나 분야·관심 글 필터를 바꿔 보세요. 자동화·개발 분야의 실제 기록 원고는 아직 없습니다.</p><button class="button" type="button" data-action="reset-community">전체 원고 보기</button></div>');
  }
  function savePostButton(p) {
    const saved=state.savedPosts.includes(p.id);
    return '<button class="button compact" type="button" data-save-post="'+p.id+'" aria-pressed="'+saved+'" aria-label="'+e(p.title)+' 관심 글 '+(saved?'해제':'담기')+'">'+(saved?'관심 글 해제':'관심 글 담기')+'</button>';
  }
  function openPost(id) {
    const p=posts.items.find(x=>x.id===id);if(!p)return;
    document.getElementById('dialog-body').innerHTML='<article class="dialog-body"><div class="eyebrow">게시 초안 · '+e(p.sourceSection)+'</div><h2 id="dialog-title">'+e(p.title)+'</h2><p>'+e(p.problem)+'</p><p>'+e(p.body)+'</p><dl><div><dt>기록으로 확인한 범위</dt><dd>'+e(p.verifiedResult)+'</dd></div><div><dt>한계·공개 전 확인</dt><dd>'+e(p.limitation)+'</dd></div><div><dt>함께 이야기할 질문</dt><dd>'+e(p.discussionQuestion)+'</dd></div><div><dt>출처</dt><dd>'+e(p.source)+' · '+e(p.sourceSection)+'</dd></div></dl><section class="post-next" aria-label="이 주제에서 이어가기"><h3>이 작업을 내 일에 적용한다면</h3><p>연결을 검토할 주제: '+e(p.relatedOfferProposal)+'</p><div class="post-choices">'+[['learn','직접 배우기'],['digital','자료 찾아보기'],['commission','제작자 서비스 보기']].map(([mode,label])=>'<a class="button" href="#services" data-post-services="'+p.id+'" data-mode="'+mode+'">'+label+'</a>').join('')+'</div><p class="small">같은 분야의 합성 상품을 보는 동선 예시입니다. 이 원고 작성자의 실제 상품·판매 이력으로 연결된 것은 아닙니다.</p>'+savePostButton(p)+'</section><p class="small">이번 작업에서는 미디어를 다시 재생 검증하지 않았습니다. 실제 고객 후기나 게시 완료 자료가 아닙니다.</p></article>';
    document.getElementById('article-dialog').showModal();
  }
  function services() {
    const source=posts.items.find(p=>p.id===state.sourcePost);
    const modes=[{id:'all',label:'모든 도움'},...Object.entries(D.modes).map(([id,label])=>({id,label}))];
    const items=D.offers.filter(o=>(state.filter==='all'||o.category===state.filter)&&(state.serviceMode==='all'||o.mode===state.serviceMode));
    return '<div class="page-intro"><div class="eyebrow">필요한 결과로 고르기</div><h1>맡기고, 배우고,<br>직접 써 보세요.</h1><p>포함 내용과 사용 조건을 먼저 살펴보세요. 실제 판매 중인 상품이 아닌 검토용 예시입니다.</p></div>'+(source?'<div class="notice source-context"><strong>읽던 원고: '+e(source.title)+'</strong><p>같은 분야의 서비스를 둘러보고 있습니다. 원고 작성자의 실제 판매 상품은 아닙니다.</p><button class="button compact" type="button" data-post="'+source.id+'">원고 다시 읽기</button></div>':'')+filters()+'<div class="filters" role="group" aria-label="도움 방식">'+modes.map(m=>'<button class="filter" type="button" data-service-mode="'+m.id+'" aria-pressed="'+(state.serviceMode===m.id)+'">'+e(m.label)+'</button>').join('')+'</div><p class="search-count" id="service-results" tabindex="-1" role="status">'+cat(state.filter)+' · '+e(modes.find(m=>m.id===state.serviceMode).label)+' · '+items.length+'개 예시</p>'+(items.length?offerRows(items):'<div class="empty"><h3>이 조건의 예시 상품은 아직 없어요.</h3><p>다른 도움 방식이나 분야를 골라 보세요.</p><button class="button" type="button" data-action="reset-services">모든 예시 상품 보기</button></div>');
  }
  function casePage(id) {
    const x=D.cases.find(x=>x.id===id); if(!x)return missing();
    const seller=D.sellers.find(s=>s.id===x.sellerId);
    return crumb(x.subtitle)+'<div class="split"><article><div class="case-hero '+x.theme+'"><span class="small">'+cat(x.category)+' · 가상 프로젝트</span><h1>'+lineTitle(x.title)+'</h1><span>'+e(x.result)+'</span></div><div class="prose"><h2>처음의 문제</h2><p>'+e(x.problem)+'</p><h2>이렇게 진행하는 예시예요</h2><ol>'+x.process.map(t=>'<li>'+e(t)+'</li>').join('')+'</ol><h2>확인할 범위</h2><p>'+e(x.limit)+'</p><p>실제 사례에서는 입력 자료, 직접 맡은 역할, 납품 증거와 공개 허락을 확인해 이 자리를 채웁니다.</p></div></article>'+
    '<aside class="aside-box"><span class="eyebrow">내 상황에 맞게 이어가기</span><h3>같은 결과가 필요하다면</h3><a class="choice-link" href="#request" data-seed="'+x.id+'" data-mode="commission"><div><strong>맞춤 의뢰하기</strong><small>내 조건으로 요청서 작성</small></div><span>↗</span></a><a class="choice-link" href="#request" data-seed="'+x.id+'" data-mode="learn"><div><strong>직접 배우기</strong><small>실습·코칭 범위 정하기</small></div><span>↗</span></a><a class="choice-link" href="#services" data-service-category="'+x.category+'"><div><strong>관련 자료·서비스 보기</strong><small>포함 내용과 사용 조건 비교</small></div><span>↗</span></a><p class="small">이 시범판에서는 결제·상담을 접수하지 않습니다.</p><hr style="border:0;border-top:1px solid var(--line)"><a href="#seller/'+seller.id+'"><strong>'+e(seller.name)+'</strong><br><span class="small">제작자 예시 프로필 보기 ↗</span></a></aside></div>';
  }
  function sellerPage(id) {
    const s=D.sellers.find(s=>s.id===id);if(!s)return missing();
    return crumb('제작자')+'<div class="profile-banner"><div class="avatar" aria-hidden="true">'+e(id.slice(-1).toUpperCase())+'</div><div><div class="eyebrow">'+cat(s.category)+' · 합성 프로필</div><h1>'+e(s.name)+'</h1></div></div><div class="split"><div class="prose"><p>'+e(s.description)+'</p>'+note('실제 입점한 사람이 아닙니다. 후기·판매 실적·자격 인증을 표시하지 않습니다.')+'<h2>제공하는 도움</h2>'+offerRows(D.offers.filter(o=>o.sellerId===id))+'<h2>연결되는 사례</h2>'+rows(D.cases.filter(x=>x.sellerId===id))+'</div><aside class="aside-box"><h3>확인하면 좋은 것</h3><ul class="detail-list"><li>직접 만든 부분과 공동 작업</li><li>가능한 일정·동시 작업 여력</li><li>수정·사용권·추가 비용</li></ul>'+button('내 일 설명하기','request','primary')+'</aside></div>';
  }
  function offerPage(id) {
    const o=D.offers.find(o=>o.id===id);if(!o)return missing();
    return crumb('서비스 상세')+'<div class="page-intro"><div class="eyebrow">'+cat(o.category)+' · '+e(D.modes[o.mode])+' · 예시 상품</div><h1>'+e(o.title)+'</h1><p>구매 전에 받는 것과 받지 않는 것을 같은 자리에서 확인합니다.</p></div><div class="split"><article class="prose"><h2>포함하는 것</h2><ul>'+o.included.map(t=>'<li>'+e(t)+'</li>').join('')+'</ul><h2>별도로 정할 것</h2><ul>'+o.excluded.map(t=>'<li>'+e(t)+'</li>').join('')+'</ul><h2>완료 확인</h2><p>'+e(o.acceptance)+'</p><h2>사용권</h2><p>'+e(o.rights)+'</p><h2>취소·환불</h2><p>제공 시작 여부·제공된 부분·합의한 결과와의 차이를 확인합니다. 실제 거래에는 법정 권리와 유형별 약정이 적용되며, 이 시범 조건은 계약이 아닙니다.</p></article><aside class="aside-box"><span class="tag">가격 가설 · 구매 불가</span><div class="price">'+won(o.from)+'부터</div><p>'+ (o.days?'최소 준비 기간 '+o.days+'일의 예시':'다운로드 상품의 예시')+'</p><p class="small">총액·세금 표시·일정·추가 비용은 실제 견적에서 확정합니다.</p><a class="button primary" href="#request" data-offer="'+o.id+'">이 조건으로 요청서 써 보기</a>'+button('제작자 보기','seller/'+o.sellerId,'text')+'</aside></div>';
  }
  function field(id,label,control,hint='',errors={}) {
    return '<label class="field" for="'+id+'"><span>'+e(label)+'</span>'+control+(hint?'<span class="hint">'+e(hint)+'</span>':'')+(errors[id]?'<span class="error" id="'+id+'-error">'+e(errors[id])+'</span>':'')+'</label>';
  }
  const attrs = (id,errors) => ' id="'+id+'" name="'+id+'"'+(errors[id]?' aria-invalid="true" aria-describedby="'+id+'-error"':'');
  const errorSummary = errors => Object.keys(errors).length?'<div class="error-summary" role="alert" tabindex="-1" id="errors">입력 내용을 확인해 주세요. '+e(Object.values(errors).join(' '))+'</div>':'';
  function requestPage(errors={}) {
    if(state.review)return requestReview();
    const v=state.draft;
    return '<div class="form-shell"><div class="page-intro"><div class="eyebrow">01 작성 / 02 후보 비교</div><h1>어떤 일을<br>해결하고 싶으세요?</h1><p>도구 이름보다, 필요한 결과부터.</p></div><p class="form-context">예시로 작성해 주세요. 실제 개인정보·고객 자료는 넣지 않습니다. 초안은 내려받기로 보관할 수 있습니다.</p>'+
    '<form id="request-form" novalidate>'+errorSummary(errors)+'<div class="form-grid">'+field('category','분야 · 필수','<select'+attrs('category',errors)+'>'+selectOptions(D.categories.filter(x=>x.id!=='all'),v.category)+'</select>','',errors)+
    field('mode','원하는 도움 · 필수','<select'+attrs('mode',errors)+'>'+selectOptions(Object.entries(D.modes).map(([id,label])=>({id,label})),v.mode)+'</select>','',errors)+'</div>'+
    field('goal','지금 해결하고 싶은 일 · 필수','<textarea'+attrs('goal',errors)+' maxlength="1000" placeholder="예: 문의를 매번 시트에 옮기다 보니 빠뜨리는 일이 생겨요.">'+e(v.goal)+'</textarea>','구체적인 상황을 10자 이상 적어 주세요.',errors)+
    field('deliverable','완료되면 무엇을 받고 싶나요? · 필수','<textarea'+attrs('deliverable',errors)+' maxlength="500" placeholder="예: 문의가 시트에 기록되고 담당자에게 알림이 오는 흐름">'+e(v.deliverable)+'</textarea>','결과물·분량·완료 기준을 5자 이상 적어 주세요.',errors)+
    field('currentMethod','현재 쓰는 방법 · 선택','<textarea'+attrs('currentMethod',errors)+' maxlength="1000">'+e(v.currentMethod)+'</textarea>','현재 도구·담당자·불편한 점',errors)+
    '<div class="form-grid">'+field('budgetMax','예산 상한 · 선택','<input'+attrs('budgetMax',errors)+' type="number" min="1" max="1000000000" step="1" inputmode="numeric" value="'+e(v.budgetMax)+'" placeholder="예: 1000000">','원 단위. 비우면 상담 후 결정합니다.',errors)+
    field('deadline','필요한 날짜 · 선택','<input'+attrs('deadline',errors)+' type="date" min="'+C.today()+'" value="'+e(v.deadline)+'">','비우면 일정 협의로 표시합니다.',errors)+'</div>'+
    field('constraints','꼭 지켜야 할 조건 · 선택','<textarea'+attrs('constraints',errors)+' maxlength="1000" placeholder="사용할 매체, 연동 도구, 보안·권리 조건 등">'+e(v.constraints)+'</textarea>','조건은 사람이 검토하며 자동 추천만으로 수용이 확정되지 않습니다.',errors)+
    field('reference','참고 링크 · 선택','<input'+attrs('reference',errors)+' type="url" value="'+e(v.reference)+'" placeholder="https://...">','공개해도 되는 링크만 적어 주세요.',errors)+
    '<label class="check"><input type="checkbox" name="shareWithCandidates"'+(v.shareWithCandidates?' checked':'')+'><span>실제 운영에서, 확인한 요청 요약을 참여한 후보에게 공유하는 방식에 동의합니다. <small>이 화면은 전송하지 않습니다.</small></span></label>'+
    '<label class="check"><input type="checkbox" name="publishCase"'+(v.publishCase?' checked':'')+'><span>완료 뒤 공개 사례 제안을 받아보고 싶어요. <small>선택</small></span></label>'+
    '<div class="form-actions"><button class="button primary" type="submit">요청서 검토하기 →</button><button class="button" type="button" data-action="request-sample">예시로 채우기</button></div></form></div>';
  }
  function requestReview() {
    const v=state.review, result=C.matchRequest(v,D.sellers);
    return crumb('요청서 검토')+'<div class="page-intro"><div class="eyebrow">2. 요약과 후보 확인</div><h1>이렇게 이해했어요.</h1><p>조건과 다른 부분을 고친 뒤 초안으로 보관하세요. 아래는 합성 판매자 데이터로 비교한 결과입니다.</p></div><div class="split"><div><dl class="summary-dl">'+
    [['분야·도움',cat(v.category)+' · '+D.modes[v.mode]],['해결할 일',v.goal],['받고 싶은 결과',v.deliverable],['예산',v.budgetMax===null?'상담 후 결정':won(v.budgetMax)+' 이내'],['필요한 날짜',v.deadline||'일정 협의'],['추가 조건',v.constraints||'없음'],['후보 공유',v.shareWithCandidates?'요약 확인 후 공유하는 방식에 동의 · 실제 발송 없음':'공유 선택 전 · 초안으로만 보관']].map(([k,val])=>'<div><dt>'+e(k)+'</dt><dd>'+e(val)+'</dd></div>').join('')+'</dl>'+
    '<div class="section-head"><h2>조건을 비교할 후보</h2><span class="tag">최대 3곳 · 예시</span></div>'+
    (result.matches.length?result.matches.map(m=>'<article class="candidate"><div class="candidate-head"><a href="#seller/'+m.seller.id+'"><h3>'+e(m.seller.name)+'</h3></a><div class="price">'+won(m.terms.from)+'부터</div></div><strong>맞는 조건</strong><ul>'+m.reasons.map(t=>'<li>'+e(t)+'</li>').join('')+'</ul><strong>추가로 확인할 것</strong><ul class="questions">'+m.questions.map(t=>'<li>'+e(t)+'</li>').join('')+'</ul></article>').join(''):'<div class="empty"><h3>지금 조건에 맞는 예시 후보가 없어요.</h3><p>예산·기한·제공 방식을 확인해 주세요. 실제 운영에서는 운영자가 조정 가능한 조건을 함께 정리합니다.</p><button class="button" data-action="edit-request" type="button">조건 수정하기</button></div>')+
    '</div><aside class="aside-box"><h3>아직 발송하지 않았어요.</h3><p>실제 운영에서는 연락 방법과 공유 동의를 확인한 후 운영자가 후보의 가용 일정을 확인합니다.</p><button class="button primary" type="button" data-action="save-request">'+(state.savedKey?'저장한 초안 보기':'내 작업에 초안 보관')+'</button><button class="button" type="button" data-action="export-request">요청서 JSON 내려받기</button><button class="button text" type="button" data-action="edit-request">내용 수정하기</button><p class="small">이 창 안에서만 보관됩니다. 새로고침 전에 내려받으세요.</p></aside></div>';
  }
  function sellerForm(errors={}) {
    if(state.sellerReview) return '<div class="form-shell">'+crumb('판매자 등록 초안')+'<div class="page-intro"><h1>검토할 내용이 모였어요.</h1><p>실제 등록이나 입점 승인은 이루어지지 않았습니다. 이 초안을 보관한 뒤 참여·작업 증거·신원·약정을 확인합니다.</p></div><div class="success"><h3>'+e(state.sellerReview.displayName)+'</h3><p>'+e(state.sellerReview.offer)+'</p></div><div class="form-actions"><button class="button primary" type="button" data-action="export-seller">등록서 JSON 내려받기</button><button class="button" type="button" data-action="edit-seller">수정하기</button></div></div>';
    const v=state.sellerDraft;
    return '<div class="form-shell">'+crumb('판매자로 참여하기')+'<div class="page-intro"><div class="eyebrow">경험을 나누고, 필요한 사람과 연결되기</div><h1>어떤 일을<br>도울 수 있나요?</h1><p>직접 한 작업과 제공할 수 있는 범위를 알려 주세요. 실제 판매 활성화에는 별도 확인이 필요합니다.</p></div>'+note('등록 양식 시범판입니다. 실제 이름·연락처·정산 정보를 넣지 마세요.')+
    '<form id="seller-form" novalidate>'+errorSummary(errors)+field('displayName','활동 이름 · 필수','<input'+attrs('displayName',errors)+' value="'+e(v.displayName)+'" maxlength="60">','',errors)+
    field('category','대표 분야 · 필수','<select'+attrs('category',errors)+'>'+selectOptions(D.categories.filter(x=>x.id!=='all'),v.category)+'</select>','',errors)+
    '<fieldset><legend>제공 방식 · 하나 이상</legend><div class="check-row">'+Object.entries(D.modes).map(([id,label])=>'<label class="check"><input name="modes" type="checkbox" value="'+id+'"'+(v.modes.includes(id)?' checked':'')+'><span>'+label+'</span></label>').join('')+'</div>'+(errors.modes?'<span class="error">'+e(errors.modes)+'</span>':'')+'</fieldset>'+
    field('offer','제공하는 결과와 맡는 범위 · 필수','<textarea'+attrs('offer',errors)+' maxlength="1000">'+e(v.offer)+'</textarea>','10자 이상',errors)+
    field('workUrl','직접 작업한 사례 링크 · 필수','<input'+attrs('workUrl',errors)+' type="url" value="'+e(v.workUrl)+'" placeholder="https://...">','',errors)+
    field('role','이 사례에서 직접 맡은 역할 · 필수','<textarea'+attrs('role',errors)+' maxlength="1000">'+e(v.role)+'</textarea>','공동 제작·외주·생성 AI 사용 부분도 구분해 주세요.',errors)+
    field('priceFrom','가격 기준·견적 방식 · 필수','<input'+attrs('priceFrom',errors)+' maxlength="500" value="'+e(v.priceFrom)+'">','세금·추가 비용·별도 견적 범위를 구분합니다.',errors)+
    field('availability','가능 일정·작업 여력 · 필수','<input'+attrs('availability',errors)+' maxlength="500" value="'+e(v.availability)+'">','',errors)+
    '<label class="check"><input type="checkbox" name="participation"'+(v.participation?' checked':'')+'><span>조건을 확인하는 참여 인터뷰를 검토하고 싶어요. 실제 등록·계약 동의와는 별도입니다.</span></label>'+(errors.participation?'<span class="error">'+e(errors.participation)+'</span>':'')+
    '<div class="form-actions"><button class="button primary" type="submit">등록서 검토하기 →</button><button class="button" type="button" data-action="seller-sample">예시로 채우기</button></div></form></div>';
  }
  function work() {
    const stages=['범위·견적 합의','제공·작업 진행','납품·검수','완료·후기 선택'];
    return '<div class="page-intro"><div class="eyebrow">이 창에서 작성한 내용</div><h1>내 작업</h1><p>초안과 실제 접수·계약 상태를 구분합니다. 이 시범판에서는 실제 거래가 생기지 않습니다.</p></div>'+
    (state.saved.length?state.saved.map(x=>'<article class="work-item"><div><span class="tag">로컬 초안 '+e(x.id)+'</span><h3 style="margin-top:14px">'+e(x.value.goal)+'</h3><p>'+cat(x.value.category)+' · '+D.modes[x.value.mode]+' · 발송 전</p></div><button class="button" type="button" data-open-draft="'+x.id+'">초안 열기</button></article>').join(''):'<div class="empty"><h3>작성한 초안이 아직 없어요.</h3><p>필요한 결과를 적고 검토 화면에서 초안을 보관하세요.</p>'+button('요청서 써 보기','request','primary')+'</div>')+
    '<div class="section-head"><h2>계약 이후의 화면 예시</h2><span class="tag">가상 주문</span></div><div class="milestones">'+stages.map((x,i)=>'<div class="'+(i===state.workStep?'current':'')+'">'+(i+1)+'. '+x+'</div>').join('')+'</div><div class="aside-box" style="position:static"><h3>'+stages[state.workStep]+'</h3><p>'+['산출물·총액·기한·수정·사용권을 같은 제안서에서 확인합니다.','진행 상황과 질문을 남기고, 범위 변경은 양측이 확인합니다.','납품본을 약속한 기준과 비교하고, 보완이 필요하면 근거를 적습니다.','구매 확정과 지급 결과를 구분합니다. 후기와 작업 공개는 선택입니다.'][state.workStep]+'</p><div class="inline-actions"><button class="button" type="button" data-action="previous-step"'+(state.workStep===0?' disabled':'')+'>이전 단계</button><button class="button" type="button" data-action="next-step"'+(state.workStep===3?' disabled':'')+'>다음 단계 예시 →</button></div></div>';
  }
  const economyDefaults={orderValue:1000000,orders:30,commission:12,paymentRate:3.5,support:15000,lossRate:1,acquisition:0,fixed:3000000};
  let economy={...economyDefaults};
  function calculationResult() {
    const r=C.economics(economy);
    if(!r.valid)return '<div class="error-summary" role="alert">'+e(r.error)+'</div>';
    return '<div class="metrics"><div class="metric'+(r.contribution<0?' negative':'')+'"><small>건당 공헌이익</small><strong>'+won(r.contribution)+'</strong></div><div class="metric'+(r.operatingResult<0?' negative':'')+'"><small>월 운영 손익</small><strong>'+won(r.operatingResult)+'</strong></div></div><div class="calc-breakdown"><div><span>건당 수수료 매출</span><strong>'+won(r.fee)+'</strong></div><div><span>건당 결제·지급 비용</span><span>− '+won(r.payment)+'</span></div><div><span>건당 운영·획득·손실 비용</span><span>− '+won(economy.support+economy.acquisition+r.loss)+'</span></div><div><span>같은 조건의 손익분기 거래</span><strong>'+(r.breakEven===null?'현재 조건으로 불가능':r.breakEven+'건 / 월')+'</strong></div></div><p class="small">환불되지 않은 완료 거래·부가세 제외 관리 손익. 계획값이며 실제 견적·매출 전망이 아닙니다. 취소 주문 대응 원가와 유형별 차이는 별도 측정합니다.</p>';
  }
  function ops() {
    const inputs=[['orderValue','완료 거래액 / 건 (원)',1,1],['orders','월 완료 거래 (건)',0,1],['commission','수수료율 (%)',0,.1],['paymentRate','결제·지급 비용률 (%)',0,.1],['support','건당 운영 원가 (원)',0,1000],['lossRate','회수 불가 비용률 (%)',0,.1],['acquisition','건당 고객 획득비 (원)',0,1000],['fixed','월 고정비 (원)',0,10000]];
    const checks=[['요청과 공유 동의','결과물·예산·기한의 빠진 정보를 확인하고, 후보에게 보낼 내용은 요청자의 동의를 받습니다.'],['판매자의 작업과 일정','직접 수행한 역할, 참여 의사, 현재 가능한 일정을 각각 확인합니다.'],['가격·기한·권리 조건','맞지 않는 조건은 제외 사유로 기록하고, 미확인 조건은 제안서에서 확인합니다.'],['신고·미응답·정산 보류','이유와 증거, 담당자, 다음 확인 시점을 기록하고 당사자의 설명을 받습니다.']];
    return '<div class="page-intro ops-intro"><div class="eyebrow">운영 준비</div><h1>첫 거래를 준비하는 일.</h1></div><div class="ops-grid"><section><h2>출시 준비 상태</h2><ul class="status-list"><li><span>요청·판매자 등록 양식</span><strong>시범판</strong></li><li><span>실제 구매자 인터뷰</span><strong class="pending">0건 · 발송 보류</strong></li><li><span>실제 판매자 참여 확정</span><strong class="pending">0곳 · 발송 보류</strong></li><li><span>콘텐츠 소개 원고</span><strong>20편 · 공개 검토 전</strong></li><li><span>정책·계약</span><strong class="pending">초안</strong></li><li><span>PG·실제 정산</span><strong class="pending">미연동</strong></li></ul><h3>운영 검토 항목</h3><div class="ops-checks">'+checks.map(([title,body])=>'<details><summary>'+e(title)+'<span aria-hidden="true">+</span></summary><p>'+e(body)+'</p></details>').join('')+'</div><div class="form-actions"><button class="button" type="button" data-action="export-schema">전체 양식 정의 내려받기</button>'+button('원고 20편 검토','community')+'</div></section><section class="calculator"><div class="calculator-head"><h2>거래가 남기는 돈</h2><span class="small">완료 거래 · 계획값</span></div><div id="calculation-result" aria-live="polite">'+calculationResult()+'</div><form id="calculator-form" class="cost-inputs"><div class="cost-caption">계산 조건 바꾸기</div>'+inputs.map(([id,label])=>field('calc-'+id,label,'<input id="calc-'+id+'" name="'+id+'" type="text" inputmode="decimal" autocomplete="off" value="'+(Number.isFinite(economy[id])?economy[id].toLocaleString('ko-KR'):'')+'">')).join('')+'</form></section></div>';
  }
  function missing(){return '<div class="empty"><h1>화면을 찾을 수 없어요.</h1>'+button('처음으로','home')+'</div>';}
  function render({focus=false}={}) {
    const [route,id]=(location.hash.slice(1)||'home').split('/');
    document.body.classList.toggle('form-mode',['request','seller-apply'].includes(route));
    document.body.dataset.route=route;
    const pages={home,community,services,case:()=>casePage(id),seller:()=>sellerPage(id),offer:()=>offerPage(id),request:requestPage,'seller-apply':sellerForm,work,ops};
    main.innerHTML=(pages[route]||missing)();
    document.querySelectorAll('[data-nav]').forEach(a=>{if(a.dataset.nav===route)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    if(focus){window.scrollTo(0,0);main.focus({preventScroll:true});}
  }
  function toast(message){const t=document.getElementById('toast');t.textContent=message;t.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>{t.hidden=true;},3500);}
  function download(name,data) {
    const payload={artifactType:'prototype_draft',transmitted:false,createdAt:new Date().toISOString(),data};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    toast('JSON 파일 내려받기를 요청했습니다. 실제 접수는 하지 않았습니다.');
  }
  function navigate(route){if(location.hash==='#'+route)render({focus:true});else location.hash=route;}
  function captureForm(form) {
    const fd=new FormData(form), v=Object.fromEntries(fd);
    if(form.id==='request-form'){
      state.draft={...C.normalizeRequest(v),sourceCase:state.draft.sourceCase||''};
    } else if(form.id==='seller-form')state.sellerDraft={...v,modes:fd.getAll('modes'),participation:fd.has('participation')};
  }
  document.addEventListener('input',event=>{
    const form=event.target.closest('form');if(!form)return;
    if(form.id==='calculator-form'){
      const fd=new FormData(form);economy=Object.fromEntries([...fd].map(([k,v])=>[k,C.parseNumericInput(v)]));
      document.getElementById('calculation-result').innerHTML=calculationResult();
    } else captureForm(form);
  });
  document.addEventListener('focusout',event=>{if(event.target.closest('#calculator-form')&&event.target.matches('input')){const n=C.parseNumericInput(event.target.value);if(Number.isFinite(n))event.target.value=n.toLocaleString('ko-KR',{maximumFractionDigits:12});}});
  document.addEventListener('change',event=>{const f=event.target.closest('form');if(f&&f.id!=='calculator-form')captureForm(f);});
  document.addEventListener('submit',event=>{
    event.preventDefault();const f=event.target;captureForm(f);
    if(f.id==='community-search'){
      state.communityQuery=String(new FormData(f).get('query')||'').trim();render();document.getElementById('community-results').focus();return;
    }
    if(f.id==='request-form'){
      const result=C.validateRequest(state.draft);
      if(result.valid){state.review=result.value;state.savedKey=null;render({focus:true});}
      else{main.innerHTML=requestPage(result.errors);document.getElementById('errors').focus();}
    }
    if(f.id==='seller-form'){
      const result=C.validateSeller(state.sellerDraft);
      if(result.valid){state.sellerReview=result.value;render({focus:true});}
      else{main.innerHTML=sellerForm(result.errors);document.getElementById('errors').focus();}
    }
  });
  document.addEventListener('click',event=>{
    if(event.target.closest('.skip')){event.preventDefault();main.focus();return;}
    const el=event.target.closest('[data-filter],[data-action],[data-post],[data-seed],[data-offer],[data-service-category],[data-open-draft],[data-spotlight],[data-save-post],[data-post-services],[data-service-mode]');if(!el)return;
    if(el.dataset.spotlight){state.spotlight=el.dataset.spotlight;const y=scrollY;render();window.scrollTo(0,y);document.querySelector('[data-spotlight="'+state.spotlight+'"]').focus({preventScroll:true});return;}
    if(el.dataset.filter){state.filter=el.dataset.filter;if(document.body.dataset.route==='services')state.sourcePost=null;const y=scrollY;render();window.scrollTo(0,y);document.querySelector('[data-filter="'+state.filter+'"]').focus({preventScroll:true});return;}
    if(el.dataset.serviceMode){state.serviceMode=el.dataset.serviceMode;const y=scrollY;render();window.scrollTo(0,y);document.querySelector('[data-service-mode="'+state.serviceMode+'"]').focus({preventScroll:true});return;}
    if(el.dataset.savePost){
      const p=posts.items.find(p=>p.id===el.dataset.savePost);if(!p)return;
      const saved=state.savedPosts.includes(p.id);state.savedPosts=saved?state.savedPosts.filter(id=>id!==p.id):[...state.savedPosts,p.id];
      const dialog=document.getElementById('article-dialog');
      if(document.body.dataset.route==='community'){const y=scrollY;render();window.scrollTo(0,y);if(!dialog.open)(main.querySelector('[data-save-post="'+p.id+'"]')||document.getElementById('community-results')).focus({preventScroll:true});}
      dialog.querySelectorAll('[data-save-post="'+p.id+'"]').forEach(b=>{b.setAttribute('aria-pressed',String(!saved));b.setAttribute('aria-label',p.title+' 관심 글 '+(saved?'담기':'해제'));b.textContent=saved?'관심 글 담기':'관심 글 해제';});
      toast(saved?'관심 글에서 뺐습니다.':'이 창의 관심 글에 담았습니다.');return;
    }
    if(el.dataset.postServices){
      const p=posts.items.find(p=>p.id===el.dataset.postServices);if(!p)return;
      event.preventDefault();state.filter=p.category;state.serviceMode=el.dataset.mode;state.sourcePost=p.id;document.getElementById('article-dialog').close();navigate('services');return;
    }
    if(el.dataset.seed){
      const x=D.cases.find(x=>x.id===el.dataset.seed);
      const mode=el.dataset.mode;
      state.draft={category:x.category,mode,goal:x.goal,deliverable:x.deliverable,sourceCase:x.id};
      if(mode==='learn'){state.draft.goal=x.subtitle+'의 과정을 배워 제 업무에 직접 적용하고 싶어요.';state.draft.deliverable='실습 코칭과 직접 만든 초안에 대한 피드백';}
      state.review=null;state.savedKey=null;
      if(location.hash==='#request'){event.preventDefault();render({focus:true});}return;
    }
    if(el.dataset.offer){const o=D.offers.find(o=>o.id===el.dataset.offer);state.draft={category:o.category,mode:o.mode,goal:o.title+'에 관해 제 상황에 맞는 도움을 받고 싶어요.',deliverable:o.included.join(', '),budgetMax:o.from};state.review=null;state.savedKey=null;return;}
    if(el.dataset.serviceCategory){state.filter=el.dataset.serviceCategory;state.serviceMode='all';state.sourcePost=null;return;}
    if(el.dataset.openDraft){const item=state.saved.find(x=>x.id===el.dataset.openDraft);state.draft={...item.value};state.review={...item.value};state.savedKey=item.id;navigate('request');return;}
    if(el.dataset.post){openPost(el.dataset.post);return;}
    switch(el.dataset.action){
      case 'saved-posts':state.savedOnly=!state.savedOnly;render();document.querySelector('[data-action="saved-posts"]').focus();break;
      case 'reset-community':state.communityQuery='';state.filter='all';state.savedOnly=false;render();document.getElementById('community-query').focus();break;
      case 'reset-services':state.filter='all';state.serviceMode='all';state.sourcePost=null;render();document.getElementById('service-results').focus();break;
      case 'close-dialog': document.getElementById('article-dialog').close();break;
      case 'request-sample':state.draft={category:'automation',mode:'commission',goal:D.cases[2].goal,deliverable:D.cases[2].deliverable,budgetMax:1000000,currentMethod:'메일을 확인한 뒤 사람이 시트에 옮기고 있습니다.',sourceCase:'automation'};state.review=null;render();document.getElementById('goal').focus();break;
      case 'edit-request':state.review=null;render({focus:true});break;
      case 'save-request':if(!state.savedKey){const id='R'+String(state.saved.length+1).padStart(3,'0');state.saved.push({id,value:{...state.review}});state.savedKey=id;}navigate('work');toast('이 창 안에 초안을 보관했습니다. 실제 발송은 하지 않았습니다.');break;
      case 'export-request':if(state.review)download('AI-의뢰요청-초안.json',state.review);break;
      case 'seller-sample':state.sellerDraft={displayName:'예시 제작자',category:'automation',modes:['commission','learn'],offer:'문의 접수와 담당자 분류 흐름을 구축하고 운영 방법을 설명합니다.',workUrl:'https://example.com/portfolio',role:'구성 설계·연동·오류 처리와 인수인계를 직접 맡았습니다.',priceFrom:'범위 확인 후 견적, 월 서비스 이용료 별도',availability:'일정 협의 후 한 번에 1건',participation:false};render();document.getElementById('displayName').focus();break;
      case 'export-seller':if(state.sellerReview)download('AI-판매자등록-초안.json',state.sellerReview);break;
      case 'edit-seller':state.sellerReview=null;render({focus:true});break;
      case 'export-schema':download('AI-플랫폼-양식정의.json',S);break;
      case 'next-step':state.workStep=Math.min(3,state.workStep+1);render();break;
      case 'previous-step':state.workStep=Math.max(0,state.workStep-1);render();break;
    }
  });
  window.addEventListener('hashchange',()=>render({focus:true}));
  render();
})();

