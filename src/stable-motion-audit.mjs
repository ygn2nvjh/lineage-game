// Stability contracts for decoded RGBA sprites; no anatomical inference.
export function auditStabilityPixels(before,after,{editMask,headMask,goldMask,canonicalHead,frameWidth=128,height=128,frameCount=8}){
 const width=frameWidth*frameCount,n=width*height;if(![frameWidth,height,frameCount].every(x=>Number.isInteger(x)&&x>0)||before?.length!==4*n||after?.length!==4*n||editMask?.length!==n||headMask?.length!==n||goldMask?.length!==n||canonicalHead?.length!==4*frameWidth*height)throw Error('Stability audit dimensions mismatch');
 const r={changedPixels:0,outsideMaskChanges:0,lowerChanges:0,chestCoreChanges:0,distalHairChanges:0,goldHiltChanges:0,headMismatchPixels:0};
 for(let p=0;p<n;p++){const q=p*4,x=p%width%frameWidth,y=Math.floor(p/width);if(headMask[p]){const c=(y*frameWidth+x)*4;if(after[q]!==canonicalHead[c]||after[q+1]!==canonicalHead[c+1]||after[q+2]!==canonicalHead[c+2]||after[q+3]!==canonicalHead[c+3])r.headMismatchPixels++;}if(before[q]===after[q]&&before[q+1]===after[q+1]&&before[q+2]===after[q+2]&&before[q+3]===after[q+3])continue;r.changedPixels++;if(!editMask[p])r.outsideMaskChanges++;if(y>=78)r.lowerChanges++;if(y>=50&&y<=67)r.chestCoreChanges++;if(x<=54&&y>=44)r.distalHairChanges++;if(goldMask[p])r.goldHiltChanges++;}
 return r;
}
