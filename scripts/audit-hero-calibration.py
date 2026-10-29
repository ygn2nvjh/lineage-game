"""Verify a fixed-reference batch instead of merely comparing to latest output."""
from pathlib import Path
from PIL import Image
import numpy as np,json,hashlib
ROOT=Path(__file__).resolve().parents[1];folder=ROOT/'assets/art-calibration'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def audit():
 lock=json.loads((ROOT/'data/art/hero-reference-lock.json').read_text());ref=json.loads((folder/'reference-v1.json').read_text());meta=json.loads((folder/'candidate-v1.json').read_text());old=json.loads((ROOT/'assets/art-play/manifest-v7.json').read_text());standard=json.loads((ROOT/'data/art/production-standard.json').read_text())
 errors=[];rows={};frames=0
 for path,expected in [(ROOT/lock['source'],lock['sourceSha256']),(folder/'reference-v1.webp',lock['referenceSha256']),(folder/'reference-parts-v1.webp',lock['partsSha256']),(folder/'reference-v1.json',lock['metadataSha256'])]:
  if sha(path)!=expected:errors.append('locked reference changed: '+path.name)
 def pixels(path):
  a=np.array(Image.open(path).convert('RGBA'));a[a[:,:,3]<160]=0;return a
 master=pixels(folder/'reference-v1.webp');candidate=pixels(folder/'candidate-v1.webp');parts=pixels(folder/'reference-parts-v1.webp')
 def crop(a,f):return a[f['y']:f['y']+f['h'],f['x']:f['x']+f['w']]
 for kind in ['male','female']:
  previous=pixels(ROOT/'assets/art-play'/old[kind]['atlas']);rows[kind]={}
  if meta[kind]['availableActions']!=['idle','walk']:errors.append(kind+': unsupported actions silently introduced')
  for di in ['down','right','up']:
   f=ref['frames'][kind]['idle:'+di];original=crop(master,f);new=crop(candidate,meta[kind]['frames']['idle:'+di]);record=ref['records'][kind][di];offset=record['normalizedSize'];dx,dy=f['sourceOffset']
   if not np.array_equal(original,new):errors.append(kind+' '+di+': idle differs from locked reference')
   rebuilt=np.zeros_like(original)
   for name in ['far','near','upper']:
    part=ref['parts'][kind][di][name];q=parts[part['y']:part['y']+part['h'],part['x']:part['x']+part['w']];target=rebuilt[dy:dy+part['h'],dx:dx+part['w']];opaque=q[:,:,3]>=160
    if np.any((target[:,:,3]>=160)&opaque):errors.append(kind+' '+di+': duplicated source pixel between parts')
    target[opaque]=q[opaque]
   if not np.array_equal(original,rebuilt):errors.append(kind+' '+di+': source partition lost or changed pixels')
   head=record['marks']['head'];hx,hy,hw,hh=head;headPixels=original[dy+hy:dy+hy+hh,dx+hx:dx+hx+hw]
   for key in ['idle:'+di]+[f'walk:{di}:{i}' for i in range(12)]:
    ff=meta[kind]['frames'].get(key)
    if not ff:errors.append(kind+': missing '+key);continue
    frame=crop(candidate,ff);ys,xs=np.where(frame[:,:,3]>=160);frames+=1
    if not len(xs):errors.append(kind+': empty '+key);continue
    if min(xs.min(),ys.min(),159-xs.max(),159-ys.max())<1:errors.append(kind+': clipped '+key)
    if int(ys.max())+ff['dy']!=0:errors.append(kind+': support floor drift '+key)
    if not np.array_equal(headPixels,frame[dy+hy:dy+hy+hh,dx+hx:dx+hx+hw]):errors.append(kind+': head drift '+key)
   of=old[kind]['frames']['idle:'+di];op=crop(previous,of);om=standard['actors'][kind]['views'][di]
   yy,xx=np.where(original[:,:,3]>=160);oy,ox=np.where(op[:,:,3]>=160)
   rows[kind][di]={'reference':{'width':int(xx.max()-xx.min()+1),'height':int(yy.max()-yy.min()+1),'headHeightEstimate':hh,'torsoWidthEstimate':record['marks']['torso'][2]},'previous':{'width':int(ox.max()-ox.min()+1),'height':int(oy.max()-oy.min()+1),'headHeightEstimate':om['head'][3],'torsoWidthEstimate':om['torso'][2]},'candidateIdlePixelDifferences':int(np.any(original!=new,axis=2).sum()),'bodyMarks':'manual estimates, not automatic anatomical segmentation','partsScale':1,'provenance':'all candidate source parts from fixed reference, never newly generated armor'}
 report={'referenceId':lock['id'],'referenceStatus':ref['status'],'status':'technical-pass' if not errors else 'technical-fail','artApproval':'pending-user-review','frameCount':frames,'supportedActions':['idle','walk'],'pendingActions':['attack','hurt','fall','settle'],'errors':errors,'measurements':rows,'hashes':{str(p.relative_to(ROOT)):sha(p) for p in [ROOT/'data/art/hero-reference-lock.json',folder/'reference-v1.json',folder/'reference-v1.webp',folder/'reference-parts-v1.webp',folder/'candidate-v1.json',folder/'candidate-v1.webp',ROOT/'assets/art-play/manifest-v7.json',ROOT/'assets/art-play/male-v7.webp',ROOT/'assets/art-play/female-v7.webp']}}
 return report
if __name__=='__main__':
 r=audit();(folder/'audit-v1.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'status':r['status'],'frames':r['frameCount'],'errors':r['errors']},ensure_ascii=False));raise SystemExit(bool(r['errors']))
