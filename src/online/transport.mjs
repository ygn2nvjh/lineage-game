// Commands are ordered; reads never hold up input. Only the newest unsent goal matters.
export class OnlineTransport{
 constructor(send,{now=()=>performance.now(),onSample=()=>{}}={}){this.send=send;this.now=now;this.onSample=onSample;this.queue=[];this.commandRunning=false;this.readPending=null;this.epoch=0;this.serial=0;}
 request(action,extra={}){
  if(action==='state'||action==='ping'){
   if(action==='state'&&this.readPending)return this.readPending;
   const meta={serial:++this.serial,epoch:this.epoch,duringCommand:this.commandRunning,queuedAt:this.now(),queueMs:0};
   const job=this.run(action,extra,meta);if(action==='state'){this.readPending=job;job.finally(()=>{if(this.readPending===job)this.readPending=null;}).catch(()=>{});}return job;
  }
  const meta={serial:++this.serial,epoch:++this.epoch,queuedAt:this.now()};
  return new Promise((resolve,reject)=>{
   if(['goal','stop','attack','leave'].includes(action)){
    this.queue=this.queue.filter(job=>{if(job.action!=='goal')return true;job.resolve({coalesced:true});return false;});
   }
   this.queue.push({action,extra,meta,resolve,reject});this.drain();
  });
 }
 async run(action,extra,meta){meta.queueMs=this.now()-meta.queuedAt;const began=this.now();try{const value=await this.send(action,extra,meta);this.onSample({action,queueMs:meta.queueMs,rtt:this.now()-began});return {value,meta,stale:action==='state'&&(meta.epoch!==this.epoch||meta.duringCommand)};}catch(error){error.transport={action,queueMs:meta.queueMs,rtt:this.now()-began};throw error;}}
 async drain(){if(this.commandRunning)return;this.commandRunning=true;try{while(this.queue.length){const job=this.queue.shift();try{job.resolve(await this.run(job.action,job.extra,job.meta));}catch(e){job.reject(e);}}}finally{this.commandRunning=false;}}
}
export function nextSyncDelay(start,now,interval){return Math.max(0,interval-(now-start));}
