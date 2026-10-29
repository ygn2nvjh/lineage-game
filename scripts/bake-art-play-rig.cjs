// Technical atlas assembly. Source cutouts remain preserved; no hand-painted changes.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const root=path.resolve(__dirname,'..'),dir=path.join(root,'assets/art-play');
 const source=fs.readFileSync(path.join(root,'src/art-play-rig.mjs'),'utf8').replace(/^export /gm,'');
 const meta=JSON.parse(fs.readFileSync(path.join(dir,'base-meta-v3.json'))),rig=JSON.parse(fs.readFileSync(path.join(dir,'rig-v3.json')));
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{const p=await b.newPage();
 for(const kind of ['female','male','skeleton']){
  const original=fs.readFileSync(path.join(dir,kind+'-base-v3.webp')).toString('base64'),parts=fs.readFileSync(path.join(dir,kind+'-rig-v3.webp')).toString('base64');
  const data=await p.evaluate(async({original,parts,source,rig})=>{
   const load=async s=>{const im=new Image();im.src='data:image/webp;base64,'+s;await im.decode();return im;};
   const base=await load(original),image=await load(parts),canvas=document.createElement('canvas');canvas.width=1344;canvas.height=1504;
   const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;c.drawImage(base,0,0);
   const bake=new Function(source+';return bakeArtPlayRig;')();
   const frames={};
   for(const [r,dir]of ['right','down','up'].entries()){
    for(let i=0;i<12;i++){
     const index=r*12+i,x=index%8*160,y=704+Math.floor(index/8)*160;
     c.save();c.translate(x+80,y+148);bake(c,image,rig[dir],dir,i/12);c.restore();
     frames['walk:'+dir+':'+i]={x,y,w:160,h:160,dx:-80,dy:-148};
    }
    const col={down:0,right:1,up:2}[dir];c.clearRect(col*160,0,160,160);
    c.save();c.translate(col*160+80,148);bake(c,image,rig[dir],dir,0,true);c.restore();
    frames['idle:'+dir]={x:col*160,y:0,w:160,h:160,dx:-80,dy:-148};
   }
   // Remove antialiased fringe from rotated cutouts before saving the packed atlas.
   const pixels=c.getImageData(0,0,canvas.width,canvas.height);for(let i=0;i<pixels.data.length;i+=4){if(pixels.data[i+3]<160)pixels.data.fill(0,i,i+4);else pixels.data[i+3]=255;}c.putImageData(pixels,0,0);
   return {png:canvas.toDataURL().split(',')[1],frames};
  },{original,parts,source,rig:rig[kind]});
  fs.writeFileSync(path.join(dir,kind+'-v3.png'),Buffer.from(data.png,'base64'));
  Object.assign(meta[kind].frames,data.frames);meta[kind].walkCount=12;
 }
 fs.writeFileSync(path.join(dir,'manifest-v3.json'),JSON.stringify(meta));
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
