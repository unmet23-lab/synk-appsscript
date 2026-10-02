// Render quality follows device capabilities and measured frame time. A narrow
// desktop preview must not be mistaken for a low-powered phone.
export function automaticQuality({coarsePointer=false,memoryGB=8,cores=8}={}) {
  if(coarsePointer && (memoryGB<=2 || cores<=2))return 'low';
  return coarsePointer?'balanced':'high';
}

export function qualitySettings(mode,{pixelRatio=1,explicit=false}={}) {
  if(!['high','balanced','low'].includes(mode))throw new RangeError(`Unknown quality: ${mode}`);
  const ratio=Number.isFinite(pixelRatio)&&pixelRatio>0?pixelRatio:1;
  return {
    pixelRatio:Math.min(ratio,mode==='low'?1.1:mode==='balanced'?1.4:explicit?2:1.75),
    shadows:mode!=='low',
    shadowSize:mode==='high'?2048:1024,
    detailDistance:mode==='high'?460:mode==='balanced'?340:260
  };
}

// Step down only after a sustained slow sample. Hidden/paused time is excluded
// by the caller; explicit user choices are never silently overwritten.
export function slowerQuality(mode,averageSeconds) {
  if(!Number.isFinite(averageSeconds)||averageSeconds<=.038)return mode;
  return mode==='high'?'balanced':mode==='balanced'?'low':'low';
}
