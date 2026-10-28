import {AdventureService} from './adventure-hub.mjs';
import {ADVENTURE_VERSION} from '../online/adventure.mjs';
import {DungeonHub as Hub} from './hub.mjs';
import {enableLargeDungeon,ONLINE} from '../online/room.mjs';
import seed from '../../data/game/catalog.json';
enableLargeDungeon(seed);
export class DungeonHub extends Hub {constructor(ctx,env){super(ctx,{...env,SEED:seed});}}
export class AdventureHub extends AdventureService {constructor(ctx,env){super(ctx,{...env,SEED:seed});}}
export default {async fetch(request,env){const url=new URL(request.url);if(url.pathname==='/play-ws'){if(request.headers.get('Origin')!==url.origin)return new Response('Forbidden',{status:403});return env.ADVENTURE.get(env.ADVENTURE.idFromName('unified-v1')).fetch(request);}if(url.pathname==='/ws'){if(request.headers.get('Origin')!==url.origin)return new Response('Forbidden',{status:403});if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});return env.HUB.get(env.HUB.idFromName('friends-test-v1')).fetch(request);}if(url.pathname==='/health')return Response.json({version:ADVENTURE_VERSION,legacyVersion:ONLINE.wsVersion,transport:'WebSocket + SQLite Durable Object',guestCap:30});if(url.pathname==='/'||url.pathname==='/play'||url.pathname==='/play/')url.pathname='/play.html';else if(url.pathname==='/dungeon')url.pathname='/dungeon.html';const response=await env.ASSETS.fetch(new Request(url,request));if(url.pathname==='/play.html'){const headers=new Headers(response.headers);headers.set('cache-control','no-store');return new Response(response.body,{status:response.status,headers});}return response;}};
