export async function loadPortraits(){
  const images={};await Promise.all(['male','female'].map(sex=>new Promise((resolve,reject)=>{
    const image=new Image();image.onload=()=>{images[sex]=image;resolve();};image.onerror=()=>reject(Error('人物立繪載入失敗'));
    image.src=globalThis.LINEAGE_PORTRAITS?.[sex]||new URL('../assets/portraits/'+sex+'.webp',import.meta.url).href;
  })));return images;
}
