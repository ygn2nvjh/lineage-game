"""Reusable production gate. Alpha measures image extents, never semantic anatomy.
Run with --manifest/--spec/--output to audit a future batch. Technical errors exit 1;
proportion warnings and absent manual marks remain explicit, not fake approvals.
"""
from pathlib import Path
import argparse,json,hashlib
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
def audit(manifest,spec,folder):
 report={'schemaVersion':1,'standard':spec['revision'],'status':'technical-pass','artApproval':'pending-human-review','actors':{},'errors':[],'warnings':[],'referencesPending':[k for k in spec['actors'] if k not in manifest]}
 shared=spec['shared'];alpha=shared['alphaThreshold']
 for kind,m in manifest.items():
  entry=spec['actors'].get(kind,{});profile=spec['profiles'].get(entry.get('profile'),{});issues=[];warnings=[];views={}
  layout=spec.get('animationLayouts',{}).get(entry.get('animationLayout'))
  if not layout:warnings.append('animation layout not calibrated')
  else:
   expected=['fall']+[f'attack:{i}' for i in range(layout['attackFrames'])]+[f'hurt:{i}' for i in range(layout['hurtFrames'])]
   for di in shared['views']:
    expected+=['idle:'+di]+[f'walk:{di}:{i}' for i in range(layout['walkFrames'])]+[f'settle:{di}:{group}:{step}' for group in range(layout['settlePhaseGroups']) for step in range(layout['settleFramesPerGroup'])]
   issues.extend('missing pose '+key for key in expected if key not in m['frames'])
   if m['bodyHeight']!=layout['sourceBodyHeight']:issues.append('source body height differs from selected layout')
   if m.get('walkCount')!=layout['walkFrames']:issues.append('walk count differs from selected layout')
  atlas=folder/m['atlas'];a=np.array(Image.open(atlas).convert('RGBA'));a[a[:,:,3]<alpha]=0
  frames={};grounded=[]
  for key,f in m['frames'].items():
   x,y,w,h=(f[z] for z in ['x','y','w','h'])
   if min(x,y)<0 or x+w>a.shape[1] or y+h>a.shape[0]:issues.append(key+': outside atlas');continue
   pose=a[y:y+h,x:x+w];mask=pose[:,:,3]>=alpha;ys,xs=np.where(mask)
   if not len(xs):issues.append(key+': empty');continue
   frames[key]=pose
   if min(xs.min(),ys.min(),w-1-xs.max(),h-1-ys.max())<shared['framePaddingMin']:issues.append(key+': touches frame edge')
   if key.startswith(('idle:','walk:','settle:')):
    floor=int(ys.max())+f['dy'];grounded.append(floor)
    if not f.get('feet'):issues.append(key+': contact metadata missing')
    if abs(floor)>shared['supportFloorTolerancePx']:issues.append(key+': support floor '+str(floor))
    for foot in f.get('feet',[]):
     if foot['y']+f['dy']>shared['supportFloorTolerancePx']:issues.append(key+': foot below ground')
  for di in shared['views']:
   f=m['frames'].get('idle:'+di);mark=entry.get('views',{}).get(di)
   if f is None:issues.append(di+': missing idle');continue
   pose=frames.get('idle:'+di)
   if pose is None:continue
   yy,xx=np.where(pose[:,:,3]>=alpha);v={'imageWidth':int(xx.max()-xx.min()+1),'imageHeight':int(yy.max()-yy.min()+1),'floor':int(yy.max()+f['dy']),'bodyHeightReference':m['bodyHeight'],'anatomyMethod':entry.get('markMethod','pending')}
   if not mark:warnings.append(di+': anatomy marks pending')
   else:
    for name in ['head','torso']:
     x,y,w,h=mark[name]
     if min(x,y,w,h)<0 or w==0 or h==0 or x+w>f['w'] or y+h>f['h']:issues.append(di+': invalid '+name+' mark');continue
     if not np.any(pose[y:y+h,x:x+w,3]>=alpha):issues.append(di+': empty '+name+' mark')
    v.update(headHeight=mark['head'][3],torsoWidth=mark['torso'][2],headHeightRatio=mark['head'][3]/m['bodyHeight'],torsoWidthRatio=mark['torso'][2]/m['bodyHeight'])
    for value,bounds in [('headHeightRatio',profile.get('headHeightRatio')),('torsoWidthRatio',profile.get('torsoWidthRatio',{}).get(di))]:
     if bounds and not bounds[0]<=v[value]<=bounds[1]:warnings.append(di+': '+value+' outside trial range')
    # Walk/settle head crop must remain invariant in actor coordinates, not atlas coordinates.
    x,y,w,h=mark['head'];head=pose[y:y+h,x:x+w];changed=[]
    for key,other in frames.items():
     if not key.startswith(('walk:'+di+':','settle:'+di+':')):continue
     q=m['frames'][key];ox=x+f['dx']-q['dx'];oy=y+f['dy']-q['dy'];candidate=other[oy:oy+h,ox:ox+w]
     if candidate.shape!=head.shape or np.any(candidate!=head):changed.append(key)
    v['headChangedFrames']=changed
    if len(changed)>shared['walkHeadPixelChangesMax']:issues.append(di+': unstable head in '+','.join(changed))
   # Defined, reproducible descriptive statistics; not a semantic palette count or quality score.
   rgb=pose[:,:,:3][pose[:,:,3]>=alpha].astype(float);luma=rgb@np.array([.2126,.7152,.0722]);bins=np.unique((rgb//32).astype(int),axis=0,return_counts=True)[1]
   adj=[]
   gray=pose[:,:,:3].astype(float)@np.array([.2126,.7152,.0722]);mask=pose[:,:,3]>=alpha
   for axis in [0,1]:
    ok=np.take(mask,range(mask.shape[axis]-1),axis=axis)&np.take(mask,range(1,mask.shape[axis]),axis=axis)
    adj.extend(np.abs(np.diff(gray,axis=axis))[ok].tolist())
   v['appearance']={'lumaP90MinusP10':round(float(np.percentile(luma,90)-np.percentile(luma,10)),2),'rgb32BinsAtLeast1Percent':int((bins>=len(rgb)*.01).sum()),'meanAdjacentLumaDifference':round(float(np.mean(adj)),2)}
   views[di]=v
  if profile.get('status')!='trial':warnings.append('profile not calibrated')
  report['actors'][kind]={'atlas':m['atlas'],'sha256':hashlib.sha256(atlas.read_bytes()).hexdigest(),'profile':entry.get('profile'),'marks':entry.get('markMethod','pending'),'frameCount':len(frames),'groundedFrameCount':len(grounded),'views':views,'errors':issues,'warnings':warnings,'status':'technical-fail' if issues else 'needs-review' if warnings else 'technical-pass'}
  report['errors'].extend(kind+': '+x for x in issues);report['warnings'].extend(kind+': '+x for x in warnings)
 if report['errors']:report['status']='technical-fail'
 return report
if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--manifest',default='assets/art-play/manifest-v7.json');ap.add_argument('--spec',default='data/art/production-standard.json');ap.add_argument('--output',default='assets/art-play/audit-v7.json');args=ap.parse_args()
 manifest=ROOT/args.manifest;spec=json.loads((ROOT/args.spec).read_text());report=audit(json.loads(manifest.read_text()),spec,manifest.parent)
 report['manifestSha256']=hashlib.sha256(manifest.read_bytes()).hexdigest();report['standardSha256']=hashlib.sha256((ROOT/args.spec).read_bytes()).hexdigest()
 target=ROOT/args.output;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'status':report['status'],'frames':sum(a['frameCount'] for a in report['actors'].values()),'errors':report['errors'],'warnings':report['warnings']},ensure_ascii=False));raise SystemExit(bool(report['errors']))
