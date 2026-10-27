import {readFile} from 'node:fs/promises';
export async function syncArt(){return JSON.parse(await readFile(new URL('../assets/art/manifest.json',import.meta.url),'utf8'));}
