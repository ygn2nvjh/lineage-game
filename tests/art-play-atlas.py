"""Check actual atlas pixels, including the neighboring-weapon fragment regression."""
from pathlib import Path
from PIL import Image
from scipy.ndimage import label
import numpy as np,json
root=Path(__file__).resolve().parents[1];folder=root/'assets/art-play';meta=json.load(open(folder/'manifest-v4.json'))
for kind,m in meta.items():
 a=np.array(Image.open(folder/f'{kind}-v4.webp').convert('RGBA'))
 # Lossless WebP may rewrite invisible RGB; runtime explicitly clears it too.
 a[a[:,:,3]<160]=0
 def frame(key):
  f=m['frames'][key];return a[f['y']:f['y']+f['h'],f['x']:f['x']+f['w']]
 for dir in ['right','down','up']:
  base=frame(f'walk:{dir}:0')[36:70]
  for i in range(12):assert np.array_equal(base,frame(f'walk:{dir}:{i}')[36:70]),(kind,dir,i,'unstable head pixels')
 for i in range(6):
  labels,_=label(frame(f'attack:{i}')[:,:,3]>=160)
  components=sorted(np.bincount(labels.ravel())[1:],reverse=True)
  assert components[0]>1000,(kind,i,'missing actor')
  assert not any(size>4 for size in components[1:]),(kind,i,'detached weapon fragment',components)
 print(kind,'36 stable walking heads; 6 attacks without neighboring blade fragments')

 for dir in ['right','down','up']:
  f=m['frames']['idle:'+dir]
  assert len(f['feet'])==2,(kind,dir,'two distinguishable resting feet required',f['feet'])
  assert abs(f['feet'][1]['x']-f['feet'][0]['x'])>=12,(kind,dir,'stance too narrow')
  assert max(p['y']+f['dy'] for p in f['feet'])==0,(kind,dir,'soles must touch ground')
  for i in range(12):
   f=m['frames'][f'walk:{dir}:{i}']
   assert max(p['y']+f['dy'] for p in f['feet'])==0,(kind,dir,i,'support foot must touch ground')
 print(kind,'staggered idle feet and planted support feet checked')
