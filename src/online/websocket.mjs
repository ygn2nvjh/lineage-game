import {StateDeltaDecoder} from './state-delta.mjs';
// One authenticated connection. Secrets are sent in the first frame, never in URLs.
export class SocketRPC {
 constructor(pass,{onPush=()=>{},onBytes=()=>{},stateDeltas=!!globalThis.LINEAGE_UNIFIED}={}){
  this.pass=pass;this.onPush=onPush;this.onBytes=onBytes;this.stateDeltas=stateDeltas;this.decoder=new StateDeltaDecoder();this.resyncing=null;
  this.stats={fullStateFrames:0,deltaStateFrames:0,fullStateBytes:0,deltaStateBytes:0,resyncs:0};this.pending=new Map();this.serial=0;this.socket=null;this.connecting=null;
 }
 resyncState(){if(this.resyncing||!this.stateDeltas)return;this.stats.resyncs++;const pending=this.request({action:'state',full:true}).then(m=>this.onPush(m.data)).catch(()=>this.socket?.close(1012,'State resync needed')).finally(()=>{if(this.resyncing===pending)this.resyncing=null;});this.resyncing=pending;}
 async connect(){if(this.socket?.readyState===1)return;if(this.connecting)return this.connecting;this.connecting=new Promise((resolve,reject)=>{
  const url=new URL(globalThis.LINEAGE_UNIFIED?'/play-ws':'/ws',location.href);url.protocol=url.protocol==='https:'?'wss:':'ws:';const ws=new WebSocket(url);this.socket=ws;this.decoder.reset();
  const timer=setTimeout(()=>{ws.close();reject(Error('連線逾時，請重試'));},10000);let authenticated=false;
  ws.onopen=()=>ws.send(JSON.stringify({id:0,action:'auth',pass:this.pass,...(this.stateDeltas?{stateDeltas:1}:{})}));
  ws.onmessage=e=>{
   const bytes=new TextEncoder().encode(e.data).length;this.onBytes(bytes);let m;try{m=JSON.parse(e.data);}catch{return;}
   if(m.id===0){clearTimeout(timer);if(m.error){reject(Error(m.error));ws.close();}else{authenticated=true;resolve();}return;}
   if(m.stateFrame){try{m.data=this.decoder.decode(m.data,m.stateFrame);const kind=m.stateFrame.full?'full':'delta';this.stats[kind+'StateFrames']++;this.stats[kind+'StateBytes']+=bytes;}catch{const job=this.pending.get(m.id);if(job){clearTimeout(job.timer);this.pending.delete(m.id);job.reject(Error('同步資料重新校正中'));}this.resyncState();return;}}
   if(m.push){this.onPush(m.data);return;}const job=this.pending.get(m.id);if(!job)return;clearTimeout(job.timer);this.pending.delete(m.id);m.error?job.reject(Error(m.error)):job.resolve(m);
  };
  ws.onclose=()=>{clearTimeout(timer);if(this.socket===ws)this.socket=null;if(!authenticated)reject(Error('連線中斷，請重試'));for(const job of this.pending.values()){clearTimeout(job.timer);job.reject(Error('連線中斷，請重新連線'));}this.pending.clear();};ws.onerror=()=>{};
 }).finally(()=>{this.connecting=null;});return this.connecting;}
 async request(body){await this.connect();const id=++this.serial;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('回應逾時，請重新連線'));this.socket?.close();},10000);this.pending.set(id,{resolve,reject,timer});this.socket.send(JSON.stringify({...body,id}));});}
}
