"""Technical crop/packing of the immutable static reference, no new painted art.
Every candidate part is masked from the same normalized reference; never auto-fit
legs or regenerate armor. Existing runtime atlases are not overwritten.
"""
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
import numpy as np,json,hashlib
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'assets/art-calibration';out.mkdir(exist_ok=True)
source=ROOT/'assets/art-review/characters.webp';sha=hashlib.sha256(source.read_bytes()).hexdigest()
lock=ROOT/'data/art/hero-reference-lock.json'
if lock.exists() and json.loads(lock.read_text())['sourceSha256']!=sha:raise SystemExit('Reference changed: create a new explicitly reviewed reference revision, do not replace this lock')
# Masks in normalized 112-high reference coordinates. They select existing pixels;
# visible armor design, width, palette and source resolution are preserved.
legs={
 'male':{
  'down':{'far':[(31,77),(47,77),(47,94),(46,110),(20,110),(20,99),(30,92)],'near':[(56,77),(71,77),(73,94),(80,104),(80,112),(63,112),(60,99)]},
  'right':{'far':[(5,79),(17,79),(17,111),(0,111),(0,97)],'near':[(17,78),(33,78),(32,98),(42,104),(42,112),(15,112)]},
  'up':{'far':[(6,77),(22,77),(21,94),(17,112),(0,112),(0,99)],'near':[(34,77),(49,77),(49,96),(56,105),(56,112),(38,112),(36,98)]}},
 'female':{
  'down':{'far':[(34,69),(51,69),(51,88),(48,109),(24,109),(24,99),(35,93)],'near':[(55,69),(74,69),(76,94),(83,103),(83,112),(68,112),(64,97)]},
  'right':{'far':[(5,76),(17,76),(17,98),(20,108),(0,108),(0,96)],'near':[(18,75),(35,75),(32,96),(45,105),(45,112),(19,112)]},
  'up':{'far':[(7,74),(23,74),(21,95),(16,112),(0,112),(0,99)],'near':[(30,74),(44,74),(46,97),(53,105),(53,112),(36,112),(33,96)]}}}
# Source inspection marks: explicitly manual cross-sections, not automatic anatomy.
sections={
 'male':{'down':{'head':[37,0,24,26],'torso':[32,27,35,39],'thigh':[58,82,12,1],'shin':[62,93,10,1],'boot':[65,105,12,1]},'right':{'head':[16,0,25,26],'torso':[10,27,25,40],'thigh':[18,81,12,1],'shin':[18,94,9,1],'boot':[17,110,23,1]},'up':{'head':[15,0,25,26],'torso':[8,27,38,40],'thigh':[35,82,14,1],'shin':[40,94,9,1],'boot':[40,105,15,1]}},
 'female':{'down':{'head':[38,0,27,25],'torso':[34,27,34,38],'thigh':[59,76,13,1],'shin':[67,92,9,1],'boot':[70,105,12,1]},'right':{'head':[20,0,23,25],'torso':[14,26,24,38],'thigh':[20,79,12,1],'shin':[21,94,10,1],'boot':[20,110,24,1]},'up':{'head':[14,0,26,26],'torso':[9,28,37,38],'thigh':[33,79,12,1],'shin':[37,94,10,1],'boot':[38,105,14,1]}}}
