// 주문 폭주 — WORLD 안 캠퍼스 판(2026-11-03)의 손님: 싱크타운 카페에 오는 학생 여섯(실사, assets/world/guests/).
// LAB 화면은 cafe.mjs의 펠트 동물 그대로다. 판정·주문·기록(core.mjs · learning.mjs)은 손님 그림과 상관없다.
// 주문 음성이 여성 합성 음성 하나라서 손님도 모두 젊은 여성이다(목소리를 손님마다 다시 녹음하면 넓힌다).
// 표정 셋: order(주문하는 중) · thanks(받아 감) · puzzled(주문과 다름). 얼굴 동그라미는 face/<키>.webp.

export const WORLD_GUESTS = Object.freeze([
  { id: 'g1', name: '니트 카디건 손님' },
  { id: 'g2', name: '데님 재킷 손님' },
  { id: 'g3', name: '과잠 입은 손님' },
  { id: 'g4', name: '안경 쓴 조교 손님' },
  { id: 'g5', name: '새내기 손님' },
  { id: 'g6', name: '유학생 손님' },
]);
const NAMES = Object.fromEntries(WORLD_GUESTS.map((g) => [g.id, g.name]));
export const worldGuestName = (id) => NAMES[id] || '손님';
export const worldGuestImage = (id, mood = 'order') => `assets/world/guests/${id}-${mood}.webp`;
export const worldGuestFace = (id) => `assets/world/guests/face/${id}.webp`;

/**
 * 손님 고르기: 주문(손님 표)마다 처음 보일 때 한 명을 정하고, 지금 줄에 선 손님과 겹치지 않게 돌아가며 고른다
 * (점심 러시에 같은 얼굴이 줄에 둘 서지 않게). 첫 손님은 판마다 달라진다(seed).
 */
export function createGuestPicker(seed = 0) {
  let next = Math.abs(seed | 0) % WORLD_GUESTS.length;
  return {
    /** ticket에 worldGuest를 붙여 돌려준다. active: 지금 화면에 있는 손님 표들(줄 · 계산대). */
    of(ticket, active = []) {
      if (ticket.worldGuest) return ticket.worldGuest;
      const busy = new Set(active.map((t) => t?.worldGuest).filter(Boolean));
      for (let k = 0; k < WORLD_GUESTS.length; k += 1) {
        const id = WORLD_GUESTS[(next + k) % WORLD_GUESTS.length].id;
        if (busy.has(id)) continue;
        next = (next + k + 1) % WORLD_GUESTS.length;
        ticket.worldGuest = id;
        return id;
      }
      ticket.worldGuest = WORLD_GUESTS[next].id;   // 줄이 손님 수보다 길 때만(지금 줄은 많아야 넷)
      next = (next + 1) % WORLD_GUESTS.length;
      return ticket.worldGuest;
    },
  };
}
