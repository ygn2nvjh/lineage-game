// Bounded adventure history only. World/movement snapshots remain complete.
export class AdventureLogEncoder {
 constructor(){this.previous=null;this.owner=null;}
 encode(data){if(!data.solo)return data;const logs=data.solo.logs||[],keys=logs.map(e=>JSON.stringify(e));let update;
 if(this.owner!==data.id||!this.previous)update={full:logs};
 else if(keys.length===this.previous.length&&keys.every((k,i)=>k===this.previous[i]))update=null;
 else {const overlap=keys.findIndex((k,i)=>k===this.previous[0]&&keys.slice(i).every((v,j)=>v===this.previous[j]));update=overlap>=0?{prepend:logs.slice(0,overlap),length:logs.length}:{full:logs};}
 this.previous=keys;this.owner=data.id;const {logs:omitted,...solo}=data.solo;return {...data,solo,logUpdate:update};
 }
}
export class AdventureLogDecoder {
 constructor(){this.logs=[];this.owner=null;this.stats={fullUpdates:0,prependUpdates:0,unchangedFrames:0};}
 decode(data){if(!Object.hasOwn(data,'logUpdate'))return data;if(this.owner!==data.id){this.logs=[];this.owner=data.id;}const u=data.logUpdate;
 if(u?.full){this.logs=u.full;this.stats.fullUpdates++;}else if(u?.prepend){this.logs=[...u.prepend,...this.logs].slice(0,u.length);this.stats.prependUpdates++;}else this.stats.unchangedFrames++;
 return {...data,solo:{...data.solo,logs:this.logs}};
 }
}
