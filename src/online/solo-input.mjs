// Shared transport limits; movement speed/collision remain in the canonical Game rules.
export const SOLO_INPUT=Object.freeze({refreshMs:120,minSendMs:80,leaseMs:750,maxPredictionMs:1000});
export function normalizeInput(input){const x=Number(input?.x)||0,y=Number(input?.y)||0,d=Math.hypot(x,y);return d>.15?{x:x/d,y:y/d}:{x:0,y:0};}