im=Image.open(source).convert('RGBA');arr=np.array(im);atlas=Image.new('RGBA',(480,320));partsAtlas=Image.new('RGBA',(640,960));frames={};parts={};records={}
for row,kind in enumerate(['male','female']):
 frames[kind]={};parts[kind]={};records[kind]={}
 for col,di in enumerate(['down','right','up']):
  x0=col*im.width//3;y0=row*im.height//2;mask=arr[y0:y0+im.height//2,x0:x0+im.width//3,3]>160;yy,xx=np.where(mask);box=[int(x0+xx.min()),int(y0+yy.min()),int(x0+xx.max()+1),int(y0+yy.max()+1)];cut=im.crop(box)
  if di=='right':cut=ImageOps.mirror(cut)
  cut=cut.resize((round(cut.width*112/cut.height),112),Image.Resampling.NEAREST);a=np.array(cut);a[a[:,:,3]<160]=0;a[a[:,:,3]>=160,3]=255;cut=Image.fromarray(a)
  masks={}
  for side,polygon in legs[kind][di].items():
   m=Image.new('1',cut.size);ImageDraw.Draw(m).polygon(polygon,fill=1);masks[side]=np.array(m)&(a[:,:,3]>=160)
  masks['far']&=~masks['near'] # Near leg owns the one-pixel shared seam; never draw it twice.
  # Foot center of the two source legs is the body anchor, independent of blade.
  foots=[]
  for side in ['far','near']:
   y,x=np.where(masks[side]);bottom=int(y.max());xs=x[y>=bottom-2];foots.append(float((xs.min()+xs.max())/2))
  anchor=round(sum(foots)/2);dx=80-anchor;dy=37
  atlas.alpha_composite(cut,(col*160+dx,row*160+dy));frames[kind]['idle:'+di]={'x':col*160,'y':row*160,'w':160,'h':160,'dx':-80,'dy':-148,'sourceAnchor':anchor,'sourceOffset':[dx,dy]}
  parts[kind][di]={}
  for j,name in enumerate(['upper','far','near']):
   selection=~(masks['far']|masks['near']) if name=='upper' else masks[name];part=a.copy();part[~selection]=0
   px=j*160;py=(row*3+col)*160;partsAtlas.alpha_composite(Image.fromarray(part),(px,py))
   ys,xs=np.where(part[:,:,3]>=160)
   # Split the source leg at its visible knee; no stretch or independently scaled parts.
   knee=86 if kind=='male' else 84
   hipY=int(ys.min()) if name!='upper' else 0
   hipXs=xs[ys<=hipY+3];hipX=float(np.median(hipXs)) if name!='upper' else anchor
   kneeXs=xs[(ys>=knee-1)&(ys<=knee+1)];kneeX=float(np.median(kneeXs)) if len(kneeXs) else hipX
   parts[kind][di][name]={'x':px,'y':py,'w':cut.width,'h':112,'anchor':anchor,'hip':[hipX,hipY],'knee':[kneeX,knee],'sourcePixelCount':int(selection.sum()) if name!='upper' else int((selection&(a[:,:,3]>=160)).sum())}
  records[kind][di]={'sourceCrop':box,'mirrored':di=='right','sourceScale':112/(box[3]-box[1]),'normalizedSize':list(cut.size),'sourceAnchor':anchor,'marks':sections[kind][di]}
atlas.save(out/'reference-v1.webp','WEBP',lossless=True,method=6);partsAtlas.save(out/'reference-parts-v1.webp','WEBP',lossless=True,method=6)
meta={'id':'hero-static-reference-20261029-v1','source':'assets/art-review/characters.webp','sourceSha256':sha,'normalization':'one uniform height normalization per original view, 112 source pixels; right mirrors the original left view; no independently fitted body parts','status':'fixed-reference-for-this-review','frames':frames,'parts':parts,'records':records}
(out/'reference-v1.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
locked={'id':meta['id'],'source':meta['source'],'sourceSha256':sha,'referenceSha256':hashlib.sha256((out/'reference-v1.webp').read_bytes()).hexdigest(),'partsSha256':hashlib.sha256((out/'reference-parts-v1.webp').read_bytes()).hexdigest(),'metadataSha256':hashlib.sha256((out/'reference-v1.json').read_bytes()).hexdigest(),'rule':'Never advance this reference automatically to the latest animation. Any changed source, masks or normalization needs an explicit new revision.'}
if lock.exists() and json.loads(lock.read_text())!=locked:raise SystemExit('Reference geometry or pixels changed; use a new reviewed reference revision')
lock.write_text(json.dumps(locked,ensure_ascii=False,indent=2)+'\n');print('Packed immutable reference and exact-source parts')
