export class CafeAudio {
 constructor(onState){this.onState=onState;this.element=new Audio();this.element.preload='auto';this.busy=false;this.token=0;this.context=null;}
 unlock(){if(!this.context){const C=window.AudioContext||window.webkitAudioContext;if(C)this.context=new C();}this.context?.resume().catch(()=>{});}
 async play(order){
  this.stop();const token=++this.token;this.busy=true;this.onState('playing',order);this.element.src=`audio/${order.id}.wav`;
  const ended=()=>{if(token!==this.token)return;this.busy=false;this.onState('ready',order);};
  this.element.onended=ended;this.element.onerror=()=>{if(token!==this.token)return;this.busy=false;this.onState('error',order);};
  try{await this.element.play();}catch{if(token!==this.token)return;this.busy=false;this.onState('error',order);}
 }
 stop(){this.token++;this.element.pause();this.element.onended=null;this.element.onerror=null;this.busy=false;this.wasPlaying=false;}
 pause(){this.wasPlaying=this.busy;this.element.pause();this.busy=false;}
 async resume(){const shouldResume=this.wasPlaying;this.wasPlaying=false;if(shouldResume&&!this.element.ended&&this.element.src){this.busy=true;try{await this.element.play();}catch{this.busy=false;this.onState('error');}}}
 tone(kind){if(!this.context||this.context.state!=='running')return;const now=this.context.currentTime;const notes=kind==='serve'?[523.25,659.25,783.99]:kind==='wrong'?[196,174.61]:[440];notes.forEach((f,i)=>{const osc=this.context.createOscillator(),gain=this.context.createGain();osc.type='sine';osc.frequency.value=f;gain.gain.setValueAtTime(0,now+i*.085);gain.gain.linearRampToValueAtTime(.035,now+i*.085+.012);gain.gain.exponentialRampToValueAtTime(.001,now+i*.085+.16);osc.connect(gain).connect(this.context.destination);osc.start(now+i*.085);osc.stop(now+i*.085+.18);});}
}
