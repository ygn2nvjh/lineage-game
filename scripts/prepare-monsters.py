"""Pack drawn monster poses tightly. No empty fixed-size animation cells in runtime GPU image."""
from pathlib import Path
from PIL import Image
import json,statistics
root=Path(__file__).resolve().parents[1];r=root/'assets/monsters'
ns={'__file__':str(root/'scripts/atlas-extract.py')}
exec((root/'scripts/atlas-extract.py').read_text().split("pack(extract('chop-source.png'")[0],ns);ns['r']=r/'sources'
keys=['spartoi','skeleton_fighter','werewolf','night_werewolf','white_wolf_king']
vertical=ns['extract']('vertical-walk.png',40,8)
items=[];packing=[]
def stage(kind,key,c,factor,reaction=False):
 im=c['image'];alpha=im.getchannel('A');xs=[x for y in range(round(im.height*.12),round(im.height*.35)) for x in range(im.width) if alpha.getpixel((x,y))>128];anchor=statistics.median(xs) if xs else im.width/2
 if reaction:anchor=im.width/2
 sprite=im.resize((round(im.width*factor),round(im.height*factor)),Image.Resampling.NEAREST)
 items.append({'key':kind+':'+key,'image':sprite,'offsetX':round(-anchor*factor),'offsetY':-sprite.height})
 packing.append({'kind':kind,'pose':key,'sourceBox':c['box'],'scale':factor})
for index,kind in enumerate(keys):
 rows=ns['extract'](kind+'.png',24,6);factor=112/rows[0][3]['image'].height
 for row,cells in enumerate(rows):
  for col,c in enumerate(cells):
   if row==0:
    if col<4:stage(kind,'idle:'+['down','up','left','right'][col],c,factor)
   else:stage(kind,['idle','walk:right','attack','reaction'][row]+':'+str(col),c,factor,row==3 and col>=4)
 # Vertical sheet is independently scaled to the same anatomical standing height.
 vf=112/statistics.median(c['image'].height for c in vertical[index])
 for col,c in enumerate(vertical[index]):stage(kind,'walk:'+('down' if col<4 else 'up')+':'+str(col%4),c,vf)
# Shelf packing by height keeps the complete six-monster scene small in decoded memory.
width=1024;x=y=rowh=0;frames={};placed=[]
for item in sorted(items,key=lambda item:item['image'].height,reverse=True):
 im=item['image'];w,h=im.size
 if x+w+4>width:x=0;y+=rowh+4;rowh=0
 frames[item['key']]={'x':x,'y':y,'width':w,'height':h,'offsetX':item['offsetX'],'offsetY':item['offsetY']};placed.append((im,x,y));x+=w+4;rowh=max(rowh,h)
height=y+rowh+4;out=Image.new('RGBA',(width,height))
for im,x,y in placed:out.alpha_composite(im,(x,y))
out.save(r/'monsters.webp',lossless=True,method=6);(r/'monsters.json').write_text(json.dumps({'bodyPixels':112,'originX':0,'originY':0,'frames':frames,'packing':packing},indent=2));print('Packed monsters',len(frames),out.size,(r/'monsters.webp').stat().st_size,'decoded bytes',width*height*4)
