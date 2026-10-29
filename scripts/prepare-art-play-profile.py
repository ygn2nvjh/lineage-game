"""Pack the new male profile cutout; preserve all v3 sources and other views."""
from pathlib import Path
from PIL import Image
from scipy.ndimage import label,find_objects
import numpy as np,json,sys
root=Path(__file__).resolve().parents[1];out=root/'assets/art-play'
revision=sys.argv[1] if len(sys.argv)>1 else '4'
source=out/f'sources/male-profile-v{revision}.png'
if not source.exists():source=source.with_suffix('.webp')
im=Image.open(source).convert('RGBA');im.save(out/f'sources/male-profile-v{revision}.webp','WEBP',lossless=True,method=6)
a=np.array(im);labels,n=label(a[:,:,3]>160);sizes=np.bincount(labels.ravel());i=int(np.argmax(sizes[1:]))+1;y,x=find_objects(labels)[i-1]
crop=a[y,x].copy();crop[labels[y,x]!=i]=0;crop=Image.fromarray(crop)
raw=np.array(crop);head=raw[:round(crop.height*.28),:,3]>160;hy,hx=np.where(head);center=float(hx.mean());head_width=int(hx.max()-hx.min()+1)
core=raw[:,max(0,round(center-head_width*.32)):round(center+head_width*.32),3]>160
body_height=int(np.where(core)[0].max())+1
if revision=='5':
 # The lowered blade crosses the center band. Use the blue hip-cloth hem as
 # anatomical scale reference so the head/body do not shrink with blade angle.
 rgb=raw[:,:,:3].astype(float);blue=(raw[:,:,3]>160)&(rgb[:,:,2]>rgb[:,:,0]*1.5)&(rgb[:,:,2]>rgb[:,:,1]*1.15)&(rgb[:,:,2]>45)
 body_height=int(np.where(blue)[0].max())+6
factor=min(212/crop.height,212/crop.width);crop=crop.resize((round(crop.width*factor),round(crop.height*factor)),Image.Resampling.NEAREST)
atlas=Image.open(out/'male-rig-v3.webp').convert('RGBA');atlas.paste((0,0,0,0),(0,0,224,224));atlas.alpha_composite(crop,(0,0));atlas.save(out/f'male-rig-v{revision}.webp','WEBP',lossless=True,method=6)
meta=json.load(open(out/'rig-v3.json'));mask=np.array(crop)[:,:,3]>160;yy,xx=np.where(mask[:round(body_height*factor*.3)])
meta['male']['right'][0]={'x':0,'y':0,'w':crop.width,'h':crop.height,'anchor':float(xx.mean()),'bodyHeight':round(body_height*factor)}
(out/f'rig-v{revision}.json').write_text(json.dumps(meta));print('packed male profile',crop.size)
