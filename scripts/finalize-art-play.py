"""Encode packed animation and record contact points from actual opaque soles."""
from pathlib import Path
from PIL import Image
import numpy as np,json
out=Path(__file__).resolve().parents[1]/'assets/art-play';meta=json.load(open(out/'manifest-v4.json'))
for kind,m in meta.items():
 im=Image.open(out/f'{kind}-v4.png').convert('RGBA');a=np.array(im)
 for key,f in m['frames'].items():
  mask=a[f['y']:f['y']+f['h'],f['x']:f['x']+f['w'],3]>=160;ys,xs=np.where(mask)
  if not len(ys):raise ValueError((kind,key,'empty pose'))
  bottom=int(ys.max());columns=np.where(mask[max(0,bottom-3):bottom+1].any(axis=0))[0];runs=[]
  for x in columns:
   if not runs or x-runs[-1][-1]>2:runs.append([])
   runs[-1].append(int(x))
  f['feet']=[]
  if key!='fall':
   for run in runs:
    yy,xx=np.where(mask[:,run[0]:run[-1]+1]);f['feet'].append({'x':(run[0]+run[-1])/2,'y':int(yy.max()),'width':run[-1]-run[0]+1})
 im.save(out/f'{kind}-v4.webp','WEBP',lossless=True,method=6)
 print(kind,'bytes',(out/f'{kind}-v4.webp').stat().st_size,'side idle feet',m['frames']['idle:right']['feet'])
(out/'manifest-v4.json').write_text(json.dumps(meta))
