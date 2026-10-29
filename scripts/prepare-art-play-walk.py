"""Pack new walk phases; retain previous art and attacks unchanged."""
from pathlib import Path
from PIL import Image
import numpy as np,json
root=Path(__file__).resolve().parents[1];out=root/'assets/art-play';meta=json.load(open(out/'manifest.json'))
for kind in ['female','male','skeleton']:
 source=out/'sources'/f'{kind}-walk-v2.webp'
 im=Image.open(source if source.exists() else source.with_suffix('.png')).convert('RGBA');im.save(source,'WEBP',lossless=True,method=6)
 a=np.array(im);mask=a[:,:,3]>160;h,w=mask.shape;hist=mask.sum(axis=1);bounds=[0]
 for t in [1/3,2/3]:
  lo=int((t-.04)*h);hi=int((t+.04)*h);bounds.append(lo+int(np.argmin(hist[lo:hi])))
 bounds.append(h);frames=[]
 for row in range(3):
  for col in range(6):
   x0=round(col*w/6);x1=round((col+1)*w/6);y0=bounds[row];y1=bounds[row+1];ys,xs=np.where(mask[y0:y1,x0:x1]);box=(int(xs.min())+x0,int(ys.min())+y0,int(xs.max()+1)+x0,int(ys.max()+1)+y0);frames.append((row,col,box))
 unit=112/np.median([b[3]-b[1]for r,c,b in frames]);atlas=Image.new('RGBA',(960,1120));atlas.alpha_composite(Image.open(out/f'{kind}.webp').convert('RGBA'),(0,0))
 for row,col,box in frames:
  crop=im.crop(box);hh,ww=np.array(crop)[:,:,3].shape;ys,xs=np.where(np.array(crop)[:max(1,int(hh*.3)),:,3]>160);anchor=float(xs.mean());scaled=crop.resize((max(1,round(ww*unit)),max(1,round(hh*unit))),Image.Resampling.NEAREST);dx=round(80-anchor*unit);dy=148-scaled.height
  if dx<0 or dy<0 or dx+scaled.width>160:raise ValueError((kind,row,col,'overflow'))
  atlas.alpha_composite(scaled,(col*160+dx,(row+4)*160+dy));key=f"walk:{['right','down','up'][row]}:{col}";meta[kind]['frames'][key]={'x':col*160,'y':(row+4)*160,'w':160,'h':160,'dx':-80,'dy':-148}
 meta[kind]['frames']['idle:right']['flip']=True
 atlas.save(out/f'{kind}-v2.webp','WEBP',lossless=True,method=6)
 print(kind,'size',(out/f'{kind}-v2.webp').stat().st_size,'rows',bounds)
(out/'manifest-v2.json').write_text(json.dumps(meta))
