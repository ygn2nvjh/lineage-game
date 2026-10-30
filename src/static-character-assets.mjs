export const STATIC_DIRECTIONS=Object.freeze(['down','down-right','right','up-right','up','up-left','left','down-left']);

async function browserImage(url){const image=new Image();image.src=url;await image.decode();return image;}

// Optional renderer for the archived art package. Not wired into the live game.
export async function loadStaticCharacter(manifestUrl,{baseURL=globalThis.location?.href||'http://localhost/',fetcher=globalThis.fetch,decodeImage=browserImage}={}){
 const characterURL=new URL(manifestUrl,baseURL);
 const json=async url=>{const response=await fetcher(url.href);if(!response.ok)throw new Error('Character asset load failed: '+response.status);return response.json();};
 const character=await json(characterURL),runtimeURL=new URL(character.runtime.manifest,characterURL),runtime=await json(runtimeURL);
 if(runtime.schemaVersion!==1||runtime.state!=='idle'||Object.keys(runtime.frames||{}).length!==8)throw new Error('Unsupported static character manifest');
 const used=new Set();
 for(const direction of STATIC_DIRECTIONS){const f=runtime.frames[direction];if(!f||![f.x,f.y,f.width,f.height,f.anchor?.x,f.anchor?.y].every(Number.isFinite)||f.width<=0||f.height<=0||f.x<0||f.y<0||f.x+f.width>runtime.atlasWidth||f.y+f.height>runtime.atlasHeight||used.has(f.x+','+f.y))throw new Error('Invalid static frame: '+direction);used.add(f.x+','+f.y);}
 const image=await decodeImage(new URL(runtime.atlas,runtimeURL).href);
 if((image.naturalWidth||image.width)!==runtime.atlasWidth||(image.naturalHeight||image.height)!==runtime.atlasHeight)throw new Error('Character atlas size mismatch');
 return Object.freeze({character,runtime,image,draw(context,direction,x,y,{scale=1}={}){const f=runtime.frames[direction];if(!f)throw new RangeError('Unknown character direction: '+direction);if(!Number.isFinite(scale)||scale<=0)throw new RangeError('Character scale must be positive');context.save();try{context.imageSmoothingEnabled=false;context.drawImage(image,f.x,f.y,f.width,f.height,Math.round(x-f.anchor.x*scale),Math.round(y-f.anchor.y*scale),f.width*scale,f.height*scale);}finally{context.restore();}}});
}
