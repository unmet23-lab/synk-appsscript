// 검정 구 얼굴의 화면(PC 클라이언트 1단계). 컨트롤러(orb-face.mjs)가 넘긴 장면을 그리고, 누른 것을 컨트롤러에 알린다.
// 화면 층은 셋이다(묻기 · 공간 고르기 · 들어온 뒤). 글과 자리 값은 시안 docs/디자인/플랫폼_클라이언트_검정구_20261116/검정구.html을 따른다.
// 호스트(portal-host.mjs)가 이름으로 찾는 요소(#portal-invite-input, [data-portal-pane="invite"], #portal-invite-error,
// [data-portal-auth-feedback], [data-portal-action="close-invite"], [data-portal-action="continue-personal"])를 같은 뜻으로 둔다(설계 6절).
// 모듈 맨 위에서는 DOM을 건드리지 않는다.
import { fanR, HOME_R, createOrbStage, easeIO, easeIOQ, easeOut, lerp, smooth, switchGeom, PLACE_LON } from './orb-stage.mjs';
import { createOrbSound, followSoundPreference } from './orb-sound.mjs';
import { createOrbSignature } from './orb-signature.mjs';
import { rowSpeech } from './site-visits-model.mjs';
import { createOfficeFloor, floorSeatCount } from './office-floor.mjs';
import { createOfficeTaskView } from './office-task-view.mjs';
import { createBizplanView } from './office-bizplan-view.mjs';

export const PORTAL_STATE_EVENT = 'synk:portal-state';
export const QA_GUEST_EVENT = 'synk:qa-guest-entry';

const EASE = { io: easeIO, ioq: easeIOQ, out: easeOut };
const NON_HOST_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'LINK', 'META', 'NOSCRIPT']);
const FOCUSABLE = 'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';
/* 연결한 구독이 없을 때 「구독 연결하기」 아래에 서는 예시 계정판(11-24 짜임 쌍 맹검에서 지금 판 · 빈 계정판을 모두 이김, 유호님 「둘 다 옮겨」,
   docs/디자인/솔리오_방짜임_20261124). 연결한 뒤의 계정 명단(구독비서 설계 11절)과 같은 꼴이고 값은 예시라 낭독하지 않는다 */
const PEEK_ACCT = (nm, v, when) => `<div class="peek-acct${v ? '' : ' used'}"><span class="peek-nm">${nm}</span><span class="peek-bar"><i style="width:${v}%"></i></span><span class="peek-pc">${v ? v + '%' : ''}</span><span class="peek-when">${when}</span></div>`;
const PEEK_COL = (svc, sub, open, total, accts) => `<div class="peek-col"><div class="peek-col-h"><span><b>${svc}</b><small>${sub}</small></span><span class="peek-num"><strong>${open}<em>/${total}</em></strong>지금 쓸 수 있는 계정</span></div>${accts}</div>`;
const SUB_PEEK = `<section class="sub-peek rise" style="--i:3" data-sub-peek hidden aria-label="연결하면 보이는 모습"><p class="peek-h"><span class="peek-tag">예시</span>연결하면 계정마다 이렇게 보입니다</p><div class="peek-cols" aria-hidden="true">${
  PEEK_COL('Claude', '구독 3개 · 합쳐서 54% 남음', 2, 3, PEEK_ACCT('업무 계정', 100, '월요일 12:00 초기화') + PEEK_ACCT('개인 계정', 62, '일요일 19:59 초기화') + PEEK_ACCT('팀 계정', 0, '다 씀 · 오늘 21:00 열림'))
}${PEEK_COL('Codex', 'ChatGPT 구독 2개', 1, 2, PEEK_ACCT('업무 계정', 81, '토요일 09:00 초기화') + PEEK_ACCT('개인 계정', 0, '다 씀 · 내일 07:30 열림'))}</div></section>`;
/* 솔리오 안의 프로그램 오브제(시안 .rail의 그림). 이름은 컨트롤러가 장면으로 넘긴다. 백업은 방이 생길 때 구독 다음 자리에 넣는다 */
const PROGRAM_ICON = Object.freeze({
  subs: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.6" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M10 10V3.4A6.6 6.6 0 0 1 16.6 10Z" fill="currentColor"/></svg>',
  visits: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.6" fill="none" stroke="currentColor" stroke-width="1.1"/><circle cx="14.7" cy="5.3" r="1.9" fill="currentColor"/></svg>',
  /* 원클릭: 누르는 화살표 하나(11-23 원클릭 시안의 오브제. 그 전은 둘레 안에서 되돌아오는 화살이었다) */
  backup: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.2 3.6v11l3-2.8 2 4.4 2-.9-2-4.3h4.1Z" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></svg>',
  /* 계정 건강: 맥박 한 줄(솔리오 계정건강 시안의 오브제) */
  health: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2.5 10.5h3.2l1.8-4.5 3 8 2-5.5 1.2 2h3.8" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  /* 사무실: 방 하나와 점 눈 둘(솔리오 사무실 시안의 오브제) */
  office: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3.4" y="5" width="13.2" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.1"/><circle cx="7.6" cy="10" r="1.2" fill="currentColor"/><circle cx="12.4" cy="10" r="1.2" fill="currentColor"/></svg>',
});
/* 다가가서 잠깐 머물러야 열리고, 벗어나서 잠깐 지나야 닫힌다(시안 NEAR). pad는 오브제 줄에 다가갔다고 보는 거리(px) */
const NEAR = Object.freeze({ row: 120, prog: 180, close: 400, pad: 64, open: 150, fast: 260, orb: 18, name: 10, zone: 44 });
/* 오브제 이름이 다 펼쳐지는 데 걸리는 시간. 이름 하나가 0.46초에 펼쳐지고 보이는 오브제마다 70ms씩 늦게 시작한다(CSS .obj-n의 --k는 보이는 차례다).
 * 이름이 펼쳐지는 동안에는 그 위에 머물러도 프로그램을 열지 않는다. 셋이면 620ms(시안 railSettle), 둘이면 550ms, 넷이면 690ms다
 * (사이트방문 설계 6절, 맡긴 세션 11-18, 계정건강 PC앱_구현설계 10절) */
export function railSettleMs(count) {
  return 460 + 70 * Math.max(0, count - 1) + 20;
}
const CHEVRON = '<svg viewBox="0 0 8 5" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" d="M1 1l3 3 3-3"/></svg>';

/* 펼침이나 구독 방에서 여는 방(2단계 둘째 조각 설계 1.3절, 시안 data-room="manage" · "account" · "settings"). 맨 위 「돌아가기」, 결론 문장, 줄 묶음, 맨 아래 줄과 글 단추 하나다 */
const ASIDE_NAMES = Object.freeze(['manage', 'account', 'settings', 'pc']);
const ASIDE_LABEL = Object.freeze({ manage: '연결한 계정', account: '내 계정', settings: '설정', pc: '내 PC 진단' });
function asideMarkup(name) {
  return `<div class="room room-top room-aside" data-room="${name}" hidden>
      <button class="quiet up" type="button" data-orb-act="aside-back">돌아가기</button>
      <p class="say" tabindex="-1" data-aside-say><span data-aside-text></span><span class="then" data-aside-then></span></p>
      <div class="rows vis" role="group" aria-label="${ASIDE_LABEL[name]}" data-aside-rows></div>
      <p class="read"><span role="status" aria-live="polite" data-aside-foot></span><button class="reread" type="button" data-room-act="" hidden></button></p>
    </div>`;
}

function markup() {
  return `<div class="orb-stage" data-portal-stage data-ui="none" data-mode="portal">
  <canvas class="orb-canvas" aria-hidden="true"></canvas>
  <canvas class="orb-sig" aria-hidden="true"></canvas>
  <button class="orb-wake" type="button" data-orb-act="wake" aria-label="시작하기"></button>
  <h1 class="sr" data-orb-heading tabindex="-1"></h1>
  <section class="orb-layer" data-layer="ask" aria-label="로그인 방법">
    <p class="lobby-word" aria-hidden="true">Solio</p>
    <div class="ask-in">
      <div class="lanyard" aria-hidden="true"><i></i><i></i></div>
      <div class="badge rise" style="--i:1">
        <span class="clip" aria-hidden="true"></span>
        <div class="badge-h"><img class="badge-logo" src="/assets/launcher/synk.svg" alt="SYNK" width="57" height="40"><span class="badge-k">SOLIO</span></div>
        <div class="badge-id"><span class="badge-face" aria-hidden="true"></span><p class="badge-nm">아직 출근 전입니다<span>로그인하면 솔리오 사무실로 들어갑니다.</span></p></div>
        <p class="ask-unconf" data-ask-unconf hidden></p>
        <div class="ask-ways"><button class="way way-main" type="button" data-orb-act="signin" data-portal-action="signin">로그인</button></div>
        <p class="ask-feedback" role="alert" data-portal-auth-feedback hidden></p>
        <p class="ask-note" role="status" aria-live="polite" data-ask-note></p>
        <div class="status" data-ask-status-box>
          <p role="status" aria-live="polite" data-ask-status></p>
          <p id="portal-invite-error" role="alert" data-portal-invite-error></p>
          <div class="status-acts" data-ask-actions></div>
        </div>
        <p class="badge-f" aria-hidden="true"><span>SYNK</span><span>STAFF</span></p>
      </div>
      <div class="lobby-more rise" style="--i:2">
        <button class="quiet signup" type="button" data-orb-act="signup" data-portal-action="signup">처음이라면 가입하기</button>
        <p class="bak-alone" data-bak-alone hidden><span>업무 백업은 로그인하지 않아도 따로 열 수 있습니다.</span><button class="quiet" type="button" data-orb-act="backup-alone">백업 창 따로 열기</button></p>
        <form class="invite" data-portal-pane="invite" autocomplete="off" novalidate>
          <label for="portal-invite-input">초대받으셨다면</label>
          <input id="portal-invite-input" name="code" type="text" placeholder="여기에 코드를 붙여 넣으세요" spellcheck="false" autocapitalize="off" autocorrect="off" maxlength="200">
        </form>
      </div>
    </div>
  </section>
  <section class="orb-layer" data-layer="switch" aria-label="공간 고르기">
    <div class="sw-top"><p class="sw-lead" data-sw-lead></p><p class="sw-error" role="alert" data-sw-error></p></div>
    <div class="sw-names" data-sw-names></div>
    <p class="sw-foot rise" style="--i:4" data-sw-foot></p>
    <button class="back rise" style="--i:3" type="button" data-orb-act="close-switch">돌아가기<kbd>Esc</kbd></button>
  </section>
  <section class="orb-layer" data-layer="app" aria-label="솔리오">
    <div class="here">
      <button class="here-orb" type="button" data-orb-act="open-switch" aria-expanded="false" aria-label="다른 공간으로 가기"></button>
      <button class="here-name" type="button" data-orb-act="open-switch" aria-expanded="false" aria-label="다른 공간으로 가기"><span data-here-text>SOLIO</span>${CHEVRON}</button>
      <nav class="rail" aria-label="이 공간의 프로그램" data-orb-rail hidden>
        <button class="obj" type="button" data-orb-prog="subs" aria-current="false" style="--k:0">${PROGRAM_ICON.subs}<span class="obj-n"></span></button>
        <button class="obj" type="button" data-orb-prog="backup" aria-current="false" style="--k:1">${PROGRAM_ICON.backup}<span class="obj-n"></span></button>
        <button class="obj" type="button" data-orb-prog="visits" aria-current="false" style="--k:2">${PROGRAM_ICON.visits}<span class="obj-n"></span></button>
        <button class="obj" type="button" data-orb-prog="health" aria-current="false" style="--k:3">${PROGRAM_ICON.health}<span class="obj-n"></span></button>
        <button class="obj" type="button" data-orb-prog="office" aria-current="false" style="--k:4">${PROGRAM_ICON.office}<span class="obj-n"></span></button>
      </nav>
      <button class="quiet legacy-back" type="button" data-orb-act="legacy-back">돌아가기</button>
      <button class="quiet band-close" type="button" data-orb-act="band-close" hidden>PULSE 닫기</button>
    </div>
    <div class="todo-bar" data-todo-bar hidden><span class="todo-n" data-todo-n></span><button class="todo-go" type="button" data-orb-act="todo-start" data-todo-go>1순위부터 처리</button></div>
    <p class="bak-alone bak-alone-app" data-bak-alone-app hidden><span>이 계정에서는 업무 백업 방을 열 수 없습니다.</span><button class="quiet" type="button" data-orb-act="backup-alone">백업 창 따로 열기</button></p>
    <div class="fan" role="group" aria-label="갈 수 있는 공간과 계정" data-orb-fan><p class="fan-error" role="alert" data-fan-error></p><p class="fan-lead" role="status" data-fan-lead></p></div>
    <div class="room room-top" data-room="solio">
      <p class="sr" role="status" aria-live="polite" data-solio-status></p>
      <section class="board rise" style="--i:1" aria-label="남은 사용량" data-board hidden><div class="b-cols" data-board-cols></div></section>
      <p class="rep-h rise" style="--i:2" data-rep-h hidden>솔리오 보고</p>
      <p class="say rise" style="--i:1"><em class="rep-tag" data-say-tag hidden></em><span data-say></span><span class="then" data-then></span></p>
      <p class="sub-start rise" style="--i:2" data-sub-start hidden><button class="sub-go" type="button" data-orb-act="connect">구독 연결하기</button><span>Claude · Codex 계정을 연결할 수 있습니다.</span></p>
      ${SUB_PEEK}
      <div class="brief rise" style="--i:2" data-brief hidden>
        <ol class="report" aria-label="솔리오 보고" data-report hidden></ol>
        <p class="rep-more" data-rep-more hidden></p>
        <p class="rep-cost" data-rep-cost hidden></p>
        <ol class="soon" aria-label="다가오는 일" data-soon></ol>
        <p class="soon-more" data-soon-more hidden></p>
        <p class="live" role="group" data-live><span class="live-big" data-live-big></span><span class="live-unit" data-live-unit></span><span class="live-small" data-live-small></span><button class="reread" type="button" data-orb-act="tok-on" hidden>켜기</button></p>
        <div class="diag" data-diag hidden>
          <p class="diag-h"><span>오늘 진단</span><small data-diag-when></small></p>
          <p class="diag-line"><b data-diag-name></b><em data-diag-word></em><span data-diag-say></span></p>
          <p class="diag-cost" data-diag-cost></p>
        </div>
        <button class="details" type="button" aria-expanded="false" aria-controls="orb-details-top orb-sub-rows" data-details>상세내역</button>
      </div>
      <div class="details-top" id="orb-details-top" data-details-top hidden></div>
      <div class="rows rise" id="orb-sub-rows" style="--i:3" role="group" aria-label="구독별 남은 양" data-rows></div>
      <p class="read rise" style="--i:5"><span data-read></span><button class="reread" type="button" data-orb-act="subs-manage" hidden>계정 관리</button><button class="reread" type="button" data-orb-act="reread">다시 읽기</button><button class="reread" type="button" data-orb-act="connect" hidden>구독 연결하기</button><button class="reread" type="button" data-orb-act="recheck-auth" hidden>다시 확인</button></p>
      <button type="button" class="reread" data-orb-act="open-estimate" hidden>견적 비서 열기</button>
      <span data-estimate-note aria-live="polite" hidden></span>
    </div>
    <div class="room room-top" data-room="solio-visits" hidden>
      <p class="say rise" style="--i:1"><span data-vis-say></span><span class="then" data-vis-then></span></p>
      <div class="rows vis rise" style="--i:3" role="group" aria-label="synk.im 방문자 분석" data-vis-rows></div>
      <p class="read rise" style="--i:5"><span data-vis-when></span><span data-vis-scope></span></p>
    </div>
    <div class="room room-top" data-room="solio-backup" hidden>
      <p class="bak-door-path" data-bak-door hidden><button class="bak-door-back" type="button" data-orb-act="backup-view-close">← 원클릭</button><span class="bak-door-sep" aria-hidden="true">›</span><span class="bak-door-nm" data-bak-door-nm></span></p>
      <p class="say rise" style="--i:1"><span data-bak-say></span><span class="then" data-bak-then></span></p>
      <p class="read acts rise" style="--i:2" role="group" aria-label="원클릭 할 일" data-bak-acts></p>
      <div class="one-board rise" style="--i:3" data-bak-board hidden>
        <section class="one-drive" aria-label="남은 공간" data-bak-drive></section>
        <section class="one-flow" aria-label="원클릭이 하는 일" data-bak-flow>
          <span class="one-helper" aria-hidden="true" data-bak-helper hidden><i></i><i></i></span>
          <button class="one-sum" type="button" aria-expanded="false" data-bak-sum hidden></button>
          <ol class="one-steps" data-bak-steps></ol>
          <div class="one-after" data-bak-groups></div>
        </section>
      </div>
      <div class="rows vis rise" style="--i:3" role="group" aria-label="업무 백업 상태" data-bak-rows></div>
      <p class="read rise" style="--i:5"><span data-bak-when></span><span data-bak-scope></span></p>
      <p class="read bak-foot rise" style="--i:6" data-bak-foot hidden><span data-bak-foot-say></span><button class="reread" type="button" data-orb-act="backup-update" data-bak-foot-go hidden>업데이트</button></p>
    </div>
    <div class="room room-top" data-room="solio-health" hidden>
      <p class="say rise" style="--i:1"><span data-hea-say></span><span class="then" data-hea-then></span></p>
      <div class="rows vis hea rise" style="--i:3" role="group" aria-label="SNS 계정 건강" data-hea-rows></div>
      <p class="read rise" style="--i:5"><span data-hea-when></span><span data-hea-scope></span></p>
    </div>
    <div class="room room-top room-office" data-room="solio-office" hidden>
      <div class="ofc rise" style="--i:1" data-ofc>
        <aside class="ofc-list ofc-scroll" aria-label="사무실의 대화 상대">
          <div class="ofc-list-h"><h2 class="ofc-h">사무실</h2><button class="ofc-plus" type="button" data-off-add-btn aria-expanded="false" aria-label="부서 더하기"><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 1.5v11M1.5 7h11" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg></button></div>
          <div class="rows off ofc-addrows" role="group" aria-label="부서 더하기" data-off-add hidden></div>
          <nav class="ofc-chats" aria-label="대화 상대" data-off-chats></nav>
          <p class="ofc-foot" data-off-foot></p>
          <button class="ofc-cap" type="button" data-off-cap hidden></button>
        </aside>
        <div class="ofc-room">
          <div class="ofc-center">
            <div class="ofc-head">
              <button class="ofc-back" type="button" data-off-back aria-label="대화 상대 목록으로"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 2.5 4.5 8l5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
              <p class="say" tabindex="-1" data-off-head><span class="ofc-nm" data-off-nm></span><span data-off-say></span><span class="then" data-off-then></span></p>
              <button class="quiet ofc-side-btn" type="button" data-off-side-btn aria-expanded="false" aria-controls="ofc-side">이 부서</button>
            </div>
            <p class="more-note off-hint" data-off-hint hidden></p>
            <div class="off-slot" role="img" aria-label="부서마다 직원이 앉아 있는 사무실 그림. 같은 내용이 왼쪽 목록과 오른쪽 칸에 글로 있습니다." data-off-slot hidden><canvas aria-hidden="true" data-off-floor></canvas><p class="off-bubble" aria-hidden="true" data-off-bubble hidden><b></b><span></span></p></div>
            <div class="ofc-thread ofc-scroll" data-off-thread>
              <div class="rows off ofc-now" role="group" aria-label="지금 선 직원" data-off-center hidden></div>
              <div data-off-tasks></div>
              <div class="ofc-empty" data-off-empty hidden><p data-off-empty-say></p><button class="ofc-pill" type="button" data-off-empty-add>부서 더하기</button></div>
            </div>
            <button class="ofc-new" type="button" data-off-new hidden>새 답 보기</button>
            <div class="ofc-compose" data-off-compose></div>
            <p class="ofc-offsay" data-off-offsay hidden></p>
          </div>
          <aside class="ofc-side ofc-scroll" id="ofc-side" aria-label="이 부서" tabindex="-1" data-off-side><button class="quiet ofc-side-close" type="button" data-off-side-close>닫기</button><div class="rows off" role="group" aria-label="이 부서" data-off-rows></div></aside>
        </div>
      </div>
      <div class="biz-host" data-off-feature hidden></div>
    </div>
    <div class="todo-deck" data-todo-deck aria-hidden="true" hidden></div>
    <section class="room room-top room-todo" data-room="solio-todo" aria-label="한 번에 처리" hidden>
      <p class="todo-meta" data-todo-meta><b data-todo-rank></b><span data-todo-why></span><span data-todo-where></span></p>
      <p class="say" id="orb-todo-say" tabindex="-1" data-todo-head><span data-todo-say></span><span class="then" data-todo-then></span></p>
      <p class="todo-acts" role="group" aria-label="이 일 처리하기" data-todo-acts></p>
      <p class="todo-note" role="status" aria-live="polite" data-todo-note></p>
      <p class="todo-foot" data-todo-foot><button class="quiet" type="button" data-orb-act="todo-skip">건너뛰기</button><button class="quiet" type="button" data-orb-act="todo-later">나중에</button><button class="quiet" type="button" data-orb-act="todo-stop">그만하기<kbd>Esc</kbd></button></p>
      <p class="todo-left" data-todo-left></p>
    </section>
    ${ASIDE_NAMES.map(asideMarkup).join('')}
    <div class="room" data-room="space">
      <p class="say rise" style="--i:1"><span data-space-say></span><span class="then" data-space-then></span></p>
      <p class="read rise" style="--i:3"><span data-space-error role="alert"></span><button class="reread" type="button" data-orb-act="reopen-space">다시 열기</button></p>
      <div class="share" role="group" aria-labelledby="orb-share-title" data-share hidden>
        <p class="share-title" id="orb-share-title">공유할 화면을 고르세요</p>
        <p class="share-h" data-share-screens-h>화면</p>
        <div class="share-grid" data-share-screens></div>
        <p class="share-h" data-share-windows-h>창</p>
        <div class="share-grid" data-share-windows></div>
        <button class="quiet share-cancel" type="button" data-orb-act="share-cancel">취소</button>
      </div>
    </div>
  </section>
</div>`;
}

function isVisible(el) {
  if (!el || el.hidden || el.disabled) return false;
  if (typeof el.getClientRects === 'function' && el.getClientRects().length === 0) return false;
  const win = el.ownerDocument?.defaultView;
  const style = win?.getComputedStyle?.(el);
  return !(style && (style.visibility === 'hidden' || style.display === 'none'));
}

