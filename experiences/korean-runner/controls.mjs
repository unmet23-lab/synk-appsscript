export const KEY_ACTIONS = Object.freeze({
  ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',
  ArrowUp:'jump',KeyW:'jump',Space:'jump',ArrowDown:'slide',KeyS:'slide'
});

// A physical press changes one lane even when a host duplicates keydown
// without setting repeat. Keyup permits the next deliberate press.
export class KeyboardInput {
  constructor(){this.held=new Map();}
  down(code,repeat=false){
    const action=KEY_ACTIONS[code];
    if(!action||repeat||this.held.has(code))return null;
    const alreadyHeld=[...this.held.values()].includes(action);
    this.held.set(code,action);
    return alreadyHeld?null:action;
  }
  up(code){this.held.delete(code);}
  reset(){this.held.clear();}
}
