import {Easing} from 'remotion';
import {색,그늘} from '../킷/색';
import {본문스택,폰트준비} from '../킷/폰트';
void 폰트준비;
export const theme={paper:색('Paper'),ink:색('Ink'),muted:색('Deep Wool'),oat:색('Oat'),stitch:색('Stitch'),lab:색('Coral 3'),shift:색('Lapis Deep'),pulse:색('Pop Deep'),font:본문스택,shadow:그늘,ease:Easing.bezier(.16,1,.3,1),drift:Easing.bezier(.37,0,.63,1),exit:Easing.bezier(.4,0,1,1)};
