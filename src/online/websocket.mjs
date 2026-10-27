// One authenticated connection. Secrets are sent in the first frame, never in URLs.
export class SocketRPC {
 constructor(pass,{onPush=()=>{},onBytes=()=>{}}={}){this.pass=pass;this.onPush=onPush;this.onBytes=onBytes;this.pending=new Map();this.serial=0;this.socket=null;this.connecting=null;}
 async connect(){if(this.socket?.readyState===1)return;if(this.connecting)return this.connecting;this.connecting=new Promise((resolve,reject)=>{const url=new URL('/ws',location.href);url.protocol=url.protocol==='https:'?'wss:':'ws:';const ws=new WebSocket(url);this.socket=ws;const timer=setTimeout(()=>{ws.close();reject(Error('連線逾時，請重試'));},10000);let authenticated=false;
 ws.onopen=()=>ws.send(JSON.stringify({id:0,action:'auth',pass:this.pass}));
 ws.onmessage=e=>{this.onBytes(e.data.length);let m;try{m=JSON.parse(e.data);}catch{return;}if(m.id===0){clearTimeout(timer);if(m.error){reject(Error(m.error));ws.close();}else{authenticated=true;resolve();}return;}if(m.push){this.onPush(m.data);return;}const job=this.pending.get(m.id);if(!job)return;clearTimeout(job.timer);this.pending.delete(m.id);m.error?job.reject(Error(m.error)):job.resolve(m);};
 ws.onclose=()=>{clearTimeout(timer);if(this.socket===ws)this.socket=null;if(!authenticated)reject(Error('連線中斷，請重試'));for(const job of this.pending.values()){clearTimeout(job.timer);job.reject(Error('連線中斷，請重新連線'));}this.pending.clear();};ws.onerror=()=>{};
 }).finally(()=>{this.connecting=null;});return this.connecting;}
 async request(body){await this.connect();const id=++this.serial;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('回應逾時，請重新連線'));this.socket?.close();},10000);this.pending.set(id,{resolve,reject,timer});this.socket.send(JSON.stringify({...body,id}));});}
}
