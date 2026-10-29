import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {rightWalkPose} from '../src/hero-walk-motion.mjs';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root)),hash=async p=>createHash('sha256').update(await read(p)).digest('hex');
const config=JSON.parse(await read('data/art/right-walk-v1.json')),lock=JSON.parse(await read('data/art/hero-reference-lock.json')),reference=JSON.parse(await read('assets/art-calibration/reference-v1.json')),errors=[],roles={};
if(config.referenceId!==lock.id||reference.id!==lock.id)errors.push('reference identity changed');
if(config.partScale!==1)errors.push('independent body-part scaling is forbidden');
if(JSON.stringify(config.views)!=='["right"]')errors.push('scope must remain right view only');
for(const [path,expected]of [[lock.source,lock.sourceSha256],['assets/art-calibration/reference-v1.webp',lock.referenceSha256],['assets/art-calibration/reference-parts-v1.webp',lock.partsSha256],['assets/art-calibration/reference-v1.json',lock.metadataSha256]])if(await hash(path)!==expected)errors.push('locked reference changed: '+path);
for(const kind of ['male','female']){
 const anchors=new Map();let maxSupportDrift=0,maxJointLengthError=0,maxReachError=0;
 for(let i=0;i<4000;i++)for(const leg of Object.values(rightWalkPose(config,kind,i/1000).legs)){
  maxReachError=Math.max(maxReachError,leg.reachError);
  maxJointLengthError=Math.max(maxJointLengthError,Math.abs(Math.hypot(leg.knee[0]-leg.hip[0],leg.knee[1]-leg.hip[1])-leg.upperLength),Math.abs(Math.hypot(leg.ankle[0]-leg.knee[0],leg.ankle[1]-leg.knee[1])-leg.lowerLength));
  if(leg.stance){if(anchors.has(leg.supportId))maxSupportDrift=Math.max(maxSupportDrift,Math.hypot(...leg.worldContact.map((v,j)=>v-anchors.get(leg.supportId)[j])));else anchors.set(leg.supportId,leg.worldContact);}
 }
 const a=rightWalkPose(config,kind,0),b=rightWalkPose(config,kind,.5);
 if(!(a.legs.near.stance&&b.legs.far.stance&&a.legs.near.contact[0]>a.legs.far.contact[0]&&b.legs.far.contact[0]>b.legs.near.contact[0]))errors.push(kind+': legs did not exchange support/lead');
 if(Math.max(maxSupportDrift,maxJointLengthError,maxReachError)>1e-6)errors.push(kind+': planted foot or fixed-length joint failed');
 roles[kind]={samples:4000,maxSupportDriftSourcePixels:maxSupportDrift,maxJointLengthError,maxReachError,referenceSource:lock.id,partScale:1,weaponContainingUpperCopies:1};
}
const paths=['data/art/right-walk-v1.json','data/art/hero-reference-lock.json','assets/art-calibration/reference-v1.json','assets/art-calibration/reference-parts-v1.webp','src/hero-walk-motion.mjs','src/hero-right-walk.mjs'];
const report={id:config.id,status:errors.length?'technical-fail':'technical-pass',artApproval:'pending-user-review',rightViewOnly:true,keyPoses:config.keyLabels,model:'planted world contact -> fixed two-bone solution -> flat boot; same immutable source pieces',roles,rasterVerification:'separate browser check; mathematical drift is not a claim of zero display-pixel jitter',pending:['other directions','attack','hurt','fall','settle'],errors,hashes:Object.fromEntries(await Promise.all(paths.map(async p=>[p,await hash(p)])))};
await writeFile(new URL('assets/art-calibration/right-walk-audit-v1.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,roles,errors}));if(errors.length)process.exitCode=1;
