// SYNK WORLD는 휴대폰에서 쓰는 앱이라 플랫폼 앱 목록에 넣지 않고(2026-11-11 유호님 「진행하자」), 내 홈에 휴대폰으로 넘어가는 칸 하나만 둔다.
// PC 앱(desktop/renderer)과 웹 플랫폼(experiences/synk-account)이 같은 글을 쓴다. QR은 https://synk.im/world/ 하나를 담는다
// (원본은 각 assets 폴더의 world-qr.svg — segno로 만들고 읽어서 주소를 확인했다). 계정 권한 · 학습 기록 · 메모는 건드리지 않는다.
export const WORLD_PHONE_URL='https://synk.im/world/';
const worldPhoneEscape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);

// qrSrc: 그 화면에서 QR 그림 주소. openHref가 있으면(웹) 이 브라우저로 여는 링크를 붙이고, 없으면(PC 앱) 주소 글자만 보인다.
export function worldPhoneSection({qrSrc,openHref=''}={}){
  const open=openHref?'<a class="world-phone-open" href="'+worldPhoneEscape(openHref)+'" target="_blank" rel="noopener noreferrer" data-web="world">이 브라우저로 열기 <span aria-hidden="true">↗</span></a>':'';
  return '<section class="world-phone" id="world-phone" aria-labelledby="world-phone-title">'
    +'<div class="world-phone-copy"><h2 id="world-phone-title" tabindex="-1">SYNK WORLD는 휴대폰에서</h2>'
    +'<p>한국어 공부 앱 WORLD는 설치 없이 휴대폰 브라우저에서 열려요.<span class="world-phone-hint"> 휴대폰 카메라로 QR을 찍으면 바로 시작해요.</span></p>'
    +'<p class="world-phone-url"><span class="world-phone-label">주소</span> <span class="latin">synk.im/world</span></p>'+open+'</div>'
    +'<figure class="world-phone-qr"><img src="'+worldPhoneEscape(qrSrc)+'" alt="synk.im/world로 가는 QR 코드" width="132" height="132" decoding="async"></figure>'
    +'</section>';
}
