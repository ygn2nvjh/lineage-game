import {movePosition,clearLine} from '../navigation.mjs';
import {SOLO_INPUT,normalizeInput} from './solo-input.mjs';
export function directionStep(position,input,game,dt){
 const p={...position},d=game.derived,speed=game.rules.movement.playerSpeed*(d.weight>d.maxWeight?.5:1);
 const moving=movePosition(p,input.x,input.y,speed,dt,(x,y,r)=>game.blocked(x,y,r),game.rules.movement.playerRadius);
 return {...p,moving,face:moving?Math.atan2(input.y,input.x):position.face};
}
// Replay exact pending movement frames, never combat/economy or arbitrary client positions.
export class SoloMovementPrediction{
 constructor(){this.reset();this.metrics={corrections:0,hardCorrections:0,errors:[]};}
 reset(position=null){this.position=position?{x:position.x,y:position.y}:null;this.active=false;this.input={x:0,y:0};this.frames=[];this.serial=0;this.lastSentAt=-Infinity;this.lastSentInput={x:0,y:0};this.markerDirty=false;this.lastSnapshot=null;this.ack=0;this.lastAckAt=0;this.stale=false;}
 begin(position,now,lastId=0){this.reset(position);this.serial=lastId;this.active=true;this.lastAckAt=now;}
 setInput(input){const next=normalizeInput(input);if(next.x!==this.input.x||next.y!==this.input.y){this.input=next;this.markerDirty=true;}}
 needsSend(now){const changed=Math.hypot(this.input.x-this.lastSentInput.x,this.input.y-this.lastSentInput.y)>.02,held=!!(this.input.x||this.input.y),pending=this.frames.some(f=>!f.sent);return (changed&&(now-this.lastSentAt>=SOLO_INPUT.minSendMs||!held))||(held&&pending&&now-this.lastSentAt>=SOLO_INPUT.refreshMs)||(!held&&pending&&now-this.lastSentAt>=SOLO_INPUT.refreshMs);}
 sentInput(now){if(this.markerDirty||!this.frames.some(f=>!f.sent)){this.frames.push({inputId:++this.serial,x:this.input.x,y:this.input.y,dt:0,sent:false});this.markerDirty=false;}const frames=this.frames.filter(f=>!f.sent).slice(0,16);for(const f of frames)f.sent=true;this.lastSentAt=now;this.lastSentInput={...this.input};return {frames:frames.map(({sent,...f})=>f)};}
 replay(position,game){let p={...position};for(const f of this.frames)p=directionStep(p,f,game,f.dt);return p;}
 reconcile(game,movement,{now,force=false}={}){
  if(force||game.deathPending||game.fallen||game.p.hp<=0){this.reset(game.p);return;}
  if(!this.active||!movement||movement.id<this.ack)return;
  this.ack=movement.id;this.lastAckAt=now;this.stale=false;
  this.frames=this.frames.filter(f=>f.inputId>movement.id);
  this.lastSnapshot={position:{x:game.p.x,y:game.p.y}};
 }
 step(game,dt,now){
  if(!this.position)this.position={x:game.p.x,y:game.p.y};if(!this.active)return null;
  if(game.deathPending||game.fallen||game.p.hp<=0){this.reset(game.p);return null;}
  this.stale=now-this.lastAckAt>SOLO_INPUT.maxPredictionMs;
  const age=(now-(game.receivedAt??now))/1000,locked=(game.swing||0)>age;
  const input=this.stale||locked?{x:0,y:0}:this.input;
  let p=directionStep(this.position,input,game,dt);
  if(dt>0&&!this.stale&&(input.x||input.y)){this.frames.push({inputId:++this.serial,x:input.x,y:input.y,dt,sent:false});this.markerDirty=false;}
  if(this.lastSnapshot&&!this.stale){const target=this.replay(this.lastSnapshot.position,game),error=Math.hypot(target.x-p.x,target.y-p.y);this.metrics.errors.push(error);this.metrics.errors=this.metrics.errors.slice(-120);
   if(error>100||game.blocked(p.x,p.y)){p={...p,x:target.x,y:target.y};this.metrics.hardCorrections++;}
   else if(error>2){const k=Math.min(.18,dt*4),next={x:p.x+(target.x-p.x)*k,y:p.y+(target.y-p.y)*k};if(clearLine(p,next,(x,y,r)=>game.blocked(x,y,r),game.rules.movement.playerRadius)){p={...p,...next};this.metrics.corrections++;}}
  }
  this.position={x:p.x,y:p.y,face:p.face};return p;
 }
}
