"""Meaningful negative fixtures for the reusable art production gate."""
import importlib.util,json,copy,tempfile
from pathlib import Path
from PIL import Image
import numpy as np
root=Path(__file__).resolve().parents[1];loader=importlib.util.spec_from_file_location('audit',root/'scripts/audit-art-production.py');mod=importlib.util.module_from_spec(loader);loader.loader.exec_module(mod)
folder=root/'assets/art-play';meta=json.load(open(folder/'manifest-v7.json'));standard=json.load(open(root/'data/art/production-standard.json'))
r=mod.audit(meta,standard,folder);assert not r['errors'];assert r['artApproval']=='pending-human-review';assert set(r['referencesPending'])=={'spartoi','skeleton_fighter'}
broken=copy.deepcopy(meta);broken['male']['frames']['walk:right:0']['dy']+=4
assert any('support floor' in e for e in mod.audit(broken,standard,folder)['errors'])
broken=copy.deepcopy(meta);del broken['skeleton']['frames']['attack:3']
assert any('missing pose attack:3' in e for e in mod.audit(broken,standard,folder)['errors'])
broken=copy.deepcopy(meta);broken['male']['frames']['idle:right']['x']=99999
assert any('outside atlas' in e for e in mod.audit(broken,standard,folder)['errors'])
s=copy.deepcopy(standard);s['actors']['male']['views']={}
r=mod.audit(meta,s,folder);assert not r['errors'];assert any('anatomy marks pending' in w for w in r['warnings']);assert r['actors']['male']['status']=='needs-review'
s=copy.deepcopy(standard);s['profiles']['hero']['headHeightRatio']=[.9,1]
assert any('outside trial range' in w for w in mod.audit(meta,s,folder)['warnings'])
# Protect previous accepted shapes/weapons and every unrelated animation frame.
old=json.load(open(folder/'manifest-v5.json'))
for kind in ['male','female','skeleton']:
 a=np.array(Image.open(folder/old[kind]['atlas']).convert('RGBA'));b=np.array(Image.open(folder/meta[kind]['atlas']).convert('RGBA'));a[a[:,:,3]<160]=0;b[b[:,:,3]<160]=0
 assert np.array_equal(a[:,:,3],b[:,:,3]),(kind,'silhouette changed')
 changed=[]
 for key,f in meta[kind]['frames'].items():
  prev=old[kind]['frames'][key];one=a[prev['y']:prev['y']+prev['h'],prev['x']:prev['x']+prev['w']];two=b[f['y']:f['y']+f['h'],f['x']:f['x']+f['w']]
  if np.any(one!=two):changed.append(key)
  if key=='idle:right':
   x,y,w,h=standard['actors'][kind]['views']['right']['head'];assert np.array_equal(one[y:y+h,x:x+w],two[y:y+h,x:x+w]),(kind,'head changed')
  if kind=='skeleton' or ':right' not in key:assert np.array_equal(one,two),(kind,key,'unrelated pixels changed')
 assert bool(changed)==(kind!='skeleton')
 print(kind,'changed frames',len(changed),'silhouette and unrelated frames preserved')
print('Production gate: valid batch, floor drift, invalid crop, absent anatomy marks and ratio warning verified')
