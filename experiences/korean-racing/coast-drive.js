// Completion is a one-time boundary. Opening/reopening results never awards a
// second round, and the drive cannot accidentally create another question.
export function createCoastDrive(){
  let phase='race',laps=0;
  return {
    get active(){return phase!=='race';},
    get driving(){return phase==='drive';},
    complete(answered,total){if(phase!=='race'||!Number.isInteger(total)||total<1||answered!==total)return false;phase='drive';return true;},
    openResults(){if(phase!=='drive')return false;phase='results';return true;},
    resume(){if(phase!=='results')return false;phase='drive';return true;},
    reset(){phase='race';laps=0;},
    advance(position,speed,dt,roadEnd){
      if(!Number.isFinite(roadEnd)||roadEnd<600)throw new RangeError('Coast drive needs a complete road.');
      if(!Number.isFinite(position)||!Number.isFinite(speed)||!Number.isFinite(dt))throw new TypeError('Invalid coast drive step.');
      const start=75,end=roadEnd-100,length=end-start;
      let next=position+(phase==='drive'?Math.max(0,speed)*Math.max(0,Math.min(.055,dt)):0),wrapped=false;
      if(phase==='drive'&&next>=end){next=start+(next-end)%length;laps++;wrapped=true;}
      // The authored road is finite. A brief fade conceals the return to its
      // beginning, instead of sending the car beyond the terrain into the sea.
      const t=Math.max(0,Math.min(1,Math.max((next-(end-32))/32,laps>0?(107-next)/32:0)));
      return {position:next,wrapped,fade:phase==='drive'?t*t*(3-2*t):0};
    },
    snapshot(){return {phase,laps};}
  };
}
