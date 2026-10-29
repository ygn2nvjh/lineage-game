// Technical motion study from the exact static reference. No image generation,
// independent limb resize, recoloring or runtime body/weapon frame splicing.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const root=path.resolve(__dirname,'..'),folder=path.join(root,'assets/art-calibration'),reference=JSON.parse(fs.readFileSync(path.join(folder,'reference-v1.json')));
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const p=await b.newPage(),result=await p.evaluate(async({reference,master,parts})=>{
  const load=async data=>{const im=new Image();im.src='data:image/webp;base64,'+data;await im.decode();return im;};
  const source=await load(master),image=await load(parts),canvas=document.createElement('canvas');canvas.width=1280;canvas.height=1600;const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
  const meta={};let index=0;
  const frame=(kind,dir,key,phase)=>{
   const x=index%8*160,y=Math.floor(index/8)*160;index++;
   const ref=reference.frames[kind]['idle:'+dir],dx=ref.sourceOffset[0],dy=ref.sourceOffset[1],rig=reference.parts[kind][dir];
   if(key.startsWith('idle:'))c.drawImage(source,ref.x,ref.y,160,160,x,y,160,160);
   else{
    c.save();c.translate(x,y);
    for(const [i,side] of ['far','near'].entries()){
     const f=rig[side],t=phase*Math.PI*2+i*Math.PI,s=Math.sin(t),lift=Math.max(0,Math.cos(t))*5;
     const a=-s*(dir==='right'?.32:.085),bend=dir==='right'?Math.max(0,Math.cos(t))*.32:0;
     const layer=document.createElement('canvas');layer.width=layer.height=160;const q=layer.getContext('2d',{willReadFrequently:true});q.imageSmoothingEnabled=false;
     q.translate(dx+f.hip[0],dy+f.hip[1]);q.rotate(a);
     // Same source scale for thigh/shin/boot. Translation and rotation only.
     const knee=f.knee[1];q.drawImage(image,f.x,f.y,f.w,knee,-f.hip[0],-f.hip[1],f.w,knee);
     q.translate(f.knee[0]-f.hip[0],f.knee[1]-f.hip[1]);q.rotate(bend);
     q.drawImage(image,f.x,f.y+knee,f.w,112-knee,-f.knee[0],0,f.w,112-knee);
     const pixels=q.getImageData(0,0,160,160).data;let bottom=-1;
     for(let yy=0;yy<160;yy++)for(let xx=0;xx<160;xx++)if(pixels[(yy*160+xx)*4+3]>=160)bottom=Math.max(bottom,yy);
     c.drawImage(layer,0,Math.round(148-lift-bottom));
    }
    const f=rig.upper;c.drawImage(image,f.x,f.y,f.w,f.h,dx,dy,f.w,f.h);c.restore();
   }
   meta[kind].frames[key]={x,y,w:160,h:160,dx:-80,dy:-148};
  };
  for(const kind of ['male','female']){
   meta[kind]={atlas:'candidate-v1.webp',bodyHeight:112,walkCount:12,availableActions:['idle','walk'],sourceReference:reference.id,frames:{}};
   for(const dir of ['down','right','up']){frame(kind,dir,'idle:'+dir,0);for(let i=0;i<12;i++)frame(kind,dir,'walk:'+dir+':'+i,i/12);}
  }
  const data=c.getImageData(0,0,canvas.width,canvas.height);for(let i=0;i<data.data.length;i+=4){if(data.data[i+3]<160)data.data.fill(0,i,i+4);else data.data[i+3]=255;}c.putImageData(data,0,0);
  return {png:canvas.toDataURL().split(',')[1],meta};
 },{reference,master:fs.readFileSync(path.join(folder,'reference-v1.webp')).toString('base64'),parts:fs.readFileSync(path.join(folder,'reference-parts-v1.webp')).toString('base64')});
 fs.writeFileSync(path.join(folder,'candidate-v1.png'),Buffer.from(result.png,'base64'));fs.writeFileSync(path.join(folder,'candidate-v1.json'),JSON.stringify(result.meta));console.log('Baked 78 frames from the fixed reference: idle/walk only; attacks explicitly pending');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
