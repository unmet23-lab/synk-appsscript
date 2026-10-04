// Keep the reward run separate from the next learning stop. Five authored
// gates end at 2050m, before the existing coastal loop returns at 2150m.
export const FIRST_GATE=310;
export const GATE_SPACING=435;
export const QUESTION_LEAD=220;
export const MIN_REWARD_RUN=4;
export const BOOST_SECONDS=6;
export const COMBO_BOOST_SECONDS=6.8;
export const gatePosition=index=>FIRST_GATE+index*GATE_SPACING;
export const rewardBoost=combo=>combo>=3?COMBO_BOOST_SECONDS:BOOST_SECONDS;

export function createQuestionPace(){
  let heldSpeed=null,lastAnswerAt=-Infinity;
  return {
    reset(){heldSpeed=null;lastAnswerAt=-Infinity;},
    answered(elapsed){lastAnswerAt=elapsed;},
    canAnnounce(elapsed){return elapsed>=3&&elapsed-lastAnswerAt>=MIN_REWARD_RUN;},
    step({waiting,velocity,boost,dt}){
      if(waiting){
        // Save once on entry: saving the braking speed every frame would erase
        // the reward. A reading/replay wait never spends boost time.
        heldSpeed??=velocity;
        return {velocity,boost};
      }
      if(heldSpeed!==null){velocity=Math.max(velocity,heldSpeed);heldSpeed=null;}
      return {velocity,boost:Math.max(0,boost-Math.max(0,Math.min(.055,dt)))};
    },
    snapshot(){return {holding:heldSpeed!==null,heldSpeed,lastAnswerAt:Number.isFinite(lastAnswerAt)?lastAnswerAt:null};}
  };
}
