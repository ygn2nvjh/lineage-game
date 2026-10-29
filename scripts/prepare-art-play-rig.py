"""Pack generated cutout components without repainting or rectangular limb masks."""
from pathlib import Path
from PIL import Image
from scipy.ndimage import label,find_objects
import numpy as np,json
root=Path(__file__).resolve().parents[1];out=root/'assets/art-play';metadata={};base_metadata=json.load(open(out/'manifest-v2.json'))
for kind in ['female','male','skeleton']:
 source=out/'sources'/f'{kind}-rig-v3.png'
 if not source.exists():source=source.with_suffix('.webp')
 im=Image.open(source).convert('RGBA');im.save(out/'sources'/f'{kind}-rig-v3.webp','WEBP',lossless=True,method=6)
 mask=np.array(im)[:,:,3]>160;labels,n=label(mask);counts=np.bincount(labels.ravel());objects=find_objects(labels)
 parts=[]
 for i,b in enumerate(objects,1):
  if counts[i]>200:
   y,x=b;parts.append((i,(x.start,y.start,x.stop,y.stop)))
 if len(parts)!=15:raise ValueError((kind,'expected 15 separate rig parts',len(parts)))
 parts.sort(key=lambda p:(p[1][1]+p[1][3])/2)
 atlas=Image.new('RGBA',(1120,672));meta={}
 for row,dir in enumerate(['right','down','up']):
  cells=sorted(parts[row*5:(row+1)*5],key=lambda p:(p[1][0]+p[1][2])/2);meta[dir]=[]
  for col,(label_id,box) in enumerate(cells):
   crop=im.crop(box);data=np.array(crop);x0,y0,x1,y1=box;data[labels[y0:y1,x0:x1]!=label_id]=0
   crop=Image.fromarray(data);factor=min(1,212/crop.width,212/crop.height)
   crop=crop.resize((round(crop.width*factor),round(crop.height*factor)),Image.Resampling.NEAREST)
   a=np.array(crop)[:,:,3]>160;yy,xx=np.where(a[:max(1,int(crop.height*.3))]);anchor=float(xx.mean())
   atlas.alpha_composite(crop,(col*224,row*224));meta[dir].append({'x':col*224,'y':row*224,'w':crop.width,'h':crop.height,'anchor':anchor})
 metadata[kind]=meta;atlas.save(out/f'{kind}-rig-v3.webp','WEBP',lossless=True,method=6)
 print(kind,'parts',len(parts),'bytes',(out/f'{kind}-rig-v3.webp').stat().st_size)
 # Old rectangular source cells included neighboring sword tips. Recover each
 # whole connected actor BEFORE cropping, so blades are neither copied nor cut.
 original=Image.open(out/'sources'/f'{kind}.webp').convert('RGBA');raw=np.array(original)
 actor_labels,actor_n=label(raw[:,:,3]>160);sizes=np.bincount(actor_labels.ravel());actors=[]
 for i,b in enumerate(find_objects(actor_labels),1):
  if sizes[i]>1000:
   y,x=b;actors.append((i,(x.start,y.start,x.stop,y.stop)))
 if len(actors)!=24:raise ValueError((kind,'expected 24 original poses',len(actors)))
 actors.sort(key=lambda p:(p[1][1]+p[1][3])/2)
 rows=[sorted(actors[r*6:(r+1)*6],key=lambda p:(p[1][0]+p[1][2])/2) for r in range(4)]
 body=np.median([b[3]-b[1]for _,b in rows[0][:3]]);unit=112/body;base=Image.new('RGBA',(1344,704))
 for row,cells in enumerate(rows):
  for col,(i,box) in enumerate(cells):
   x0,y0,x1,y1=box;data=raw[y0:y1,x0:x1].copy();data[actor_labels[y0:y1,x0:x1]!=i]=0;crop=Image.fromarray(data);hh,ww=data.shape[:2];mask=data[:,:,3]>160
   band=mask[int(hh*.8):] if row==3 else mask[:max(1,int(hh*.3))]
   yy,xx=np.where(band);anchor=ww/2 if row==0 and col==5 else float(xx.mean())
   cell=224 if row==3 else 160;origin=112 if row==3 else 80;foot=180 if row==3 else 148
   scaled=crop.resize((round(ww*unit),round(hh*unit)),Image.Resampling.NEAREST);dx=round(origin-anchor*unit);dy=foot-scaled.height
   if dx<0 or dx+scaled.width>cell or dy<0:raise ValueError((kind,row,col,'actor overflow',dx,dy))
   base.alpha_composite(scaled,(col*cell+dx,row*160+dy))
   if row==3:base_metadata[kind]['frames'][f'attack:{col}']={'x':col*cell,'y':480,'w':cell,'h':cell,'dx':-origin,'dy':-foot}
 base.save(out/f'{kind}-base-v3.webp','WEBP',lossless=True,method=6)
(out/'rig-v3.json').write_text(json.dumps(metadata))
(out/'base-meta-v3.json').write_text(json.dumps(base_metadata))
