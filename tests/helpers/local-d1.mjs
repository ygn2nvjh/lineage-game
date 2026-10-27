import {DatabaseSync} from 'node:sqlite';
export function localD1(file=':memory:'){
  const db=new DatabaseSync(file);db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  const wrap=(sql,args=[])=>({
    bind(...next){return wrap(sql,next);},
    async all(){const results=db.prepare(sql).all(...args);return {results,meta:{rows_read:results.length,rows_written:0,changes:0}};},
    _run(){const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes),rows_read:0,rows_written:Number(r.changes)}};},
    async run(){return this._run();}
  });
  return {prepare:sql=>wrap(sql),batch:async statements=>{db.exec('BEGIN IMMEDIATE');try{const results=[];for(const s of statements)results.push(s._run());db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}},exec:sql=>db.exec(sql),close:()=>db.close()};
}
