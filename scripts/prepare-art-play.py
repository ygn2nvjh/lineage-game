"""Pack generated poses on a common 112px body grid; no painted alterations."""
from pathlib import Path
from PIL import Image
import numpy as np,json
root=Path(__file__).resolve().parents[1];out=root/'assets/art-play';metadata={}
keys=[['idle:down','idle:right','idle:up','hurt:0','hurt:1','fall'],[f'walk:right:{i}' for i in range(6)],['walk:down:0','walk:down:1','walk:down:2','walk:up:0','walk:up:1','walk:up:2'],[f'attack:{i}'for i in range(6)]]
for kind in ['female','male','skeleton']:
 im=Image.open(out/'sources'/f'{kind}.webp').convert('RGBA');im.save(out/'sources'/f'{kind}.webp','WEBP',lossless=True,method=6)
 a=np.asarray(im);alpha=a[:,:,3]>160;h,w=alpha.shape;hist=alpha.sum(axis=1);bound=[0]
 for t in [.25,.5,.75]:
  lo=int((t-.035)*h);hi=int((t+.035)*h);band=hist[lo:hi];bound.append(lo+int(np.argmin(band)))
 bound.append(h);frames=[]
 for row in range(4):
  for col in range(6):
   x0=round(col*w/6);x1=round((col+1)*w/6);y0=bound[row];y1=bound[row+1]
   mask=alpha[y0:y1,x0:x1];ys,xs=np.where(mask)
   if not len(xs):raise ValueError((kind,row,col,'empty cell'))
   box=(int(xs.min())+x0,int(ys.min())+y0,int(xs.max()+1)+x0,int(ys.max()+1)+y0)
   frames.append((row,col,box))
 body=np.median([b[3]-b[1] for r,c,b in frames if r==0 and c<3]);unit=112/body
 atlas=Image.new('RGBA',(960,640));meta={'bodyHeight':112,'frames':{},'sourceRows':bound,'sourceBodyHeight':float(body)}
 for row,col,box in frames:
  crop=im.crop(box);mask=np.asarray(crop)[:,:,3]>160;hh,ww=mask.shape
  if row==0 and col==5:anchor=ww/2
  elif row==3:
   yy,xx=np.where(mask[int(hh*.8):]);anchor=float(xx.mean()) if len(xx) else ww/2
  else:
   yy,xx=np.where(mask[:max(1,int(hh*.3))]);anchor=float(xx.mean()) if len(xx) else ww/2
  scaled=crop.resize((max(1,round(ww*unit)),max(1,round(hh*unit))),Image.Resampling.NEAREST)
  dx=round(80-anchor*unit);dy=148-scaled.height
  if dx<0 or dx+scaled.width>160 or dy<0:raise ValueError((kind,row,col,'frame overflow',dx,dy,scaled.size))
  atlas.alpha_composite(scaled,(col*160+dx,row*160+dy))
  meta['frames'][keys[row][col]]={'x':col*160,'y':row*160,'w':160,'h':160,'dx':-80,'dy':-148}
 atlas.save(out/f'{kind}.webp','WEBP',lossless=True,method=6);metadata[kind]=meta
 print(kind,'rows',bound,'sourceBody',body,'runtimeBytes',(out/f'{kind}.webp').stat().st_size)
(out/'manifest.json').write_text(json.dumps(metadata))
