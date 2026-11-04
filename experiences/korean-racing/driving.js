// Arcade contacts on the curved road's Frenet coordinates. Fixed-size colliders follow the car footprint.
// The unscaled GLB body spans 2.257m across and 4.523m along the road. Leave a small contact margin.
export const CAR_HALF_WIDTH=1.16, CAR_HALF_LENGTH=2.30;
// size(선택): WORLD 자전거처럼 탈것 크기가 다를 때. 없으면 LAB 차 크기 그대로.
export function resolveContact(player,rival,{halfWidth=CAR_HALF_WIDTH,halfLength=CAR_HALF_LENGTH}={}){
 const dx=player.offset-rival.offset,dz=player.s-rival.s;
 const px=halfWidth*2-Math.abs(dx),pz=halfLength*2-Math.abs(dz);
 if(px<=0||pz<=0)return null;
 if(px<pz){const direction=dx===0?(player.offset>=0?1:-1):Math.sign(dx);const shift=px+.025;
   const next=Math.max(-5.05,Math.min(5.05,player.offset+direction*shift));
   const remainder=shift-Math.abs(next-player.offset);player.offset=next;if(remainder>0)rival.offset=Math.max(-5.05,Math.min(5.05,rival.offset-direction*remainder));
   return {axis:'side',direction,impact:Math.abs(player.velocity-rival.speed)};
 }
 const direction=dz<=0?-1:1;player.s=rival.s+direction*(halfLength*2+.025);
 return {axis:'front',direction,impact:Math.abs(player.velocity-rival.speed)};
}

// A shield absorbs the arcade penalty once. Contact separation is still handled
// by resolveContact, so protected cars cannot drive through an occupied car.
export function shieldContact(state,hit){
 const next={...state,protected:false};
 if(!hit)return next;
 if(state.shield>0)return {...next,shield:0,protected:true};
 return {...next,collisions:state.collisions+1,velocity:Math.max(14,state.velocity*.76),boost:Math.min(state.boost,.65)};
}

// Earn at most one held shield on a successful third, sixth, ninth... answer.
// Wrong answers and contact handling never change the learning score or medals.
export function comboShield(combo,success,currentShield=0){
 return success&&Number.isInteger(combo)&&combo>0&&combo%3===0?1:currentShield;
}
