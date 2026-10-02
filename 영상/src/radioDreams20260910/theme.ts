import {Easing} from 'remotion';
import {색,그늘,빛} from '../킷/색';

// Quiet radio loops intentionally omit Ken Burns, entrances, cuts and animated grain.
// The user prioritises fixed framing, stable wool and non-nauseating continuous viewing.
export const theme={
 paper:색('Paper'),ink:색('Ink'),shadow:그늘,light:빛,
 ease:{out:Easing.bezier(.16,1,.3,1),inOut:Easing.bezier(.83,0,.17,1),in:Easing.bezier(.7,0,.84,0)},
 spring:{snappy:{damping:14,stiffness:160,mass:.6},smooth:{damping:20,stiffness:90,mass:1},bouncy:{damping:11,stiffness:170,mass:.7}},
};
