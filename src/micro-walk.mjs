// Integer pixel translation only; no resampling, rotation or equipment redraw.
export const HEAD_Y_OFFSETS = Object.freeze([0,1,0,0,0,1,0,0]);
export function microWalkPixels(source,{width=1024,height=128}={}){
 if(width!==1024||height!==128||source.length!==width*height*4)throw Error('Expected eight 128px RGBA frames');
 const result=new Uint8ClampedArray(source);
 for(let f=0;f<8;f++)if(HEAD_Y_OFFSETS[f]){
  // Original canonical head incl. root ends at row43; row44 is the neck seam.
  for(let y=12;y<=44;y++)for(let x=30;x<=83;x++){
   const target=(y*width+f*128+x)*4;
   if(y===12)result.fill(0,target,target+4);
   else {const from=((y-1)*width+f*128+x)*4;result.set(source.subarray(from,from+4),target);}
  }
 }
 return result;
}
