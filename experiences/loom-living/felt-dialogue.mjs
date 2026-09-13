// A sewn cloud for Mongle. Geometry is measured only on text/layout changes;
// the speech stays still while the world breathes around it.
export function createFeltDialogue(element,garden,getCharacter,announcement){
  element.innerHTML=`<svg class="dialogue-cloth" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="cloth-light" x2="0" y2="1"><stop stop-color="var(--paper)"/><stop offset="1" stop-color="var(--oat)"/></linearGradient>
      <filter id="cloth-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="3" seed="17"/><feColorMatrix type="saturate" values="0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
    </defs>
    <path class="cloth-thickness"/><path class="cloth-face"/><path class="cloth-grain" filter="url(#cloth-grain)"/>
    <path class="seam-shadow"/><path class="seam-thread"/><path class="seam-glint"/>
    <g class="thread-knot"><path/><circle r="1.6"/></g>
  </svg>
  <div class="dialogue-copy"><span class="dialogue-speaker"><svg viewBox="0 0 18 18" aria-hidden="true"><path d="M9 15V8M9 10C3 10 3 5 3 5s6 0 6 5ZM9 8c0-5 5-6 5-6s2 5-5 6Z"/></svg><span>몽글</span></span><p class="dialogue-text"></p></div>`;
  const svg=element.querySelector('.dialogue-cloth'),text=element.querySelector('.dialogue-text'),speaker=element.querySelector('.dialogue-speaker span');
  let timer;
  function layout(){
    const w=element.offsetWidth,h=element.offsetHeight;if(!w||!h)return;
    const character=getCharacter(),area=garden.getBoundingClientRect();
    const cx=character?character[0]+character[2]*.5:area.width*.55;
    const head=character?character[1]+character[3]*.13:area.height*.38;
    const x=Math.max(14,Math.min(area.width-w-14,cx-w*.52));
    const y=Math.max(18,head-h-23);
    const tail=Math.max(35,Math.min(w-35,cx-x));
    element.style.left=`${x}px`;element.style.top=`${y}px`;
    element.style.transformOrigin=`${tail}px ${h+15}px`;
    svg.setAttribute('viewBox',`0 0 ${w} ${h+20}`);
    // Soft, asymmetrical cloud lobes instead of a rounded rectangular border.
    const shape=(inset,tip)=>{const l=inset,r=w-inset,t=inset,b=h-inset;
      return `M ${l+27} ${t+6} C ${l+9} ${t+4},${l+1} ${t+18},${l+5} ${t+32}
      C ${l-3} ${t+45},${l+2} ${b-18},${l+12} ${b-13}
      C ${l+16} ${b+1},${l+36} ${b+2},${l+48} ${b-3}
      Q ${tail-32} ${b+2},${tail-11} ${b-1}
      Q ${tail-5} ${b+10},${tail+4} ${tip}
      Q ${tail+3} ${b+7},${tail+13} ${b-2}
      Q ${r-49} ${b+3},${r-35} ${b-3}
      C ${r-12} ${b+3},${r} ${b-12},${r-5} ${b-28}
      C ${r+2} ${t+34},${r-3} ${t+16},${r-18} ${t+13}
      C ${r-27} ${t-1},${r-51} ${t-1},${r-62} ${t+5}
      C ${w*.54} ${t-3},${w*.34} ${t-2},${l+54} ${t+5}
      Q ${l+39} ${t-1},${l+27} ${t+6} Z`;};
    const outer=shape(4,h+14),seam=shape(12,h+6);
    for(const cls of ['cloth-thickness','cloth-face','cloth-grain'])svg.querySelector('.'+cls).setAttribute('d',outer);
    for(const cls of ['seam-shadow','seam-thread','seam-glint'])svg.querySelector('.'+cls).setAttribute('d',seam);
    const knot=svg.querySelector('.thread-knot');knot.setAttribute('transform',`translate(${w-34} ${h-17})`);
    knot.querySelector('path').setAttribute('d','M-4 1Q-10-7-5-7Q1-6 0 0Q6-7 9-4Q10 1 0 1');
    const intro=garden.querySelector('.intro').getBoundingClientRect();
    // On very short phones the cloud can occupy the title's space temporarily.
    // Fade only the overlapping heading, keeping the face and controls clear.
    const overlaps=x<intro.right-area.left&&x+w>intro.left-area.left&&y<intro.bottom-area.top&&y+h>intro.top-area.top;
    garden.classList.toggle('dialogue-over-title',element.classList.contains('show')&&overlaps);
  }
  function hide(){element.classList.remove('show');garden.classList.remove('dialogue-over-title');}
  const observer=new ResizeObserver(layout);observer.observe(element);observer.observe(garden);
  return {
    show(message,{name='몽글',immediate=false}={}){
      clearTimeout(timer);text.textContent=message;speaker.textContent=name;
      announcement.textContent=`${name}: ${message}`;
      element.dataset.immediate=String(immediate);
      element.classList.add('show');layout();
      timer=setTimeout(hide,Math.min(6500,Math.max(4200,message.length*115)));
    },
    layout,
    dispose(){clearTimeout(timer);observer.disconnect();},
  };
}
