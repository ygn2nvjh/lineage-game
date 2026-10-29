from pathlib import Path
import importlib.util,json
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];loader=importlib.util.spec_from_file_location('calibration',ROOT/'scripts/audit-hero-calibration.py');m=importlib.util.module_from_spec(loader);loader.loader.exec_module(m)
r=m.audit();assert not r['errors'];assert r['frameCount']==78;assert r['artApproval']=='pending-user-review';assert r['pendingActions']==['attack','hurt','fall','settle']
p=ROOT/'data/art/hero-reference-lock.json';original=p.read_bytes()
try:
 lock=json.loads(original);lock['sourceSha256']='0'*64;p.write_text(json.dumps(lock));assert any('locked reference changed' in e for e in m.audit()['errors'])
finally:p.write_bytes(original)
p=ROOT/'assets/art-calibration/candidate-v1.json';original=p.read_bytes()
try:
 data=json.loads(original);del data['male']['frames']['walk:right:5'];p.write_text(json.dumps(data));assert any('missing walk:right:5' in e for e in m.audit()['errors'])
finally:p.write_bytes(original)
p=ROOT/'assets/art-calibration/candidate-v1.webp';original=p.read_bytes()
try:
 im=Image.open(p).convert('RGBA');data=json.load(open(ROOT/'assets/art-calibration/candidate-v1.json'));f=data['male']['frames']['idle:down'];im.putpixel((f['x']+80,f['y']+40),(255,0,255,255));im.save(p,'WEBP',lossless=True);assert any('idle differs' in e or 'head drift' in e for e in m.audit()['errors'])
finally:p.write_bytes(original)
print('78 fixed-reference frames verified; changed reference, missing pose and altered appearance rejected')
