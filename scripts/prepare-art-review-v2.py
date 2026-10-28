"""Encode generated revision assets; preserve source pixels, no repainting."""
from pathlib import Path
from PIL import Image
import json
root=Path(__file__).resolve().parents[1]
for name in ['skeleton-v2','terrain-v2']:
 im=Image.open(root/'assets/art-review/sources'/f'{name}.webp').convert('RGBA')
 im.save(root/'assets/art-review/sources'/f'{name}.webp','WEBP',lossless=True,method=6)
 im.save(root/'assets/art-review'/f'{name}.webp','WEBP',quality=94,method=6)
 if name=='skeleton-v2':
  alpha=im.getchannel('A').point(lambda v:255 if v>160 else 0);x,y,x1,y1=alpha.getbbox();(root/'assets/art-review/skeleton-v2.json').write_text(json.dumps({'x':x,'y':y,'w':x1-x,'h':y1-y}))
 print(name,im.size,(root/'assets/art-review'/f'{name}.webp').stat().st_size)
