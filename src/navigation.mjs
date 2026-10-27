export function riverBlocked(map,x,y,radius=0){
 const r=map.river;if(!r)return false;const b=r.bridge;
 const touches=x+radius>r.x&&x-radius<r.x+r.width&&y+radius>r.y&&y-radius<r.y+r.height;
 return touches&&(!b||x-radius<b.x||x+radius>b.x+b.width);
}
export function clearLine(from,to,blocked,radius){
 const distance=Math.hypot(to.x-from.x,to.y-from.y),steps=Math.max(1,Math.ceil(distance/12));
 for(let i=1;i<=steps;i++)if(blocked(from.x+(to.x-from.x)*i/steps,from.y+(to.y-from.y)*i/steps,radius))return false;
 return true;
}
export function planRoute(map,from,to,blocked,radius){
 const step=32,cols=Math.ceil(map.width/step),rows=Math.ceil(map.height/step),cell=p=>({x:Math.floor(p.x/step),y:Math.floor(p.y/step)}),center=p=>({x:(p.x+.5)*step,y:(p.y+.5)*step}),key=p=>p.y*cols+p.x;
 const start=cell(from),end=cell(to),open=[start],scores=new Map([[key(start),0]]),came=new Map(),closed=new Set();let found;
 for(let n=0;open.length&&n<10000;n++){
  open.sort((a,b)=>(scores.get(key(a))+Math.hypot(a.x-end.x,a.y-end.y))-(scores.get(key(b))+Math.hypot(b.x-end.x,b.y-end.y)));
  const current=open.shift(),id=key(current);if(closed.has(id))continue;if(current.x===end.x&&current.y===end.y){found=current;break;}closed.add(id);
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
   const next={x:current.x+dx,y:current.y+dy},ni=key(next),point=center(next);if(next.x<0||next.y<0||next.x>=cols||next.y>=rows||closed.has(ni)||blocked(point.x,point.y,radius))continue;
   if(dx&&dy&&(blocked(center({x:next.x,y:current.y}).x,center({x:next.x,y:current.y}).y,radius)||blocked(center({x:current.x,y:next.y}).x,center({x:current.x,y:next.y}).y,radius)))continue;
   const score=scores.get(id)+Math.hypot(dx,dy);if(score>=(scores.get(ni)??Infinity))continue;scores.set(ni,score);came.set(ni,current);open.push(next);
  }
 }
 if(!found)return [];const path=[];let node=found;while(key(node)!==key(start)){path.push(center(node));node=came.get(key(node));if(!node)return [];}path.reverse();path.push({x:to.x,y:to.y});return path;
}
