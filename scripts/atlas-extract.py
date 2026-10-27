"""Package generated walking/chopping poses; alpha components avoid grid clipping."""
from PIL import Image,ImageFilter,ImageChops
from pathlib import Path
from collections import deque
import statistics,json
r=Path(__file__).resolve().parent
cw,ch,body,ox,oy=320,224,112,128,200
out=Image.new('RGBA',(cw*6,ch*14));frames={};packing=[]
def extract(filename,count,columns):
 im=Image.open(r/filename).convert('RGBA');alpha=im.getchannel('A');raw=alpha.tobytes();w,h=im.size;seen=bytearray(w*h);parts=[]
 for start in range(w*h):
  if seen[start] or raw[start]<160:continue
  q=deque([start]);seen[start]=1;pixels=[];l=w;t=h;rr=0;b=0
  while q:
   j=q.popleft();pixels.append(j);x=j%w;y=j//w;l=min(l,x);t=min(t,y);rr=max(rr,x);b=max(b,y)
   for nx,ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
    if 0<=nx<w and 0<=ny<h:
     z=ny*w+nx
     if not seen[z] and raw[z]>=160:seen[z]=1;q.append(z)
  parts.append({'pixels':pixels,'box':(l,t,rr+1,b+1)})
 main=sorted(parts,key=lambda c:len(c['pixels']),reverse=True)[:count]
 if len(main)!=count or min(len(c['pixels']) for c in main)<500:raise ValueError('Missing sprites')
 # Foot baseline separates rows even when raised swords extend into the margin.
 main.sort(key=lambda c:c['box'][3]);rows=[sorted(main[i:i+columns],key=lambda c:c['box'][0]) for i in range(0,count,columns)]
 for row in rows:
  for c in row:
   mask=Image.new('L',im.size);data=bytearray(w*h)
   for i in c['pixels']:data[i]=255
   mask.frombytes(bytes(data));mask=ImageChops.multiply(mask.filter(ImageFilter.MaxFilter(3)),alpha);sprite=im.copy();sprite.putalpha(mask);c['image']=sprite.crop(c['box'])
 return rows

def pack(rows,keys,start,chop=False):
 for n,(cells,key) in enumerate(zip(rows,keys)):
  # Idle height for chops, median frame height for walks: scale stable across cycle.
  factor=body/(cells[0]['image'].height if chop else statistics.median(c['image'].height for c in cells))
  for col,c in enumerate(cells):
   sprite=c['image'];a=sprite.getchannel('A');xs=[x for y in range(round(sprite.height*.53),round(sprite.height*.75)) for x in range(sprite.width) if a.getpixel((x,y))>128];anchor=statistics.median(xs) if xs else sprite.width/2
   small=sprite.resize((round(sprite.width*factor),round(sprite.height*factor)),Image.Resampling.NEAREST);x=round(ox-anchor*factor);y=oy-small.height
   if min(x,y)<0 or x+small.width>cw:raise ValueError(('clipped',key,col,x,y,small.size))
   row=start+n;out.alpha_composite(small,(col*cw+x,row*ch+y));frames[f'{key}:{col}']={'x':col*cw,'y':row*ch,'width':cw,'height':ch};packing.append({'key':key,'pose':col,'sourceBox':c['box'],'scale':factor,'packedX':x,'packedY':y})
