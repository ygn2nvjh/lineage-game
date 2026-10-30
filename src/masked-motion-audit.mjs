// Pixel contracts for restricted art patches. Verifies arrays, not anatomy.
export function auditMotionPixels(before,after,{editMask,protectedMask,width,height}){
 const n=width*height;if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||before?.length!==n*4||after?.length!==n*4||editMask?.length!==n||protectedMask?.length!==n)throw new Error('Pixel audit dimensions mismatch');
 const result={changedPixels:0,outsideMaskChanges:0,protectedLegChanges:0,headRows0to42Changes:0,bootZoneRows104to127Changes:0};
 for(let p=0;p<n;p++){const q=p*4;if(before[q]===after[q]&&before[q+1]===after[q+1]&&before[q+2]===after[q+2]&&before[q+3]===after[q+3])continue;result.changedPixels++;if(!editMask[p])result.outsideMaskChanges++;if(protectedMask[p])result.protectedLegChanges++;const y=Math.floor(p/width);if(y<43)result.headRows0to42Changes++;if(y>=104)result.bootZoneRows104to127Changes++;}
 return result;
}
