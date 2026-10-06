// 확인용 관찰(?qa에서만): 화면 위 3D 게이트·차의 자리, 카드·꼬리표·단추의 자리, 레이스 빨리 감기.
// 판정·기록·보상 규칙은 바꾸지 않는다. 빨리 감기는 같은 주행 함수를 작은 걸음으로 여러 번 부를 뿐이고, 그리기는 실제 WebGL이 한다.

/** 보이는 메시만 모은 상자(차 밑 그림자 판·부스터 불꽃처럼 빛만 내는 판은 뺀다). only가 있으면 그 표시가 있는 메시만. */
function visibleBox(THREE, object, only = null) {
  const box = new THREE.Box3(), part = new THREE.Box3();
  object.updateWorldMatrix(true, true);
  object.traverseVisible((o) => {
    if (!o.isMesh || o.material?.isMeshBasicMaterial && !o.userData.board) return;
    if (only && !o.userData[only]) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    part.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
    box.union(part);
  });
  return box;
}

/** 보이는 메시의 실제 꼭짓점을 화면에 투영한 윤곽 상자(경계 상자 모서리보다 정확하다 — 차 실루엣 확인용). */
function silhouetteBox(THREE, camera, canvas, object) {
  if (!object) return null;
  const rect = canvas.getBoundingClientRect(), v = new THREE.Vector3();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  object.updateWorldMatrix(true, true);
  object.traverseVisible((o) => {
    if (!o.isMesh || o.material?.isMeshBasicMaterial) return;
    const pos = o.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 4000));
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).project(camera);
      if (v.z > 1) continue;
      const sx = rect.left + (v.x + 1) / 2 * rect.width, sy = rect.top + (1 - v.y) / 2 * rect.height;
      if (sx < x0) x0 = sx; if (sx > x1) x1 = sx; if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
    }
  });
  if (x0 === Infinity) return null;
  return { left: Math.round(x0), top: Math.round(y0), right: Math.round(x1), bottom: Math.round(y1) };
}

/** 3D 물체가 화면(뷰포트 좌표)에서 차지하는 상자. 카메라 뒤에 있으면 null. */
function screenBox(THREE, camera, canvas, object, only = null) {
  if (!object) return null;
  const box = visibleBox(THREE, object, only);
  if (box.isEmpty()) return null;
  const rect = canvas.getBoundingClientRect(), v = new THREE.Vector3();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, behind = 0;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    v.set(x, y, z).project(camera);
    if (v.z > 1) { behind++; continue; }
    const sx = rect.left + (v.x + 1) / 2 * rect.width, sy = rect.top + (1 - v.y) / 2 * rect.height;
    x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy);
  }
  if (behind === 8) return null;
  return { left: Math.round(x0), top: Math.round(y0), right: Math.round(x1), bottom: Math.round(y1) };
}

const domBox = (node) => {
  if (!node || node.hidden || node.closest('[hidden]')) return null;
  const r = node.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  return { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom) };
};

export function installQaHook(api) {
  const { THREE } = api;
  window.__racingQA = {
    /** 지금 상태(문제·답·차선 순서·판정) */
    state: () => api.state(),
    /** 화면 배치: 3D 게이트(세 차선 판 전체)·내 차의 화면 상자와, 위 카드·꼬리표·아래 단추·게임 바의 상자 */
    layout() {
      const camera = api.camera, canvas = api.canvas;
      const boards = api.gate?.group ? api.gate.group.children.map((lane) => screenBox(THREE, camera, canvas, lane, 'board')) : [];
      return {
        viewport: { width: innerWidth, height: innerHeight, visual: window.visualViewport?.width ?? innerWidth },
        canvas: domBox(canvas),
        gate: api.gate?.group ? screenBox(THREE, camera, canvas, api.gate.group) : null,
        gateBoards: boards,
        car: api.car ? silhouetteBox(THREE, camera, canvas, api.car) : null,
        bar: domBox(document.querySelector('#game .game-bar')),
        question: domBox(document.getElementById('question')),
        tutorial: domBox(document.getElementById('tutorial-hud')),
        cruise: domBox(document.getElementById('cruise-banner')),
        toast: domBox(document.getElementById('toast')),
        laneTags: [...document.querySelectorAll('#lane-choices .lane-tag')].map(domBox),
        left: domBox(document.getElementById('left')),
        right: domBox(document.getElementById('right')),
        go: domBox(document.getElementById('go')),
        boost: domBox(document.getElementById('boost-meter')),
        cruiseAction: domBox(document.getElementById('cruise-action')),
      };
    },
    /** 레이스를 seconds초만큼 빨리 감는다(1/60초 걸음). 음성을 기다리는 동안에는 실제 레이스처럼 차가 서 있다. */
    advance: (seconds) => api.advance(seconds),
    /** 지금 문제의 음성을 끝까지 들은 것으로 친다(음성을 멈추고 ‘다 들음’으로 넘긴다). */
    hearNow: () => api.hearNow(),
    /** 입구 그림용: 레이스 화면을 카드 없이 보이고 카메라를 앞쪽 3/4 각도에 둔다. */
    heroPose: (options) => api.heroPose(options),
    /** 3D 그리기 상태(프레임 수·평균 FPS·그리기 호출) */
    render: () => api.render(),
  };
}
