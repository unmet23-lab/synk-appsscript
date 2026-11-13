import React from 'react';
import { DataComponent, DataTable, Filters, Section, SortableItem, SortableRegion, useDataApp, useDashboardTabs } from '../../data-app-public.jsx';
import { createSearchIndex, searchRows, visibleChannel, channelSearchFields, identitySearchFields, managedChannels, loginSummary, brandChannelView, operationLabels } from './account-view.mjs';
import './marketing-map.css';
// The shell keeps a saved tab label unless it is listed in previousLabels, so every generated country-count label is listed.
const countryTabLabels = ['LAB · 국가별', ...Array.from({ length: 200 }, (_, n) => `LAB · ${n + 1}개국`)];
const baseTabs = [
  { id: 'overview', label: '회사·브랜드', filterIds: [] },
  { id: 'countries', label: 'LAB · 국가별', filterIds: ['country'], focusFields: ['countryCode'], previousLabels: countryTabLabels },
  // 11-13: 회사별 거르기는 주 사업(business). 콘텐츠 트랙(brand) 거르기는 그대로 둔다 — 두 축이 다르다.
  { id: 'channels', label: '전체 채널', filterIds: ['business', 'brand', 'channelCountry', 'channelScope', 'platform', 'loginState'], focusFields: ['channelId'] },
  { id: 'content', label: '콘텐츠 제작', filterIds: ['contentBrand'] },
  { id: 'accounts', label: '로그인·권한', filterIds: [] }
];
function Badge({ children }) {
  const value = String(children ?? '미확인');
  const tone = /제외|보류|실패/.test(value) ? 'hold' : /미확인|미완료|미반영|미게시|대기|예정|계획|제안|초안|준비|필요|확인하지/.test(value) ? 'pending' : /확인|완료|기존|보존|유지/.test(value) ? 'known' : 'pending';
  return <span className={`mm-badge mm-${tone}`}>{value}</span>;
}
function LinkCell(value, row) {
  return row.publicUrl && /^https:\/\//.test(row.publicUrl)
    ? <a className="mm-public-link" href={row.publicUrl} target="_blank" rel="noreferrer">{value || '공개 프로필'}</a>
    : <span>{value || '미정'}</span>;
}
// Scope counts come from the reviewed summary rows so the notes follow each rebuild of build-map.mjs.
const koDate = value => value ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value)) : '미확인';
function scopeCounts(summary, lab, countryCount) {
  const value = id => Number(summary.find(row => row.id === id)?.value) || 0;
  const secured = value('lab-secured');
  const pending = value('lab-pending');
  const prioritySlots = Number(lab?.plannedSlots) || countryCount * 2;
  const mongoliaExtra = Math.max(0, (Number(lab?.ownedCount) || 0) - 2);
  return { existing: value('existing'), secured, pending, expansionSlots: secured + pending, countries: value('lab-world') || countryCount,
    prioritySlots, mongoliaOwned: Number(lab?.ownedCount) || 0, mongoliaExtra, totalSlots: prioritySlots + mongoliaExtra };
}
const status = (field, label) => ({ field, label, renderCell: value => String(value || '').length > 32 ? <span className="mm-status-detail">{value}</span> : <Badge>{value}</Badge> });
function SearchField({ id, label, value, onChange, placeholder }) {
  return <label className="mm-search" htmlFor={id}><span>{label}</span><input id={id} type="search" value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} autoComplete="off" spellCheck={false}/></label>;
}
function DetailFields({ items }) {
  return <dl className="mm-details" data-reviewed-rows>{items.map(([key,value]) => <React.Fragment key={key}><dt>{key}</dt><dd>{value || '미확인'}</dd></React.Fragment>)}</dl>;
}
function ConnectionList(value) {
  const connections = String(value || '').split(' · ').filter(Boolean);
  if (connections.length <= 3) return <span className="mm-cell-detail">{value}</span>;
  return <details className="mm-connections"><summary>{connections.length}개 연결 · 목록 보기</summary><ul>{connections.map(item => <li key={item}>{item}</li>)}</ul></details>;
}
function EvidenceTable({ id, queryId, title, rows, columns, onRowSelect, rowActionLabel, selectedRowKey, searchable = true, toolbarControls }) {
  const readableColumns = columns.map(column => column.renderCell || !['title','nextAction','currentUse','proposedRole','scopeOwner','state','role','contentStatus','appStatus','existingLabel'].includes(column.field) ? column : {...column, renderCell: value => <span className="mm-cell-detail">{value}</span>});
  return <DataComponent id={id} queryId={queryId} title={title} kind="table" variant="card" displayRows={rows} sourceRows={rows}>
    <DataTable rows={rows} columns={readableColumns} rowKey="id" caption={title} searchable={searchable} toolbarControls={toolbarControls} onRowSelect={onRowSelect} rowActionLabel={rowActionLabel} selectedRowKey={selectedRowKey}/>
  </DataComponent>;
}
export function DashboardContent() {
  const { snapshot, queries, reviewedRows, filters, setFilter, exploreDashboard, viewFocus, setDashboardFocus } = useDataApp();
  const countryCount = queries.countries?.rows?.length || 0;
  const tabs = React.useMemo(() => baseTabs.map(item => item.id === 'countries' && countryCount ? { ...item, label: `LAB · ${countryCount}개국` } : item), [countryCount]);
  const { activeTabId } = useDashboardTabs(tabs);
  const tab = tabs.find(item => item.id === activeTabId) || tabs[0];
  const rows = id => queries[id] ? reviewedRows(id) : [];
  const brands = rows('brands');
  const [channelSearch, setChannelSearch] = React.useState('');
  const [identitySearch, setIdentitySearch] = React.useState('');
  const [detailRequest, setDetailRequest] = React.useState(0);
  const detailRef = React.useRef(null);
  const rosterRef = React.useRef(null);
  const pendingDetailFocus = React.useRef(false);
  const countries = rows('countries');
  const allChannels = queries.channels?.rows || [];
  const channelIndex = React.useMemo(() => createSearchIndex(allChannels, channelSearchFields), [allChannels]);
  const channelRows = searchRows(rows('channels'), channelIndex, channelSearch);
  const allIdentities = queries.identities?.rows || [];
  const identityIndex = React.useMemo(() => createSearchIndex(allIdentities, identitySearchFields), [allIdentities]);
  const identityRows = searchRows(rows('identities'), identityIndex, identitySearch);
  const managed = React.useMemo(() => managedChannels(allChannels), [allChannels]);
  const loginCounts = React.useMemo(() => loginSummary(allChannels), [allChannels]);
  const countrySelection = filters.country && filters.country !== 'all' ? filters.country : null;
  const selectedCountry = countries.find(row => row.code === viewFocus?.countryCode) || countries.find(row => row.country === countrySelection) || countries.find(row => row.code === 'MN') || countries[0];
  const countryChannels = selectedCountry ? allChannels.filter(row => row.country === selectedCountry.country && row.brand === 'LAB') : [];
  const selectedChannel = visibleChannel(channelRows, viewFocus?.channelId);
  React.useEffect(() => {
    if (tab.id !== 'channels' || !viewFocus?.channelId || channelRows.some(row => row.id === viewFocus.channelId)) return;
    setDashboardFocus(selectedChannel ? {channelId:selectedChannel.id} : {});
  }, [tab.id, viewFocus?.channelId, channelRows, selectedChannel, setDashboardFocus]);
  React.useEffect(() => {
    if (!pendingDetailFocus.current || !detailRef.current || tab.id !== 'channels') return;
    pendingDetailFocus.current = false;
    detailRef.current.focus({ preventScroll: true });
    detailRef.current.scrollIntoView({ block: 'start' });
  }, [detailRequest, selectedChannel, tab.id]);
  const showChannel = row => {
    pendingDetailFocus.current = true;
    setDashboardFocus({ channelId: row.id });
    setDetailRequest(value => value + 1);
  };
  const scope = scopeCounts(queries.summary?.rows || [], (queries.brands?.rows || []).find(row => row.id === 'LAB'), countryCount);
  const evidenceTimes = allChannels.map(row => Date.parse(row.lastEvidenceAt)).filter(Number.isFinite);
  const latestAccountEvidence = evidenceTimes.length ? Math.max(...evidenceTimes) : null;
  const allContents = queries.contents?.rows || [];
  const contentLineCount = allContents.filter(row => /^CL-/.test(row.id)).length;
  const reviewVideoCount = allContents.filter(row => /^(YB|SB)-/.test(row.id)).length;
  const firstPlanCount = allContents.length - contentLineCount - reviewVideoCount;
  return <div className="mm-page">
    <Filters sticky filters={(snapshot.filters || []).filter(filter => tab.filterIds.includes(filter.id))} queries={queries} values={filters} onChange={setFilter}>
      {tab.id === 'channels' && <SearchField id="mm-channel-search" label="계정 검색" value={channelSearch} onChange={setChannelSearch} placeholder="계정·플랫폼·로그인 연결·브라우저"/>}
    </Filters>
    {tab.id === 'overview' && <>
      <div className="mm-note" data-editable-id="map-scope-note" data-editable-narrative="true">LAB {scope.countries}개국 계획의 확장 {scope.expansionSlots}자리 중 {scope.secured}곳은 계정 확인, {scope.pending}곳은 개설·생성 확인이 남았습니다. 몽골 기존 {scope.mongoliaOwned}개는 유지합니다. 계정 확인은 콘텐츠 게시를 뜻하지 않습니다.</div>
      <p className="mm-record-link"><a className="mm-action" href="http://127.0.0.1:4188/" target="_blank" rel="noreferrer">게시물·좋아요·댓글·공유 기록 열기 ↗</a><span>게시 후 날짜별 수치를 직접 입력하는 로컬 기록장</span></p>
      <DataComponent id="map-totals" queryId="summary" title="운영 범위" kind="custom" variant="plain" displayRows={rows('summary')} sourceRows={rows('summary')}>
        <div className="mm-totals" data-reviewed-rows>{rows('summary').map(item => <div key={item.id}><span>{item.label}</span><strong>{item.value}<small>{item.unit}</small></strong><p>{item.note}</p></div>)}</div>
      </DataComponent>
      <Section id="brand-map-heading" title="회사·브랜드별 지도" spacing="after-metrics">
        <SortableRegion id="map:brand-cards" variant="freeform" authoredRevision={1} className="mm-brand-grid">
          {brands.map(brand => <SortableItem key={brand.id} id={`brand-${brand.id}`} label={brand.name} kind="custom">
            <DataComponent id={`brand-${brand.id}`} queryId="brands" title={brand.name} kind="custom" variant="card" displayRows={[brand]} sourceRows={[brand]}>
              <div className="mm-brand-body" data-reviewed-rows>
                <p className="mm-role">{brand.role}</p><p className="mm-muted">{brand.market}</p>
                <div className="mm-brand-count"><strong>{brand.ownedCount}</strong><span>기존 운영 대상</span>{brand.securedExpansionCount > 0 && <span>· 확장 확보 {brand.securedExpansionCount}곳</span>}{brand.sharedCount > 0 && <span>· 공유 채널 {brand.sharedCount}곳</span>}</div>
                <p>{brand.channelPolicy}</p><p className="mm-next"><span>다음 할 일</span>{brand.nextAction}</p>
                <button className="mm-action" onClick={() => {
                  setChannelSearch('');
                  if (brand.id === 'LAB') exploreDashboard('countries', {});
                  else if (brand.id === 'PATH') exploreDashboard('accounts', {});
                  else exploreDashboard('channels', brandChannelView(brand.id));
                }}>{brand.id === 'LAB' ? `${scope.countries}개국 준비 상황 보기` : brand.id === 'PATH' ? '홈페이지 연결 보기' : '채널 확인하기'} →</button>
              </div>
            </DataComponent>
          </SortableItem>)}
        </SortableRegion>
      </Section>
      <Section id="next-actions-heading" title="이어서 할 일">
        <EvidenceTable id="next-actions" queryId="tasks" title="작업 대기 목록" rows={rows('tasks')} columns={[{field:'brand',label:'구분'},{field:'country',label:'국가·범위'},{field:'title',label:'작업'},status('state','상태'),{field:'nextAction',label:'다음 행동'}]}/>
      </Section>
      {queries.plans && <Section id="long-term-plans-heading" title={`장기 계획 ${rows('plans').length}개 · 실계정 수에 더하지 않음`}>
        <EvidenceTable id="long-term-plans" queryId="plans" title="아직 만들지 않은 계정 계획" rows={rows('plans')} columns={[{field:'business',label:'주 사업'},{field:'contentTrack',label:'콘텐츠 트랙'},{field:'platform',label:'플랫폼'},status('state','상태'),{field:'note',label:'메모'}]}/>
      </Section>}
      <p className="mm-footnote">지도 자료 갱신: {koDate(snapshot.generatedAt)} · 계정 기록의 가장 최근 근거는 {koDate(latestAccountEvidence)}입니다. 이번 갱신에서 SNS 실시간 조회는 하지 않았습니다.</p>
    </>}
    {tab.id === 'countries' && <>
      <div className="mm-note" data-editable-id="lab-country-scope" data-editable-narrative="true">{scope.countries}개국 우선 플랫폼 {scope.prioritySlots}자리 + 몽골 추가 {scope.mongoliaExtra}개 = LAB 전체 {scope.totalSlots}자리입니다. 몽골 외 {scope.expansionSlots}자리 중 {scope.secured}곳을 확보했고 {scope.pending}곳은 미확인입니다. 국가 순서는 수요 순위가 아닙니다.</div>
      <Section id="country-roster-heading" title="LAB 국가별 준비 상황" spacing="content">
        <EvidenceTable id="lab-country-roster" queryId="countries" title={`${scope.countries}개국 운영 계획`} rows={countries} selectedRowKey={selectedCountry?.id} onRowSelect={row => setDashboardFocus({countryCode:row.code})} rowActionLabel={row => `${row.country}의 계정과 진행 상황 보기`} columns={[
          {field:'country',label:'국가'}, {field:'platformsLabel',label:'계획 플랫폼'}, status('setupStatus','계정 세팅'), {field:'contentStatus',label:'콘텐츠'}, {field:'appStatus',label:'앱 출시'}
        ]}/>
      </Section>
      {selectedCountry && <Section id="country-detail-heading" title={`${selectedCountry.country} · 채널 상세`}>
        <DataComponent id="country-context" queryId="countries" title={`${selectedCountry.country}의 다음 단계`} kind="custom" variant="plain" displayRows={[selectedCountry]} sourceRows={[selectedCountry]}>
          <div className="mm-country-context" data-reviewed-rows><p>{selectedCountry.nextAction}</p><p className="mm-muted">{selectedCountry.condition}</p>
            <dl className="mm-stages">{[['한국어 원본',selectedCountry.scriptStatus],['번역',selectedCountry.translationStatus],['현지 검수',selectedCountry.localReviewStatus],['게시',selectedCountry.publishStatus],['앱',selectedCountry.appStatus]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd><Badge>{value}</Badge></dd></div>)}</dl>
          </div>
        </DataComponent>
        <EvidenceTable id="country-channel-detail" queryId="channels" title={`${selectedCountry.country} 계정·프로필·게시 상태`} rows={countryChannels} columns={[
          {field:'platform',label:'플랫폼'},{field:'priority',label:'운영 구분'},{field:'handle',label:'핸들',renderCell:LinkCell},status('setupStatus','계정 세팅'),status('profileStatus','소개'),status('coverStatus','커버'),status('publishStatus','게시'),{field:'nextAction',label:'다음 행동'}
        ]}/>
      </Section>}
    </>}
    {tab.id === 'channels' && <>
      <div className="mm-note" data-editable-id="channel-scope-note" data-editable-narrative="true">기존 운영 {scope.existing}곳, 확장 확보 {scope.secured}곳, 확장 미확인 {scope.pending}곳과 보류·제외를 구분합니다. LAB·PULSE 공유 YouTube와 공통 Substack은 중복 계산하지 않습니다.</div>
      <div ref={rosterRef} tabIndex={-1} className="mm-inspection-anchor" aria-label="채널 목록">
      <Section id="channel-roster-heading" title="채널별 진행 상황" spacing="content">
        <EvidenceTable id="channel-roster" queryId="channels" title="계정·프로필·게시 현황" rows={channelRows} searchable={false} selectedRowKey={selectedChannel?.id} onRowSelect={showChannel} rowActionLabel={row => `${row.platform} ${row.handle || row.id} 상세 보기`} columns={[
          {field:'business',label:'주 사업'},{field:'contentTrack',label:'콘텐츠 트랙'},{field:'country',label:'국가·범위'},{field:'platform',label:'플랫폼'},{field:'handle',label:'계정',renderCell:LinkCell},status('channelScope','운영 분류'),status('loginStatusLabel','로그인 경로'),{field:'publishStatus',label:'게시·예약(작업실 기록)',renderCell:(value,row)=><span className="mm-cell-detail">{row.operations?.publication ? operationLabels(row).publication : value || '기록 미확인'}</span>},status('profileStatus','소개'),{field:'nextAction',label:'다음 행동'}
        ]}/>
      </Section>
      </div>
      {!channelRows.length && <div className="mm-empty" role="status"><p>현재 검색어와 필터에 맞는 채널이 없습니다.</p><button className="mm-action" onClick={() => { setChannelSearch(''); tab.filterIds.forEach(id => setFilter(id, 'all')); }}>검색·필터 초기화</button></div>}
      {selectedChannel && <div ref={detailRef} tabIndex={-1} className="mm-inspection-anchor" aria-label={`${selectedChannel.platform} ${selectedChannel.handle || selectedChannel.id} 상세`}>
      <Section id="channel-detail-heading" title="선택한 채널의 확인 근거">
        <DataComponent id="channel-detail" queryId="channels" title={`${selectedChannel.platform} · ${selectedChannel.handle || selectedChannel.id}`} kind="custom" variant="card" displayRows={[selectedChannel]} sourceRows={[selectedChannel]}>
          <div className="mm-detail-top" data-reviewed-rows><span>{selectedChannel.business || selectedChannel.brand}{selectedChannel.contentTrack && selectedChannel.contentTrack !== selectedChannel.business ? ` · 트랙 ${selectedChannel.contentTrack}` : ''} · {selectedChannel.country}</span><button className="mm-action" onClick={() => { rosterRef.current?.focus({preventScroll:true}); rosterRef.current?.scrollIntoView({block:'start'}); }}>목록으로 돌아가기 ↑</button></div>
          <DetailFields items={[
            ['브라우저 로그인(직접 확인)',operationLabels(selectedChannel).login],['게시·예약(작업실 기록)',operationLabels(selectedChannel).publication],['수집',operationLabels(selectedChannel).collection],['로그인 연결',selectedChannel.loginAlias || (selectedChannel.accountStatus === 'planned' ? '미개설 · 로그인 없음' : '미확인')],['로그인 방식',selectedChannel.loginMethod],['브라우저·프로필',selectedChannel.loginBrowser],['확인 상태',selectedChannel.loginStatusLabel],['로그인 근거 날짜',selectedChannel.operations?.login?.observedDateOnly===true?String(selectedChannel.loginEvidenceAt||'').slice(0,10)+' (날짜만 확인)':selectedChannel.loginEvidenceAt],['세션 확인 범위',selectedChannel.loginSessionStatus],['연결 주의사항',selectedChannel.loginCaveat || '없음'],['다음 행동',selectedChannel.nextAction]
          ]}/>
          <details className="mm-evidence-details"><summary>프로필·디자인·기록 근거 보기</summary><DetailFields items={[
            ['주 사업',selectedChannel.business],['보조 사업',(selectedChannel.secondaryBusinesses || []).join(' · ') || '없음'],['분류 근거',selectedChannel.classificationBasis],['용도',selectedChannel.purpose || selectedChannel.channelRole],['프로필',selectedChannel.profileStatus],['디자인',selectedChannel.coverStatus],['확인 범위',selectedChannel.verificationScope || '계정별 원장 기록'],['프로필 근거 날짜',selectedChannel.lastEvidenceAt],['공유 브랜드',selectedChannel.sharedLabel || '없음'],['기록 위치',[...new Set([...(selectedChannel.sourcePaths || []),...(selectedChannel.loginSourcePaths || [])])].join('\n')]
          ]}/></details>
        </DataComponent>
      </Section></div>}
    </>}
    {tab.id === 'content' && <>
      <div className="mm-note" data-editable-id="content-flow-note" data-editable-narrative="true">기존 첫 콘텐츠 계획 {firstPlanCount}건, yuhobuilds·synkbrief 영상 검토본 {reviewVideoCount}건, 콘텐츠 라인 {contentLineCount}건을 함께 둡니다. 영상 파일 제작·검수와 사용자 최종 승인·SNS 게시는 각각 다른 상태입니다.</div>
      <p className="mm-record-link"><a className="mm-action" href="http://127.0.0.1:4188/" target="_blank" rel="noreferrer">게시 성과 기록 열기 ↗</a><span>실제 게시물 주소를 등록한 뒤 날짜별 반응을 입력합니다.</span></p>
      <Section id="content-roster-heading" title="콘텐츠별 제작 진행" spacing="content">
        <EvidenceTable id="content-roster" queryId="contents" title="원고·제작·발행" rows={rows('contents')} columns={[
          {field:'id',label:'콘텐츠 ID'},{field:'brand',label:'브랜드·트랙'},{field:'title',label:'콘텐츠'},status('scriptStatus','원고'),status('productionStatus','제작'),status('publishStatus','게시'),{field:'scopeOwner',label:'진행 위치'},{field:'nextAction',label:'다음 행동'}
        ]}/>
      </Section>
    </>}
    {tab.id === 'accounts' && <>
      <div className="mm-note" data-editable-id="identity-scope-note" data-editable-narrative="true">로그인 연결과 공개 채널은 다릅니다. 전체 채널의 로그인 방식·브라우저·근거를 대조했으며, 미확인 연결은 그대로 표시합니다. 보안 설정과 모든 계정의 현재 세션을 재검증한 결과는 아닙니다. 정확한 이메일·ID는 비공개 로그인 표에서 관리합니다.</div>
      <DataComponent id="login-confidence-summary" queryId="channels" title={`관리 대상 ${managed.length}곳 · 로그인 경로 확인 상태`} kind="custom" variant="card" displayRows={loginCounts} sourceRows={managed}>
        <div className="mm-login-counts" data-reviewed-rows>{loginCounts.map(item => <div key={item.id}><span>{item.label}</span><strong>{item.value}<small>곳</small></strong></div>)}</div>
      </DataComponent>
      <Section id="identity-heading" title={`로그인 연결 ${rows('identities').length}개 · 방식과 확인 범위`} spacing="content">
        <EvidenceTable id="identity-roster" queryId="identities" title="로그인·소유권 관리" rows={identityRows} searchable={false} toolbarControls={<SearchField id="mm-identity-search" label="로그인 연결 검색" value={identitySearch} onChange={setIdentitySearch} placeholder="연결 별칭·계정·플랫폼"/>} columns={[
          {field:'label',label:'연결 구분'},{field:'loginType',label:'로그인 방식'},{field:'currentUse',label:'연결된 채널',renderCell:ConnectionList},status('assignment','확인 범위'),status('security','보안 확인'),{field:'nextAction',label:'다음 확인'}
        ]}/>
      </Section>
      <Section id="destinations-heading" title="홈페이지·제품 연결">
        <EvidenceTable id="web-destinations" queryId="destinations" title="SNS 계정 수에서 제외하는 도착지" rows={rows('destinations')} searchable={false} columns={[{field:'brand',label:'브랜드'},{field:'handle',label:'도착지',renderCell:LinkCell},{field:'role',label:'구분'},{field:'state',label:'확인 범위'}]}/>
      </Section>
    </>}
  </div>;
}
