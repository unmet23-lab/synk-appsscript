// User-agent hints only choose instructions. Actual installation and notification
// support still comes from the browser's install event and Web API availability.
export function installationEnvironment({userAgent='',platform='',maxTouchPoints=0,standalone=false,secure=true}={}){
  const ios=/iPhone|iPad|iPod/i.test(userAgent)||(platform==='MacIntel'&&Number(maxTouchPoints)>1);
  const android=/Android/i.test(userAgent);
  const embedded=/(?:KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER\(|DaumApps|;\s*wv\))/i.test(userAgent);
  const browser=/SamsungBrowser\//i.test(userAgent)?'samsung':/(?:Edg|EdgA|EdgiOS)\//i.test(userAgent)?'edge':/(?:Chrome|CriOS)\//i.test(userAgent)?'chrome':/(?:Firefox|FxiOS)\//i.test(userAgent)?'firefox':/Safari\//i.test(userAgent)?'safari':'other';
  return {ios,android,mobile:ios||android,embedded,browser,standalone:!!standalone,secure:!!secure};
}

// The guide never creates permissions, saves an invitation, or changes a device.
// Render these strings as escaped text, not trusted HTML.
export function installationGuide(environment={}, {connected=false,enabled=false,canPrompt=false}={}){
  const env=environment,needsHomeScreen=!!env.ios&&!env.standalone;
  const guide={title:'앱 설치 · 알림',summary:'홈 화면에서 바로 열고, 새 수정본과 답변을 알림으로 확인하세요.',steps:[],notes:[],canPrompt:!!canPrompt&&!env.standalone&&!env.ios&&!env.embedded&&env.secure!==false,needsHomeScreen,openNotifications:!!connected&&!needsHomeScreen&&!env.embedded&&env.secure!==false};
  const reconnect='앱을 열었는데 프로젝트가 보이지 않으면, 담당자에게 받은 초대 링크를 첫 화면에 붙여 넣어 한 번 연결해 주세요.';
  const enable='PULSE의 ‘알림’ → ‘기기 알림 켜기’를 누르고, 알림 허용 창에서 ‘허용’을 선택해 주세요.';
  if(env.secure===false){
    guide.summary='앱 설치와 기기 알림은 보안 연결에서 사용할 수 있어요.';
    guide.steps=['담당자에게 받은 https:// 초대 링크를 Chrome 또는 Safari에서 열어 주세요.'];
    return guide;
  }
  if(env.embedded){
    guide.summary='메신저 안 브라우저에서는 설치나 알림 허용이 안 될 수 있어요.';
    guide.steps=[`메신저의 메뉴에서 ‘다른 브라우저로 열기’를 선택해 ${env.ios?'Safari':'Chrome 또는 삼성 인터넷'}에서 열어 주세요. 메뉴가 없으면 담당자에게 받은 원본 초대 링크를 복사해 브라우저 주소창에 붙여 넣으세요.`,'프로젝트가 열린 뒤 ‘앱 설치 · 알림’을 다시 눌러 주세요.'];
    guide.notes=['현재 주소에는 연결용 정보가 지워져 있을 수 있어요. 다른 브라우저로 옮길 때는 받은 원본 초대 링크를 사용해 주세요.'];
    return guide;
  }
  if(env.standalone){
    guide.summary=enabled?'이 앱의 기기 알림 연결이 켜져 있어요.':'홈 화면의 PULSE 앱으로 열었어요. 새 소식을 받으려면 기기 알림을 켜 주세요.';
    guide.steps=connected?[enabled?'새 수정본이나 답변이 올라오면 알림을 눌러 프로젝트로 돌아올 수 있어요.':enable]:[reconnect,enable];
  }else if(env.ios){
    guide.steps=['Safari에서 담당자에게 받은 초대 링크를 열고, 공유 메뉴 → ‘홈 화면에 추가’를 선택해 주세요.','‘웹 앱으로 열기’ 항목이 있으면 켠 상태로 ‘추가’를 눌러 주세요.','홈 화면에 생긴 PULSE 아이콘을 눌러 앱을 다시 열어 주세요.',enable];
    guide.notes.push('iPhone·iPad의 기기 알림은 iOS·iPadOS 16.4 이상에서 홈 화면에 추가한 앱으로 사용할 수 있어요.',reconnect);
  }else if(env.android){
    const install=env.browser==='samsung'?'삼성 인터넷의 주소창 설치 아이콘을 눌러 주세요. 아이콘이 없으면 메뉴 → ‘현재 페이지 추가’ → ‘홈 화면’에서 추가할 수 있어요.':guide.canPrompt?'아래 ‘이 기기에 설치’를 눌러 브라우저의 설치 안내를 따라 주세요.':'Chrome 메뉴(⋮) → ‘설치 및 바로가기 만들기’ → ‘설치’를 선택해 주세요. 버전에 따라 ‘앱 설치’ 또는 ‘홈 화면에 추가’로 표시됩니다.';
    guide.steps=[install,'홈 화면 또는 앱 목록의 PULSE 아이콘을 눌러 열어 주세요.',enable];
    guide.notes.push(reconnect);
    if(enabled)guide.notes.push('현재 브라우저의 기기 알림은 켜져 있어요. 설치한 앱에서도 ‘기기 알림 끄기’로 표시되는지 확인해 주세요.');
  }else{
    guide.steps=[guide.canPrompt?'아래 ‘이 기기에 설치’를 누르고 브라우저의 설치 안내를 따라 주세요.':'Chrome·Edge의 주소창 설치 아이콘 또는 메뉴에서 PULSE를 설치할 수 있어요. Safari는 파일 → Dock에 추가를 이용해 주세요.',enable];
  }
  if(!connected&&!env.standalone)guide.notes.push('기기 알림을 켜려면 먼저 받은 초대 링크로 프로젝트에 연결해 주세요.');
  guide.notes.push('설치하지 않아도 브라우저에서 영상 확인, 수정 의견, 승인을 할 수 있어요.');
  if(enabled)guide.notes.push('알림이 보이지 않으면 휴대폰·PC 설정의 PULSE 또는 사용 중인 브라우저 알림과 방해 금지 설정을 확인해 주세요.');
  return guide;
}

export function devicePermissionTimeout(environment={}){
  if(environment.ios)return '알림 허용을 기다리다 중단했어요. 홈 화면의 PULSE 앱에서 다시 시도해 주세요. 알림 창이 보이지 않으면 기기 설정 → 알림 → PULSE를 확인해 주세요.';
  if(environment.android)return '알림 허용을 기다리다 중단했어요. Chrome 또는 삼성 인터넷에서 받은 초대 링크를 열고 다시 시도해 주세요. 브라우저 사이트 설정과 휴대폰 설정의 알림 권한도 확인해 주세요.';
  return '알림 허용을 기다리다 중단했어요. 허용 창이 보이지 않으면 Chrome 또는 Edge에서 PULSE를 열어 주세요. 고객은 받은 초대 링크로 접속하면 됩니다.';
}