export function createOrbFaceView(root, { options = {}, look = {}, onAction = () => false, getMode = () => 'portal', getReducedMotion = () => false } = {}) {
  const doc = root.ownerDocument || globalThis.document;
  const win = doc?.defaultView || globalThis;
  root.id = root.id || 'portal-entry';
  root.classList.add('orb-face-root');
  root.innerHTML = markup();

  const $ = sel => root.querySelector(sel);
  const stageEl = $('.orb-stage');
  const heading = $('[data-orb-heading]');
  const layers = { ask: $('[data-layer="ask"]'), switch: $('[data-layer="switch"]'), app: $('[data-layer="app"]') };
  const ask = {
    unconf: $('[data-ask-unconf]'), signin: $('[data-orb-act="signin"]'), feedback: $('[data-portal-auth-feedback]'), signup: $('[data-orb-act="signup"]'),
    note: $('[data-ask-note]'), form: $('[data-portal-pane="invite"]'), input: $('#portal-invite-input'), status: $('[data-ask-status]'),
    inviteError: $('#portal-invite-error'), actions: $('[data-ask-actions]'), ways: $('.ask-ways'), statusBox: $('[data-ask-status-box]'),
  };
  const sw = { lead: $('[data-sw-lead]'), error: $('[data-sw-error]'), names: $('[data-sw-names]'), foot: $('[data-sw-foot]'), close: $('[data-orb-act="close-switch"]') };
  const app = {
    estimateBtn: $('[data-orb-act="open-estimate"]'), estimateNote: $('[data-estimate-note]'),
    orbBtn: $('.here-orb'), nameBtn: $('.here-name'), name: $('[data-here-text]'), legacyBack: $('.legacy-back'), bandClose: $('.band-close'),
    solio: $('[data-room="solio"]'), say: $('[data-say]'), then: $('[data-then]'), rows: $('[data-rows]'), read: $('[data-read]'),
    brief: $('[data-brief]'), soon: $('[data-soon]'), soonMore: $('[data-soon-more]'), live: $('[data-live]'), liveBig: $('[data-live-big]'), liveUnit: $('[data-live-unit]'), liveSmall: $('[data-live-small]'), tokOn: $('[data-orb-act="tok-on"]'),
    board: $('[data-board]'), boardCols: $('[data-board-cols]'), repH: $('[data-rep-h]'), sayTag: $('[data-say-tag]'), report: $('[data-report]'), repMore: $('[data-rep-more]'), repCost: $('[data-rep-cost]'),
    diag: $('[data-diag]'), diagWhen: $('[data-diag-when]'), diagName: $('[data-diag-name]'), diagWord: $('[data-diag-word]'), diagSay: $('[data-diag-say]'), diagCost: $('[data-diag-cost]'), details: $('[data-details]'), detailsTop: $('[data-details-top]'),
    reread: $('[data-orb-act="reread"]'), subsManage: $('[data-orb-act="subs-manage"]'), fan: $('[data-orb-fan]'), fanError: $('[data-fan-error]'), fanLead: $('[data-fan-lead]'), connect: $('.read [data-orb-act="connect"]'), subStart: $('[data-sub-start]'), subPeek: $('[data-sub-peek]'), recheck: $('[data-orb-act="recheck-auth"]'), solioStatus: $('[data-solio-status]'),
    space: $('[data-room="space"]'), spaceSay: $('[data-space-say]'), spaceThen: $('[data-space-then]'), spaceError: $('[data-space-error]'), reopen: $('[data-orb-act="reopen-space"]'),
    share: $('[data-share]'), shareScreens: $('[data-share-screens]'), shareWindows: $('[data-share-windows]'), shareScreensH: $('[data-share-screens-h]'), shareWindowsH: $('[data-share-windows-h]'),
    rail: $('[data-orb-rail]'), objs: [...root.querySelectorAll('[data-orb-prog]')],
    visits: $('[data-room="solio-visits"]'), visSay: $('[data-vis-say]'), visThen: $('[data-vis-then]'), visRows: $('[data-vis-rows]'), visWhen: $('[data-vis-when]'), visScope: $('[data-vis-scope]'),
    backup: $('[data-room="solio-backup"]'), bakSay: $('[data-bak-say]'), bakThen: $('[data-bak-then]'), bakActs: $('[data-bak-acts]'), bakRows: $('[data-bak-rows]'), bakWhen: $('[data-bak-when]'), bakScope: $('[data-bak-scope]'),
    bakBoard: $('[data-bak-board]'), bakDrive: $('[data-bak-drive]'), bakFlow: $('[data-bak-flow]'), bakHelper: $('[data-bak-helper]'), bakSum: $('[data-bak-sum]'), bakSteps: $('[data-bak-steps]'), bakGroups: $('[data-bak-groups]'),
    bakDoor: $('[data-bak-door]'), bakDoorNm: $('[data-bak-door-nm]'), bakDoorBack: $('[data-orb-act="backup-view-close"]'), bakFoot: $('[data-bak-foot]'), bakFootSay: $('[data-bak-foot-say]'), bakFootGo: $('[data-bak-foot-go]'),
    bakAloneAsk: $('[data-bak-alone]'), bakAloneApp: $('[data-bak-alone-app]'),
    health: $('[data-room="solio-health"]'), heaSay: $('[data-hea-say]'), heaThen: $('[data-hea-then]'), heaRows: $('[data-hea-rows]'), heaWhen: $('[data-hea-when]'), heaScope: $('[data-hea-scope]'),
    office: $('[data-room="solio-office"]'), offHead: $('[data-off-head]'), offSay: $('[data-off-say]'), offThen: $('[data-off-then]'), offHint: $('[data-off-hint]'), offSlot: $('[data-off-slot]'), offFloor: $('[data-off-floor]'), offRows: $('[data-off-rows]'), offFoot: $('[data-off-foot]'),
    ofc: $('[data-ofc]'), offNm: $('[data-off-nm]'), offChats: $('[data-off-chats]'), offAddBtn: $('[data-off-add-btn]'), offAdd: $('[data-off-add]'), offCap: $('[data-off-cap]'), offCenter: $('[data-off-center]'), offThread: $('[data-off-thread]'),
    offCompose: $('[data-off-compose]'), offOffSay: $('[data-off-offsay]'), offEmpty: $('[data-off-empty]'), offEmptySay: $('[data-off-empty-say]'), offEmptyAdd: $('[data-off-empty-add]'), offSide: $('[data-off-side]'), offSideBtn: $('[data-off-side-btn]'), offNew: $('[data-off-new]'),
    todoBar: $('[data-todo-bar]'), todoN: $('[data-todo-n]'), todoGo: $('[data-todo-go]'),
    todoDeck: $('[data-todo-deck]'), todo: $('[data-room="solio-todo"]'), todoMeta: $('[data-todo-meta]'), todoRank: $('[data-todo-rank]'), todoWhy: $('[data-todo-why]'), todoWhere: $('[data-todo-where]'),
    todoHead: $('[data-todo-head]'), todoSay: $('[data-todo-say]'), todoThen: $('[data-todo-then]'), todoActs: $('[data-todo-acts]'), todoNote: $('[data-todo-note]'), todoFoot: $('[data-todo-foot]'), todoLeft: $('[data-todo-left]'),
    asides: Object.fromEntries(ASIDE_NAMES.map(name => {
      const r = $(`[data-room="${name}"]`);
      return [name, { room: r, say: r.querySelector('[data-aside-say]'), text: r.querySelector('[data-aside-text]'), then: r.querySelector('[data-aside-then]'), rows: r.querySelector('[data-aside-rows]'), foot: r.querySelector('[data-aside-foot]'), act: r.querySelector('.read [data-room-act]') }];
    })),
  };
  // 사무실 방의 줄도 방의 줄(data-key)과 같은 규칙으로 열고 접는다(다가가면 열림 · 누르면 고정 · Esc로 접힘). 그래서 같은 묶음 목록에 둔다
  const asideBoxes = [...Object.values(app.asides).map(a => a.rows), app.offRows, app.offCenter, app.offAdd];
  /* 솔리오의 읽기 프로그램 방(방문자 분석, 계정 건강). 짜임이 같다: 결론, 줄, 잰 때와 범위. key는 마지막으로 그린 글이다 */
  const readRooms = {
    visits: { room: app.visits, say: app.visSay, then: app.visThen, rows: app.visRows, when: app.visWhen, scope: app.visScope, key: '' },
    health: { room: app.health, say: app.heaSay, then: app.heaThen, rows: app.heaRows, when: app.heaWhen, scope: app.heaScope, key: '' },
    // 백업 방은 할 일 단추 줄(acts)이 더 있다. 단추는 정해진 동작과 낱말만 넘긴다(src/solio-backup.cjs가 다시 확인한다)
    backup: { room: app.backup, say: app.bakSay, then: app.bakThen, rows: app.bakRows, when: app.bakWhen, scope: app.bakScope, acts: app.bakActs, key: '' },
  };
  const readBoxes = Object.values(readRooms).map(r => r.rows);

  let disposed = false;
  // 구의 움직임 세대. 점 로고가 도는 동안 다른 움직임(로그아웃으로 묻는 화면에 돌아가기 따위)이 시작되면
  // arrive가 남은 자리 옮기기를 하지 않는다(검수 A8)
  let motionGen = 0;
  let scene = null;
  let appliedFocusSeq = -1;
  let hostLocked = false;
  const savedHost = new Map();
  let introWait = null;
  let lastLayer = 'none';
  // 솔리오 안의 프로그램과 방문자 분석의 줄. 펼침은 화면만의 상태다(컨트롤러는 어느 프로그램이 열렸는지만 안다)
  let lastProg = null;
  let restoringVis = false;
  const moreKeys = new WeakMap();
  let railSince = -1e9, progTimer = 0, visTimer = 0, visLeave = 0, subTimer = 0, subLeave = 0;
  /* 구 곁의 펼침(2단계 첫 조각 설계 1.3절). 다가가 머무는 판정은 화면이 하고, 열고 닫는 것은 컨트롤러에 알린다 */
  let fanKey = '', fanTimer = 0, fanLeave = 0, fanWasOpen = false, fanReturn = null, fanRefocus = null, fanRestoring = false;
  /* 방(2단계 둘째 조각). asideReturn은 방을 연 자리(닫을 때 초점을 돌려줄 곳)다. applied는 컨트롤러가 보낸 요청(열 줄, 접을 줄, 초점)을 한 번씩만 따르려고 적어 둔다.
     stale은 입력 중이거나 누르는 중이라 다시 짓기를 미룬 안쪽이다. 손을 떼거나 초점이 그 안쪽을 떠나면 마저 짓는다 */
  let lastAside = null, asideReturn = null, pressing = false, liveSeq = 0, fldSeq = 0;
  // 칸에서 Enter로 누른 단추. 일이 끝났는데 칸이 남아 있으면(실패나 칸이 남는 저장) 초점을 그 칸으로 돌린다(PC 0.5.0 설계 2절)
  // 끝났는지는 그 일이 그린 마지막 판을 보고 정한다. 한 번에 끝나는 저장도 중간에 한 번 그리므로, 판단은 그리기 묶음이 지나간 뒤로 미룬다
  let enterBack = null, enterTimer = 0;
  /* 방 안에서 옛 화면(마을 기록)을 열 때 누른 단추. 옛 화면을 닫으면 그리로 초점을 돌린다 */
  let legacyReturn = null, lastModeSeen = null;
  const applied = { open: {}, close: {}, focus: {} };
  const stale = new Map();
  const ptrPx = { x: -1e4, y: -1e4, t: 0, v: 0 };
  const canHover = () => { try { return win.matchMedia?.('(hover: hover)')?.matches !== false; } catch { return true; } };
  const clock = () => { try { return win.performance?.now?.() ?? Date.now(); } catch { return Date.now(); } };
  // 키보드로 옮긴 초점인가. 창에 초점이 없으면 :focus-visible이 맞지 않으므로 마지막 입력이 자판이었는지도 본다
  let keyboardModality = false;
  const focusVisible = el => { if (keyboardModality) return true; try { return el.matches(':focus-visible'); } catch { return false; } };
  const onAnyKey = event => { if (event.key === 'Tab' || event.key?.startsWith?.('Arrow')) keyboardModality = true; };
  // 포인터를 누르면 Enter로 누른 단추의 되돌림 약속도 버린다(PC 0.5.0 설계 2.2, 검토 D10)
  const onAnyPointer = () => { keyboardModality = false; enterBack = null; };
  // 그 단추에서 초점이 떠나면(되돌리는 중이 아닐 때) 약속을 버린다. 그리기 없이 끝난 일 뒤에 1분 장면이 초점을 끌어오지 않는다
  const onEnterLeave = event => { if (enterBack && !restoringVis && event.target?.dataset?.roomAct === enterBack.act && (event.target.dataset.roomArg ?? '') === enterBack.arg) enterBack = null; };

  const reduced = () => {
    try { if (getReducedMotion() === true) return true; } catch { /* 무시 */ }
    if (doc?.documentElement?.dataset?.motion === 'reduced') return true;
    try { return win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true; } catch { return false; }
  };
  const homePoint = () => {
    const b = app.orbBtn.getBoundingClientRect(), s = stageEl.getBoundingClientRect();
    return { x: b.left - s.left + b.width / 2, y: b.top - s.top + b.height / 2 };
  };
  let noWebGL = false, noCanvas = false;
  try { noWebGL = globalThis.__synkOrbNoWebGL === true || win.__synkOrbNoWebGL === true; } catch { noWebGL = false; }
  try { noCanvas = globalThis.__synkOrbNoCanvas === true || win.__synkOrbNoCanvas === true; } catch { noCanvas = false; }
  /* 시작 창에서 넘어올 때: 드러남이 시작 창과 같은 자세에서 이어지는 첫 장을 그리면 본체에 알린다. 본체는 그때 앱 창을 보이고 시작 창을 없앤다(1-가 구현 설계 2절) */
  let introPainted = false, firstFrameSent = false;
  const onRender = () => { if (!introPainted || firstFrameSent) return; firstFrameSent = true; try { void Promise.resolve(options.onFirstFrame?.()).catch(() => {}); } catch { /* 무시 */ } };
  const stage = createOrbStage($('.orb-canvas'), { getReducedMotion: reduced, getHome: homePoint, places: look.places !== false, eyes: look.eyes !== false, noWebGL, noCanvas, onRender, onEyes: m => { stageEl.dataset.eyes = m; } });
  /* 지도의 효과음(2026-11-20 유호님). look.sound가 false이거나 설정 방 「화면」 줄에서 끄면 내지 않는다 */
  const soundPref = followSoundPreference(options.rooms?.desktop);
  const sound = createOrbSound({ win, enabled: () => look.sound !== false && soundPref.on() && doc?.hasFocus?.() !== false });   // 앱 창이 뒤에 있을 때는 내지 않는다(Fable 최종 검수 F3)
  const sig = createOrbSignature($('.orb-sig'), { getReducedMotion: reduced, getWidth: () => stageEl.getBoundingClientRect().width || win.innerWidth || 1440 });

  /* ── 옛 런처 가리기(지금 얼굴의 lockHostElements와 같다) ── */
  function hostElements() {
    if (Array.isArray(options.hostElements) && options.hostElements.length > 0) return options.hostElements.filter(el => el && el !== root && el.nodeType === 1);
    const parent = root.parentElement;
    if (!parent) return [];
    return [...parent.children].filter(el => el && el !== root && el.nodeType === 1 && !NON_HOST_TAGS.has(el.tagName) && el.tagName !== 'DIALOG' && el.id !== 'toast');
  }
  function setHostLocked(locked) {
    if (locked === hostLocked) return;
    if (locked) {
      for (const el of hostElements()) {
        if (!savedHost.has(el)) savedHost.set(el, { inert: Boolean(el.inert), inertAttr: el.hasAttribute?.('inert') === true, ariaHidden: el.getAttribute?.('aria-hidden') ?? null });
        el.inert = true; el.setAttribute?.('inert', ''); el.setAttribute?.('aria-hidden', 'true');
      }
    } else {
      for (const [el, prev] of savedHost.entries()) {
        el.inert = prev.inert;
        if (prev.inertAttr || prev.inert) el.setAttribute?.('inert', ''); else el.removeAttribute?.('inert');
        if (prev.ariaHidden === null) el.removeAttribute?.('aria-hidden'); else el.setAttribute?.('aria-hidden', prev.ariaHidden);
      }
      savedHost.clear();
    }
    hostLocked = locked;
  }

  /* ── 그리기 ── */
  function setText(el, text) { if (el && el.textContent !== (text || '')) el.textContent = text || ''; }
  function button(cls, text, attrs = {}) {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = text;
    for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) b.setAttribute(k, v);
    return b;
  }
  function renderActions(container, actions, busy, busyAction) {
    const key = JSON.stringify(actions.map(a => [a.action, a.label, a.key]));
    if (container.dataset.key !== key) {
      container.dataset.key = key;
      container.replaceChildren(...actions.map(a => button('quiet', a.label, { 'data-orb-act': a.action, 'data-portal-action': a.action, 'data-orb-key': a.key || '' })));
    }
    for (const b of container.querySelectorAll('button')) {
      const isCancel = b.dataset.orbKey === 'cancel';
      b.disabled = busy && !(isCancel && (busyAction === 'invite' || busyAction === 'signin'));
    }
  }

  function renderAsk(s) {
    const a = s.ask;
    ask.unconf.hidden = !a.unconfigured;
    setText(ask.unconf, a.unconfigured ? `로그인 설정을 찾지 못했습니다. ${a.unconfiguredText}` : '');
    ask.ways.hidden = !a.showSignIn;
    ask.signin.hidden = !a.showSignIn;
    ask.signup.hidden = !a.showSignUp;
    ask.form.hidden = !a.showInvite;
    ask.feedback.hidden = !a.authFeedback;
    setText(ask.feedback, a.authFeedback);
    setText(ask.note, a.note);
    setText(ask.status, a.status);
    setText(ask.inviteError, a.inviteError);
    if (a.wait) stageEl.dataset.wait = a.wait; else delete stageEl.dataset.wait;
    // 기다리는 동안 사라지는 칸과, 기다리지 않을 때 숨은 상태 묶음은 inert로 둔다. CSS가 0.35초 뒤에 숨기는 동안에도 초점과 Tab이 밟지 않게 한다(0.4.95 원천 후보 검수)
    for (const el of [ask.ways, ask.signup, ask.form]) el.inert = Boolean(a.wait);
    ask.statusBox.inert = !a.wait;
    renderActions(ask.actions, a.actions, s.busy, s.busyAction);
    const busy = s.busy;
    ask.signin.disabled = busy;
    ask.signup.disabled = busy;
    ask.input.disabled = busy;
  }

  function renderSwitch(s) {
    const w = s.switch;
    if (!w) return;
    stageEl.dataset.switchKind = w.kind;
    setText(sw.lead, w.lead);
    setText(sw.error, w.error);
    const key = JSON.stringify(w.names.map(n => [n.space, n.current]));
    if (sw.names.dataset.key !== key) {
      sw.names.dataset.key = key;
      sw.names.replaceChildren(...w.names.map((n, i) => {
        const b = doc.createElement('button');
        b.type = 'button'; b.className = 'sw rise'; b.style.setProperty('--i', String(i));
        b.dataset.go = n.space;
        b.setAttribute('aria-current', String(n.current));
        const label = doc.createElement('span'); label.className = 'sw-n'; label.textContent = n.label;
        const desc = doc.createElement('span'); desc.className = 'sw-d'; desc.textContent = n.desc;
        const here = doc.createElement('span'); here.className = 'sw-now'; here.textContent = '지금 여기';
        b.append(label, desc, here);
        return b;
      }));
    }
    const footItems = w.kind === 'entry' ? w.actions.map(a => ({ ...a, kind: 'act' })) : w.foot.map(f => ({ ...f, kind: 'foot' }));
    const fkey = JSON.stringify(footItems.map(f => [f.kind, f.action, f.label]));
    if (sw.foot.dataset.key !== fkey) {
      sw.foot.dataset.key = fkey;
      sw.foot.replaceChildren(...footItems.map(f => (f.kind === 'foot'
        ? button('quiet', f.label, { 'data-orb-act': 'foot', 'data-foot': f.action })
        : button('quiet', f.label, { 'data-orb-act': f.action, 'data-portal-action': f.action }))));
    }
    sw.close.hidden = !w.showClose;
    for (const b of [...sw.names.querySelectorAll('button'), ...sw.foot.querySelectorAll('button'), sw.close]) b.disabled = s.busy;
    layoutSwitch();
  }
  function layoutSwitch() {
    const r = stageEl.getBoundingClientRect();
    const g = switchGeom(r.width || 1, r.height || 1);
    sw.names.style.top = Math.round(g.cy + g.r + (g.wide ? Math.max(40, (r.height || 1) * 0.075) : 22)) + 'px';
  }

  /* 구독 줄. 줄 안쪽(2단계 첫 조각 설계 2.4절)은 방문자 분석 줄과 같은 틀이다. 1분마다 오는 장면이 펼친 줄과 고정과 초점을 지우지 않게,
     줄의 차례가 같으면 그 자리의 글만 고쳐 쓰고, 차례가 달라 새로 지을 때는 서비스 이름으로 되살린다 */
  function renderRows(today) {
    const rows = today.rows || [];
    renderSubRows(rows);
    // 구독 줄 아래의 종류가 다른 줄(요금, 모델별 토큰)은 줄 열쇠(data-key)로 그린다(2단계 둘째 조각 설계 2.4절 · 3.4절).
    // 모델별 토큰 줄은 구독이 없어도 서므로 구독 줄 수와 상관없이 그린다
    putRows(app.rows, today.extra || [], 'solio');
  }
  function renderSubRows(rows) {
    const key = JSON.stringify(rows.map(r => [r.key, r.name, r.sub, r.gauge, r.val, r.when, r.urgent, r.label, r.more]));
    if (app.rows.dataset.key === key) return;
    app.rows.dataset.key = key;
    clearTimeout(subTimer);
    const old = [...app.rows.querySelectorAll('button.row[data-svc]')];
    if (rows.length && old.length === rows.length && old.every((b, i) => b.dataset.svc === String(rows[i].key))) { rows.forEach((r, i) => fillSubRow(old[i], r)); return; }
    const kept = new Map(rows.length ? old.filter(b => b.classList.contains('opened')).map(b => [b.dataset.svc, b.classList.contains('pin')]) : []);
    const focused = rows.length ? old.find(b => b === doc.activeElement)?.dataset.svc : undefined;
    // 줄 안쪽(계정 관리 단추)에 있던 초점도 줄과 동작으로 기억해 둔다(검수 A4)
    const fa = doc.activeElement, inMore = rows.length && fa && app.rows.contains(fa) ? fa.closest?.('.more') : null;
    // 팁 반응 단추는 방 동작(data-room-act · data-room-arg)이라 그것도 기억한다(검수 A)
    const innerAt = inMore ? { svc: inMore.previousElementSibling?.dataset.svc, act: fa.dataset?.orbAct || '', roomAct: fa.dataset?.roomAct, roomArg: fa.dataset?.roomArg } : null;
    // 구독 줄만 갈아 끼운다. 그 아래의 줄(data-key)은 그대로 두고 그 앞에 넣는다
    for (const b of old) { if (b.nextElementSibling?.classList.contains('more')) b.nextElementSibling.remove(); b.remove(); }
    const anchor = app.rows.querySelector(':scope > button.row[data-key]');
    for (const n of rows.flatMap(subRow)) app.rows.insertBefore(n, anchor);
    for (const b of app.rows.querySelectorAll('button.row[data-svc]')) if (kept.has(b.dataset.svc)) { setMore(b, true); if (kept.get(b.dataset.svc)) b.classList.add('pin'); }
    const again = focused === undefined ? null : [...app.rows.querySelectorAll('button.row[data-svc]')].find(b => b.dataset.svc === focused);
    if (again) { restoringVis = true; try { again.focus({ preventScroll: true }); } catch {} finally { restoringVis = false; } }
    const home = innerAt ? [...app.rows.querySelectorAll('button.row[data-svc]')].find(b => b.dataset.svc === innerAt.svc) : null;
    if (home) refocusIn(home, innerAt.act, innerAt);
  }
  function subRow(r) {
    const b = el('button', 'row');
    b.type = 'button';
    b.dataset.svc = String(r.key);
    b.setAttribute('aria-expanded', 'false');
    const more = el('div', 'more');
    more.setAttribute('aria-hidden', 'true');
    more.inert = true;
    more.append(el('div', 'more-in'));
    fillSubRow(b, r, more);
    return [b, more];
  }
  /* 줄 하나와 그 안쪽의 글을 쓴다. 펼침, 고정, 초점은 건드리지 않는다. 자료가 없는 줄은 자료 함수가 이미 뺐다(solio-today.mjs moreOf) */
  function fillSubRow(b, r, more = b.nextElementSibling) {
    b.classList.toggle('now', !!r.urgent);
    if (b.getAttribute('aria-label') !== r.label) b.setAttribute('aria-label', r.label);
    const nm = el('span', 'nm', r.name);
    if (r.sub) nm.append(el('small', '', r.sub));
    const gauge = el('span', 'gauge'); gauge.setAttribute('aria-hidden', 'true');
    const fill = el('i'); fill.style.setProperty('--v', (typeof r.gauge === 'number' ? Math.max(0, Math.min(100, r.gauge)) : 0) + '%');
    if (typeof r.gauge !== 'number') fill.hidden = true;
    gauge.append(fill);
    b.replaceChildren(nm, gauge, el('span', 'val', r.val || ''), el('span', 'when', r.when || ''));
    const inner = more?.firstElementChild;
    if (!inner) return;
    const m = r.more || {}, moreKey = JSON.stringify(m);
    if (moreKeys.get(inner) === moreKey) return;
    moreKeys.set(inner, moreKey);
    // 안쪽 단추에 있던 초점은 같은 동작의 새 단추로 옮긴다. 새로 지으면서 body로 풀리지 않게 한다(검수 A4)
    const fa = doc.activeElement, keepAct = fa && inner.contains(fa) ? fa.dataset?.orbAct || '' : null, keepRoom = keepAct !== null ? { roomAct: fa.dataset?.roomAct, roomArg: fa.dataset?.roomArg } : null;
    inner.replaceChildren();
    let j = 0;
    const put = n => { n.style.setProperty('--j', String(j++)); inner.append(n); };
    if (m.say) put(el('p', 'more-say', m.say));
    for (const f of m.fix || []) put(el('p', 'more-note more-fix', f));
    for (const a of m.accounts || []) {
      const row = el('div', 'row sub'), name = el('span', 'nm', a.name);
      if (a.tag) name.append(el('small', '', a.tag));
      row.append(name, el('span', 'mid', ''), el('span', 'val', a.val), el('span', 'when', a.when));
      put(row);
    }
    if (m.week) {
      const row = el('div', 'row sub row-plain'), week = el('span', 'week');
      week.setAttribute('role', 'img');
      week.setAttribute('aria-label', '지난 7일의 하루 사용량' + (m.week.avg ? ', ' + m.week.avg : ''));
      m.week.bars.forEach((x, k) => { const i = el('i', [k === m.week.bars.length - 1 ? 'today' : '', x ? '' : 'none'].filter(Boolean).join(' ')); i.style.setProperty('--h', (x ? x.height : 0) + '%'); week.append(i); });
      row.append(el('span', 'nm', '지난 7일'), week, el('span', 'val', m.week.avg));
      put(row);
    }
    if (m.cost) {
      const row = el('div', 'row sub');
      row.append(el('span', 'nm', '요금'), el('span', 'mid', m.cost.note), el('span', 'val', m.cost.val), el('span', 'when', m.cost.bill));
      put(row);
    }
    if (m.empty) put(el('p', 'more-note', m.empty));
    // 팁 한 줄과 반응 단추 둘(설계 검토 D7). 반응한 뒤에는 단추 대신 알림 줄이 남는다
    if (m.tip) {
      put(el('p', 'more-note more-tip', m.tip.text));
      if (!m.tip.done) {
        const tipActs = el('p', 'more-acts');
        for (const [text, action] of [['도움 됐습니다', 'helpful'], ['이런 팁 그만', 'stop']]) tipActs.append(actButton([text, 'tip', m.tip.key + '|' + action, m.tip.busy ? 'off' : ''], ''));
        put(tipActs);
      }
      const live = el('p', 'more-note more-live', m.tip.live || '');
      live.setAttribute('role', 'status');
      live.setAttribute('aria-live', 'polite');
      put(live);
    }
    const acts = el('p', 'more-acts');
    // 어느 구독에서 눌렀는지 넘긴다. 계정 관리 방이 그 구독의 첫 계정 줄을 연 채 연다(2단계 둘째 조각 설계 9.3)
    acts.append(button('reread', '계정 관리', { 'data-orb-act': 'connect', 'data-orb-arg': String(r.key) }));
    put(acts);
    if (keepAct !== null) refocusIn(b, keepAct, keepRoom);
  }
  /* 줄 안쪽에 있던 초점을 되살린다. 그 동작의 단추가 열린 안쪽에 있으면 거기로, 없으면 줄 단추로 돌린다 */
  function refocusIn(b, act, at = null) {
    const more = b.nextElementSibling, open = more && !more.inert;
    const byRoom = open && at?.roomAct ? [...more.querySelectorAll('[data-room-act]')].find(x => x.dataset.roomAct === at.roomAct && (x.dataset.roomArg || '') === (at.roomArg || '')) : null;
    const t = byRoom || (act && open ? more.querySelector(`[data-orb-act="${act}"]`) : null);
    restoringVis = true;
    try { (t || b).focus?.({ preventScroll: true }); } catch {} finally { restoringVis = false; }
  }

  /* ── 비서 판(솔리오 구독 비서 설계 3절) ── 상세내역을 펼쳤는지는 화면이 앱을 켜 둔 동안 기억한다(설계 3.5) */
  let detailsOpen = false, liveOut = null, liveFlash = null;
  const soonItem = i => { const li = el('li'); li.append(el('span', 'w', i.when), el('span', 't', i.text)); return li; };
  function setDetails(open) {
    detailsOpen = open;
    app.details.setAttribute('aria-expanded', String(open));
    setText(app.details, open ? '상세내역 접기' : '상세내역');
    const fa = doc.activeElement;
    app.rows.hidden = !open || !app.rows.children.length;
    app.detailsTop.hidden = !open || !app.detailsTop.children.length;
    // 접을 때 초점이 안에 있었으면 상세내역 단추로 옮긴다. body로 빠지지 않게 한다(설계 검토 D9)
    if (!open && fa && (app.rows.contains(fa) || app.detailsTop.contains(fa))) { closeMores(true); try { app.details.focus({ preventScroll: true }); } catch {} }
    // 펼친 내역의 머리가 보이는 범위 밖이면 그 자리로 방을 옮긴다. 아래쪽에서 시작할 때도, 방이 이미 내려가 머리가 위로 넘어갔을 때도(Fable 최종 F2)
    if (open) {
      const r = app.solio, first = !app.detailsTop.hidden ? app.detailsTop : app.rows;
      if (r && first && !first.hidden && (first.offsetTop > r.scrollTop + r.clientHeight * 0.55 || first.offsetTop < r.scrollTop + 8)) r.scrollTo?.({ top: Math.max(0, first.offsetTop - 24), behavior: reduced() ? 'auto' : 'smooth' });
    }
  }
  /* ── 계정판(11-24 유호님 「어떤 계정이 남아있는지 먼저」, 솔리오 구독 비서 설계 11절) ──
     Claude · Codex마다 머리(지금 쓸 수 있는 계정 / 이 PC 계정)와 계정 줄. 금색 막대는 지금 쓸 수 있는 남은 양뿐이다.
     다 쓴 계정은 한 줄로 접고 누르면 그 자리에서 펼친다. 펼친 서비스는 앱을 켜 둔 동안 기억한다. 계정 이름과 글은 textContent로만 넣는다 */
  const boardOpen = new Set();
  let boardData = null;
  const boardKey = () => JSON.stringify([boardData, [...boardOpen]]);
  function boardRowEl(r) {
    const li = el('li', 'b-row b-' + r.tone + (r.first ? ' b-first' : ''));
    const bar = el('span', 'b-bar');
    bar.setAttribute('aria-hidden', 'true');
    if (r.bar !== null && r.bar !== undefined) { const f = el('i'); f.style.setProperty('--v', String(Math.max(0, Math.min(100, Number(r.bar) || 0)) / 100)); bar.append(f); }
    const note = el('span', 'b-note', r.note);
    if (r.first) note.append(el('em', 'b-go', '먼저 쓰세요'));
    li.append(el('span', 'b-name', r.name), bar, el('span', 'b-pct', r.pct), note);
    return li;
  }
  function boardColEl(c) {
    const col = el('section', 'b-col' + (c.urgent ? ' b-urgent' : '') + (c.flow ? ' b-flow' : ''));
    col.setAttribute('aria-label', c.label);
    // 숫자(천 단위 쉼표 포함)가 아닌 큰 글은 상태 글(붉은 「막힘」 · 「다 씀」)이다. 읽기 전 · 다른 계정 로그인 중인 「–」는 막힘이 아니라 붉게 쓰지 않는다(quiet)
    const big = el('p', 'b-big' + (/^[\d,]+$/.test(c.big.value) || c.big.quiet ? '' : ' b-word'));
    big.append(el('b', '', c.big.value));
    if (c.big.unit) big.append(el('small', '', c.big.unit));
    const sub = el('p', 'b-sub', c.sub);
    if (c.alarm) { if (c.sub) sub.append(' · '); sub.append(el('em', 'b-alarm', c.alarm)); }
    const head = el('div', 'b-head');
    head.setAttribute('aria-hidden', 'true');
    head.append(el('p', 'b-svc', c.name), big, sub, el('p', 'b-cap', c.big.label));
    // 제목(지금 사용량) 아래 약한 소제목: 무료 API 크레딧, Gemini는 Flow 크레딧(11-26 유호님, 설계 11.10)
    if (c.credit) head.append(el('p', 'b-credit', c.credit));
    const rows = el('ol', 'b-rows');
    rows.append(...c.rows.map(boardRowEl));
    col.append(head, rows);
    if (c.fold) {
      const open = boardOpen.has(c.key), id = 'orb-board-more-' + c.key;
      const btn = el('button', 'b-fold', c.fold.label);
      btn.type = 'button'; btn.dataset.boardFold = c.key;
      btn.setAttribute('aria-expanded', String(open)); btn.setAttribute('aria-controls', id);
      const more = el('ol', 'b-rows b-more');
      more.id = id; more.hidden = !open;
      more.append(...c.fold.rows.map(boardRowEl));
      col.append(btn, more);
    }
    return col;
  }
  /* 계정판 안의 초점이 갈 곳을 잃으면 상세내역(없으면 다시 읽기)으로 옮긴다. body로 빠지지 않게(카본 solio-subs-accounts-20261124 A1) */
  const boardFocusOut = () => { const to = !app.details.hidden ? app.details : app.reread; try { to.focus({ preventScroll: true }); } catch {} };
  function renderAccountBoard(bd) {
    // 다시 지을 때 접기 단추에 있던 초점은 같은 서비스의 단추로, 그 단추가 없어졌거나 계정판이 숨으면 상세내역으로
    const fa = doc.activeElement, inside = Boolean(fa && app.board.contains(fa)), again = inside ? fa.dataset?.boardFold || null : null;
    app.board.hidden = !bd;
    app.solio.classList.toggle('boarded', Boolean(bd));
    boardData = bd || null;
    if (!bd) { app.board.dataset.key = ''; if (inside) boardFocusOut(); return; }
    const key = boardKey();
    if (app.board.dataset.key === key) return;
    app.board.dataset.key = key;
    // 막대는 방에 들어올 때 한 번만 차오른다. 새 자료로 다시 지을 때는 차오르지 않는다(설계 11.5, 방에 들어오면 enterRoom이 푼다)
    const again2 = app.boardCols.children.length > 0;
    app.boardCols.replaceChildren(...bd.cols.map(boardColEl));
    if (again2) app.board.classList.add('still');
    if (inside) {
      const b = again ? [...app.boardCols.querySelectorAll('[data-board-fold]')].find(x => x.dataset.boardFold === again) : null;
      if (b) { try { b.focus({ preventScroll: true }); } catch {} } else boardFocusOut();
    }
  }
  function toggleBoardFold(btn) {
    const key = btn.dataset.boardFold;
    if (boardOpen.has(key)) boardOpen.delete(key); else boardOpen.add(key);
    const open = boardOpen.has(key), more = btn.nextElementSibling;
    btn.setAttribute('aria-expanded', String(open));
    if (more?.classList.contains('b-more')) more.hidden = !open;
    app.board.dataset.key = boardKey();
  }
  /* 솔리오 보고 한 줄: 꼬리표(지금 · 곧 · 오늘 · 때 · 진단)와 문장. 첫 줄(맨 위 한 가지)은 [data-say]가 맡는다 */
  function reportItem(i) {
    const li = el('li', 'r-item');
    li.dataset.tone = i.tone || 'info';
    const say = el('span', 'r-say');
    if (i.name) say.append(el('b', 'r-name', i.name), el('em', 'r-word', i.word || ''));
    if (i.say) say.append(el('span', '', i.say));
    if (i.then) say.append(el('span', 'r-then', i.then));
    li.append(el('span', 'r-tag', i.tag), say);
    return li;
  }
  function renderBrief(b, fold) {
    app.brief.hidden = !b;
    // 계정판은 줄을 접는 동안 맨 위에 선다(11-24, 설계 11절). 보고는 다 읽었을 때만이다
    const bd = b && fold ? b.board || null : null, rep = bd && b.report ? b.report : null;
    renderAccountBoard(bd);
    // 계정판이 있으면 상세내역 단추를 맨 아래 줄(계정 관리 · 다시 읽기 옆)로 옮겨 단추를 한 줄에 모은다(미학 맹검 11-24 C018). 옮기면 초점이 빠지니 되살린다
    const readLine = app.reread.closest('.read'), hadDetails = doc.activeElement === app.details;
    if (bd && app.details.parentElement !== readLine) readLine.insertBefore(app.details, app.subsManage);
    else if (!bd && app.details.parentElement !== app.brief) app.brief.append(app.details);
    if (hadDetails && doc.activeElement !== app.details) { try { app.details.focus({ preventScroll: true }); } catch {} }
    app.solio.classList.toggle('reported', Boolean(rep));
    app.repH.hidden = !rep;
    app.sayTag.hidden = !rep;
    setText(app.sayTag, rep ? rep.tag : '');
    if (rep) app.sayTag.dataset.tone = rep.tone || 'info';
    const shown = rep ? rep.shown : [], rkey = JSON.stringify(shown);
    if (app.report.dataset.key !== rkey) { app.report.dataset.key = rkey; app.report.replaceChildren(...shown.map(reportItem)); }
    app.report.hidden = !shown.length;
    // 첫 화면에 다 못 보인 보고는 몇 줄이 어디 있는지 한 줄로 알린다(Fable 최종 F3)
    setText(app.repMore, rep && rep.more ? '보고 ' + rep.more + '개가 상세내역에 더 있습니다.' : '');
    app.repMore.hidden = !rep || !rep.more;
    setText(app.repCost, rep ? b.diag?.cost || '' : '');
    app.repCost.hidden = !rep || !b.diag?.cost;
    if (!b) { app.detailsTop.hidden = true; return; }
    // 계정판이 있으면 다가오는 일과 진단은 보고 안에 있다. 따로 세우지 않는다
    const soon = bd ? [] : b.soon?.shown || [], key = JSON.stringify(soon);
    if (app.soon.dataset.key !== key) { app.soon.dataset.key = key; app.soon.replaceChildren(...soon.map(soonItem)); }
    app.soon.hidden = !soon.length;
    setText(app.soonMore, !bd && b.soon?.more ? '48시간 안에 ' + b.soon.more + '개가 더 있습니다. 상세내역에 있습니다.' : '');
    app.soonMore.hidden = Boolean(bd) || !b.soon?.more;
    // 지금 출력. 숫자가 오르면 숫자만 잠깐 밝아진다(움직임 줄이기에서는 그대로)
    const l = b.live, tokFocus = doc.activeElement === app.tokOn;
    app.live.hidden = !l;
    if (l) {
      setText(app.liveBig, l.big); setText(app.liveUnit, l.unit); setText(app.liveSmall, l.small);
      if (app.live.dataset.state !== l.state) app.live.dataset.state = l.state;
      // 「켜기」를 누르면 단추가 사라진다. 초점이 그 단추에 있었으면 상세내역 단추(없으면 다시 읽기)로 옮긴다(화면 검수 A8)
      const hideOn = l.state !== 'off', hadFocus = hideOn && !app.tokOn.hidden && tokFocus;
      app.tokOn.hidden = hideOn;
      if (hadFocus) { const to = !app.details.hidden ? app.details : app.reread; try { to.focus({ preventScroll: true }); } catch {} }
      const label = l.state === 'on' ? ['지금 출력', l.unit, l.big + ' 토큰', l.small].filter(Boolean).join(', ') : l.small;
      if (app.live.getAttribute('aria-label') !== label) app.live.setAttribute('aria-label', label);
      if (l.state === 'on' && liveOut !== null && l.out > liveOut && !reduced()) {
        app.liveBig.classList.add('bump'); clearTimeout(liveFlash);
        liveFlash = setTimeout(() => app.liveBig.classList.remove('bump'), 600);
      }
      liveOut = l.state === 'on' ? l.out : null;
    }
    // 오늘 진단: 첫 화면에는 가장 무거운 판정 한 줄과 구독료 한 줄(설계 검토 D11). 계정판이 있으면 보고의 「진단」 줄이 맡는다
    const d = b.diag, top = d?.items?.[0];
    app.diag.hidden = Boolean(bd) || !d || (!top && !d.cost && !d.manual);
    if (d) {
      setText(app.diagWhen, d.when || '');
      // 판정의 할 일과 근거의 범위(「Codex 한도 기준」)까지 함께 쓴다(화면 검수 A5)
      setText(app.diagName, top ? top.name : ''); setText(app.diagWord, top ? top.word : ''); setText(app.diagSay, top ? [top.line || top.say, top.scope ? '(' + top.scope + ')' : ''].filter(Boolean).join(' ') : '');
      app.diagName.parentElement.hidden = !top;
      // 자동으로 읽는 구독이 없고 직접 넣은 구독만 있으면 그 한 줄을 요금 줄 위에 둔다(화면 검수 A6)
      setText(app.diagCost, [!top && d.manual ? d.manual : '', d.cost || ''].filter(Boolean).join(' '));
    }
    renderDetailsTop(b, Boolean(bd));
    app.details.hidden = !fold;
    if (!fold) { app.detailsTop.hidden = true; return; }
    app.details.setAttribute('aria-expanded', String(detailsOpen));
    setText(app.details, detailsOpen ? '상세내역 접기' : '상세내역');
    app.detailsTop.hidden = !detailsOpen || !app.detailsTop.children.length;
  }
  /* 상세내역 맨 위: 보고의 나머지와 48시간 안의 일 모두(계정판이 있을 때), 다가오는 일 모두(첫 화면에 다 못 보였을 때), 진단 모두 */
  function renderDetailsTop(b, boarded = false) {
    const rest = boarded && b.report ? b.report.items.slice(b.report.shown.length) : [];
    const all = boarded ? b.soon?.all || [] : b.soon && b.soon.more ? b.soon.all : [], d = b.diag;
    const key = JSON.stringify([rest, all, d && d.items, d && d.manual]);
    if (app.detailsTop.dataset.key === key) return;
    app.detailsTop.dataset.key = key;
    const parts = [];
    if (rest.length) {
      parts.push(el('p', 'details-h', '솔리오 보고 · 나머지'));
      const ol = el('ol', 'report'); ol.setAttribute('aria-label', '솔리오 보고 나머지'); ol.append(...rest.map(reportItem)); parts.push(ol);
    }
    if (all.length) {
      parts.push(el('p', 'details-h', '다가오는 일 · 48시간'));
      const ol = el('ol', 'soon'); ol.setAttribute('aria-label', '48시간 안에 다가오는 일 모두'); ol.append(...all.map(soonItem)); parts.push(ol);
    }
    if (d && d.items && d.items.length) {
      parts.push(el('p', 'details-h', '오늘 진단 · 구독마다'));
      for (const i of d.items) {
        const p = el('p', 'diag-line');
        p.append(el('b', '', i.name), el('em', '', i.word), el('span', '', [i.say, i.more, i.scope ? '(' + i.scope + ')' : ''].filter(Boolean).join(' ')));
        parts.push(p);
      }
    }
    if (d && d.manual) parts.push(el('p', 'diag-cost', d.manual));
    app.detailsTop.replaceChildren(...parts);
  }

  /* ── 「한 번에 처리」(docs/디자인/솔리오_한번에처리_20261124/README.md 2절 · 5절) ──
     머리 줄 오른쪽: 할 일이 있으면 「할 일 N」과 꽉 찬 단추 하나, 없고 AI가 일하면 흐린 한 문장. 카드가 서면 머리 줄의 단추는 물러난다.
     카드는 한 장이다. 일이 바뀌면 아래에서 떠오르고, 끝낸 일이 줄에서 빠지면 왼쪽 위 구가 한 번 웃는다. 카드가 서 있으면 true */
  let todoFlash = null, todoKey = '';
  /* 로비: 로그인을 묻는 동안과 「한 번에 처리」 카드가 선 동안만 바탕이 솔리오 노랑이다(유호님 11-26 「두 화면만 바꿔」). 그 밖의 방은 검정 그대로다 */
  const LOBBY_RGB = [254, 208, 39];
  let lobbyNow = null;
  function syncLobby() {
    const ui = stageEl.dataset.ui;
    // 공간 펼침이 열린 동안에는 로비를 끈다. 펼침 글자는 검정 바탕용이다(Fable F1)
    const want = ui === 'ask' ? 'ask' : ui === 'app' && 'todo' in stageEl.dataset && stageEl.dataset.fan !== '1' ? 'todo' : '';
    if (want === lobbyNow) return;
    lobbyNow = want;
    if (want) stageEl.dataset.lobby = want; else delete stageEl.dataset.lobby;
    stage.setBg?.(want ? LOBBY_RGB : [0, 0, 0]);
  }
  function renderTodo(t) { const open = renderTodoCard(t); syncLobby(); return open; }
  function renderDeck(c) {
    const next = c && !c.end && Array.isArray(c.next) ? c.next.slice(0, 3) : [];
    const key = JSON.stringify(next.map(n => [n.key, n.say, n.where]));
    if (app.todoDeck.dataset.key !== key) {
      app.todoDeck.dataset.key = key;
      app.todoDeck.replaceChildren(...next.map((n, i) => {
        const d = doc.createElement('div'); d.className = 'todo-back'; d.style.setProperty('--k', String(i + 1));
        const no = doc.createElement('b'); no.textContent = String(i + 2).padStart(2, '0');
        const say = doc.createElement('span'); say.textContent = n.say || '';
        const where = doc.createElement('em'); where.textContent = n.where || '';
        d.append(no, say, where); return d;
      }));
    }
    app.todoDeck.hidden = !next.length;
  }
  function renderTodoCard(t) {
    const work = !!t && (t.count > 0 || t.paused);
    app.todoBar.hidden = !t || t.open || (!work && !t.ai && !t.fail);
    // 머리 줄은 짧게 둔다. AI가 하는 일의 문장은 카드 아래 줄과 끝 카드가 말한다(좁은 창에서 잘리지 않게, 카본 A6)
    if (app.todoN.title !== (t?.ai || '')) app.todoN.title = t?.ai || '';
    if (t) {
      // 줄이 비었어도 못 불러온 방이 있으면 그것을 말한다(「없음」으로 읽히지 않게, 워크스페이스 13절 같은 말 규칙)
      setText(app.todoN, t.count > 0 ? `할 일 ${t.count}` : t.paused ? '' : t.fail || (t.ai ? 'AI가 처리 중' : ''));
      app.todoGo.hidden = !work;
      setText(app.todoGo, t.label);
      app.todoBar.classList.toggle('idle', !work);
      if (todoFlash === null) todoFlash = t.flash;
      else if (t.flash > todoFlash) { todoFlash = t.flash; void stage.setMood?.('smile', 1100); sound.done?.(); }
    }
    const c = t?.open ? t.card : null;
    app.todo.hidden = !c;
    if (c) { if (stageEl.dataset.todo !== '1') stageEl.dataset.todo = '1'; } else if ('todo' in stageEl.dataset) delete stageEl.dataset.todo;
    renderDeck(c);
    if (!c) { todoKey = ''; return false; }
    const fresh = c.key !== todoKey;
    todoKey = c.key;
    app.todo.classList.toggle('end', !!c.end);
    app.todoMeta.hidden = !!c.end;
    setText(app.todoRank, c.rank || '');
    setText(app.todoWhy, c.why || '');
    app.todoWhy.hidden = !c.why;
    setText(app.todoWhere, c.where || '');
    app.todoWhere.hidden = !c.where;
    setText(app.todoSay, c.say);
    setText(app.todoThen, c.then || '');
    const key = JSON.stringify([c.key, !!c.busy, c.acts.map(a => [a.id, a.label, a.primary])]);
    if (app.todoActs.dataset.key !== key) {
      const fa = doc.activeElement, had = fa && app.todoActs.contains(fa);
      app.todoActs.dataset.key = key;
      app.todoActs.replaceChildren(...c.acts.map(a => {
        const b = button(a.primary ? 'todo-main' : 'todo-alt', a.label, { 'data-orb-act': a.kind === 'close' ? 'todo-stop' : 'todo-act', 'data-orb-arg': a.id, 'aria-describedby': 'orb-todo-say' });
        if (c.busy) b.setAttribute('aria-disabled', 'true');
        return b;
      }));
      // 누른 단추가 일과 함께 사라지면 초점은 다음 카드의 꽉 찬 단추로 간다(body로 빠지지 않게)
      if (had) { const next = app.todoActs.querySelector('.todo-main') || app.todoActs.firstElementChild; try { (next || app.todoHead).focus({ preventScroll: true }); } catch {} }
    }
    app.todoActs.hidden = !c.acts.length;
    setText(app.todoNote, c.busy ? '처리하는 중입니다.' : c.note || '');
    app.todoFoot.hidden = !!c.end;
    setText(app.todoLeft, c.end ? '' : [c.left, c.ai].filter(Boolean).join(' · '));
    if (fresh) {
      app.todo.classList.remove('todo-in');
      void app.todo.offsetWidth;
      app.todo.classList.add('todo-in');
      app.todo.scrollTop = 0;
    }
    return true;
  }

  function renderApp(s) {
    const room = s.room;
    setText(app.name, s.spaceLabel);
    // 보이는 공간 이름이 낭독 이름에도 들어가게 한다(검수 A6, WCAG 2.5.3)
    const nameLabel = s.spaceLabel ? `${s.spaceLabel}, 다른 공간으로 가기` : '다른 공간으로 가기';
    if (app.nameBtn?.getAttribute?.('aria-label') !== nameLabel) app.nameBtn?.setAttribute?.('aria-label', nameLabel);
    app.orbBtn.setAttribute('aria-label', `지금 ${s.spaceLabel}. 다른 공간으로 가기`);
    app.legacyBack.hidden = s.mode !== 'legacy';
    // 창 안의 공간(PULSE, Workspace)을 닫는 자리(3단계 설계 검토 R6). 쓰던 글이 있으면 본체가 묻는다. 글은 공간마다다(4단계 6.1)
    if (app.bandClose) { app.bandClose.hidden = !s.bandClose; if (s.bandCloseLabel) setText(app.bandClose, s.bandCloseLabel); }
    renderShare(s.share || null);
    if (!room) {
      renderTodo(null);
      renderRail(s, [], null);
      lastProg = null;
      renderAsides(null, null);
      renderOffice(null, false);
      return;
    }
    const solio = room.space === 'solio';
    const prog = solio ? (room.prog || 'subs') : null;
    // 방이 열려 있으면 그 방 하나만 보인다(시안 #stage[data-aside])
    const asideName = s.aside && app.asides[s.aside] ? s.aside : null;
    app.solio.hidden = !solio || prog !== 'subs' || !!asideName;
    app.estimateBtn.hidden = app.solio.hidden || !room.canOpenEstimate;
    app.estimateNote.hidden = app.estimateBtn.hidden || !room.estimateError;
    setText(app.estimateNote, room.estimateError || '');
    for (const [name, r] of Object.entries(readRooms)) r.room.hidden = prog !== name || !!asideName;
    app.office.hidden = prog !== 'office' || !!asideName;
    app.space.hidden = solio || !!asideName;
    // 「한 번에 처리」 카드가 서 있으면 그 한 장만 보인다(방은 그 뒤에 그대로 있다)
    // 곁방(계정 관리 따위)이 열려 있어도 머리 줄의 「다음 일」은 남는다. 그 방에서 끝낸 뒤 한 번 눌러 줄을 잇는다
    const todoOpen = renderTodo(solio && s.layer === 'app' && s.mode === 'app' && room.todo ? (asideName ? { ...room.todo, open: false } : room.todo) : null);
    if (todoOpen) { app.solio.hidden = true; app.estimateBtn.hidden = true; app.estimateNote.hidden = true; for (const r of Object.values(readRooms)) r.room.hidden = true; app.office.hidden = true; }
    renderRail(s, solio ? room.programs || [] : [], prog);
    placeTodoBar();
    for (const [name, r] of Object.entries(readRooms)) renderRead(r, solio ? room[name] : null);
    // 가려진 방에서 그린 판은 줄 위치가 0이다. 원클릭 방이 보이면 작은 구를 그 자리에서 다시 놓는다(Fable F3)
    if (!app.backup.hidden) placeHelper(board.at);
    renderOffice(solio ? room.office : null, solio && prog === 'office' && !asideName && !todoOpen && s.layer === 'app' && s.mode === 'app');
    if (prog !== lastProg) {
      closeMores(true);
      if (lastProg !== null && prog && !asideName) enterRoom(prog);
      lastProg = prog;
    }
    renderAsides(asideName, s.rooms);
    // 방이 가려진 동안(옛 화면, 다른 공간) 스크롤은 사건 없이 0으로 돌아온다. 그릴 때마다 위쪽 흐림 표시를 지금 스크롤에 맞춘다(0.4.97 검수 A3)
    for (const r of [app.solio, app.backup, app.visits, app.health, app.office, ...Object.values(app.asides).map(a => a.room)]) if (r.classList.contains('scrolled') && !(r.scrollTop > 0)) r.classList.remove('scrolled');
    layers.app.setAttribute('aria-label', solio ? '솔리오' : room.space === 'workspace' ? 'Workspace' : 'PULSE');
    if (solio) {
      const t = room.solio;
      setText(app.say, t.say);
      setText(app.then, t.then);
      renderRows(t);
      app.rows.classList.toggle('dim', Boolean(t.dim));
      // 비서 판(솔리오 구독 비서 설계 3절). 줄은 상세내역 안에 접혀 있다가 단추를 누르면 펼쳐진다(설계 3.5, 설계 검토 D9)
      const hasRows = Boolean((t.rows && t.rows.length) || (t.extra && t.extra.length)), fold = Boolean(t.brief?.fold) && hasRows;
      const fa = doc.activeElement, wasIn = fa && (app.rows.contains(fa) || app.detailsTop.contains(fa));
      renderBrief(t.brief || null, fold);
      app.rows.hidden = !hasRows || (fold && !detailsOpen);
      // 상태가 바뀌어(check → ready) 줄이 접히면 줄 안의 초점은 상세내역 단추로 옮긴다(화면 검수 A8)
      if (wasIn && app.rows.hidden && !app.details.hidden) { closeMores(true); try { app.details.focus({ preventScroll: true }); } catch {} }
      setText(app.read, t.read);
      app.reread.hidden = t.action !== 'reread';
      // 「구독 관리 열기」는 구독 줄이 있어 「다시 읽기」가 보일 때만 그 옆에 둔다(설계 검토 2차 4)
      app.subsManage.hidden = t.action !== 'reread' || !(t.rows && t.rows.length);
      // 연결한 구독이 없으면 먼저 할 일 하나(「구독 연결하기」)를 문장 바로 아래 꽉 찬 단추로 둔다. 맨 아래의 글 단추는 그동안 숨긴다(11-23 맹검)
      const start = t.state === 'none' && t.action === 'connect';
      app.subStart.hidden = !start;
      // 예시 계정판도 같은 때만 선다. 그동안 맨 위 문장을 한 단계 줄여 예시까지 한 화면에 든다
      app.subPeek.hidden = !start;
      app.solio.classList.toggle('peeking', start);
      app.connect.hidden = t.action !== 'connect' || start;
      app.recheck.hidden = t.action !== 'recheck-auth';
      // 계정 확인을 기다리는 문장은 낭독기에도 알린다(단추가 「사용할 수 없음」으로 바뀐 것만 읽히지 않게, 다시 검수 -e)
      // 앱 층이 보일 때에만 넣는다. 들어가는 움직임 동안(층이 inert) 먼저 넣으면 층이 보인 뒤 알릴 변화가 없다(다시 검수 -f)
      setText(app.solioStatus, s.layer === 'app' && t.state === 'waiting' ? [t.say, t.then].filter(Boolean).join(' ') : '');
      // 누를 수 없는 동안에도 disabled를 쓰지 않는다. 눌러 둔 단추가 disabled가 되면 브라우저가 초점을 body로 옮긴다(다시 검수 -d)
      setUnavailable(app.reread, Boolean(t.rereading) || s.busy);
      setUnavailable(app.recheck, Boolean(t.checking) || s.busy);
      app.reread.closest('.read').hidden = !t.read && (!t.action || start);
    } else {
      setText(app.spaceSay, room.say);
      setText(app.spaceThen, room.then);
      setText(app.spaceError, room.error);
      app.reopen.hidden = !room.action;
      // 배정이 걷힌 방은 같은 단추를 「솔리오로」로 쓴다(fix-all 화면 Fable F1)
      if (room.action) { setText(app.reopen, room.action.label); if (app.reopen.dataset.orbAct !== room.action.action) app.reopen.dataset.orbAct = room.action.action; }
      app.reopen.disabled = s.busy;
    }
  }

  /* ── Workspace 화면 공유 고르기(4단계 6.4). 화면과 창을 작은 그림과 이름으로 둔다. 움직임은 없다. 같은 물음은 다시 그리지 않는다 ── */
  let shareShown = null;
  function renderShare(share) {
    if (!app.share) return;
    if (!share) { if (!app.share.hidden) app.share.hidden = true; shareShown = null; return; }
    app.share.hidden = false;
    if (shareShown === share.id) return;
    shareShown = share.id;
    const tile = (item, index) => {
      const btn = doc.createElement('button');
      btn.type = 'button'; btn.className = 'share-tile'; btn.dataset.orbAct = 'share-pick'; btn.dataset.orbArg = String(index);
      const pic = doc.createElement('span'); pic.className = 'share-pic';
      if (item.thumb) { const img = doc.createElement('img'); img.alt = ''; img.src = item.thumb; img.draggable = false; pic.append(img); }
      const name = doc.createElement('span'); name.className = 'share-name'; name.textContent = item.name;
      btn.append(pic, name);
      btn.setAttribute('aria-label', `${item.kind === 'screen' ? '화면' : '창'} ${item.name} 공유하기`);
      return btn;
    };
    const screens = [], windows = [];
    share.items.forEach((item, index) => (item.kind === 'screen' ? screens : windows).push(tile(item, index)));
    app.shareScreens.replaceChildren(...screens);
    app.shareWindows.replaceChildren(...windows);
    app.shareScreensH.hidden = app.shareScreens.hidden = screens.length === 0;
    app.shareWindowsH.hidden = app.shareWindows.hidden = windows.length === 0;
  }

  /* 오브제 줄은 다가가면 이름이 펼쳐진다(.rail.near). 펼친 줄이 머리 줄 단추에 닿는 창에서는 단추를 창 아래 오른쪽으로 내린다(Fable F2).
     이름 한 칸의 최대 너비는 CSS의 9em(13px 글자 → 117px)과 앞 간격 9px이다 */
  const RAIL_NAME = Object.freeze({ max: 117, gap: 9, clear: 16 });
  function placeTodoBar() {
    const bar = app.todoBar;
    if (!bar) return;
    const was = bar.classList.contains('low');
    if (bar.hidden || app.rail.hidden) { if (was) bar.classList.remove('low'); return; }
    if (was) bar.classList.remove('low');
    const b = bar.getBoundingClientRect(), r = app.rail.getBoundingClientRect();
    let right = r.right;
    for (const o of app.objs) {
      if (o.hidden) continue;
      const n = o.querySelector('.obj-n');
      if (!n) continue;
      const now = n.getBoundingClientRect().width + (parseFloat(win.getComputedStyle?.(n)?.marginLeft) || 0);
      right += Math.max(0, Math.min(n.scrollWidth, RAIL_NAME.max) + RAIL_NAME.gap - now);
    }
    const low = b.width > 0 && b.top < r.bottom && b.bottom > r.top && right + RAIL_NAME.clear > b.left;
    if (low) bar.classList.add('low');
  }
  /* ── 솔리오 안의 프로그램(시안 .rail) ── */
  function renderRail(s, programs, prog) {
    const on = s.mode === 'app' && programs.length > 0;
    app.rail.hidden = !on;
    // 같은 값은 다시 쓰지 않는다(장면은 1분마다 다시 그린다)
    if (on && stageEl.dataset.rail !== '1') stageEl.dataset.rail = '1'; else if (!on && 'rail' in stageEl.dataset) delete stageEl.dataset.rail;
    if (prog && stageEl.dataset.prog !== prog) stageEl.dataset.prog = prog; else if (!prog && 'prog' in stageEl.dataset) delete stageEl.dataset.prog;
    if (!on) { app.rail.classList.remove('near'); clearTimeout(progTimer); }
    let k = 0;
    for (const o of app.objs) {
      const p = programs.find(x => x.key === o.dataset.orbProg);
      o.hidden = !p;
      // 알림이 있는 프로그램(사무실)은 오브제에 느낌표가 붙는다. 다른 프로그램을 보고 있어도 붙는다(사무실 구현설계 7절)
      o.classList.toggle('news', !!p?.alert);
      if (!p) continue;
      // 이름이 펼쳐지는 늦춤(--k)은 보이는 차례로 준다. 가운데 오브제가 빠져도 펼치는 시간이 railSettleMs와 맞는다
      const at = String(k++);
      if (o.style.getPropertyValue('--k') !== at) o.style.setProperty('--k', at);
      const label = (p.note ? `${p.label}, ${p.note}` : p.label) + (p.alert ? ', 새 소식' : '');
      if (o.getAttribute('aria-label') !== label) {
        o.setAttribute('aria-label', label);
        const name = o.querySelector('.obj-n');
        const parts = [doc.createTextNode(p.label)];
        if (p.note) { const small = doc.createElement('small'); small.textContent = p.note; parts.push(small); }
        name.replaceChildren(...parts);
      }
      o.setAttribute('aria-current', String(o.dataset.orbProg === prog));
    }
    // 오브제 줄은 Tab 한 자리다. 연 오브제만 Tab 차례에 두고 줄 안은 좌우 화살표로 옮긴다.
    // 그래야 Tab이 연 프로그램의 방 안으로 바로 내려간다(0.4.97 최종 검수 F1: 구독 방에 Tab으로 들어가지 못했다)
    const shown = app.objs.filter(o => !o.hidden), current = shown.find(o => o.dataset.orbProg === prog) || shown[0];
    for (const o of shown) { const want = o === current ? '0' : '-1'; if (o.getAttribute('tabindex') !== want) o.setAttribute('tabindex', want); }
  }
  /* 다른 프로그램의 방이 뜰 때 안의 것들이 차례로 떠오른다(시안 flashRoom) */
  function enterRoom(prog) {
    const el = app.asides[prog]?.room || readRooms[prog]?.room || (prog === 'office' ? app.office : null) || app.solio;
    el.scrollTop = 0;
    el.classList.remove('scrolled');
    el.classList.remove('enter');
    if (el === app.solio) app.board.classList.remove('still');
    void el.offsetWidth;
    el.classList.add('enter');
  }
  /* 포인터가 오브제 줄 가까이 오면 이름이 차례로 펼쳐진다. 펼쳐지기 시작한 때를 적어 둔다 */
  function updateNear(x, y) {
    if (app.rail.hidden || scene?.layer !== 'app') { app.rail.classList.remove('near'); return; }
    const r = app.rail.getBoundingClientRect();
    const near = x > r.left - NEAR.pad && x < r.right + NEAR.pad && y > r.top - NEAR.pad && y < r.bottom + NEAR.pad;
    if (near === app.rail.classList.contains('near')) return;
    app.rail.classList.toggle('near', near);
    if (near) railSince = clock();
  }
  const onRailOver = event => {
    const o = event.target?.closest?.('.obj[data-orb-prog]');
    if (!o || event.pointerType !== 'mouse' || o.contains(event.relatedTarget)) return;
    updateNear(event.clientX, event.clientY);
    clearTimeout(progTimer);
    // 이름이 다 펼쳐지기 전에는 열지 않는다. 펼쳐지는 동안 이름 밑으로 지나가던 오브제가 열리지 않게 한다
    const settle = railSettleMs(app.objs.filter(x => !x.hidden).length);
    progTimer = setTimeout(() => { if (!disposed && !o.hidden && scene?.layer === 'app') onAction('prog', o.dataset.orbProg); }, Math.max(NEAR.prog, railSince + settle - clock()));
  };
  const onRailOut = event => {
    const o = event.target?.closest?.('.obj[data-orb-prog]');
    if (o && !o.contains(event.relatedTarget)) clearTimeout(progTimer);
  };
  /* 방이 조금이라도 내려가 있으면 위쪽 끝도 흐린다. 맨 위로 돌아오면(줄을 접어 스크롤이 0이 된 때 포함) 뗀다(시안 세션 11-18) */
  const onRoomScroll = event => {
    const r = event.target;
    if (r && r.nodeType === 1 && r.classList.contains('room')) r.classList.toggle('scrolled', r.scrollTop > 0);
  };
  const onRailFocus = event => {
    const o = event.target?.closest?.('.obj[data-orb-prog]');
    if (o && focusVisible(o)) onAction('prog', o.dataset.orbProg);
  };

  /* ── 솔리오 「사무실」의 방: 대화 짜임(docs/디자인/솔리오_사무실대화_20261124/PC앱_옮기기.md, 2026-11-25).
     왼쪽은 대화 상대(사무실 · 부서 · 부서 없는 일), 가운데 위는 사무실 그림, 그 아래는 고른 상대의 대화와 입력칸, 오른쪽은 「이 부서」 칸이다.
     그림의 책상을 누르면 그 부서를, 직원을 누르면 그 부서와 그 도구로 입력칸을 고른다. 손을 올리면 밝아지기만 한다(설계 검토 10) ── */
  // inRoom: 좁은 폭(방 상자 640px 아래)에서 목록 대신 방을 보이는가. 처음은 고른 상대의 방이다(맡긴 일과 입력칸이 먼저 보인다).
  // 「목록으로」를 누르면 목록, 목록 줄을 누르거나 「한 번에 처리」에서 오면 다시 방이다
  // sideWant: 다음 그림에서 서랍을 연다(수용 인원 단추가 상대를 바꾸며 서랍을 열 때 상대 바꿈이 서랍을 도로 닫지 않게, 카본 화면 검수 A6).
  // officeShown: 앞 그림에서 사무실 방이 보였는가. 숨었다 보이는 첫 그림에서 대화를 끝으로 내린다(카본 화면 검수 A7)
  let assignmentFloor = null, chatSel = null, inRoom = true, sideWant = false, officeShown = false;
  const markOfficeStaff = id => { for (const box of [app.offRows, app.offCenter]) for (const r of box.querySelectorAll('.row.staff')) r.classList.toggle('hot', !!id && r.dataset.staff === id); };
  const taskHost = $('[data-off-tasks]');
  // 기획부 「사업계획서」 작업 화면(사업계획서_설계.md 6절). 열려 있는 동안 사무실의 다른 자리는 감춘다
  const featureHost = $('[data-off-feature]');
  const bizView = createBizplanView(featureHost, payload => onAction('room', { room: 'solio-office', key: 'd:' + (featureHost.dataset.dept || ''), ...payload }), doc);
  let featureWas = '';
  const officeTasks = createOfficeTaskView(taskHost, payload => onAction('room', { room: 'solio-office', ...payload }), { formHost: app.offCompose });
  const pickChat = (key, extra = {}) => onAction('room', { room: 'solio-office', act: 'chat-pick', arg: key, ...extra });
  /* ── 눌린 직원의 한마디와 방 옮기기(솔리오_사무실한마디_20261126) ──
     방을 옮길 때: 앞 대화가 0.12초 동안 흐려지고(leaving) 새 대화가 0.3초 동안 아래에서 8px 올라온다. 그림은 그 부서로 다가간다(office-floor의 lean).
     한마디: 그림에서 직원이나 책상을 누르면 그 직원이 일어서고 머리 위에 말풍선이 뜬다. 6.5초 뒤나 다른 곳을 누르면 앉는다 */
  const SWAP_MS = 120, TALK_MS = 6500, TALK_OVER = 30;
  let greets = null, talkTimer = 0, talkGone = 0, swapTimer = 0, swapNow = null, talkTurn = new Map();
  const bubble = $('[data-off-bubble]');
  const swapParts = () => [$('[data-off-head]'), app.offThread, app.offSide];
  function swapTo(key, go) {
    if (swapNow) { clearTimeout(swapTimer); swapNow = null; }
    if (reduced() || !key || key === chatSel) {
      app.ofc.classList.remove('leaving'); go();
      // 이미 고른 상대를 눌러도 그림이 전체이면 그 부서로 다가간다. 방을 다시 열면 급한 부서가 골라진 채 전체에서 시작한다(Fable 최종 F2)
      if (key && key === chatSel) officeFloor.lean(key !== 'all' ? key : null);
      return;
    }
    app.ofc.classList.add('leaving');
    swapNow = go;
    swapTimer = setTimeout(() => { const run = swapNow; swapNow = null; if (!disposed && run) run(); app.ofc.classList.remove('leaving'); }, SWAP_MS);
  }
  function arrive() {
    if (reduced()) return;
    swapParts().forEach((n, i) => n?.animate?.([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: i * 40, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' }));
  }
  function hush({ now = false } = {}) {
    clearTimeout(talkTimer); clearTimeout(talkGone);
    officeFloor.talk(null);
    bubble.classList.remove('on');
    if (now || reduced()) bubble.hidden = true; else talkGone = setTimeout(() => { bubble.hidden = true; }, 220);
  }
  function speak(id) {
    const g = id && greets?.by?.[id];
    if (!g) { hush(); return; }
    clearTimeout(talkTimer); clearTimeout(talkGone);
    const turn = talkTurn.get(id) || 0;
    talkTurn.set(id, turn + 1);
    setText(bubble.firstElementChild, g.name);
    setText(bubble.lastElementChild, g.lines[turn % g.lines.length]);
    bubble.classList.remove('on');
    bubble.hidden = false;
    officeFloor.talk(id);
    win.requestAnimationFrame?.(() => bubble.classList.add('on'));
    talkTimer = setTimeout(() => hush(), TALK_MS);
  }
  /* 말풍선은 말하는 직원의 머리 위에 선다. 그림 칸 위로 30px까지는 나가도 되고(그 자리는 방 머리 오른쪽의 빈 곳이다), 그래도 모자라면 아래에 선다 */
  function placeBubble(p) {
    if (bubble.hidden) return;
    if (!p) { hush(); return; }
    const W = app.offSlot.clientWidth, w = bubble.offsetWidth, h = bubble.offsetHeight, gap = 9;
    const x = Math.max(2, Math.min(W - w - 2, p.x - w / 2)), above = p.y - p.r - gap - h, low = p.endY - p.r - gap - h < -TALK_OVER;
    bubble.classList.toggle('low', low);
    bubble.style.transform = `translate(${Math.round(x)}px,${Math.round(low ? p.y + p.r + gap : above)}px)`;
    bubble.style.setProperty('--tail', Math.max(14, Math.min(w - 14, p.x - x)).toFixed(1) + 'px');
  }
  const officeFloor = createOfficeFloor(app.offFloor, {
    win,
    reduced,
    isOpen: key => !!key && key === chatSel,
    onHover: (zone, staff) => { markOfficeStaff(staff); },
    onTalk: placeBubble,
    onPress: (zone, staff) => {
      speak(staff || (zone ? greets?.lead?.[zone] : null));
      if (staff && assignmentFloor) {
        for (const group of assignmentFloor.zones) {
          const worker = group.staff.find(person => person.id === staff);
          if (worker?.provider) {
            swapTo(worker.zone === 'lobby' ? 'all' : worker.zone, () => onAction('room', { room: 'solio-office', act: 'task-open', key: worker.zone, arg: worker.provider }));
            return;
          }
        }
      }
      if (!zone) return;
      // 「그 밖」(일곱째 부서부터)은 「사무실」을 고르고 목록을 일곱째 부서로 내린다
      if (zone === 'other') { pickChat('all'); const b = [...app.offChats.querySelectorAll('[data-chat^="d:"]')][6]; if (b) b.scrollIntoView?.({ block: 'nearest' }); return; }
      swapTo(zone, () => pickChat(zone));
    },
  });
  const onOfficeOver = event => {
    const t = event.target, s = t?.closest?.('.row.staff'), c = t?.closest?.('[data-chat]');
    const zone = c ? (c.dataset.chat === 'all' ? null : c.dataset.chat) : chatSel && chatSel !== 'all' ? chatSel : null;
    officeFloor.setHot({ zone, staff: s?.dataset?.staff || null });
    markOfficeStaff(s?.dataset?.staff || null);
  };
  const onOfficeLeave = () => { officeFloor.setHot(null); markOfficeStaff(null); };
  /* 목록 줄 하나: 작은 구 둘, 이름과 느낌표, 상태 낱말, 미리보기. 낭독 이름은 자료의 label이고 고른 줄은 aria-current다(설계 검토 17) */
  function chatButton(key) {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = 'ofc-chat';
    b.dataset.chat = key;
    const av = el('span', 'ofc-av'), main = el('span', 'ofc-c-main'), top = el('span', 'ofc-c-top');
    av.setAttribute('aria-hidden', 'true');
    // 느낌표는 이름 글 밖의 따로 선 칸이다. 좁아도 이름 말줄임에 먹히지 않는다(Fable 최종 F3)
    const fl = el('i', 'flag ofc-c-flag', '!');
    fl.setAttribute('aria-hidden', 'true');
    fl.hidden = true;
    top.append(el('b', 'ofc-c-nm'), fl, el('span', 'ofc-c-word'));
    main.append(top, el('span', 'ofc-c-pre'));
    b.append(av, main);
    return b;
  }
  function fillChat(b, c, sel) {
    const ck = JSON.stringify([c.nm, c.flag, c.word, c.preview, c.orbs, c.label]);
    if (b.dataset.ck !== ck) {
      b.dataset.ck = ck;
      const av = b.querySelector('.ofc-av');
      if (c.key === 'all') av.replaceChildren(officeIcon());
      else av.replaceChildren(...(c.orbs.length ? c.orbs : [{ status: 'empty' }]).map(o => { const i = el('i', 'ofc-orb'); i.dataset.st = o.status || ''; if (o.provider) i.dataset.tool = o.provider; return i; }));
      setText(b.querySelector('.ofc-c-nm'), c.nm);
      b.querySelector('.ofc-c-flag').hidden = !c.flag;
      setText(b.querySelector('.ofc-c-word'), c.word);
      setText(b.querySelector('.ofc-c-pre'), c.preview);
      b.setAttribute('aria-label', c.label);
    }
    const cur = c.key === sel;
    if ((b.getAttribute('aria-current') === 'true') !== cur) { if (cur) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); }
  }
  /* 「사무실」 줄의 그림: 오브제 줄의 사무실 그림과 같은 꼴(글로 넣지 않고 DOM으로 짓는다) */
  function officeIcon() {
    const NS = 'http://www.w3.org/2000/svg', svg = doc.createElementNS(NS, 'svg'), part = (tag, at) => { const n = doc.createElementNS(NS, tag); for (const [k, v] of Object.entries(at)) n.setAttribute(k, v); svg.append(n); };
    svg.setAttribute('viewBox', '0 0 20 20');
    part('rect', { x: '3.4', y: '5', width: '13.2', height: '10', rx: '1', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.1' });
    part('circle', { cx: '7.6', cy: '10', r: '1.2', fill: 'currentColor' });
    part('circle', { cx: '12.4', cy: '10', r: '1.2', fill: 'currentColor' });
    return svg;
  }
  function renderChats(list, sel) {
    const box = app.offChats, byKey = new Map([...box.querySelectorAll(':scope > [data-chat]')].map(n => [n.dataset.chat, n]));
    const want = new Set(list.map(c => c.key));
    const lost = doc.activeElement && box.contains(doc.activeElement) && !want.has(doc.activeElement.dataset?.chat);
    for (const [k, b] of byKey) if (!want.has(k)) { b.remove(); byKey.delete(k); }
    let slot = box.firstElementChild;
    for (const c of list) {
      let b = byKey.get(c.key);
      if (!b) b = chatButton(c.key);
      if (b === slot) slot = b.nextElementSibling; else box.insertBefore(b, slot);
      fillChat(b, c, sel);
    }
    if (lost) box.querySelector('[aria-current="true"]')?.focus?.({ preventScroll: true });
  }
  /* 좁은 창(방 상자 1100px 아래)에서 오른쪽 칸은 방 머리의 단추로 여는 서랍이다. 열면 초점을 안에 가두고 Esc로 닫는다(설계 검토 14) */
  const sideOpen = () => app.ofc.classList.contains('side-open');
  // 서랍으로 보이는 때(방 상자 1100px 아래)에만 「이 부서」 단추가 보인다
  const drawerOpen = () => sideOpen() && !!app.offSideBtn.offsetParent;
  function setSide(open, { focus = true } = {}) {
    app.ofc.classList.toggle('side-open', open);
    app.offSideBtn.setAttribute('aria-expanded', String(open));
    if (!focus) return;
    if (open) { const first = app.offSide.querySelector('button:not([tabindex="-1"]),input,[tabindex="0"]'); (first || app.offSide).focus?.({ preventScroll: true }); }
    else app.offSideBtn.focus?.({ preventScroll: true });
  }
  const sideFocusables = () => [...app.offSide.querySelectorAll('button,input,select,textarea,[tabindex]')].filter(n => n.tabIndex >= 0 && !n.closest('[hidden]') && !n.closest('[inert]') && !n.disabled);
  const onSideKey = event => {
    // 서랍으로 보일 때만 가둔다. 연 채 창을 넓혀 세 칸이 되면 오른쪽 칸은 보통 칸이다(Fable 최종 F7)
    if (!drawerOpen()) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setSide(false); return; }
    if (event.key !== 'Tab') return;
    const items = sideFocusables();
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  const threadAtEnd = () => app.offThread.scrollHeight - app.offThread.scrollTop - app.offThread.clientHeight < 24;
  const onThreadScroll = () => { if (!app.offNew.hidden && threadAtEnd()) app.offNew.hidden = true; };
  const onOfficeClick = event => {
    const t = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
    if (!t) return;
    // 그림 밖을 누르면 말하던 직원이 앉는다. 그림 안의 누름은 그림이 맡는다(카본 A2)
    if (!t.closest('[data-off-floor]')) hush();
    // 서랍 밖을 누르면 서랍을 닫고 그 누름은 그대로 한다. 서랍 안의 「닫기」는 닫고 단추로 초점을 돌린다(카본 화면 검수 A1)
    if (t.closest('[data-off-side-close]')) { event.preventDefault(); event.stopPropagation(); setSide(false); return; }
    if (drawerOpen() && !app.offSide.contains(t) && !t.closest('[data-off-side-btn]') && !t.closest('[data-off-cap]')) setSide(false, { focus: false });
    const c = t.closest('[data-chat]');
    if (c && app.offChats.contains(c)) {
      event.preventDefault(); event.stopPropagation(); inRoom = true; app.ofc.classList.add('in-room'); { const key = c.dataset.chat; swapTo(key, () => pickChat(key)); }
      // 좁은 방에서는 목록이 통째로 숨는다. 누른 줄에 있던 초점을 방 머리로 옮긴다(0.5.12 공개 후보 카본 B1)
      if (c.offsetParent === null) focusEl(app.offHead);
      return;
    }
    if (t.closest('[data-off-back]')) { event.preventDefault(); event.stopPropagation(); inRoom = false; app.ofc.classList.remove('in-room'); app.offChats.querySelector('[aria-current="true"]')?.focus?.({ preventScroll: true }); return; }
    if (t.closest('[data-off-add-btn]')) { event.preventDefault(); event.stopPropagation(); onAction('room', { room: 'solio-office', act: 'chat-add' }); return; }
    // 더하기 칸은 목록에 있다. 좁은 방에서는 목록부터 보인다(0.5.12 공개 후보 카본 B1)
    if (t.closest('[data-off-empty-add]')) { event.preventDefault(); event.stopPropagation(); inRoom = false; app.ofc.classList.remove('in-room'); onAction('room', { room: 'solio-office', act: 'chat-add', arg: 'open' }); return; }
    // 수용 인원: 「사무실」을 고르고(좁으면 방으로 넘어가) 오른쪽 칸의 수용 인원 줄을 펼쳐 초점을 둔다. 서랍이면 그림 안에서 서랍을 먼저 연다
    if (t.closest('[data-off-cap]')) { event.preventDefault(); event.stopPropagation(); inRoom = true; app.ofc.classList.add('in-room'); sideWant = true; pickChat('all', { focus: 'cap' }); return; }
    if (t.closest('[data-off-side-btn]')) { event.preventDefault(); event.stopPropagation(); setSide(!sideOpen()); return; }
    if (t.closest('[data-off-new]')) { event.preventDefault(); event.stopPropagation(); app.offNew.hidden = true; app.offThread.scrollTo?.({ top: app.offThread.scrollHeight, behavior: reduced() ? 'auto' : 'smooth' }); }
  };
  /* 목록 안에서는 위아래 화살표로 옮긴다(고르지는 않는다. Enter · Space로 고른다) */
  const onChatsKey = event => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const items = [...app.offChats.querySelectorAll(':scope > [data-chat]')], i = items.indexOf(doc.activeElement);
    if (i < 0) return;
    event.preventDefault();
    items[Math.max(0, Math.min(items.length - 1, i + (event.key === 'ArrowDown' ? 1 : -1)))].focus();
  };
  function renderOffice(v, shown) {
    const on = !!(v && v.visible);
    const feature = on && v.feature ? v.feature : null;
    featureHost.dataset.dept = feature?.departmentId || '';
    if (app.ofc.hidden !== !!feature) app.ofc.hidden = !!feature;
    bizView.render(feature);
    const fkey = feature ? feature.departmentId : '';
    if (fkey !== featureWas) { featureWas = fkey; if (feature) bizView.focusHead(); }
    greets = on ? v.greets || null : null;
    if (feature || !shown) hush({ now: true });
    if (feature) { officeFloor.show(false); return; }
    const c = on && v.chat ? v.chat : null;
    const sel = c ? c.sel : null, selChanged = sel !== chatSel;
    chatSel = sel;
    if (selChanged && sideOpen() && !sideWant) setSide(false, { focus: false });
    // 초점을 방 안으로 보내는 새 요청이면 좁은 방에서도 방을 보인다. 요청은 다음 요청까지 남아 있으므로 새것만 본다(뒤로 간 목록을 다시 그리며 덮지 않게)
    if (on && (v.focus?.task || v.focus?.say) && applied.focus['solio-office'] !== v.focus.seq) inRoom = true;
    app.ofc.classList.toggle('in-room', inRoom);
    assignmentFloor = shown && on && v.tasking ? v.floor : null;
    renderChats(c ? c.contacts : [], sel);
    setText(app.offNm, c ? c.head.nm : '');
    setText(app.offSay, c ? c.head.say : on ? v.say : '');
    setText(app.offThen, c ? c.head.then : on ? v.then : '');
    setText(app.offHint, on ? v.hint : '');
    app.offHint.hidden = !(on && v.hint);
    setText(app.offFoot, on ? v.foot : '');
    app.offCap.hidden = !(c && c.capLine);
    setText(app.offCap, c ? c.capLine : '');
    // 부서 더하기 칸(목록 머리의 「+」)
    const addRow = on ? (v.rows || []).find(r => r.key === 'add') : null, adding = !!(c && c.addOpen && addRow);
    app.offAddBtn.setAttribute('aria-expanded', String(adding));
    putRows(app.offAdd, adding ? [{ ...addRow, pin: true }] : [], 'solio-office');
    if (app.offAdd.hidden !== !adding) app.offAdd.hidden = !adding;
    // 그림. 세션도 부서도 없으면 빈 그림을 두지 않는다. 흐름 시험이 구역과 보기를 읽도록 자리에 적어 둔다
    const zones = on && v.floor ? v.floor.zones || [] : [];
    app.offSlot.hidden = !zones.length;
    const zoneKeys = zones.map(z => z.key).join(' '), viewName = on && v.floor ? v.floor.view : '';
    if (app.offSlot.dataset.zones !== zoneKeys) app.offSlot.dataset.zones = zoneKeys;
    if (app.offSlot.dataset.view !== viewName) app.offSlot.dataset.view = viewName;
    // 자리가 많으면 그림 칸을 높인다. 넓히는 문턱(18)과 좁히는 문턱(12)이 달라 직원 하나가 오갈 때 대화 칸이 들썩이지 않는다(책상 설계 검토 P1-2)
    const seatCount = on && v.floor ? floorSeatCount(v.floor) : 0, dense = app.offSlot.classList.contains('dense');
    if (dense ? seatCount <= 12 : seatCount > 18) app.offSlot.classList.toggle('dense', !dense);
    officeFloor.setScene(on ? v.floor : null);
    officeFloor.show(shown && zones.length > 0);
    // 방이 보이는 동안 상대가 바뀌면 그 부서로 다가간다. 방을 처음 열거나 다시 열 때는 전체에서 시작한다
    if (shown && officeShown && selChanged && zones.length) { officeFloor.lean(sel && sel !== 'all' ? sel : null); arrive(); }
    // 고른 책상이 밝아진다. 움직임 줄이기에서는 그림이 저절로 다시 그려지지 않으므로 고른 상대가 바뀔 때 한 번 그린다(설계 검토 10)
    if (selChanged && reduced()) officeFloor.redraw();
    // 대화: 맡긴 일(고른 부서만 보이고 나머지는 숨긴다). 「부서 없는 일」과 맡기기가 꺼진 판은 가운데에 직원 줄을 세운다
    // 숨은 방에서는 스크롤 값을 읽지 않는다. 사무실을 못 보는 회원의 그림마다 배치를 다시 재지 않게 한다(0.5.12 공개 후보 Fable F3)
    const th = app.offThread, live = !!shown && on, atEnd = live && threadAtEnd(), h0 = live ? th.scrollHeight : 0;
    const tk = on && v.tasking ? { ...v.tasking, form: { ...(v.tasking.form || {}), deptPick: !!c?.composer?.deptPick }, view: !c || c.sel === 'all' || c.sel === 'lobby' ? {} : { departmentId: c.composer.departmentId } } : null;
    officeTasks.render(tk);
    const lobby = c?.sel === 'lobby';
    if (taskHost.hidden !== (!tk || lobby)) taskHost.hidden = !tk || lobby;
    const composing = !!(tk && c?.composer?.on);
    if (app.offCompose.hidden !== !composing) app.offCompose.hidden = !composing;
    const offSay = c && !c.composer.on ? c.composer.off || '' : '';
    setText(app.offOffSay, offSay);
    if (app.offOffSay.hidden !== !offSay) app.offOffSay.hidden = !offSay;
    const center = c && Array.isArray(c.center) ? c.center : [];
    putRows(app.offCenter, center, 'solio-office');
    if (app.offCenter.hidden !== !center.length) app.offCenter.hidden = !center.length;
    const empty = !!(c && c.empty);
    setText(app.offEmptySay, empty ? c.emptySay || '' : '');
    if (app.offEmpty.hidden !== !empty) app.offEmpty.hidden = !empty;
    // 오른쪽 칸
    const side = c ? c.side || [] : [];
    putRows(app.offRows, side, 'solio-office');
    app.ofc.classList.toggle('no-side', !side.length);
    if (app.offSideBtn.hidden !== !side.length) app.offSideBtn.hidden = !side.length;
    setText(app.offSideBtn, c && c.sel === 'all' ? '사무실 설정' : '이 부서');
    for (const box of [app.offSide, app.offRows]) box.setAttribute('aria-label', c && c.sel === 'all' ? '사무실 설정' : '이 부서');
    if (sideWant) { sideWant = false; if (side.length && app.offSideBtn.offsetParent && !sideOpen()) setSide(true, { focus: false }); }
    // 스크롤: 상대를 바꾸면 대화 끝으로. 바닥에 있을 때만 바닥을 따라가고, 위로 올려 읽는 중에 새 말이 오면 「새 답 보기」를 둔다(설계 검토 16)
    const reveal = !!shown && !officeShown;
    officeShown = !!shown;
    // 맡긴 일의 대화가 없으면(직원 줄만 설 때) 맨 위부터 보인다. 급한 직원이 맨 위에 선다(0.5.12 공개 후보 카본 B3)
    if (!live) { /* 다시 보일 때 맞춘다 */ }
    else if (taskHost.hidden) { if (selChanged || reveal) th.scrollTop = 0; app.offNew.hidden = true; }
    else if (selChanged || reveal) { th.scrollTop = th.scrollHeight; app.offNew.hidden = true; }
    else if (atEnd) th.scrollTop = th.scrollHeight;
    else if (th.scrollHeight > h0 + 4) app.offNew.hidden = false;
    // 숨긴 카드에 있던 초점은 고른 목록 줄로 옮긴다(설계 검토 2)
    if (officeTasks.takeFocusLost()) app.offChats.querySelector('[aria-current="true"]')?.focus?.({ preventScroll: true });
    if (!on) return;
    const f = v.focus;
    if (f && applied.focus['solio-office'] !== f.seq && (f.task || f.addBtn || f.say)) {
      applied.focus['solio-office'] = f.seq;
      if (f.task) setTimeout(() => { if (!disposed) officeTasks.focusTask(f.task); }, 0);
      else if (f.addBtn) focusEl(app.offAddBtn);
      else focusEl(app.offHead);
    }
    // 요청의 줄이 선 칸으로 보낸다: 「부서 없는 일」 줄은 가운데에 선다(Fable 최종 F5)
    const reqKey = f?.key || v.opening?.key || v.closing?.key || '';
    const reqBox = reqKey === 'add' ? app.offAdd : reqKey && rowByKey(app.offCenter, reqKey) ? app.offCenter : app.offRows;
    applyRequests(reqBox, 'solio-office', f && (f.task || f.addBtn || f.say) ? { ...v, focus: null } : v);
  }

  /* ── 방문자 분석의 방(시안 buildVis)과 계정 건강의 방(계정건강 시안 build). 요약에서 온 글이 섞이므로 모두 textContent로만 넣는다
     (사이트방문 설계 6절, 검토 P2-5, 계정건강 PC앱_구현설계 4절) ── */
  function el(tag, cls, text) {
    const n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  /* 장면은 1분마다 새로 온다(상대 시각, 다시 읽은 요약). 줄의 차례가 같으면 그 자리의 줄을 고쳐 쓰고,
     차례가 달라 새로 지을 때도 펼친 줄, 눌러 고정한 줄, 자판 초점을 줄 이름(key)으로 되살린다(0.4.97 공개 후보 검수 A2) */
  function renderRead(box, v) {
    const key = v && v.visible ? JSON.stringify([v.say, v.then, v.when, v.scope, v.rows, v.acts || null, v.board || null, v.door || null, v.foot || null]) : '';
    if (key === box.key) return;
    box.key = key;
    if (box.acts) renderActs(box.acts, key && Array.isArray(v.acts) ? v.acts : [], key && v.board ? v.board.main : null);
    if (box === readRooms.backup) { renderBoard(key && v.board ? v.board : null); renderDoor(key && v.door ? v.door : null); renderFoot(key && v.foot ? v.foot : null); }
    clearTimeout(visTimer);
    if (!key) clearTimeout(visLeave);
    setText(box.say, key ? v.say : '');
    setText(box.then, key ? v.then : '');
    setText(box.when, key ? v.when : '');
    setText(box.scope, key ? v.scope : '');
    const rows = key && Array.isArray(v.rows) ? v.rows : [];
    const old = [...box.rows.querySelectorAll('button.row[data-vis]')];
    if (rows.length && old.length === rows.length && old.every((b, i) => b.dataset.vis === String(rows[i].key))) {
      rows.forEach((r, i) => fillVisRow(old[i], r));
    } else {
      const kept = new Map(rows.length ? old.filter(b => b.classList.contains('opened')).map(b => [b.dataset.vis, b.classList.contains('pin')]) : []);
      const focused = rows.length ? old.find(b => b === doc.activeElement)?.dataset.vis : undefined;
      box.rows.replaceChildren(...rows.flatMap(visRow));
      // 펼침을 먼저 되살린다. 초점을 옮기면 모양이 계산되어, 그 뒤에 붙인 펼침은 처음부터 다시 펼쳐진다
      for (const b of box.rows.querySelectorAll('button.row[data-vis]')) if (kept.has(b.dataset.vis)) { setMore(b, true); if (kept.get(b.dataset.vis)) b.classList.add('pin'); }
      const again = focused === undefined ? null : [...box.rows.querySelectorAll('button.row[data-vis]')].find(b => b.dataset.vis === focused);
      if (again) { restoringVis = true; try { again.focus({ preventScroll: true }); } catch {} finally { restoringVis = false; } }
    }
    box.rows.hidden = !rows.length;
  }
  /* 한 몸(11-26): 방 안에 엔진 화면을 열었으면 띠 아래에 「← 원클릭 › 이름」 길을 세운다. 그 아래를 본체의 엔진 화면 자리가 채운다 */
  function renderDoor(d) {
    app.bakDoor.hidden = !d;
    app.backup.classList.toggle('bak-in-door', !!d);
    setText(app.bakDoorNm, d ? d.name : '');
  }
  /* 원클릭 판 맨 아래 한 줄: 백업 부품 새 판 · 옛 판 안내 · 올리는 중 · 올림 */
  function renderFoot(f) {
    app.bakFoot.hidden = !f;
    app.bakFoot.classList.toggle('done', !!f?.done);
    setText(app.bakFootSay, f ? f.say : '');
    app.bakFootGo.hidden = !f?.act;
    if (f?.act) setText(app.bakFootGo, f.act.label);
  }
  /* 길 아래 높이(CSS px). 길이 서 있지 않으면 null이다. 본체는 이 아래에 엔진 화면을 붙인다 */
  function backupDoorTop() {
    if (!app.bakDoor || app.bakDoor.hidden || app.backup.hidden) return null;
    const r = app.bakDoor.getBoundingClientRect?.();
    return r && r.height > 0 ? Math.ceil(r.bottom + 10) : null;
  }
  /* 백업 방의 할 일 단추. 다시 그려도 누르던 단추(같은 동작과 낱말)에 초점을 되돌린다 */
  function renderActs(box, acts, main = null) {
    const fa = doc.activeElement, had = fa && box.contains(fa) ? `${fa.dataset.orbAct}|${fa.dataset.orbArg || ''}` : null;
    // 원클릭 판의 큰 단추(흰 알약)가 맨 앞이다. 엔진이 일하는 동안은 누를 수 없고 이름이 하는 일을 말한다
    const lead = main ? [button('go main', main.label, { 'data-orb-act': 'backup-oneclick', 'data-orb-arg': '', 'aria-disabled': main.disabled ? 'true' : null })] : [];
    box.replaceChildren(...lead, ...acts.slice(0, 4).map(a => {
      const b = button(a.primary ? 'reread lead' : 'reread', a.label, { 'data-orb-act': a.act, 'data-orb-arg': a.arg || '' });
      if (a.disabled) b.setAttribute('aria-disabled', 'true');
      return b;
    }));
    box.hidden = !acts.length && !main;
    if (had) { const again = [...box.children].find(b => `${b.dataset.orbAct}|${b.dataset.orbArg || ''}` === had); try { (again || box.children[0])?.focus({ preventScroll: true }); } catch {} }
  }
  /* ── 원클릭 판(11-23, docs/디자인/솔리오_원클릭_20261123). 왼쪽은 드라이브 하나, 오른쪽은 네 줄과 묶음 셋이다.
     부분마다 마지막으로 그린 글을 열쇠로 두어 2초마다 오는 판에서 바뀐 곳만 다시 그린다. 사람이 연 묶음과 다시 편 네 줄은 다시 그려도 지킨다 ── */
  const board = { keys: {}, open: new Set(), unfold: '', key: '', sum: false, at: null };
  function paintPart(name, value, paint) {
    const k = JSON.stringify(value ?? null);
    if (board.keys[name] === k) return;
    board.keys[name] = k;
    paint();
  }
  function renderBoard(v) {
    app.bakBoard.hidden = !v;
    if (!v) { board.keys = {}; app.bakHelper.hidden = true; return; }
    board.key = v.key || '';
    paintPart('drive', v.drive, () => paintDrive(v.drive || {}));
    paintPart('steps', v.steps, () => paintSteps(Array.isArray(v.steps) ? v.steps : []));
    paintPart('sum', v.sum, () => paintSum(v.sum));
    paintPart('groups', v.groups, () => paintGroups(Array.isArray(v.groups) ? v.groups : []));
    board.sum = !!v.sum;
    board.at = v.at || null;
    applyFold();
    placeHelper(board.at);
  }
  function paintDrive(d) {
    const box = app.bakDrive;
    if (d.empty) { box.replaceChildren(el('p', 'd-lab', '남은 공간'), el('p', 'd-empty', d.empty)); return; }
    const lab = el('p', 'd-lab', d.label);
    if (d.at) lab.append(el('span', '', d.at));
    const big = el('p', 'd-big');
    big.append(el('b', 'd-free', d.free), el('span', 'd-unit', d.unit));
    const bar = el('div', 'd-bar');
    bar.setAttribute('role', 'img');
    bar.setAttribute('aria-label', d.aria || '');
    const fill = el('i', 'd-fill');
    fill.style.width = `${Number(d.freePct) || 0}%`;
    bar.append(fill);
    const ticks = el('div', 'd-ticks');
    ticks.setAttribute('aria-hidden', 'true');
    ticks.append(el('span', 't0', '0'), el('span', 't2', d.max));
    if (Number.isFinite(d.linePct)) {
      const line = el('i', 'd-line');
      line.style.left = `${d.linePct}%`;
      bar.append(line);
      // 정한 선 글자는 막대 안쪽에 머물게 하고, 양 끝 글자와 겹치면 그 끝 글자를 뺀다(카본 A7)
      const tl = el('span', 'tl', d.lineLabel);
      tl.style.left = `${Math.max(8, Math.min(92, d.linePct))}%`;
      ticks.append(tl);
      if (d.linePct < 18) ticks.querySelector('.t0')?.remove();
      if (d.linePct > 82) ticks.querySelector('.t2')?.remove();
    }
    const parts = [lab, big, bar, ticks];
    if (d.pred) parts.push(el('p', d.below ? 'd-pred below' : 'd-pred', d.pred));
    if (d.pace) parts.push(el('p', 'd-pace', d.pace));
    // 둘째 드라이브부터는 한 줄 막대. 넷 이상이면 셋째부터 접는다(PC 진단 설계 5.1)
    const row = r => {
      const box2 = el('div', r.below ? 'd-row below' : 'd-row');
      const head = el('p', 'd-row-h');
      head.append(el('b', '', r.label), el('span', 'd-row-size', r.size), el('span', 'd-row-free', r.free));
      const mini = el('div', 'd-mini');
      mini.setAttribute('role', 'img');
      mini.setAttribute('aria-label', r.aria || '');
      const f = el('i', 'f');
      f.style.width = `${Number(r.freePct) || 0}%`;
      mini.append(f);
      if (Number.isFinite(r.linePct)) { const l = el('i', 'l'); l.style.left = `${r.linePct}%`; mini.append(l); }
      box2.append(head, mini);
      return box2;
    };
    if (d.rows?.length) {
      const rows = el('div', 'd-rows');
      rows.append(...d.rows.map(row));
      if (d.folded?.length) {
        // 다시 그려도 손님이 펼쳐 둔 목록은 펼친 채로 둔다(카본 A2)
        const wasOpen = !!box.querySelector('.d-more')?.open;
        const more = el('details', 'd-more');
        more.open = wasOpen;
        more.append(el('summary', '', d.foldLabel), ...d.folded.map(row));
        rows.append(more);
      }
      parts.push(rows);
    }
    if (d.hidden) parts.push(el('p', 'd-pace', d.hidden));
    box.replaceChildren(...parts);
  }
  function stepCells(r, sumRow = false) {
    const cells = [el('span', 's-no', sumRow ? '' : r.no), el('span', 's-nm', r.nm), el('span', 's-mid', r.mid), el('span', 's-val', r.val)];
    return cells;
  }
  function paintSteps(steps) {
    app.bakSteps.replaceChildren(...steps.map(r => {
      const li = el('li', `one-step${r.state ? ` ${r.state}` : ''}${r.can ? ' can' : ''}${r.ok ? ' ok' : ''}`);
      li.dataset.k = r.k;
      li.append(...stepCells(r));
      if (Number.isFinite(r.p)) { const bar = el('i', 's-bar'); bar.style.setProperty('--p', String(Math.max(0, Math.min(1, r.p)))); li.append(bar); }
      return li;
    }));
  }
  function paintSum(sum) {
    const b = app.bakSum;
    b.hidden = !sum;
    if (!sum) { b.replaceChildren(); return; }
    b.replaceChildren(...stepCells(sum, true), el('i', 'g-ch'));
  }
  /* 끝나면 네 줄을 한 줄로 접는다. 사람이 다시 펴면 그 누름(열쇠)이 바뀔 때까지 편 채로 둔다 */
  function applyFold() {
    const folded = board.sum && board.unfold !== board.key;
    app.bakFlow.classList.toggle('folded', folded);
    app.bakSum.setAttribute('aria-expanded', String(!folded));
  }
  function paintGroups(groups) {
    app.bakGroups.replaceChildren(...groups.map(g => {
      const wrap = el('div', `g${board.open.has(g.k) ? ' open' : ''}`);
      wrap.dataset.g = g.k;
      const head = el('button', 'g-h');
      head.type = 'button';
      head.dataset.bakG = g.k;
      head.setAttribute('aria-expanded', String(board.open.has(g.k)));
      head.append(el('span', 'g-nm', g.nm), el('span', 'g-mid', g.mid), el('span', `g-val gr-${g.k}`, g.val), el('i', 'g-ch'));
      const body = el('div', 'g-b'), inner = el('div', 'g-in');
      // 접힌 속은 화면 낭독기와 Tab이 지나간다(카본 A9)
      body.inert = !board.open.has(g.k);
      body.setAttribute('aria-hidden', String(!board.open.has(g.k)));
      (Array.isArray(g.items) ? g.items : []).forEach((it, j) => {
        const row = el('div', 'it');
        row.style.setProperty('--j', String(j));
        const t = el('p', 'it-t');
        t.append(el('b', '', it.nm));
        if (it.cnt) t.append(el('span', 'cnt', it.cnt));
        if (it.how) t.append(el('small', '', it.how));
        row.append(t, el('span', `it-v gr-${g.k}`, it.val));
        inner.append(row);
      });
      body.append(inner);
      wrap.append(head, body);
      return wrap;
    }));
  }
  function toggleGroup(k) {
    const on = !board.open.has(k);
    if (on) board.open.add(k); else board.open.delete(k);
    const g = app.bakGroups.querySelector(`.g[data-g="${k}"]`);
    g?.classList.toggle('open', on);
    g?.querySelector('.g-h')?.setAttribute('aria-expanded', String(on));
    const body = g?.querySelector('.g-b');
    if (body) { body.inert = !on; body.setAttribute('aria-hidden', String(!on)); }
  }
  /* 작은 구(솔리오의 분신)가 지금 일하는 줄의 번호 자리에 앉는다. 일하는 줄이 없으면 숨는다 */
  function placeHelper(at) {
    const h = app.bakHelper;
    const row = at && !app.bakFlow.classList.contains('folded') ? app.bakSteps.querySelector(`.one-step[data-k="${at}"]`) : null;
    for (const r of app.bakSteps.querySelectorAll('.one-step.at')) if (r !== row) r.classList.remove('at');
    if (!row) { h.hidden = true; return; }
    row.classList.add('at');
    h.hidden = false;
    h.style.transform = `translateY(${row.offsetTop + row.offsetHeight / 2 - 11}px)`;
  }
  function visRow(r) {
    const b = el('button', 'row');
    b.type = 'button';
    b.dataset.vis = String(r.key);
    b.setAttribute('aria-expanded', 'false');
    const more = el('div', 'more');
    more.setAttribute('aria-hidden', 'true');
    more.append(el('div', 'more-in'));
    fillVisRow(b, r, more);
    return [b, more];
  }
  /* 줄 하나의 글을 쓴다. 펼침, 고정, 초점은 건드리지 않는다 */
  function fillVisRow(b, r, more = b.nextElementSibling) {
    b.classList.toggle('now', !!r.now);
    b.classList.toggle('unread', !!r.unread);
    const label = rowSpeech(r);
    if (b.getAttribute('aria-label') !== label) b.setAttribute('aria-label', label);
    const parts = [['nm', r.nm], ['mid', r.mid], ['val', r.val], ['when', r.when]];
    if (b.children.length === parts.length && parts.every(([cls], k) => b.children[k].className === cls)) parts.forEach(([, text], k) => setText(b.children[k], text == null ? '' : String(text)));
    else b.replaceChildren(...parts.map(([cls, text]) => el('span', cls, text)));
    const inner = more?.firstElementChild;
    if (!inner) return;
    const moreKey = JSON.stringify(Array.isArray(r.more) ? r.more : []);
    if (moreKeys.get(inner) === moreKey) return;
    moreKeys.set(inner, moreKey);
    inner.replaceChildren();
    let j = 0, firstDo = true;
    const put = n => { n.style.setProperty('--j', String(j++)); inner.append(n); };
    for (const item of Array.isArray(r.more) ? r.more : []) {
      const [kind, a, c, val, when, mark] = Array.isArray(item) ? item : [];
      if (kind === 'say') put(el('p', 'more-say', a));
      else if (kind === 'note') put(el('p', 'more-note', a));
      // 계정 건강(계정건강 PC앱_구현설계 10절 「그릴 것」): 구역 이름, 풀어 쓴 글, 이름과 밝은 글(잘하고 있는 것 · 다음 목표 · 할 일)
      else if (kind === 'head') put(el('p', 'more-head', a));
      else if (kind === 'text') put(el('p', 'more-text', a));
      else if (kind === 'good' || kind === 'goal' || kind === 'do') {
        // 할 일의 첫 줄 위에는 가는 줄을 긋는다(신호 줄과 틈을 둔다)
        const row = el('div', `row sub ${kind}${kind === 'do' && firstDo ? ' first' : ''}`);
        if (kind === 'do') firstDo = false;
        row.append(el('span', 'nm', a), el('span', 'mid', c));
        put(row);
      } else if (kind === 'flow') {
        // 조회 1,000번이 가는 길: 단계가 가로로 놓이고 새는 단계만 밝다. 맨 앞 「조회 1,000」은 모델이 세운다
        const flow = el('div', 'flow');
        flow.setAttribute('role', 'list');
        for (const step of Array.isArray(a) ? a : []) {
          if (!step || typeof step !== 'object') continue;
          const cell = el('div', step.leak ? 'step leak' : 'step');
          cell.setAttribute('role', 'listitem');
          const name = el('i', '', step.name);
          if (step.verdict) name.append(el('em', '', step.verdict));
          cell.append(el('b', '', step.big), name, el('span', '', step.text));
          flow.append(cell);
        }
        put(flow);
        if (c) put(el('p', 'more-text', c));
      }
      else if (kind === 'week') {
        const days = (Array.isArray(c) ? c : []).map(x => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, x) : 0));
        const top = Math.max(1, ...days);
        const row = el('div', 'row sub row-plain'), week = el('span', 'week');
        week.setAttribute('role', 'img');
        week.setAttribute('aria-label', `지난 7일의 하루 방문 수 ${days.join(', ')}`);
        days.forEach((x, k) => { const i = el('i', k === days.length - 1 ? 'today' : ''); i.style.setProperty('--h', Math.round((x / top) * 100) + '%'); week.append(i); });
        row.append(el('span', 'nm', a), week, el('span', 'val', val));
        put(row);
      } else if (kind === 'row') {
        // 여섯째 칸이 참이면 밝다(계정 건강의 나쁨 판정). 방문자 분석의 줄은 다섯 칸이다
        const row = el('div', mark ? 'row sub now' : 'row sub');
        row.append(el('span', 'nm', a), el('span', 'mid', c), el('span', 'val', val), el('span', 'when', when));
        put(row);
      }
    }
  }
  /* 줄 하나를 펼치거나 접는다. pin이면 눌러서 연 것이라 손이 떠나도 열려 있다. 접힌 안쪽의 단추는 Tab 차례에서 빠진다(inert) */
  function setMore(b, on) {
    const more = b.nextElementSibling;
    if (!more || !more.classList.contains('more')) return;
    // 펼친 채 고정한 줄(사무실 대화 짜임의 이 부서 칸 · 부서 없는 일 · 지금)은 접히지 않고 열고 닫는 알림도 보내지 않는다
    const fixed = b.classList.contains('fixed');
    if (fixed && !on) return;
    more.classList.toggle('open', on);
    more.inert = !on;
    if (on) more.removeAttribute('aria-hidden'); else more.setAttribute('aria-hidden', 'true');
    const was = b.classList.contains('opened');
    b.classList.toggle('opened', on);
    if (!fixed) b.setAttribute('aria-expanded', String(on));
    if (!on) b.classList.remove('pin');
    // 묻고 있던 줄을 접으면 물음을 거둔다(2단계 둘째 조각 설계 8.2)
    if (!on && more.querySelector('.quiet.warn')) disarmRow(b);
    // 지켜보는 줄(모델별 토큰, 계정 지우기)은 열고 접을 때 컨트롤러에 알린다. 그리는 중에 다시 그리지 않게 한 박자 뒤에 알린다
    if (was !== on && !fixed && b.dataset?.watch && b.dataset.key) {
      const room = b.closest('.room')?.dataset.room || '', key = b.dataset.key;
      setTimeout(() => { if (!disposed) onAction('room', { room, key, act: on ? 'row-open' : 'row-fold' }); }, 0);
    }
  }
  /* 한 줄을 펼치면 그 아래에 열려 있던 줄은 접는다. 위쪽 줄은 접지 않는다(접으면 손 밑의 줄이 위로 달아난다) */
  function openVis(b, pin = false) {
    if (b.classList.contains('fixed')) { setMore(b, true); return; }
    const box = b.parentElement, rows = box ? [...box.querySelectorAll(':scope > button.row')] : [], i = rows.indexOf(b);
    if (i < 0) return;
    rows.forEach((r, k) => { if (k > i && !r.classList.contains('pin')) setMore(r, false); });
    if (pin) b.classList.add('pin');
    setMore(b, true);
  }
  /* box를 주면 그 줄 묶음만, 아니면 구독 줄, 방문자 분석과 계정 건강의 줄, 방의 줄을 모두 접는다 */
  function closeMores(all = false, box = null) {
    for (const c of box ? [box] : [...readBoxes, app.rows, ...asideBoxes]) for (const b of c.querySelectorAll(':scope > button.row')) if (all || !b.classList.contains('pin')) setMore(b, false);
  }
  const onVisOver = event => {
    const b = event.target?.closest?.('button.row[data-vis]');
    if (!b || event.pointerType !== 'mouse' || b.contains(event.relatedTarget)) return;
    clearTimeout(visTimer);
    visTimer = setTimeout(() => { if (!disposed && b.isConnected) openVis(b); }, NEAR.row);
  };
  const onVisOut = event => {
    const b = event.target?.closest?.('button.row[data-vis]');
    if (b && !b.contains(event.relatedTarget)) clearTimeout(visTimer);
  };
  const onVisEnter = () => { clearTimeout(visLeave); };
  const onVisLeave = event => { const box = event?.currentTarget || app.visRows; clearTimeout(visTimer); clearTimeout(visLeave); visLeave = setTimeout(() => { if (!disposed) closeMores(false, box); }, NEAR.close); };
  const onVisFocus = event => {
    if (restoringVis) return;
    const b = event.target?.closest?.('button.row[data-vis]');
    if (b && focusVisible(b)) openVis(b);
  };
  /* 구독 줄의 안쪽도 방문자 분석 줄과 같은 규칙이다: 머물면 열리고, 묶음을 벗어나 머물면 고정하지 않은 줄이 접히고, 자판 초점이 오면 열린다(설계 검토 2차 1) */
  /* 방의 줄(data-key)도 같은 규칙이다(2단계 둘째 조각 설계 1.3절). 묶음을 벗어나면 그 묶음의 고정하지 않은 줄만 접힌다 */
  const ROW_SEL = 'button.row[data-svc],button.row[data-key]';
  const onSubOver = event => {
    const b = event.target?.closest?.(ROW_SEL);
    if (!b || event.pointerType !== 'mouse' || b.contains(event.relatedTarget) || scene?.fan?.open) return;
    clearTimeout(subTimer);
    subTimer = setTimeout(() => { if (!disposed && b.isConnected && !scene?.fan?.open) openVis(b); }, NEAR.row);
  };
  const onSubOut = event => {
    const b = event.target?.closest?.(ROW_SEL);
    if (b && !b.contains(event.relatedTarget)) clearTimeout(subTimer);
  };
  const onSubEnter = () => { clearTimeout(subLeave); };
  const onSubLeave = event => { const box = event?.currentTarget || app.rows; clearTimeout(subTimer); clearTimeout(subLeave); subLeave = setTimeout(() => { if (!disposed) closeMores(false, box); }, NEAR.close); };
  const onSubFocus = event => {
    if (restoringVis) return;
    const b = event.target?.closest?.(ROW_SEL);
    if (b && focusVisible(b)) openVis(b);
  };

  /* ── 구 곁의 펼침(2단계 첫 조각 설계 1.3절, 시안 layoutFan · nearStep) ── */
  const fanShown = () => stageEl.dataset.fan === '1';
  function renderFan(s) {
    const f = s.fan, names = f ? f.names : [], foot = f ? f.foot : [];
    // 1분마다 오는 장면이 같은 목록이면 DOM을 그대로 둔다(초점과 가리킴이 풀리지 않게, 설계 검토 1차 14)
    const key = JSON.stringify([names.map(n => [n.space, n.label, n.desc, n.current]), foot.map(x => [x.action, x.label])]);
    // 펼침 안에 초점이 있는 채로 단추가 꺼지거나(「다시 확인」 조회 중) 다시 지어지면, 일이 끝난 뒤 같은 단추나 지금 공간으로 초점을 돌려놓는다(fix-all 화면 Fable F2, 0.5.4 후보 카본 B1)
    const had = fanShown() && app.fan.contains(doc.activeElement) ? doc.activeElement : null;
    const hadKey = had ? (had.dataset?.go ? `go:${had.dataset.go}` : had.dataset?.foot ? `foot:${had.dataset.foot}` : '') : '';
    if (key !== fanKey) {
      fanKey = key;
      const nodes = names.map((n, i) => {
        const b = el('button', 'fan-go');
        b.type = 'button';
        b.dataset.go = n.space;
        b.style.setProperty('--k', String(i));
        b.setAttribute('aria-current', String(n.current));
        b.append(el('span', 'fan-n', n.label), el('span', 'fan-d', n.desc), el('span', 'fan-now', '지금 여기'));
        return b;
      });
      const p = el('p', 'fan-foot');
      p.style.setProperty('--k', String(names.length));
      p.append(...foot.map(x => button('quiet', x.label, { 'data-orb-act': 'foot', 'data-foot': x.action })));
      // 오류 줄(role=alert)과 까닭 줄(role=status)은 떼지 않고 그 뒤만 바꾼다. 알림 영역을 떼었다 붙이면 낭독기가 새 글을 놓친다(카본 A1)
      if (app.fan.firstElementChild !== app.fanError || app.fanError.nextElementSibling !== app.fanLead) app.fan.prepend(app.fanError, app.fanLead);
      while (app.fanLead.nextSibling) app.fanLead.nextSibling.remove();
      app.fan.append(...nodes, ...(foot.length ? [p] : []));
    }
    setText(app.fanError, f?.error || '');
    // 배정 조회 까닭 한 줄(PC 검수 F1). 「다시 확인」은 아래 발치 줄에 선다
    setText(app.fanLead, f?.lead || '');
    const open = Boolean(f?.open) && s.layer === 'app' && s.mode === 'app';
    if (open) { if (stageEl.dataset.fan !== '1') stageEl.dataset.fan = '1'; } else if ('fan' in stageEl.dataset) delete stageEl.dataset.fan;
    syncLobby();
    for (const b of [app.orbBtn, app.nameBtn]) if (b.getAttribute('aria-expanded') !== String(open)) b.setAttribute('aria-expanded', String(open));
    app.fan.inert = !open;
    // 펼친 동안 물러난 이름 단추와 오브제 줄, 흐린 방은 Tab 차례에서도 빠진다. 그 안에 있던 초점은 보이는 구 단추로 먼저 옮긴다(검수 A1)
    // 「한 번에 처리」의 머리 줄 단추와 카드도 같다(물러난 단추를 Tab이 밟지 않게)
    const back = [app.nameBtn, app.rail, app.solio, app.backup, app.visits, app.health, app.office, app.space, app.todoBar, app.todo, ...Object.values(app.asides).map(a => a.room)].filter(Boolean); // 사무실 방도(공간 지도 검수 c FA1)
    // 다가가 머물러 연(고정하지 않은) 펼침이면 옮기기 전 자리를 기억해 두고, 닫을 때 초점이 구에 그대로 있으면 그 자리로 돌려놓는다(최종 검수 F5)
    if (open) { const a = doc.activeElement; if (a && back.some(x => x.contains(a))) { fanReturn = f.pin ? null : a; app.orbBtn.focus?.({ preventScroll: true }); } }
    if (open && f.pin) fanReturn = null;
    for (const x of back) if (x.inert !== open) x.inert = open;
    for (const b of app.fan.querySelectorAll('button')) b.disabled = s.busy;
    if (had && hadKey && (s.busy || !had.isConnected)) fanRefocus = hadKey;
    if (!open) fanRefocus = null;
    else if (fanRefocus && !s.busy) {
      const want = fanRefocus;
      fanRefocus = null;
      const a = doc.activeElement;
      // 초점이 body로 빠졌을 때만 돌려놓는다. 그사이 사람이 다른 단추로 옮겼으면 그대로 둔다(pc-fan-followups Fable F2).
      // 꺼졌던 단추에 초점이 남았으면 바로 위에서 다시 켜져 그대로 초점을 가지므로 따로 보지 않는다(pc-fan-p3 Fable F2)
      if (!a || a === doc.body) {
        const [kind, value] = [want.slice(0, want.indexOf(':')), want.slice(want.indexOf(':') + 1)];
        const same = [...app.fan.querySelectorAll(kind === 'go' ? '.fan-go' : '[data-foot]')].find(b => (kind === 'go' ? b.dataset.go : b.dataset.foot) === value);
        const target = same || app.fan.querySelector('.fan-go[aria-current="true"]') || app.fan.querySelector('.fan-go');
        // 돌려놓는 초점은 가리킨 것이 아니다. 펼침의 톡 소리와 가리킴 모습을 내지 않는다(pc-fan-followups Fable F3)
        fanRestoring = true;
        try { target?.focus?.({ preventScroll: true }); } catch { /* 초점은 사람이 옮길 수 있다 */ } finally { fanRestoring = false; }
      }
    }
    if (open && !fanWasOpen) {
      // 펼칠 때 오브제와 줄의 머묾 타이머를 지운다. 흐린 방 위에서 걸려 있던 머묾이 펼친 뒤에 열리지 않게 한다(설계 검토 1차 4)
      clearTimeout(fanTimer); fanTimer = 0; clearTimeout(fanLeave); fanLeave = 0;
      clearTimeout(progTimer); clearTimeout(subTimer); clearTimeout(visTimer);
      app.rail.classList.remove('near');
      layoutFan();
    }
    if (!open && fanWasOpen) {
      clearTimeout(fanLeave); fanLeave = 0;
      stage.setHot(null); stage.setFace(null);
      for (const b of app.fan.querySelectorAll('.fan-go')) b.classList.remove('hot');
      // 접힌 펼침에 초점이 남지 않게 구 단추로 돌려놓는다(body로 빠지지 않게)
      const a = doc.activeElement;
      if (a && app.fan.contains(a)) app.orbBtn.focus?.({ preventScroll: true });
      const back0 = fanReturn; fanReturn = null;
      if (back0 && back0.isConnected && doc.activeElement === app.orbBtn && !back0.closest?.('[inert],[hidden]')) {
        restoringVis = true;
        try { back0.focus?.({ preventScroll: true }); } catch {} finally { restoringVis = false; }
      }
    }
    fanWasOpen = open;
  }
  /* 끌기 띠의 끌기 칸이 왼쪽 위 묶음 뒤에서 시작하게 그 폭을 뿌리에 적는다. 오브제 이름이 펼쳐질 자리(약 260px)까지 비운다(설계 검토 1차 3나).
     옛 화면에서는 오브제 줄이 없고 「돌아가기」까지가 그 묶음이다(OS 마우스 확인 11-19) */
  function syncDragGap(legacy = false) {
    const r = root.getBoundingClientRect?.(), h = root.querySelector('.here')?.getBoundingClientRect?.();
    if (!r || !h || !r.width) return;
    const gap = Math.max(0, Math.min(r.width - 220, Math.round(h.right - r.left + (legacy || app.rail.hidden ? 0 : 260) - 8)));
    const v = gap + 'px';
    if (root.style.getPropertyValue('--orb-here-w') !== v) root.style.setProperty('--orb-here-w', v);
  }
  /* 펼침의 자리는 앱이 실제로 그리는 작은 구(반지름 13)의 왼쪽 위에서 잡는다. 시안의 16을 옮기지 않는다(설계 검토 1차 ①) */
  function layoutFan() {
    const s = stageEl.getBoundingClientRect(), hp = homePoint(), W = s.width || 1, H = s.height || 1, fr = fanR(H);
    const ox = hp.x - HOME_R, oy = hp.y - HOME_R, side = W >= 560;
    const top = Math.round(side ? oy + 2 : oy + fr * 2 + 16);
    app.fan.style.left = Math.round(side ? ox + fr * 2 + 26 : ox + 4) + 'px';
    app.fan.style.top = top + 'px';
    // 창보다 길면 펼침 안에서 내린다(시안 11-18)
    app.fan.style.maxHeight = Math.max(72, H - top - 8) + 'px';
  }
  const nearBox = (r, x, y, pad) => x > r.left - pad && x < r.right + pad && y > r.top - pad && y < r.bottom + pad;
  function nearOrb(x, y) { return nearBox(app.orbBtn.getBoundingClientRect(), x, y, NEAR.orb) || nearBox(app.nameBtn.getBoundingClientRect(), x, y, NEAR.name); }
  /* 펼친 뒤에 머물 수 있는 넓이: 자란 구와 펼침, 그리고 둘레 */
  function fanZone(x, y) {
    const st = stage.state(), s = stageEl.getBoundingClientRect();
    return Math.hypot(x - s.left - st.cx, y - s.top - (st.top + st.r)) < st.r + NEAR.zone || nearBox(app.fan.getBoundingClientRect(), x, y, NEAR.zone);
  }
  /* 다가가 머물면 열고(빠르게 다가오면 조금 더 기다린다), 다가가서 연 것은 구역을 벗어나 머물면 닫는다. 옛 화면이 열린 동안은 다가가서 열지 않는다(설계 검토 1차 2) */
  /* 머묾이 다 차도 구가 아직 움직이는 중(접히며 돌아오는 중)이면 버리지 않고 움직임이 끝날 때까지 조금씩 미룬다. 손이 그대로 있는데 열리지 않는 일이 없게 한다 */
  function armFan(ms) {
    fanTimer = setTimeout(() => {
      fanTimer = 0;
      if (disposed || scene?.fan?.open || !nearOrb(ptrPx.x, ptrPx.y)) return;
      if (stage.moving) { armFan(60); return; }
      onAction('fan-near');
    }, ms);
  }
  function fanStep(x, y) {
    // 띠에 있을 때도(창 안의 PULSE) 다가가서 열지 않는다. 띠를 지날 때마다 PULSE가 숨었다 나타나지 않게 한다(3단계 구현 설계 4.3)
    if (!scene || scene.layer !== 'app' || scene.mode !== 'app' || scene.band || scene.busy || !canHover() || stageEl.classList.contains('still')) { clearTimeout(fanTimer); fanTimer = 0; return; }
    if (!scene.fan?.open) {
      if (!nearOrb(x, y)) { clearTimeout(fanTimer); fanTimer = 0; }
      else if (!fanTimer) armFan(ptrPx.v > 1.4 ? NEAR.fast : NEAR.open);
    } else if (!scene.fan.pin && fanShown()) {
      if (fanZone(x, y)) { clearTimeout(fanLeave); fanLeave = 0; }
      else if (!fanLeave) fanLeave = setTimeout(() => { fanLeave = 0; if (!disposed && fanShown() && !scene?.fan?.pin && !fanZone(ptrPx.x, ptrPx.y)) onAction('fan-leave'); }, NEAR.close);
    }
  }
  /* 다가가기와 구역 판정은 무대가 아니라 맨 위 끌기 띠까지 덮는 뿌리에서 듣는다. 띠는 무대의 형제라, 무대에서 들으면 띠 위를 지날 때 판정이 끊긴다(설계 검토 1차 3가) */
  const onRootMove = event => {
    const t = clock(), dt = t - ptrPx.t;
    // 앞 움직임과 0.2초 넘게 떨어졌으면 멈췄다 다시 움직인 것이라 속도를 0으로 둔다. 예전 값이 남아 0.26초를 기다리지 않게 한다(최종 검수 F6, 시안 nearStep)
    ptrPx.v = ptrPx.t && dt > 0 && dt < 200 ? Math.hypot(event.clientX - ptrPx.x, event.clientY - ptrPx.y) / dt : 0;
    ptrPx.x = event.clientX; ptrPx.y = event.clientY; ptrPx.t = t;
    const r = stageEl.getBoundingClientRect();
    if (r.width && r.height && !reduced() && !stageEl.contains(event.target)) stage.setPointer((event.clientX - r.left) / r.width, (event.clientY - r.top) / r.height);
    if (event.pointerType !== 'touch') fanStep(event.clientX, event.clientY);
  };
  const onRootLeave = () => { ptrPx.x = ptrPx.y = -1e4; ptrPx.t = 0; fanStep(-1e4, -1e4); };
  /* 눌러서 연 펼침은 바깥을 누르면 닫힌다. 펼친 동안 방은 눌리지 않으므로 그 자리의 줄이 같이 눌리지 않는다 */
  const onRootDown = event => {
    if (!fanShown() || !scene?.fan?.pin) return;
    if (event.target?.closest?.('.here-orb,.here-name')) return;
    if (!fanZone(event.clientX, event.clientY)) onAction('close-switch');
  };
  /* 이름을 가리키면 그 공간의 별이 밝아지고 톡 소리가 한 번 난다(시안 pointAt) */
  const onFanPoint = event => {
    if (fanRestoring) return;
    const b = event.target?.closest?.('.fan-go[data-go]');
    const on = event.type === 'pointerover' || event.type === 'focusin';
    if (b && on) { if (!b.classList.contains('hot')) sound.key(); stage.setHot(b.dataset.go); stage.setFace(b.dataset.go); for (const x of app.fan.querySelectorAll('.fan-go')) x.classList.toggle('hot', x === b); }
    else if (!on && (!b || !b.contains(event.relatedTarget))) { stage.setHot(null); stage.setFace(null); for (const x of app.fan.querySelectorAll('.fan-go')) x.classList.remove('hot'); }
  };

  function setUnavailable(button, off) {
    button.disabled = false;
    if (off) button.setAttribute('aria-disabled', 'true'); else button.removeAttribute('aria-disabled');
  }

  /* ── 방과 줄 안쪽(2단계 둘째 조각 설계 1.3절, 시안 putRows · nodesOf · showRow · holdBox · twice).
     자료 함수(solio-rooms.mjs)가 [종류, …]로 적은 안쪽을 그린다. 계정 이름과 본체 글이 섞이므로 글은 모두 textContent로만 넣는다 ── */
  const FIELD_TYPES = new Set(['password', 'date', 'time', 'email']);
  const cellKeys = new WeakMap(), acted = new WeakMap();
  const rowByKey = (box, key) => [...box.querySelectorAll(':scope > button.row[data-key]')].find(b => b.dataset.key === String(key)) || null;
  const flagsOf = fl => String(fl || '').split(' ').filter(Boolean);
  function renderAsides(name, roomsScene) {
    for (const [key, a] of Object.entries(app.asides)) if (a.room.hidden !== (key !== name)) a.room.hidden = key !== name;
    if (name !== lastAside) {
      // 방을 연 자리를 적어 둔다. 닫을 때 초점을 그리로 돌린다(설계 1.3절 「보기」)
      if (name && !lastAside) { const a = doc.activeElement; asideReturn = a && a !== doc.body && root.contains(a) ? a : null; }
      if (name) { closeMores(true, app.asides[name].rows); enterRoom(name); }
      else if (lastAside) { for (const b of asideBoxes) acted.delete(b); if (lastProg) enterRoom(lastProg); }
      lastAside = name;
    }
    if (!name) return;
    const a = app.asides[name], d = roomsScene?.[name];
    if (!d) return;
    setText(a.text, d.say);
    setText(a.then, d.then);
    putRows(a.rows, d.rows || [], name);
    setText(a.foot, d.foot);
    a.act.hidden = !d.act;
    if (d.act) { setText(a.act, d.act[0]); a.act.dataset.roomAct = d.act[1]; setUnavailable(a.act, flagsOf(d.act[2]).includes('off')); }
    applyRequests(a.rows, name, d);
  }
  /* 컨트롤러의 요청(방을 열 때 열어 둘 줄, 끝난 뒤 접을 줄, 초점을 둘 단추)은 번호마다 한 번만 따른다 */
  function applyRequests(box, room, d) {
    if (d.closing && applied.close[room] !== d.closing.seq) {
      applied.close[room] = d.closing.seq;
      const b = rowByKey(box, d.closing.key), inner = b?.nextElementSibling?.firstElementChild;
      if (inner && stale.has(inner)) buildInner(b, inner, stale.get(inner).items);
      if (b) setMore(b, false);
    }
    if (d.opening && applied.open[room] !== d.opening.seq) { applied.open[room] = d.opening.seq; const b = rowByKey(box, d.opening.key); if (b) { openVis(b, true); showRow(b); } }
    if (d.focus && applied.focus[room] !== d.focus.seq) { applied.focus[room] = d.focus.seq; focusInRoom(box, room, d.focus); }
  }
  function focusInRoom(box, room, f) {
    if (f.say) { focusEl(app.asides[room]?.say); return; }
    const b = rowByKey(box, f.key);
    if (!b) return;
    if (!b.classList.contains('opened')) openVis(b, true);
    const inner = b.nextElementSibling?.firstElementChild;
    let t = null;
    if (f.grp) { const g = [...(inner?.querySelectorAll('[data-grp]') || [])].find(x => x.dataset.grp === f.grp); t = g && !g.hidden ? g.querySelector('input,button') : null; }
    else if (f.ask) t = inner?.querySelector('[data-ask-q]') || null;
    else if (f.field) t = fieldEl(inner, f.field);
    else if (f.act) t = actEl(inner, f.act, f.arg);
    restoringVis = true;
    try { (t || b).focus?.({ preventScroll: true }); } catch {} finally { restoringVis = false; }
  }
  const actEl = (inner, act, arg) => [...(inner?.querySelectorAll('[data-room-act]') || [])].find(x => x.dataset.roomAct === act && (arg === undefined || arg === null || (x.dataset.roomArg || '') === String(arg))) || null;
  const fieldEl = (inner, name) => { const n = [...(inner?.querySelectorAll('[data-f]') || [])].find(x => x.dataset.f === name); return n?.matches?.('input') ? n : n?.querySelector('[aria-pressed="true"]') || n?.querySelector('button') || null; };
  /* 줄 열쇠로 줄을 그린다. 있던 줄은 그 자리에 두고(쓰던 칸과 초점이 남게) 글만 고쳐 쓰고, 없어진 줄은 빼고, 새 줄은 차례에 맞춰 넣는다 */
  function putRows(box, rows, room) {
    const byKey = new Map([...box.querySelectorAll(':scope > button.row[data-key]')].map(b => [b.dataset.key, b]));
    const fa = doc.activeElement, had = fa && box.contains(fa) ? focusInfo(fa) : null;
    const want = new Set(rows.map(r => String(r.key)));
    for (const [k, b] of byKey) if (!want.has(k)) { const m = b.nextElementSibling; if (m?.classList.contains('more')) { stale.delete(m.firstElementChild); m.remove(); } b.remove(); byKey.delete(k); }
    let slot = box.querySelector(':scope > button.row[data-key]');
    for (const r of rows) {
      let b = byKey.get(String(r.key)), m = b?.nextElementSibling;
      if (!b) [b, m] = keyRow(r);
      if (b === slot) slot = m.nextElementSibling;
      else { box.insertBefore(b, slot); box.insertBefore(m, slot); }
      fillKeyRow(b, r, room);
    }
    const now = doc.activeElement;
    if (had && (!now || now === doc.body || !box.contains(now))) restoreFocus(box, had);
  }
  function keyRow(r) {
    const b = el('button', 'row');
    b.type = 'button';
    b.dataset.key = String(r.key);
    b.setAttribute('aria-expanded', 'false');
    const m = el('div', 'more'), inner = el('div', 'more-in');
    m.setAttribute('aria-hidden', 'true');
    m.inert = true;
    inner.dataset.liveId = 'orb-live-' + (++liveSeq);
    m.append(inner);
    return [b, m];
  }
  function fillKeyRow(b, r, room) {
    // pin이면 「펼친 채 고정」: 머리는 누를 수 없는 제목이지만 data-key를 지닌다. 동작의 key 얻기 · 칸 값 모으기 · 초점 찾기가 그대로 돈다
    const fixed = !!r.pin;
    if (b.classList.contains('fixed') !== fixed) {
      b.classList.toggle('fixed', fixed);
      b.nextElementSibling?.classList.toggle('fixed', fixed);
      if (fixed) { b.tabIndex = -1; b.setAttribute('role', 'heading'); b.setAttribute('aria-level', '3'); b.removeAttribute('aria-expanded'); }
      else { b.removeAttribute('tabindex'); b.removeAttribute('role'); b.removeAttribute('aria-level'); b.setAttribute('aria-expanded', String(b.classList.contains('opened'))); }
    }
    b.classList.toggle('now', !!r.now);
    b.classList.toggle('unread', !!r.unread);
    b.classList.toggle('gap', !!r.gap);
    if (r.watch) b.dataset.watch = '1'; else delete b.dataset.watch;
    const label = r.label || [r.nm, r.sub, r.mid, r.val, r.when].filter(Boolean).join(', ');
    if (b.getAttribute('aria-label') !== label) b.setAttribute('aria-label', label);
    // flag가 참이면 이름 옆에 느낌표가 붙는다(사무실의 부서 줄, 구현설계 7절). 낭독 이름(label)이 「새 소식」을 읽는다
    const cells = [['nm', r.nm, r.sub, !!r.flag], ['mid', r.mid], ['val', r.val], ['when', r.when]], ck = JSON.stringify(cells);
    if (cellKeys.get(b) !== ck) {
      cellKeys.set(b, ck);
      b.replaceChildren(...cells.map(([cls, text, sub, flag]) => { const n = el('span', cls, text || ''); if (flag) { const f = el('i', 'flag', '!'); f.setAttribute('aria-hidden', 'true'); n.append(f); } if (sub) n.append(el('small', '', sub)); return n; }));
    }
    const inner = b.nextElementSibling?.firstElementChild;
    if (!inner) return;
    const items = Array.isArray(r.more) ? r.more : [];
    // 같은 글로 실패해 안쪽이 그대로여도 Enter로 누른 일의 끝을 본다
    if (moreKeys.get(inner) === JSON.stringify(items)) { stale.delete(inner); queueSettle(b, inner); if (fixed && !b.classList.contains('opened')) setMore(b, true); return; }
    // 쓰던 칸에 초점이 있거나 그 안쪽을 누르는 중이면 지금은 다시 짓지 않는다. 1분 장면이 쓰던 글과 누르던 단추를 지우지 않게 한다(설계 1.3절).
    // 다만 칸의 글이 방금 저장되어 새 처음 값으로 돌아왔으면 쓰던 중이 아니다. 바로 다시 지어 저장 뒤의 문장을 보인다(초점은 같은 칸으로 돌아간다)
    const a = doc.activeElement;
    const typing = !!a && inner.contains(a) && !!a.matches?.('input,textarea,select');
    const def = typing && a.dataset?.f ? fieldDefault(items, a.dataset.f) : undefined;
    const savedBack = def === null || (def !== undefined && a.value !== (a.dataset.d ?? '') && def === a.value);
    if ((typing && !savedBack) || (pressing && pressing !== true && inner.contains(pressing))) {
      stale.set(inner, { b, items, room });
      // 다시 짓기를 미루는 동안에도 알림 줄의 글은 고쳐 쓴다. 칸에서 Enter로 저장해도 「저장했습니다.」가 들린다
      const live = items.find(x => Array.isArray(x) && x[0] === 'live'), node = inner.querySelector('.more-live');
      if (live && node) setText(node, live[1] || '');
      return;
    }
    buildInner(b, inner, items);
    if (fixed && !b.classList.contains('opened')) setMore(b, true);
  }
  const fieldValue = n => (n.matches?.('input') ? n.value : n.dataset.v ?? '');
  /* 장면 자료에서 그 이름의 칸이 가질 처음 값. 묶음 안까지 본다 */
  function fieldDefault(items, field) {
    for (const x of Array.isArray(items) ? items : []) {
      if (!Array.isArray(x)) continue;
      if (x[0] === 'fld' && x[4] === field) return String(x[2] || '');
      if (x[0] === 'grp') { const v = fieldDefault(x[2], field); if (v !== null) return v; }
    }
    return null;
  }
  function setPick(p, v) {
    p.dataset.v = String(v);
    for (const q of p.querySelectorAll('[data-pv]')) q.setAttribute('aria-pressed', String(q.dataset.pv === String(v)));
  }
  /* Enter로 누른 단추의 일이 끝났는지 다시 지은 뒤에 본다. 초점이 아직 그 단추에 있고 단추가 바쁘지 않으면 끝난 것이다.
   * 같은 이름의 칸이 보이면 그 칸의 글 끝으로 돌아간다. 묶음이 접혀 칸이 없거나 초점이 다른 곳으로 갔으면 그대로 둔다 */
  /* 저장 도중의 그리기(바쁨 표시 전, 값만 바뀐 판)에서 끝났다고 보고 칸으로 초점을 옮기면, 바로 뒤 묶음을 닫는 그리기가 「쓰는 중」으로 미뤄져
   * 묶음이 열린 채 남았다(흐름 시험 18-12 「Enter from the unchanged end time」). 그래서 마지막 그리기 뒤 한 번만 본다 */
  function queueSettle(b, inner) {
    if (!enterBack || b.dataset.key !== enterBack.key) return;
    clearTimeout(enterTimer);
    enterTimer = setTimeout(() => { enterTimer = 0; if (!disposed) settleEnter(b, inner); }, 0);
  }
  function settleEnter(b, inner) {
    const e = enterBack;
    if (!e || b.dataset.key !== e.key) return;
    const go = actEl(inner, e.act, e.arg);
    if (!go || doc.activeElement !== go) { enterBack = null; return; }
    if (go.getAttribute('aria-disabled') === 'true') return;
    enterBack = null;
    const field = [...inner.querySelectorAll('input[data-f]')].find(x => x.dataset.f === e.field && !x.closest('.grp[hidden]') && !x.disabled);
    if (!field) return;
    restoringVis = true;
    try { field.focus({ preventScroll: true }); const n = field.value.length; field.setSelectionRange?.(n, n); } catch {} finally { restoringVis = false; }
  }
  function buildInner(b, inner, items) {
    // 고쳐 쓰던 칸의 값은 그 칸의 처음 값이 그대로일 때만 새 칸에 옮긴다. 저장한 뒤 새 값이 왔으면 새 값을 쓴다
    const before = new Map([...inner.querySelectorAll('[data-f]')].map(n => [n.dataset.f, { v: fieldValue(n), d: n.dataset.d ?? '' }]));
    const fa = doc.activeElement, had = fa && inner.contains(fa) ? focusInfo(fa) : null;
    const liveId = inner.dataset.liveId || (inner.dataset.liveId = 'orb-live-' + (++liveSeq));
    inner.replaceChildren();
    let j = 0;
    for (const n of nodesOf(items, liveId)) { n.style.setProperty('--j', String(j++)); inner.append(n); }
    for (const n of inner.querySelectorAll('[data-f]')) {
      const o = before.get(n.dataset.f);
      if (!o || o.v === o.d || (n.dataset.d ?? '') !== o.d) continue;
      if (n.matches('input')) n.value = o.v; else setPick(n, o.v);
    }
    moreKeys.set(inner, JSON.stringify(items));
    stale.delete(inner);
    const box = b.parentElement;
    if (had && box) restoreFocus(box, had);
    queueSettle(b, inner);
    // 방금 안쪽을 누른 줄이 길어졌으면 지금 할 차례가 보이게 올린다. 그 줄이 화면에 걸쳐 있을 때만 한다(시안 putRows의 끝)
    const room = scrollBoxOf(b);
    // 걸쳐 있는지는 줄 머리와 그 아래 열린 안쪽(형제 칸)을 합쳐 본다. 긴 줄을 내려 머리가 위로 지나가도 안쪽을 누른 것은 따라간다(검수 A)
    const more = b.nextElementSibling, endAt = more?.classList?.contains('more') ? more.offsetTop + more.offsetHeight : b.offsetTop + b.offsetHeight;
    if (box && acted.get(box) === b.dataset.key && b.classList.contains('opened') && room && b.offsetTop < room.scrollTop + room.clientHeight && endAt > room.scrollTop) {
      // 누른 단추가 그 자리에 남아 있으면 그 단추와 알림 줄이 보이게 내린다. 줄이 방보다 길어도 지금 누를 단추가 방 안에 온다(설계 10.2절)
      const a = doc.activeElement;
      if (a && inner.contains(a)) keepInView(room, a, inner); else showRow(b);
    }
  }
  /* 잴 때의 초점을 따른다. 그리기 뒤 초점 요청(새로 펼친 묶음, 확인 물음)이 초점을 옮겼으면 그 칸을 보이게 하고, 확인 묶음이면 묶음 끝까지 보인다(검수 A) */
  function keepInView(room, a0, inner) {
    setTimeout(() => {
      const cur = doc.activeElement, a = cur && inner.contains(cur) ? cur : a0;
      if (disposed || !a.isConnected || room.hidden) return;
      const live = inner.querySelector('.more-live'), whole = a.closest?.('.confirm') || a;
      const rr = room.getBoundingClientRect(), ar = a.getBoundingClientRect(), wr = whole.getBoundingClientRect(), lr = live && live.textContent ? live.getBoundingClientRect() : ar;
      const bottom = Math.max(ar.bottom, wr.bottom, lr.bottom), over = bottom - (rr.bottom - 34), under = rr.top + 40 - ar.top;
      const by = over > 0 ? Math.min(over, Math.max(0, -under)) : under > 0 ? -under : 0;
      if (by) room.scrollTo?.({ top: Math.max(0, room.scrollTop + by), behavior: reduced() ? 'auto' : 'smooth' });
    }, 60);
  }
  function focusInfo(a) {
    const more = a.closest?.('.more'), row = a.matches?.('button.row[data-key]') ? a : more?.previousElementSibling;
    return { key: row?.dataset?.key, row: a === row, act: a.dataset?.roomAct, arg: a.dataset?.roomArg, field: a.dataset?.f || (a.dataset?.pv !== undefined ? a.closest('[data-pick]')?.dataset.f : undefined), pv: a.dataset?.pv, orbAct: a.dataset?.orbAct, qa: a.dataset?.qa !== undefined ? a.textContent : null, sel: typeof a.selectionStart === 'number' ? [a.selectionStart, a.selectionEnd] : null };
  }
  /* 다시 지은 뒤 초점을 같은 동작의 단추, 같은 이름의 칸으로 돌린다. 찾지 못하면 그 줄 단추다 */
  function restoreFocus(box, f) {
    const b = f.key === undefined ? null : rowByKey(box, f.key);
    if (!b) return;
    const inner = b.nextElementSibling?.firstElementChild, open = b.nextElementSibling && !b.nextElementSibling.inert;
    let t = null;
    if (!f.row && open && inner) {
      if (f.act) t = actEl(inner, f.act, f.pv !== undefined ? f.pv : f.arg);
      if (!t && f.field) { const n = [...inner.querySelectorAll('[data-f]')].find(x => x.dataset.f === f.field); t = n?.matches?.('input') ? n : f.pv !== undefined ? [...(n?.querySelectorAll('[data-pv]') || [])].find(q => q.dataset.pv === f.pv) || null : null; }
      if (!t && f.orbAct) t = [...inner.querySelectorAll('[data-orb-act]')].find(x => x.dataset.orbAct === f.orbAct) || null;
      if (!t && f.qa) t = [...inner.querySelectorAll('button[data-qa]')].find(x => x.textContent === f.qa) || null;
    }
    restoringVis = true;
    try {
      (t || b).focus?.({ preventScroll: true });
      if (t && f.sel && typeof t.setSelectionRange === 'function') t.setSelectionRange(...f.sel);
    } catch {} finally { restoringVis = false; }
  }
  /* 눌러서 연 줄의 안쪽이 방 아래에 걸리면 그 줄이 방 위쪽에서 44px 아래에 오게 내린다. 다가가서 연 줄과 1분 장면에서는 부르지 않는다(시안 showRow) */
  const scrollBoxOf = n => n.closest?.('.ofc-scroll') || n.closest?.('.room');
  function showRow(b) {
    const r = scrollBoxOf(b);
    if (!r) return;
    setTimeout(() => {
      if (disposed || !b.isConnected || r.hidden) return;
      const top = b.offsetTop, end = top + b.offsetHeight + (b.nextElementSibling?.firstElementChild?.scrollHeight || 0);
      if (top < r.scrollTop + 40 || end > r.scrollTop + r.clientHeight - 34) r.scrollTo?.({ top: Math.max(0, top - 44), behavior: reduced() ? 'auto' : 'smooth' });
    }, 60);
  }
  function actButton(spec, liveId) {
    const [text, act, arg, fl] = Array.isArray(spec) ? spec : [];
    const f = flagsOf(fl);
    const q = el('button', ['quiet', f.includes('far') ? 'far' : '', f.includes('warn') ? 'warn' : ''].filter(Boolean).join(' '), text);
    q.type = 'button';
    if (act === 'chatgpt-connect') q.setAttribute('data-oai-siwc-button', '');
    if (f.includes('top')) q.dataset.orbAct = act;
    else { q.dataset.roomAct = act || ''; q.dataset.roomArg = arg == null ? '' : String(arg); }
    if (f.includes('off')) q.setAttribute('aria-disabled', 'true');
    if (f.includes('enter')) q.dataset.enter = '';
    // 묶음을 여닫는 단추(grp, 확인 묶음을 펼치는 「지우기 요청」)는 펼쳤는지 낭독기에 알린다
    if (act === 'grp' || f.includes('toggle')) q.setAttribute('aria-expanded', String(f.includes('on')));
    // 묻는 동안 단추는 무엇이 지워지는지 쓴 알림 줄을 가리킨다(설계 8.2)
    if (f.includes('warn')) q.setAttribute('aria-describedby', liveId);
    return q;
  }
  function cellOf(cls, v, liveId) {
    if (Array.isArray(v)) { const s = el('span', cls); s.append(actButton(v, liveId)); return s; }
    if (v && typeof v === 'object') { const s = el('span', cls, v.text || ''); if (v.btn) { if (v.text) s.append(' '); s.append(actButton(v.btn, liveId)); } return s; }
    return el('span', cls, v || '');
  }
  function nodesOf(items, liveId) {
    const out = [];
    for (const item of items) {
      if (!Array.isArray(item)) continue;
      const [kind, a, b, c, d, e, g] = item;
      if (kind === 'say') out.push(el('p', 'more-say', a));
      else if (kind === 'note') out.push(el('p', 'more-note', a));
      else if (kind === 'cmd') { const p = el('p', 'more-note more-cmd'); p.append(el('code', '', a)); out.push(p); }
      else if (kind === 'live') { const p = el('p', 'more-note more-live', a || ''); p.id = liveId; p.setAttribute('role', 'status'); p.setAttribute('aria-live', 'polite'); out.push(p); }
      else if (kind === 'row') { const r = el('div', 'row sub' + (e ? ' now' : '')); r.append(el('span', 'nm', a), cellOf('mid', b, liveId), cellOf('val', c, liveId), cellOf('when', d, liveId)); out.push(r); }
      else if (kind === 'gauge') {
        // 몫을 그은 선(모델별 토큰의 모델 줄). 선은 낭독하지 않고 이름, 값, 오른쪽 칸을 읽는다
        const r = el('div', 'row sub'), g = el('span', 'gauge'), bar = el('i');
        g.setAttribute('aria-hidden', 'true');
        bar.style.setProperty('--v', Math.max(0, Math.min(100, Number(b) || 0)) + '%');
        g.append(bar);
        r.append(el('span', 'nm', a), g, el('span', 'val', c || ''), el('span', 'when', d || ''));
        out.push(r);
      } else if (kind === 'tog') {
        // 켜고 끄는 것(시안 tog). 누르면 동작만 보내고, 켜짐 표시는 답이 온 장면으로 바뀐다
        // 켜짐 단추는 같은 안쪽의 다른 글 단추(내려받기, 열기)처럼 오른쪽 끝 칸에 선다
        const r = el('div', 'row sub'), mid = el('span', 'mid', b || ''), s = el('span', 'when'), q = el('button', 'quiet', c ? '켜짐' : '꺼짐');
        mid.id = liveId + '-tog' + (++fldSeq);
        q.type = 'button';
        q.setAttribute('role', 'switch');
        q.setAttribute('aria-checked', String(!!c));
        q.setAttribute('aria-label', a);
        q.setAttribute('aria-describedby', mid.id);
        q.dataset.roomAct = d || '';
        // 같은 동작의 켜고 끄는 것이 여럿이면(설정 방의 칸 이름) 인자로 가른다. 다시 그린 뒤 초점도 그 인자의 단추로 돌아온다
        q.dataset.roomArg = g == null ? '' : String(g);
        if (flagsOf(e).includes('off')) q.setAttribute('aria-disabled', 'true');
        s.append(q);
        r.append(el('span', 'nm', a), mid, el('span', 'val', ''), s);
        out.push(r);
      } else if (kind === 'confirm') {
        // 줄 안에서 펼치는 확인 묶음(설계 8.3). 물음 줄이 묶음의 이름이고, 펼치면 초점이 물음 줄로 온다
        const g = el('div', 'confirm'), q = el('p', 'more-say', a), p = el('p', 'more-acts');
        q.id = liveId + '-ask';
        q.tabIndex = -1;
        q.dataset.askQ = '';
        g.setAttribute('role', 'group');
        g.setAttribute('aria-labelledby', q.id);
        g.append(q, ...(b || []).map(t => el('p', 'more-note', t)));
        for (const spec of c || []) p.append(actButton(spec, liveId));
        g.append(p);
        out.push(g);
      }
      else if (kind === 'acts') { const p = el('p', 'more-acts'); if (b) p.append(el('span', 'lab', b)); for (const spec of a || []) p.append(actButton(spec, liveId)); out.push(p); }
      else if (kind === 'pick') {
        const p = el('p', 'more-acts');
        p.setAttribute('role', 'group');
        p.setAttribute('aria-label', a);
        p.dataset.pick = '';
        if (d) { p.dataset.f = d; p.dataset.d = String(c ?? ''); p.dataset.v = String(c ?? ''); }
        p.append(el('span', 'lab', a));
        for (const [t, v] of b || []) {
          const q = el('button', 'quiet', t);
          q.type = 'button';
          q.dataset.pv = String(v);
          q.setAttribute('aria-pressed', String(String(v) === String(c ?? '')));
          if (e) { q.dataset.roomAct = e; q.dataset.roomArg = String(v); }
          p.append(q);
        }
        out.push(p);
      } else if (kind === 'fld') {
        const f = el('div', 'fld'), id = 'orb-fld-' + (++fldSeq), l = el('label', '', a), i = el('input'), h = el('span', 'hint', c || '');
        l.htmlFor = id;
        i.id = id;
        // 숫자 칸도 글 칸으로 둔다. 「290,000」처럼 쉼표를 넣어도 값이 비지 않게 한다(검사가 쉼표를 걷는다)
        i.type = FIELD_TYPES.has(e) ? e : 'text';
        if (e === 'number') i.inputMode = 'decimal';
        i.value = b || '';
        i.dataset.d = b || '';
        i.autocomplete = 'off';
        i.spellcheck = false;
        if (d) i.dataset.f = d;
        if (c) { h.id = id + '-h'; i.setAttribute('aria-describedby', h.id); }
        f.append(l, i, h);
        out.push(f);
      } else if (kind === 'qa') {
        const p = el('p', 'more-acts qa'), n = el('p', 'more-note', b), q = el('button', 'quiet', a);
        q.type = 'button';
        q.dataset.qa = '';
        q.setAttribute('aria-expanded', 'false');
        n.hidden = true;
        p.append(q);
        out.push(p, n);
      } else if (kind === 'grp') { const g = el('div', 'grp'); g.dataset.grp = a; g.hidden = !!c; g.append(...nodesOf(b || [], liveId)); out.push(g); }
      else if (kind === 'staff') {
        // 사무실의 직원 줄(office-room.mjs): 도구와 모델, 상태 문장과 하는 일. 그림에서 그 직원을 가리키면 이 줄이 밝아진다
        const fl = flagsOf(g), r = el('div', 'row sub staff' + (fl.includes('now') ? ' now' : '')), nm = el('span', 'nm', b || ''), mid = el('span', 'mid');
        r.dataset.staff = String(a ?? '');
        if (fl.includes('alert')) { const f = el('i', 'flag', '!'); f.setAttribute('aria-hidden', 'true'); nm.append(f, el('span', 'sr', ' 새 소식')); }
        if (c) nm.append(el('small', '', c));
        mid.append(el('b', '', d || ''));
        if (e) mid.append(el('small', '', e));
        r.append(nm, mid, el('span', 'val', ''));
        out.push(r);
      } else if (kind === 'item') {
        // 부서의 기능 줄(사무실 시안 「담은 것」 16): 누르면 바로 아래 묶음이 그 자리에서 열린다. 다가가기만 해서는 열리지 않는다
        const q = el('button', 'row sub item' + (c ? ' opened' : '') + (g === 'feature' ? ' feature' : ''));
        q.type = 'button';
        // 셋째 조각의 기능 줄(g 'feature')은 묶음 대신 그 기능의 작업 화면을 연다
        q.dataset.roomAct = g === 'feature' ? 'feature-open' : 'grp';
        q.dataset.roomArg = String(d ?? '');
        if (g !== 'feature') q.setAttribute('aria-expanded', String(!!c));
        q.append(el('span', 'nm', a || ''), el('span', 'mid', b || ''), el('span', 'val', e || ''));
        out.push(q);
      }
    }
    return out;
  }
  const fieldsOf = inner => Object.fromEntries([...(inner?.querySelectorAll('[data-f]') || [])].map(n => [n.dataset.f, fieldValue(n)]));
  /* 방 안쪽의 단추를 누르면 그 줄의 칸 값을 모아 컨트롤러에 보낸다. 고르는 단추는 먼저 그 자리에서 고른 것을 밝힌다 */
  function roomAct(btn) {
    if (btn.getAttribute('aria-disabled') === 'true') return;
    const more = btn.closest('.more'), b = more?.previousElementSibling, box = b?.parentElement;
    const pick = btn.closest('[data-pick]');
    if (pick && btn.dataset.pv !== undefined) setPick(pick, btn.dataset.pv);
    if (box && b) acted.set(box, b.dataset.key);
    // 구독 줄(data-svc)의 안쪽 단추(팁의 반응)는 「svc:서비스」를 열쇠로 보낸다. 알림 줄도 그 열쇠로 돌아온다
    const key = b?.dataset.key || (b?.dataset.svc ? 'svc:' + b.dataset.svc : '');
    onAction('room', { room: btn.closest('.room')?.dataset.room || '', key, act: btn.dataset.roomAct, arg: btn.dataset.roomArg || '', fields: more ? fieldsOf(more.firstElementChild) : {} });
  }
  /* 묻고 있던 줄에서 손이나 초점이 떠나면 물음을 거둔다. 그리는 중에 다시 그리지 않게 한 박자 뒤에 알린다 */
  function disarmRow(b) {
    if (!b?.dataset?.key) return;
    const room = b.closest('.room')?.dataset.room || '', key = b.dataset.key;
    setTimeout(() => { if (!disposed) onAction('room', { room, key, act: 'disarm' }); }, 0);
  }
  function flushStale() {
    for (const [inner, rec] of [...stale]) {
      if (!inner.isConnected) { stale.delete(inner); continue; }
      const a = doc.activeElement;
      if ((a && inner.contains(a) && a.matches?.('input,textarea,select')) || pressing) continue;
      buildInner(rec.b, inner, rec.items);
    }
  }
  /* 안쪽에서 무언가를 누르거나 칸에 들어가면 그 줄을 고정한다. 쓰던 칸이 저절로 접히지 않게 한다(시안 holdBox). 구독 줄(첫 조각)은 그대로 둔다 */
  const onRowsHold = event => {
    const m = event.target?.closest?.('.more'), b = m?.previousElementSibling;
    if (m && m.classList.contains('open') && b?.matches?.('button.row[data-key]')) b.classList.add('pin');
  };
  const onRowsOut = event => {
    const m = event.target?.closest?.('.more');
    if (m && m.querySelector('.quiet.warn') && !(event.relatedTarget && m.contains(event.relatedTarget))) disarmRow(m.previousElementSibling);
  };
  const onRowsFocusOut = event => {
    const m = event.target?.closest?.('.more');
    if (!m || (event.relatedTarget && m.contains(event.relatedTarget))) return;
    // 다시 짓는 동안 초점이 잠깐 풀리는 것은 떠난 것이 아니다. 한 박자 뒤에도 초점이 그 안쪽 밖에 있을 때만 거둔다
    setTimeout(() => {
      if (disposed) return;
      const a = doc.activeElement;
      if (m.isConnected && m.querySelector('.quiet.warn') && !(a && m.contains(a))) disarmRow(m.previousElementSibling);
      if (stale.has(m.firstElementChild)) flushStale();
    }, 0);
  };
  const onPressStart = event => { const t = event.target; pressing = t && t.nodeType === 1 && t.closest?.('.more') ? t : true; };
  const onPressEnd = () => { if (!pressing) return; pressing = false; if (stale.size) setTimeout(() => { if (!disposed) flushStale(); }, 0); };

  function headingFor(s) {
    if (s.layer === 'ask') return s.ask.unconfigured ? '로그인 설정 확인' : '로그인 방법';
    if (s.layer === 'switch') return '공간 고르기';
    if (s.layer === 'app' && s.aside === 'manage') return '계정 관리';
    if (s.layer === 'app' && s.aside === 'account') return '내 계정';
    if (s.layer === 'app' && s.aside === 'settings') return '설정';
    // 단추와 방이 같은 이름을 쓴다. 맞춰 주는 기능이 없는 계정에도 맞는 유호님의 이름이다(Fable 다시 검수 r3 FA1)
    if (s.layer === 'app' && s.aside === 'pc') return '내 PC 진단';
    if (s.layer === 'app') return s.space === 'solio' ? '솔리오' : s.space === 'workspace' ? 'Workspace' : 'PULSE';
    if (s.phase === 'welcome') return 'SYNK Platform';
    return '';
  }

  function render(next) {
    if (disposed) return;
    scene = next;
    const s = next;
    // 옛 화면으로 바뀌는 그리기에서 지금 초점의 자리를 적어 둔다. 옛 런처가 제 제목으로 초점을 옮기기 전이다
    if (s.mode === 'legacy' && lastModeSeen !== 'legacy') { const a = doc.activeElement; legacyReturn = a && a !== doc.body && root.contains(a) ? a : null; }
    lastModeSeen = s.mode;
    // 뿌리에 지키는 표시(설계 4절)
    root.hidden = s.mode === 'off';
    root.dataset.portalState = s.phase;
    root.dataset.portalActive = String(Boolean(s.active));
    root.dataset.portalAuthStatus = s.authStatus;
    if (s.workspaceStatus) root.dataset.portalWorkspaceStatus = s.workspaceStatus; else delete root.dataset.portalWorkspaceStatus;
    root.dataset.orbClient = s.mode;
    // 창 안의 PULSE가 열린 동안은 맨 위 56px 띠만 얼굴이다(3단계 구현 설계 4.1). 그 아래는 본체가 붙인 PULSE 뷰다
    if (s.band) root.dataset.orbBand = s.band; else delete root.dataset.orbBand;
    if (doc?.documentElement?.dataset) {
      doc.documentElement.dataset.portalActive = String(Boolean(s.active));
      doc.documentElement.dataset.orbClient = s.mode;
      if (s.band) doc.documentElement.dataset.orbBand = s.band; else delete doc.documentElement.dataset.orbBand;
    }
    if (s.orbBusy) root.setAttribute('aria-busy', 'true'); else root.removeAttribute('aria-busy');
    setHostLocked(s.mode === 'portal' || s.mode === 'app');
    // synk-solio 낱말로 열렸는데 방을 열 수 없을 때(로그아웃 · 방이 없는 계정)의 「백업 창 따로 열기」 한 줄(SOLIO_ONE_CLIENT.md 2.5 F13)
    app.bakAloneAsk.hidden = !(s.bakAlone === true && s.mode === 'portal');
    app.bakAloneApp.hidden = !(s.bakAlone === true && s.mode === 'app');

    stageEl.dataset.mode = s.mode;
    stageEl.dataset.space = s.space;
    if (s.boot) stageEl.dataset.boot = '1'; else delete stageEl.dataset.boot;
    const layer = s.layer;
    if (layer !== lastLayer) {
      stageEl.dataset.ui = layer;
      stageEl.classList.remove('settled');
      clearTimeout(settleTimer);
      if (layer !== 'none') settleTimer = setTimeout(() => stageEl.classList.add('settled'), 1900);
      lastLayer = layer;
    }
    for (const [name, el] of Object.entries(layers)) el.inert = name !== layer;

    stage.setVisiblePlaces(s.places);
    stage.setSpace(s.space);
    stage.setGlint(s.ask?.wait === 'wait' || s.orbBusy);
    const fanOpen = Boolean(s.fan?.open) && layer === 'app' && s.mode === 'app';
    stage.setAutoFace(layer === 'switch' || fanOpen);
    if (layer !== 'switch' && !fanOpen) stage.setHot(null);
    // 손이 다가오면 작은 구가 커지는 것은 들어온 뒤 방에 있고 옛 화면과 펼침이 닫혀 있을 때만이다(설계 검토 1차 2 · 15)
    stage.setNear(s.mode === 'app' && layer === 'app' && !fanOpen && !s.band && canHover());

    renderAsk(s);
    syncLobby();
    renderSwitch(s);
    renderApp(s);
    renderFan(s);
    if ((s.mode === 'app' || s.mode === 'legacy') && layer === 'app') syncDragGap(s.mode === 'legacy');
    setText(heading, headingFor(s));
    applyFocus(s);
  }

  let settleTimer = 0;

  /* ── 초점(설계 13절) ── */
  function focusEl(el, { select = false } = {}) {
    if (!el || doc?.hidden) return false;
    if (!isVisible(el)) return false;
    el.focus?.({ preventScroll: true });
    if (select && typeof el.select === 'function') el.select();
    return doc.activeElement === el;
  }
  function targetFor(key) {
    switch (key) {
      case 'wake': return $('.orb-wake');
      case 'signin': return isVisible(ask.signin) ? ask.signin : ask.input;
      case 'code': case 'code-select': return ask.input;
      case 'cancel': case 'retry': case 'back': case 'go-auth': case 'switch-account':
        return ask.actions.querySelector(`[data-orb-key="${key}"]`) || ask.actions.querySelector('button');
      case 'first-name': return sw.names.querySelector('button') || sw.foot.querySelector('button');
      case 'current-name': return sw.names.querySelector('[aria-current="true"]') || sw.names.querySelector('button');
      case 'here': return app.orbBtn;
      case 'share': return app.share?.querySelector('.share-tile') || app.share?.querySelector('.share-cancel') || null;
      // 방이 열리면 그 방의 맨 위 문장에 초점을 둔다. 낭독기는 결론 문장부터 읽는다(2단계 둘째 조각 설계 1.3절)
      case 'aside': return app.asides[scene?.aside]?.say || null;
      case 'aside-return': return asideReturnTarget();
      case 'legacy-return': return legacyReturnTarget();
      // 카드가 서면 그 일을 끝내는 꽉 찬 단추에 초점을 둔다(Enter 한 번이 그 일이다). 단추가 없는 카드는 문장이다
      case 'todo': return (!app.todo.hidden && (app.todoActs.querySelector('.todo-main') || app.todoHead)) || null;
      case 'todo-return': return isVisible(app.todoGo) ? app.todoGo : app.orbBtn;
      case 'office-head': return isVisible(app.offHead) ? app.offHead : null;
      default: return null;
    }
  }
  /* 방에서 연 옛 화면(마을 기록)을 닫을 때 초점을 돌려줄 자리. 연 단추가 보이면 그 단추, 아니면 그 방의 맨 위 문장이다 */
  function legacyReturnTarget() {
    const a = legacyReturn;
    legacyReturn = null;
    if (a && a.isConnected && root.contains(a) && isVisible(a) && !a.closest('[inert],[hidden]')) return a;
    return app.asides[scene?.aside]?.say || app.orbBtn;
  }
  /* 방을 닫을 때 초점을 돌려줄 자리. 연 단추가 접힌 줄 안쪽에 있으면 그 줄 단추로, 보이지 않으면 구 단추로 간다 */
  function asideReturnTarget() {
    const a = asideReturn;
    asideReturn = null;
    if (a && a.isConnected && root.contains(a)) {
      const more = a.closest?.('.more');
      if (more && !more.classList.contains('open')) { const b = more.previousElementSibling; if (b && isVisible(b) && !b.closest('[inert]')) return b; }
      if (isVisible(a) && !a.closest('[inert],[hidden]')) return a;
    }
    return app.orbBtn;
  }
  function applyFocus(s) {
    if (s.focusSeq === appliedFocusSeq || !s.focus) return;
    if (s.focus === 'legacy') { appliedFocusSeq = s.focusSeq; return; }
    if (s.focus === 'root') {
      appliedFocusSeq = s.focusSeq;
      const active = doc.activeElement;
      // 같은 그리기에서 inert로 바뀐 층의 단추에 초점이 남으면, 브라우저가 다음 프레임에 그 초점을 body로 옮겨 포털 밖으로 빠진다.
      // 그래서 inert 안의 초점도 지금 뿌리로 옮긴다(지금 얼굴의 「다시 시도」 초점 고침과 같은 약속, 11-16 토큰 세션 전달)
      if (!active || !root.contains(active) || !isVisible(active) || active.closest?.('[inert]')) { heading.focus?.({ preventScroll: true }); }
      return;
    }
    if (focusEl(targetFor(s.focus), { select: s.focus === 'code-select' })) appliedFocusSeq = s.focusSeq;
  }
  function focusables() {
    return [...root.querySelectorAll(FOCUSABLE)].filter(el => el !== heading && el.getAttribute('tabindex') !== '-1' && isVisible(el) && !el.closest('[inert]'));
  }
  function trapping() {
    const mode = getMode();
    return mode === 'portal' || mode === 'app';
  }
  function dialogOutside() {
    const open = doc.querySelector?.('dialog[open]');
    return Boolean(open && !root.contains(open));
  }

  /* ── 움직임(컨트롤러가 부른다) ── */
  function wait(ms) {
    return new Promise(resolve => {
      const t = setTimeout(() => { introWait = null; resolve(); }, ms);
      introWait = () => { clearTimeout(t); introWait = null; resolve(); };
    });
  }
  let introHurried = false;
  /* startedAt(본체가 정한 드러남 시작 시각, 밀리초)을 받으면 그만큼 지난 자리에서 이어 그린다. 시작 창이 먼저 그리던 드러남을 앱 창이 끊김 없이 잇는다 */
  async function intro(kind, { delay = 520, ms = 2400, asleepAt = null, wakeAt = null, startedAt = null } = {}) {
    const gen = ++motionGen;
    introHurried = false;
    sig.stop();
    stage.setSpin(0);
    stage.snap('void');
    stage.eyesOff?.();
    const elapsed = Number.isFinite(startedAt) ? Math.max(0, Date.now() - startedAt) : 0;
    /* 눈: 빛이 자리를 잡을 즈음 잠든 눈이 떠오르고 곧 눈을 뜬다. 시작 창에서 이미 뜬 눈이면 뜬 채로 잇는다 */
    if (Number.isFinite(asleepAt) && Number.isFinite(wakeAt)) {
      // 시작 창에서 이미 보이던 눈은 앱 창의 첫 장에서도 그대로 보인다. 떠오르는 중에 넘어오면 0에서 다시 떠오르며 깜빡인 듯 보였다(0.4.96 검수 B3)
      const at = (when, fn) => { const left = when - elapsed; if (left <= 0) fn(true); else setTimeout(() => { if (!disposed && gen === motionGen) fn(false); }, reduced() ? Math.min(left, 120) : left); };
      if (elapsed >= wakeAt) stage.eyesCalm?.({ instant: true });
      else { at(asleepAt, instant => stage.eyesAsleep?.({ instant })); at(wakeAt, () => { void stage.eyesWake?.(); }); }
    }
    if (elapsed >= delay + ms) { stage.snap('rest'); introPainted = true; stage.draw?.(); return; }
    if (elapsed < delay) await wait(reduced() ? Math.min(delay - elapsed, 120) : delay - elapsed);
    // 기다리는 동안 다른 움직임이 시작됐으면 덮지 않는다. 기다리는 동안 서둘렀으면 드러나는 움직임도 짧게 한다(0.4.95 원천 후보 검수)
    if (disposed || gen !== motionGen) return;
    const moving = stage.tween('rest', introHurried ? Math.min(ms, 320) : ms, easeOut, (t, a, b) => lerp(a, b, smooth(0, 0.62, t)), { elapsed: Math.max(0, elapsed - delay) });
    introPainted = true;
    await moving;
  }
  function hurryIntro() {
    introHurried = true;
    if (introWait) introWait();
    stage.hurry('rest');
  }
  async function move(pose, { ms = 760, ease = 'io', face = null } = {}) {
    if (disposed) return;
    motionGen++;
    sig.stop();
    const from = stage.pose;
    if (pose === 'sw') {
      if (from !== 'sw') sound.map(false);
      const to = face || scene?.space || 'solio';
      stage.setFace(null);
      stage.setSpace(scene?.mode === 'portal' ? to : (scene?.space || 'solio'));
      stage.setSpin(-PLACE_LON[to]);
      if (scene?.mode === 'portal') stage.setFace(to);
    } else if (pose === 'fan') {
      // 구가 제자리에서 자라며 눈의 점이 흩어져 별이 된다(시안 openFan)
      stage.setFace(null);
      stage.setSpin(-PLACE_LON[scene?.space || 'solio']);
      if (from !== 'fan') sound.map(true);
    } else {
      stage.setFace(null);
      if (pose === 'home' && (from === 'fan' || from === 'sw')) sound.unmap();
    }
    await stage.tween(pose, ms, EASE[ease] || easeIO);
  }
  async function dive(space, ms = 1250) {
    if (disposed) return;
    const gen = ++motionGen;
    sig.stop();
    stage.setFace(null);
    stage.setAutoFace(false);
    stage.setDive(space);
    stage.setHot(space);
    if (stage.state().mark < 0.05) stage.setSpin(-PLACE_LON[space]);
    await stage.tween('inside', ms, easeIO, (t, a) => a * (1 - smooth(0.7, 0.97, t)));
    if (disposed || gen !== motionGen) return;
    stage.setSpace(space);
  }
  /* 점 로고가 맞춰지고 물러나며 왼쪽 위의 작은 구가 된다. 작은 구가 자리를 잡기 시작하는 순간에 돌아온다 */
  async function arrive(space, sigKind, { smile = false } = {}) {
    if (disposed) return;
    const gen = motionGen;
    if (sigKind && !doc?.hidden) await sig.play(sigKind);
    if (disposed || gen !== motionGen) return;
    stage.setHot(null);
    stage.snap('home');
    stage.setLit(0);
    stage.setRadius(5);
    stage.eyesCalm?.();
    sig.fade();
    // 처음 들어온 때는 작은 구가 자리를 잡은 뒤 잠깐 웃는다(시안 enter). 점 로고를 끈 판에서도 같다
    void Promise.resolve(stage.tween('home', 700, easeOut)).then(() => { if (smile && !disposed && gen === motionGen) void stage.setMood?.('smile', 1100); });
  }

  /* ── 누름 · 자판 · 붙여 넣기 ── */
  const onClick = event => {
    if (disposed) return;
    const target = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
    if (!target) return;
    const name = target.closest?.('.sw[data-go],.fan-go[data-go]');
    if (name && root.contains(name)) { event.preventDefault(); onAction('go', name.dataset.go); return; }
    const visRowEl = target.closest?.('button.row[data-vis]');
    if (visRowEl && root.contains(visRowEl)) {
      event.preventDefault();
      clearTimeout(visTimer);
      if (visRowEl.classList.contains('pin')) setMore(visRowEl, false); else openVis(visRowEl, true);
      return;
    }
    // 계정판의 다 쓴 계정 접기는 그 자리에서 열고 닫는다(설계 11.3)
    const bf = target.closest?.('[data-board-fold]');
    if (bf && root.contains(bf)) { event.preventDefault(); toggleBoardFold(bf); return; }
    const det = target.closest?.('[data-details]');
    if (det && root.contains(det)) { event.preventDefault(); setDetails(!detailsOpen); return; }
    const obj = target.closest?.('.obj[data-orb-prog]');
    if (obj && root.contains(obj)) { event.preventDefault(); clearTimeout(progTimer); onAction('prog', obj.dataset.orbProg); return; }
    // 구독 줄을 누르면 안쪽을 고정하거나 푼다(설계 검토 1차 ③). 옛 판은 줄 안쪽의 「계정 관리」와 방 맨 아래의 「구독 관리 열기」로 연다
    const row = target.closest?.('button.row[data-svc]');
    if (row && root.contains(row)) {
      event.preventDefault();
      clearTimeout(subTimer);
      if (row.classList.contains('pin')) setMore(row, false); else openVis(row, true);
      return;
    }
    // 방의 줄(2단계 둘째 조각)도 누르면 고정과 풀기를 오간다. 눌러서 연 줄의 안쪽이 방 아래에 걸리면 올린다
    const keyed = target.closest?.('button.row[data-key]');
    if (keyed && root.contains(keyed) && keyed.classList.contains('fixed')) { event.preventDefault(); return; }
    if (keyed && root.contains(keyed)) {
      event.preventDefault();
      clearTimeout(subTimer);
      if (keyed.classList.contains('pin')) setMore(keyed, false); else { openVis(keyed, true); showRow(keyed); }
      return;
    }
    const roomBtn = target.closest?.('[data-room-act]');
    if (roomBtn && root.contains(roomBtn)) { event.preventDefault(); roomAct(roomBtn); return; }
    // 하나를 고르는 것은 그 자리에서 밝히고, 저장할 때 칸 값으로 보낸다
    const pv = target.closest?.('[data-pick] [data-pv]');
    if (pv && root.contains(pv)) { event.preventDefault(); setPick(pv.closest('[data-pick]'), pv.dataset.pv); return; }
    // 물음을 누르면 답이 바로 아래에 나온다(시안 qa)
    const qa = target.closest?.('button[data-qa]');
    if (qa && root.contains(qa)) { event.preventDefault(); const n = qa.parentElement?.nextElementSibling; if (n) { n.hidden = !n.hidden; qa.setAttribute('aria-expanded', String(!n.hidden)); } return; }
    // 원클릭 판의 묶음 머리와 접힌 한 줄은 그 자리에서 열고 닫는다(본체에 묻지 않는다)
    const bakG = target.closest?.('[data-bak-g]');
    if (bakG && root.contains(bakG)) { event.preventDefault(); toggleGroup(bakG.dataset.bakG); return; }
    if (target.closest?.('[data-bak-sum]') && root.contains(app.bakSum)) {
      event.preventDefault();
      board.unfold = board.unfold === board.key ? '' : board.key;
      applyFold();
      placeHelper(null);
      return;
    }
    const act = target.closest?.('[data-orb-act]');
    if (act && root.contains(act)) {
      if (act.disabled || act.getAttribute('aria-disabled') === 'true') return;
      event.preventDefault();
      onAction(act.dataset.orbAct, act.dataset.foot ?? act.dataset.orbArg);
      return;
    }
    // 공간 고르기에서 빈 곳을 누르면 닫히고, 구 위의 별을 누르면 그 공간으로 간다
    if (scene?.layer === 'switch' && layers.switch.contains(target) && !target.closest('.sw,.back,.sw-foot,.sw-top')) {
      const r = stageEl.getBoundingClientRect();
      const place = stage.placeUnder(event.clientX - r.left, event.clientY - r.top);
      if (place && scene.places.includes(place)) onAction('go', place);
      else if (scene.switch?.kind === 'app') onAction('close-switch');
    }
  };
  const onSubmit = event => {
    if (!event.target?.closest?.('[data-portal-pane="invite"]')) return;
    event.preventDefault();
    onAction('invite-submit');
  };
  const onInput = event => { if (event.target === ask.input) onAction('invite-input'); };
  const onPointerMove = event => {
    const r = stageEl.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (!reduced()) stage.setPointer((event.clientX - r.left) / r.width, (event.clientY - r.top) / r.height);
    if (scene?.layer === 'app') updateNear(event.clientX, event.clientY);
    if (scene?.layer === 'switch' && !event.target?.closest?.('.sw,.back,.sw-foot,.sw-top')) {
      const place = stage.placeUnder(event.clientX - r.left, event.clientY - r.top);
      const ok = place && scene.places.includes(place);
      layers.switch.style.cursor = ok ? 'pointer' : '';
      stage.setHot(ok ? place : null);
    }
  };
  /* 무대를 떠나 끌기 띠(뿌리 안) 위로 간 것이면 손의 자리를 가운데로 되돌리지 않는다(뿌리가 계속 듣는다) */
  const onPointerLeave = event => {
    if (event?.relatedTarget && root.contains(event.relatedTarget)) { app.rail.classList.remove('near'); clearTimeout(progTimer); return; }
    stage.setPointer(0.5, 0.5); app.rail.classList.remove('near'); clearTimeout(progTimer);
  };
  const onNameHover = event => {
    if (scene?.layer !== 'switch') return;
    const name = event.target?.closest?.('.sw[data-go]');
    const on = event.type === 'pointerover' || event.type === 'focusin';
    if (name && on) { if (!name.classList.contains('hot')) sound.key(); stage.setHot(name.dataset.go); stage.setFace(name.dataset.go); for (const b of sw.names.children) b.classList.toggle('hot', b === name); }
    // 이름 단추 안의 글 사이를 지날 때도 pointerout이 올라온다. 단추를 벗어난 때만 끈다(끄면 다시 들어올 때 톡 소리가 또 난다, Fable 최종 검수 F1)
    else if (!on && (!name || !name.contains(event.relatedTarget))) { stage.setHot(null); stage.setFace(null); for (const b of sw.names.children) b.classList.remove('hot'); }
  };
  const onKeyDown = event => {
    // 다음 키 누름은 앞 Enter의 되돌림 약속을 버린다. 이번 키가 Enter 저장이면 아래에서 다시 적는다(검토 D10)
    enterBack = null;
    if (disposed || event.defaultPrevented || event.isComposing) return;
    const mode = getMode();
    if (mode === 'off') return;
    const t = event.target && typeof event.target.nodeType === 'number' ? event.target : null;
    const typing = Boolean(t?.closest?.('input,textarea,select,[contenteditable="true"]'));
    if (event.key === 'Escape') {
      if (mode === 'legacy' && (dialogOutside() || typing || (t && !root.contains(t) && t.closest?.('dialog')))) return;
      if (dialogOutside()) return;
      // 사무실의 서랍이 열려 있으면 Esc는 서랍부터 닫는다. 초점이 서랍 밖에 있어도 같다(카본 화면 검수 A1)
      if (mode === 'app' && !app.office.hidden && drawerOpen()) { setSide(false, { focus: !t || t === doc.body || app.offSide.contains(t) }); event.preventDefault(); return; }
      // 펼친 줄이 있으면 Esc가 먼저 접는다(시안). 줄 안쪽에 있던 초점은 그 줄로 돌린다
      // 숨은 방에 남은 고정 줄은 보지 않는다. 보이는 방에 펼친 줄이 없으면 Esc는 원래 일을 한다(검수 A6)
      if (mode === 'app' && scene?.layer === 'app' && !scene.fan?.open && [...root.querySelectorAll('.more.open:not(.fixed)')].some(m => !m.closest('[hidden]'))) {
        const inMore = t?.closest?.('.more');
        // 보이는 방의 줄만 접는다. 방이 열린 동안 가려진 구독 방의 고정한 줄은 그대로 두어, 방을 닫으면 연 자리로 초점이 돌아간다
        for (const box of [...readBoxes, app.rows, ...asideBoxes]) if (!box.closest('[hidden]')) closeMores(true, box);
        setTimeout(() => { if (!disposed && stale.size) flushStale(); }, 0);
        if (inMore) inMore.previousElementSibling?.focus?.({ preventScroll: true });
        event.preventDefault();
        return;
      }
      if (onAction('escape')) { event.preventDefault(); event.stopPropagation(); }
      else if (typing && t && root.contains(t)) t.blur?.();
      return;
    }
    if (event.key === 'Tab' && trapping() && !dialogOutside()) {
      const items = focusables();
      if (!items.length) { event.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1], active = doc.activeElement;
      // 제목(heading)처럼 Tab 목록 밖에 초점이 있어도 얼굴 안에서 돈다(0.4.95 원천 후보 검수)
      // 오브제 줄의 오브제는 Tab 차례(-1)에서 빠져 있어도 줄 안의 자리다. 자판 초점이 오브제에 있는 채로 마우스가 다른 오브제를 열면
      // 그 오브제가 -1이 되는데, 그때도 처음으로 건너뛰지 않고 브라우저의 차례대로 잇는다(0.4.97 최종 다시 검수 FA1)
      const outside = !items.includes(active) && !(active?.closest?.('.obj[data-orb-prog]') && root.contains(active));
      if (event.shiftKey) { if (outside || active === first) { event.preventDefault(); last.focus?.({ preventScroll: true }); } }
      else if (outside || active === last) { event.preventDefault(); first.focus?.({ preventScroll: true }); }
      return;
    }
    // 방 안쪽의 칸에서 Enter를 누르면 그 묶음의 저장(또는 연결)을 누른다
    if (event.key === 'Enter' && typing && mode === 'app' && t && root.contains(t) && t.closest?.('.more-in')) {
      const scope = t.closest('.grp') || t.closest('.more-in');
      const go = [...scope.querySelectorAll('[data-enter]')].find(x => !x.closest('.grp[hidden]'));
      if (go) {
        event.preventDefault();
        const key = t.closest('.more')?.previousElementSibling?.dataset?.key;
        enterBack = key !== undefined && t.dataset?.f && go.dataset.roomAct ? { key, field: t.dataset.f, act: go.dataset.roomAct, arg: go.dataset.roomArg ?? '' } : null;
        go.focus?.({ preventScroll: true });
        go.click();
      }
      return;
    }
    if (mode === 'legacy' || typing || event.ctrlKey || event.metaKey || event.altKey) return;
    // 띠(창 안의 PULSE)에서 F6은 PULSE로 돌아간다. PULSE 안의 F6은 본체가 띠로 데려온다(3단계 구현 설계 2.2)
    if (event.key === 'F6' && !event.shiftKey && scene?.band && mode === 'app') { event.preventDefault(); onAction('band-f6'); return; }
    if ((event.key === 'Enter' || event.key === ' ') && scene?.boot) { event.preventDefault(); onAction('wake'); return; }
    if (event.key === 'Enter' && scene?.layer === 'ask' && !scene.ask.wait && !(t?.closest?.('button')) && scene.ask.showSignIn) { event.preventDefault(); onAction('signin'); return; }
    // 구 곁의 펼침: 구나 이름에서 아래 화살표를 누르면 고정해 연다. 초점만으로는 열지 않는다(설계 검토 1차 1). 열린 동안 위아래 화살표로 돈다
    if (scene?.layer === 'app' && mode === 'app') {
      const onOrb = t === app.orbBtn || t === app.nameBtn;
      if (!scene.fan?.open && onOrb && event.key === 'ArrowDown') { event.preventDefault(); onAction('open-switch'); return; }
      if (scene.fan?.open && (event.key === 'ArrowDown' || event.key === 'ArrowUp') && (onOrb || app.fan.contains(t))) {
        const list = [...app.fan.querySelectorAll('button')].filter(b => !b.disabled);
        if (list.length) {
          event.preventDefault();
          const i = list.indexOf(doc.activeElement), down = event.key === 'ArrowDown';
          list[i < 0 ? (down ? 0 : list.length - 1) : (i + (down ? 1 : list.length - 1)) % list.length].focus?.({ preventScroll: true });
        }
        return;
      }
    }
    const obj = t?.closest?.('.obj[data-orb-prog]');
    if (obj && root.contains(obj) && scene?.layer === 'app' && ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      const list = app.objs.filter(o => !o.hidden), i = list.indexOf(obj);
      if (i < 0 || !list.length) return;
      event.preventDefault();
      const k = event.key === 'Home' ? 0 : event.key === 'End' ? list.length - 1 : (i + (event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length;
      // 초점이 옮겨 가면 focusin이 그 프로그램을 연다(여는 길 셋 가운데 자판 길)
      list[k].focus?.({ preventScroll: true });
      return;
    }
    if (scene?.layer === 'switch' && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
      const list = [...sw.names.querySelectorAll('button')];
      if (!list.length) return;
      event.preventDefault();
      const i = Math.max(0, list.indexOf(doc.activeElement));
      list[(i + (event.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length].focus?.({ preventScroll: true });
    }
  };
  /* 화면 어디에서 붙여 넣어도 코드가 들어간다(설계 5절 auth 줄) */
  const onPaste = event => {
    if (disposed || scene?.layer !== 'ask' || event.target === ask.input) return;
    if (scene.ask.wait === 'wait' || scene.ask.wait === 'done' || !scene.ask.showInvite || scene.busy) return;
    if (dialogOutside()) return;
    const text = (event.clipboardData?.getData?.('text') || '').trim();
    if (!text) return;
    event.preventDefault();
    if (scene.ask.wait === 'error') onAction('close-invite');
    ask.input.value = text.slice(0, 200);
    ask.input.dispatchEvent(new win.Event('input', { bubbles: true }));
    if (typeof ask.form.requestSubmit === 'function') ask.form.requestSubmit();
    else ask.form.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  };
  /* 새 얼굴이 보이는 동안 초점이 뿌리 밖으로 나가면 돌려놓는다. 뿌리 밖에 열린 대화상자와 legacy에서는 끌어오지 않는다(설계 검토 2차 3) */
  const onFocusIn = event => {
    if (disposed || !trapping()) return;
    const t = event.target && typeof event.target.nodeType === 'number' ? event.target : null;
    if (!t || root.contains(t) || t === doc.body) return;
    if (dialogOutside() || t.closest?.('dialog')) return;
    const items = focusables();
    if (items.length) items[0].focus?.({ preventScroll: true });
    else heading.focus?.({ preventScroll: true });
  };
  const onVisibility = () => {
    if (doc.hidden) { stage.pause(); onAction('hidden'); return; }
    stage.resume();
    onAction('visible');
  };
  const onPageShow = event => { onAction('pageshow', event?.persisted === true); };
  const onPageHide = () => { if (ask.input) ask.input.value = ''; stage.pause(); };
  const onQaGuest = () => { onAction('qa-guest'); };
  const resizeObserver = typeof win.ResizeObserver === 'function' ? new win.ResizeObserver(() => { if (!app.backup.hidden) placeHelper(board.at); placeTodoBar(); if (scene?.layer === 'switch') layoutSwitch(); if (fanShown()) layoutFan(); if (scene?.mode === 'app' || scene?.mode === 'legacy') syncDragGap(scene.mode === 'legacy'); }) : null;

  root.addEventListener('click', onClick);
  root.addEventListener('scroll', onRoomScroll, true);
  root.addEventListener('submit', onSubmit);
  root.addEventListener('input', onInput);
  root.addEventListener(QA_GUEST_EVENT, onQaGuest);
  stageEl.addEventListener('pointermove', onPointerMove, { passive: true });
  stageEl.addEventListener('pointerleave', onPointerLeave);
  sw.names.addEventListener('pointerover', onNameHover);
  sw.names.addEventListener('pointerout', onNameHover);
  sw.names.addEventListener('focusin', onNameHover);
  sw.names.addEventListener('focusout', onNameHover);
  app.rail.addEventListener('pointerover', onRailOver);
  app.rail.addEventListener('pointerout', onRailOut);
  app.rail.addEventListener('focusin', onRailFocus);
  for (const box of readBoxes) {
    box.addEventListener('pointerover', onVisOver);
    box.addEventListener('pointerout', onVisOut);
    box.addEventListener('pointerenter', onVisEnter);
    box.addEventListener('pointerleave', onVisLeave);
    box.addEventListener('focusin', onVisFocus);
  }
  app.rows.addEventListener('pointerover', onSubOver);
  app.rows.addEventListener('pointerout', onSubOut);
  app.rows.addEventListener('pointerenter', onSubEnter);
  app.rows.addEventListener('pointerleave', onSubLeave);
  app.rows.addEventListener('focusin', onSubFocus);
  for (const box of [app.rows, ...asideBoxes]) {
    if (box !== app.rows) {
      box.addEventListener('pointerover', onSubOver);
      box.addEventListener('pointerout', onSubOut);
      box.addEventListener('pointerenter', onSubEnter);
      box.addEventListener('pointerleave', onSubLeave);
      box.addEventListener('focusin', onSubFocus);
    }
    box.addEventListener('pointerdown', onRowsHold);
    box.addEventListener('focusin', onRowsHold);
    box.addEventListener('pointerout', onRowsOut);
    box.addEventListener('focusout', onRowsFocusOut);
  }
  app.fan.addEventListener('pointerover', onFanPoint);
  app.fan.addEventListener('pointerout', onFanPoint);
  app.fan.addEventListener('focusin', onFanPoint);
  app.fan.addEventListener('focusout', onFanPoint);
  for (const box of [app.offChats, app.offRows, app.offCenter]) { box.addEventListener('pointerover', onOfficeOver); box.addEventListener('pointerleave', onOfficeLeave); }
  app.office.addEventListener('click', onOfficeClick, true);
  app.offChats.addEventListener('keydown', onChatsKey);
  app.offSide.addEventListener('keydown', onSideKey);
  app.offThread.addEventListener('scroll', onThreadScroll, { passive: true });
  root.addEventListener('pointermove', onRootMove, { passive: true });
  root.addEventListener('pointerleave', onRootLeave);
  root.addEventListener('pointerdown', onRootDown, true);
  doc.addEventListener('keydown', onAnyKey, true);
  doc.addEventListener('pointerdown', onAnyPointer, true);
  doc.addEventListener('pointerdown', onPressStart, true);
  doc.addEventListener('pointerup', onPressEnd, true);
  doc.addEventListener('pointercancel', onPressEnd, true);
  doc.addEventListener('keydown', onKeyDown);
  doc.addEventListener('focusout', onEnterLeave, true);
  doc.addEventListener('paste', onPaste);
  doc.addEventListener('focusin', onFocusIn);
  doc.addEventListener('visibilitychange', onVisibility);
  if (options.managePageShow !== true) win.addEventListener?.('pageshow', onPageShow);
  win.addEventListener?.('pagehide', onPageHide);
  resizeObserver?.observe(stageEl);

  return {
    render,
    intro,
    hurryIntro,
    move,
    dive,
    arrive,
    /* 움직임 없이 공간만 바꾼다. 「돌아가서 저장」으로 PULSE에 데려갈 때 쓴다(3단계 설계 검토 R12) */
    settle(space) { if (disposed) return; motionGen += 1; sig.stop(); stage.setHot(null); stage.setSpace(space); },
    getInviteValue: () => ask.input?.value ?? '',
    setInviteValue(value) { if (ask.input && ask.input.value !== value) ask.input.value = value; },
    isHidden: () => doc?.hidden === true,
    /* 백업 방 안 엔진 화면 자리의 높이와, 띠로 돌아오는 F6의 초점(「← 원클릭」) */
    backupDoorTop,
    focusBackupBack() { try { app.bakDoorBack?.focus({ preventScroll: true }); } catch { /* 초점은 사람이 옮길 수 있다 */ } },
    /* 설치 명령과 로그인 주소 복사(옛 구독 판처럼 렌더러의 클립보드를 쓴다). 복사했으면 true */
    copyText(text) {
      try {
        const c = win.navigator?.clipboard;
        if (!text || typeof c?.writeText !== 'function') return Promise.resolve(false);
        return c.writeText(String(text)).then(() => true, () => false);
      } catch { return Promise.resolve(false); }
    },
    prefersReducedMotion: reduced,
    emitState(detail) {
      if (typeof win.CustomEvent === 'function') root.dispatchEvent(new win.CustomEvent(PORTAL_STATE_EVENT, { bubbles: true, detail }));
    },
    /* 화면 확인용: 그 순간 무대의 값(흐름 시험이 읽는다) */
    debug: () => ({ stage: stage.state(), sigActive: sig.active }),
    dispose() {
      if (disposed) return;
      disposed = true;
      clearTimeout(settleTimer);
      clearTimeout(enterTimer);
      clearTimeout(progTimer);
      clearTimeout(visTimer);
      clearTimeout(visLeave);
      clearTimeout(subTimer);
      clearTimeout(subLeave);
      clearTimeout(fanTimer);
      clearTimeout(fanLeave);
      clearTimeout(swapTimer); clearTimeout(talkTimer); clearTimeout(talkGone);
      officeFloor.dispose();
      officeTasks.dispose();
      for (const box of [app.offChats, app.offRows, app.offCenter]) { box.removeEventListener('pointerover', onOfficeOver); box.removeEventListener('pointerleave', onOfficeLeave); }
      app.office.removeEventListener('click', onOfficeClick, true);
      app.offChats.removeEventListener('keydown', onChatsKey);
      app.offSide.removeEventListener('keydown', onSideKey);
      app.offThread.removeEventListener('scroll', onThreadScroll);
      if (introWait) introWait();
      root.removeEventListener('pointermove', onRootMove);
      root.removeEventListener('pointerleave', onRootLeave);
      root.removeEventListener('pointerdown', onRootDown, true);
      root.removeEventListener('click', onClick);
      root.removeEventListener('scroll', onRoomScroll, true);
      root.removeEventListener('submit', onSubmit);
      root.removeEventListener('input', onInput);
      root.removeEventListener(QA_GUEST_EVENT, onQaGuest);
      stageEl.removeEventListener('pointermove', onPointerMove);
      stageEl.removeEventListener('pointerleave', onPointerLeave);
      doc.removeEventListener('keydown', onAnyKey, true);
      doc.removeEventListener('pointerdown', onAnyPointer, true);
      doc.removeEventListener('pointerdown', onPressStart, true);
      doc.removeEventListener('pointerup', onPressEnd, true);
      doc.removeEventListener('pointercancel', onPressEnd, true);
      doc.removeEventListener('keydown', onKeyDown);
      doc.removeEventListener('focusout', onEnterLeave, true);
      doc.removeEventListener('paste', onPaste);
      doc.removeEventListener('focusin', onFocusIn);
      doc.removeEventListener('visibilitychange', onVisibility);
      if (options.managePageShow !== true) win.removeEventListener?.('pageshow', onPageShow);
      win.removeEventListener?.('pagehide', onPageHide);
      resizeObserver?.disconnect();
      sig.stop();
      stage.dispose();
      sound.dispose(); soundPref.dispose();
      setHostLocked(false);
      root.hidden = true;
      root.dataset.portalActive = 'false';
      root.dataset.portalState = 'entered';
      root.dataset.orbClient = 'off';
      delete root.dataset.portalAuthStatus;
      delete root.dataset.portalWorkspaceStatus;
      delete root.dataset.orbBand;
      if (doc?.documentElement?.dataset) { delete doc.documentElement.dataset.portalActive; delete doc.documentElement.dataset.orbClient; delete doc.documentElement.dataset.orbBand; }
      root.innerHTML = '';
    },
  };
}
