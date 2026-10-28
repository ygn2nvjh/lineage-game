import {DungeonHub as Hub} from './hub.mjs';
import {enableLargeDungeon,ONLINE} from '../online/room.mjs';
import seed from '../../data/game/catalog.json';
enableLargeDungeon(seed);
export class DungeonHub extends Hub {constructor(ctx,env){super(ctx,{...env,SEED:seed});}}
export default {async fetch(request,env){const url=new URL(request.url);if(url.pathname==='/ws'){if(request.headers.get('Origin')!==url.origin)return new Response('Forbidden',{status:403});if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});return env.HUB.get(env.HUB.idFromName('friends-test-v1')).fetch(request);}if(url.pathname==='/health')return Response.json({version:ONLINE.wsVersion,transport:'WebSocket + SQLite Durable Object',guestCap:30});if(url.pathname==='/'||url.pathname==='/dungeon')url.pathname='/dungeon.html';return env.ASSETS.fetch(new Request(url,request));}};
