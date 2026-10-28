// Transport-only snapshots. No game rules or persistent player data live here.
const isRecord=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const blockedKeys=new Set(['__proto__','prototype','constructor']);
export function stateChanges(before,after,path=[],out=[]){
 if(Object.is(before,after))return out;
 if(Array.isArray(before)&&Array.isArray(after)&&before.length===after.length){for(let i=0;i<after.length;i++)stateChanges(before[i],after[i],[...path,i],out);return out;}
 if(isRecord(before)&&isRecord(after)){
  for(const key of Object.keys(before))if(before[key]!==undefined&&(!Object.hasOwn(after,key)||after[key]===undefined))out.push([[...path,key]]);
  for(const key of Object.keys(after)){if(after[key]===undefined)continue;if(!Object.hasOwn(before,key)||before[key]===undefined)out.push([[...path,key],after[key]]);else stateChanges(before[key],after[key],[...path,key],out);}return out;
 }
 out.push([path,after]);return out;
}
export function applyStateChanges(state,changes){
 if(!Array.isArray(changes)||changes.length>10000)throw Error('同步差異格式錯誤');
 const edit=(node,path,at,op)=>{if(at===path.length)return op.length===1?undefined:structuredClone(op[1]);const key=path[at];if(node===null||typeof node!=='object'||(!Array.isArray(node)&&typeof key!=='string')||(Array.isArray(node)&&(!Number.isInteger(key)||key<0||key>=node.length)))throw Error('同步差異路徑錯誤');const copy=Array.isArray(node)?node.slice():{...node};if(at===path.length-1&&op.length===1){if(Array.isArray(copy))throw Error('同步差異不能刪除陣列欄位');delete copy[key];}else copy[key]=edit(node[key],path,at+1,op);return copy;};
 let next=state;for(const op of changes){if(!Array.isArray(op)||op.length<1||op.length>2||!Array.isArray(op[0])||op[0].length>32||op[0].some(k=>typeof k!=='string'&&typeof k!=='number'||blockedKeys.has(k)))throw Error('同步差異格式錯誤');next=edit(next,op[0],0,op);}return next;
}
export class StateDeltaEncoder{
 constructor(){this.previous=null;this.serial=0;this.sinceFull=0;this.fullSize=0;this.scope=null;}
 encode(data){const id=++this.serial,scope=JSON.stringify([data.id,data.player?.mapId,data.room?.code]);let full=!this.previous||scope!==this.scope||this.sinceFull>=100,patch;
  if(!full){patch=stateChanges(this.previous,data);if(JSON.stringify(patch).length>this.fullSize*.85)full=true;}
  const frame={v:1,id,base:full?0:id-1,full};this.previous=structuredClone(data);this.scope=scope;
  if(full){this.sinceFull=0;this.fullSize=JSON.stringify(data).length;}else this.sinceFull++;
  return {data:full?data:patch,stateFrame:frame};
 }
}
export class StateDeltaDecoder{
 constructor(){this.reset();}
 reset(){this.state=null;this.serial=0;}
 decode(data,frame){if(!frame)return data;if(frame.v!==1||!Number.isSafeInteger(frame.id)||frame.id<1||typeof frame.full!=='boolean')throw Error('同步版本錯誤');
  if(frame.full){if(!isRecord(data))throw Error('完整同步格式錯誤');this.state=structuredClone(data);this.serial=frame.id;return data;}
  if(!this.state||frame.base!==this.serial||frame.id!==this.serial+1)throw Error('同步基準不一致');
  const next=applyStateChanges(this.state,data);if(!isRecord(next))throw Error('同步差異結果錯誤');this.state=next;this.serial=frame.id;return structuredClone(next);
 }
}
