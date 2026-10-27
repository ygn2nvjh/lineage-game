"""Pack generated world props and ground textures as runtime atlases."""
from pathlib import Path
from PIL import Image
import json,statistics
root=Path(__file__).resolve().parents[1];r=root/'assets/world'
ns={'__file__':str(root/'scripts/atlas-extract.py')}
exec((root/'scripts/atlas-extract.py').read_text().split("pack(extract('chop-source.png'")[0],ns)
# Reuse extraction against the world source directory.
ns['r']=r/'sources';rows=ns['extract']('props.png',12,4)
out=Image.new('RGBA',(1024,960));frames={};packing=[]
keys=['shop','inn','gate','well','conifer','broadleaf','tombstone','grave','bridge','boulder','fence','crypt']
for n,(kind,c) in enumerate(zip(keys,[c for row in rows for c in row])):
 sprite=c['image'];factor=min(248/sprite.width,304/sprite.height);sprite=sprite.resize((round(sprite.width*factor),round(sprite.height*factor)),Image.Resampling.NEAREST);x=n%4*256+(256-sprite.width)//2;y=n//4*320+312-sprite.height;out.alpha_composite(sprite,(x,y));frames[kind]={'x':x,'y':y,'width':sprite.width,'height':sprite.height};packing.append({'kind':kind,'sourceBox':c['box']})
out.save(r/'props.webp',lossless=True,method=6)
props={'frames':frames,'packing':packing}
im=Image.open(r/'sources/tiles.png').convert('RGB');tiles=Image.new('RGB',(512,256));tf={}
for n,kind in enumerate(['grass','dirt','cobble','moss','cemetery','water','planks','forest']):
 x0=round(n%4*im.width/4);y0=round(n//4*im.height/2);x1=round((n%4+1)*im.width/4);y1=round((n//4+1)*im.height/2);tile=im.crop((x0+2,y0+2,x1-2,y1-2)).resize((128,128),Image.Resampling.NEAREST);tiles.paste(tile,(n%4*128,n//4*128));tf[kind]={'x':n%4*128,'y':n//4*128,'width':128,'height':128}
tiles.save(r/'tiles.webp',lossless=True,method=6)
(r/'manifest.json').write_text(json.dumps({'props':{'url':'props.webp','meta':props},'tiles':{'url':'tiles.webp','meta':{'frames':tf}}},indent=2));print('Packed world',len(frames),'props',sum((r/f).stat().st_size for f in ['props.webp','tiles.webp']))
