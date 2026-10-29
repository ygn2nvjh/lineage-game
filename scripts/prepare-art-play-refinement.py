"""Register image-generated local shading edits; preserve original alpha/geometry.
Only approved torso/hair interiors are replaced. Heads, weapons, legs, silhouettes,
other views and original generated images remain untouched. No painted pixels.
"""
from pathlib import Path
from PIL import Image
from scipy.ndimage import label,find_objects
import numpy as np,json,argparse
root=Path(__file__).resolve().parents[1];folder=root/'assets/art-play'
ap=argparse.ArgumentParser();ap.add_argument('--male',required=True);ap.add_argument('--female',required=True);args=ap.parse_args()
meta=json.load(open(folder/'rig-v5.json'))
for kind,source,rev in [('male',args.male,5),('female',args.female,3)]:
 generated=Image.open(source).convert('RGBA');generated.save(folder/f'sources/{kind}-refinement-v7.webp','WEBP',lossless=True,method=6)
 a=np.array(generated);mask=a[:,:,3]>=160;labels,n=label(mask);sizes=np.bincount(labels.ravel());largest=int(np.argmax(sizes[1:]))+1;sy,sx=find_objects(labels)[largest-1]
 a[labels!=largest]=0;cut=Image.fromarray(a).crop((sx.start,sy.start,sx.stop,sy.stop))
 atlas=Image.open(folder/f'{kind}-rig-v{rev}.webp').convert('RGBA');original=np.array(atlas);part=original[:224,:224].copy();yy,xx=np.where(part[:,:,3]>=160);box=(int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1))
 registered=Image.new('RGBA',(224,224));registered.paste(cut.resize((box[2]-box[0],box[3]-box[1]),Image.Resampling.NEAREST),box[:2]);edit=np.array(registered)
 y,x=np.indices((224,224));rgb=part[:,:,:3].astype(float);newrgb=edit[:,:,:3].astype(float)
 if kind=='male':
  # Armor surfaces only: exclude bronze trim, leather, hand, sword, cloth and head.
  region=(x>=35)&(x<=76)&(y>=77)&(y<=120)&(np.max(rgb,axis=2)-np.min(rgb,axis=2)<55)&(np.max(newrgb,axis=2)-np.min(newrgb,axis=2)<65)
 else:
  region=(y>=65)&(y<=103)&(x<73)&(rgb[:,:,0]>rgb[:,:,1]*1.6)&(rgb[:,:,0]>rgb[:,:,2]*1.6)&(newrgb[:,:,0]>newrgb[:,:,1]*1.6)&(newrgb[:,:,0]>newrgb[:,:,2]*1.6)
 region&=(part[:,:,3]>=160)&(edit[:,:,3]>=160)
 part[region,:3]=edit[region,:3]
 assert np.array_equal(part[:,:,3],original[:224,:224,3])
 original[:224,:224]=part;Image.fromarray(original).save(folder/f'{kind}-rig-v7.webp','WEBP',lossless=True,method=6)
 print(kind,'local interior pixels',int(region.sum()),'silhouette/weapon/head preserved')
(folder/'rig-v7.json').write_text(json.dumps(meta))
