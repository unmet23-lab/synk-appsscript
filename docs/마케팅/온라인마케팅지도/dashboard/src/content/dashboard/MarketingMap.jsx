import React from 'react';
import { DataComponent, DataTable, Filters, Section, SortableItem, SortableRegion, useDataApp, useDashboardTabs } from '../../data-app-public.jsx';
import './marketing-map.css';
const tabs = [
  { id: 'overview', label: '회사·브랜드', filterIds: [] },
  { id: 'countries', label: 'LAB · 23개국', filterIds: ['country'], focusFields: ['countryCode'] },
  { id: 'channels', label: '전체 채널', filterIds: ['brand', 'channelCountry', 'channelScope', 'platform'], focusFields: ['channelId'] },
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
const status = (field, label) => ({ field, label, renderCell: value => String(value || '').length > 32 ? <span className="mm-status-detail">{value}</span> : <Badge>{value}</Badge> });
function EvidenceTable({ id, queryId, title, rows, columns, onRowSelect, rowActionLabel, selectedRowKey, searchable = true }) {
  const readableColumns = columns.map(column => column.renderCell || !['title','nextAction','currentUse','proposedRole','scopeOwner','state','role','contentStatus','appStatus','existingLabel'].includes(column.field) ? column : {...column, renderCell: value => <span className="mm-cell-detail">{value}</span>});
  return <DataComponent id={id} queryId={queryId} title={title} kind="table" variant="card" displayRows={rows} sourceRows={rows}>
    <DataTable rows={rows} columns={readableColumns} rowKey="id" caption={title} searchable={searchable} onRowSelect={onRowSelect} rowActionLabel={rowActionLabel} selectedRowKey={selectedRowKey}/>
  </DataComponent>;
}
export function DashboardContent() {
  const { snapshot, queries, reviewedRows, filters, setFilter, exploreDashboard, viewFocus, setDashboardFocus } = useDataApp();
  const { activeTabId } = useDashboardTabs(tabs);
  const tab = tabs.find(item => item.id === activeTabId) || tabs[0];
  const rows = id => queries[id] ? reviewedRows(id) : [];
  const brands = rows('brands');
  const channelRows = rows('channels');
  const countries = rows('countries');
  const allChannels = queries.channels?.rows || [];
  const countrySelection = filters.country && filters.country !== 'all' ? filters.country : null;
  const selectedCountry = countries.find(row => row.code === viewFocus?.countryCode) || countries.find(row => row.country === countrySelection) || countries.find(row => row.code === 'MN') || countries[0];
  const countryChannels = selectedCountry ? allChannels.filter(row => row.country === selectedCountry.country && row.brand === 'LAB') : [];
  const selectedChannel = channelRows.find(row => row.id === viewFocus?.channelId);
  return <div className="mm-page">
    <Filters sticky filters={(snapshot.filters || []).filter(filter => tab.filterIds.includes(filter.id))} queries={queries} values={filters} onChange={setFilter}/>
    {tab.id === 'overview' && <>
      <div className="mm-note" data-editable-id="map-scope-note" data-editable-narrative="true">LAB 23개국 계획의 확장 44자리 중 24곳은 계정 확인, 20곳은 개설·생성 확인이 남았습니다. 몽골 기존 5개는 유지합니다. 계정 확인은 콘텐츠 게시를 뜻하지 않습니다.</div>
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
                <button className="mm-action" onClick={() => brand.id === 'LAB' ? exploreDashboard('countries', {}) : brand.id === 'PULSE' ? exploreDashboard('channels', {filters:{brand:'LAB',channelScope:'기존 운영'},focus:{channelId:'lab-youtube'}}) : brand.id === 'PATH' ? exploreDashboard('accounts', {}) : exploreDashboard('channels', {filters:{brand:brand.id}})}>{brand.id === 'LAB' ? '23개국 준비 상황 보기' : brand.id === 'PULSE' ? '공유 YouTube 확인하기' : brand.id === 'PATH' ? '홈페이지 연결 보기' : '채널 확인하기'} →</button>
              </div>
            </DataComponent>
          </SortableItem>)}
        </SortableRegion>
      </Section>
      <Section id="next-actions-heading" title="이어서 할 일">
        <EvidenceTable id="next-actions" queryId="tasks" title="작업 대기 목록" rows={rows('tasks')} columns={[{field:'brand',label:'구분'},{field:'country',label:'국가·범위'},{field:'title',label:'작업'},status('state','상태'),{field:'nextAction',label:'다음 행동'}]}/>
      </Section>
      <p className="mm-footnote">로컬 기록 갱신: 2026년 9월 23일 · 계정 원장 최신 기록은 9월 21일, 영상 제작 기록은 9월 23일까지입니다. 이번 갱신에서 SNS 실시간 조회는 하지 않았습니다.</p>
    </>}
    {tab.id === 'countries' && <>
      <div className="mm-note" data-editable-id="lab-country-scope" data-editable-narrative="true">23개국 우선 플랫폼 46자리 + 몽골 추가 3개 = LAB 전체 49자리입니다. 몽골 외 44자리 중 24곳을 확보했고 20곳은 미확인입니다. 국가 순서는 수요 순위가 아닙니다.</div>
      <Section id="country-roster-heading" title="LAB 국가별 준비 상황" spacing="content">
        <EvidenceTable id="lab-country-roster" queryId="countries" title="23개국 운영 계획" rows={countries} selectedRowKey={selectedCountry?.id} onRowSelect={row => setDashboardFocus({countryCode:row.code})} rowActionLabel={row => `${row.country}의 계정과 진행 상황 보기`} columns={[
          {field:'country',label:'국가'}, {field:'platformsLabel',label:'우선 플랫폼 2개'}, status('setupStatus','계정 세팅'), {field:'contentStatus',label:'콘텐츠'}, {field:'appStatus',label:'앱 출시'}
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
      <div className="mm-note" data-editable-id="channel-scope-note" data-editable-narrative="true">기존 운영 23곳, 확장 확보 24곳, 확장 미확인 20곳과 보류·제외를 구분합니다. LAB·PULSE 공유 YouTube와 공통 Substack은 중복 계산하지 않습니다.</div>
      <Section id="channel-roster-heading" title="채널별 진행 상황" spacing="content">
        <EvidenceTable id="channel-roster" queryId="channels" title="계정·프로필·게시 현황" rows={channelRows} selectedRowKey={selectedChannel?.id} onRowSelect={row => setDashboardFocus({channelId:row.id})} rowActionLabel={row => `${row.handle || row.id} 상세 보기`} columns={[
          {field:'brand',label:'브랜드·트랙'},{field:'country',label:'국가·범위'},{field:'platform',label:'플랫폼'},{field:'handle',label:'계정',renderCell:LinkCell},status('channelScope','운영 분류'),status('profileStatus','소개'),status('publishStatus','콘텐츠 게시'),{field:'nextAction',label:'다음 행동'}
        ]}/>
      </Section>
      {selectedChannel && <Section id="channel-detail-heading" title="선택한 채널의 확인 근거">
        <DataComponent id="channel-detail" queryId="channels" title={selectedChannel.handle || selectedChannel.id} kind="custom" variant="card" displayRows={[selectedChannel]} sourceRows={[selectedChannel]}>
          <dl className="mm-details" data-reviewed-rows>{[['소속',selectedChannel.brand],['용도',selectedChannel.channelRole],['로그인',selectedChannel.loginAlias || '미확인'],['프로필',selectedChannel.profileStatus],['디자인',selectedChannel.coverStatus],['확인 범위',selectedChannel.verificationScope || '계정별 원장 기록'],['마지막 근거',selectedChannel.lastEvidenceAt || '미확인'],['공유 브랜드',selectedChannel.sharedLabel || '없음'],['다음 행동',selectedChannel.nextAction],['기록 위치',selectedChannel.sourceLabel]].map(([key,value]) => <React.Fragment key={key}><dt>{key}</dt><dd>{value || '미확인'}</dd></React.Fragment>)}</dl>
        </DataComponent>
      </Section>}
    </>}
    {tab.id === 'content' && <>
      <div className="mm-note" data-editable-id="content-flow-note" data-editable-narrative="true">기존 첫 콘텐츠 계획 14건에 yuhobuilds·synkbrief 최신 영상 검토본 2건을 더했습니다. 영상 파일 제작·검수와 사용자 최종 승인·SNS 게시는 각각 다른 상태입니다.</div>
      <p className="mm-record-link"><a className="mm-action" href="http://127.0.0.1:4188/" target="_blank" rel="noreferrer">게시 성과 기록 열기 ↗</a><span>실제 게시물 주소를 등록한 뒤 날짜별 반응을 입력합니다.</span></p>
      <Section id="content-roster-heading" title="콘텐츠별 제작 진행" spacing="content">
        <EvidenceTable id="content-roster" queryId="contents" title="원고·제작·발행" rows={rows('contents')} columns={[
          {field:'id',label:'콘텐츠 ID'},{field:'brand',label:'브랜드·트랙'},{field:'title',label:'콘텐츠'},status('scriptStatus','원고'),status('productionStatus','제작'),status('publishStatus','게시'),{field:'scopeOwner',label:'진행 위치'},{field:'nextAction',label:'다음 행동'}
        ]}/>
      </Section>
    </>}
    {tab.id === 'accounts' && <>
      <div className="mm-note" data-editable-id="identity-scope-note" data-editable-narrative="true">로그인 계정과 공개 SNS 채널은 다릅니다. 아래 새 역할은 제안 상태이며, 소유권 이전·권한 초대·보안 설정을 완료했다는 뜻이 아닙니다.</div>
      <Section id="identity-heading" title="로그인 계정 6개 · 현재 연결과 추천 역할" spacing="content">
        <EvidenceTable id="identity-roster" queryId="identities" title="로그인·소유권 관리" rows={rows('identities')} searchable={false} columns={[
          {field:'label',label:'계정 구분명'},{field:'currentUse',label:'현재 연결·기록'},{field:'proposedRole',label:'추천 역할'},status('assignment','적용 상태'),status('security','보안 확인'),{field:'nextAction',label:'다음 확인'}
        ]}/>
      </Section>
      <Section id="destinations-heading" title="홈페이지·제품 연결">
        <EvidenceTable id="web-destinations" queryId="destinations" title="SNS 계정 수에서 제외하는 도착지" rows={rows('destinations')} searchable={false} columns={[{field:'brand',label:'브랜드'},{field:'handle',label:'도착지',renderCell:LinkCell},{field:'role',label:'구분'},{field:'state',label:'확인 범위'}]}/>
      </Section>
    </>}
  </div>;
}
