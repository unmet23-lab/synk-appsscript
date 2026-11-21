'use strict';
// 3단계의 이름이다. 뷰 자리는 4단계에서 space-view.cjs로 넓혔다(PULSE와 Workspace가 같은 자리 함수를 쓴다).
const {createSpaceViewHost,pulseViewPlacement,SPACE_VIEW_BAND_MAX}=require('./space-view.cjs');
module.exports={createPulseViewHost:createSpaceViewHost,pulseViewPlacement,PULSE_VIEW_BAND_MAX:SPACE_VIEW_BAND_MAX};
