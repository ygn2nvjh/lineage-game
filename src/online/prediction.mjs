import {clearLine,planRoute} from '../navigation.mjs';
export function predictedStep(position,goal,game,dt,cache=null){
 const radius=game.rules.movement.playerRadius,blocked=(x,y,r)=>game.blocked(x,y,r),p={...position};
 if(!goal||dt<=0||game.blocked(goal.x,goal.y))return {...p,moving:false};
 let target=goal;if(!clearLine(p,goal,blocked,radius)){const key=`${game.map.id}:${goal.x}:${goal.y}`;let route;if(cache&&cache.key===key&&cache.route?.length)route=cache.route;else{route=planRoute(game.map,p,goal,blocked,radius);if(cache){cache.key=key;cache.route=route;}}while(route.length&&Math.hypot(route[0].x-p.x,route[0].y-p.y)<=5)route.shift();target=route[0];if(!target)return {...p,moving:false};}
 const dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy),speed=game.rules.movement.playerSpeed*(game.derived.weight>game.derived.maxWeight?.5:1),step=Math.min(d,speed*dt);
 if(d<2)return {...p,moving:false};const nx=p.x+dx/d*step,ny=p.y+dy/d*step;
 if(!blocked(nx,p.y,radius))p.x=nx;if(!blocked(p.x,ny,radius))p.y=ny;
 return {...p,moving:Math.hypot(p.x-position.x,p.y-position.y)>.001,face:Math.atan2(dy,dx)};
}
export class MovementPrediction{
 constructor(){this.reset();}
 reset(position=null){this.position=position?{x:position.x,y:position.y}:null;this.goal=null;this.intent=0;this.ack=0;this.pendingAt=0;this.lastServer=null;this.correction=null;this.routeCache={};}
 setGoal(goal,position,now){if(!this.position)this.position={x:position.x,y:position.y};this.goal={...goal};this.intent++;this.pendingAt=now;return this.intent;}
 stop(now){this.goal=null;this.intent++;this.pendingAt=now;this.correction=null;}
 reconcile(game,{now,rtt=0,ackIntent=0,force=false}={}){
  const p=game.p;this.lastServer={x:p.x,y:p.y};
  if(force||!this.position){this.reset(p);return;}
  this.ack=Math.max(this.ack,ackIntent);if(this.ack<this.intent&&now-this.pendingAt<1800)return;
  this.goal=game.goal?{...game.goal}:null;
  const expected=predictedStep(p,this.goal,game,Math.min(.25,rtt/2000));
  if(Math.hypot(expected.x-this.position.x,expected.y-this.position.y)>100){this.position={x:expected.x,y:expected.y};this.routeCache={};}
  this.correction={x:expected.x,y:expected.y};
 }
 step(game,dt,now){
  if(!this.position)this.position={x:game.p.x,y:game.p.y};
  if(game.fallen||game.deathPending||game.p.hp<=0){this.reset(game.p);return {...this.position,moving:false};}
  if(this.ack<this.intent&&this.pendingAt&&now-this.pendingAt>1800){this.goal=null;this.correction=this.lastServer;}
  let p=predictedStep(this.position,this.goal,game,dt,this.routeCache);
  if(this.correction&&(!this.goal||!p.moving)){const k=Math.min(1,dt*10),x=p.x+(this.correction.x-p.x)*k,y=p.y+(this.correction.y-p.y)*k;if(!game.blocked(x,y))p={...p,x,y};}
  this.position={x:p.x,y:p.y};return p;
 }
}
