// Stable per-origin browser credential; never include it in diagnostics or URLs.
export function rememberGuest(key,pass,storage=localStorage,doc=document){
 try{storage.setItem(key,pass);}catch{}
 doc.cookie=key+'='+pass+'; Path=/; Max-Age=31536000; SameSite=Strict'+(globalThis.location?.protocol==='https:'?'; Secure':'');
}
export function loadGuest(key,storage=localStorage,doc=document){
 let pass;try{pass=storage.getItem(key);}catch{}
 if(!/^og_[a-f0-9]{64}$/.test(pass||''))pass=doc.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith(key+'='))?.slice(key.length+1);
 if(!/^og_[a-f0-9]{64}$/.test(pass||''))pass='og_'+[...crypto.getRandomValues(new Uint8Array(32))].map(v=>v.toString(16).padStart(2,'0')).join('');
 rememberGuest(key,pass,storage,doc);return pass;
}
export function forgetGuest(key,storage=localStorage,doc=document){try{storage.removeItem(key);}catch{}doc.cookie=key+'=; Path=/; Max-Age=0; SameSite=Strict';}
