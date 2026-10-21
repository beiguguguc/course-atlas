import {describe,it,expect,afterEach} from 'vitest';
import 'fake-indexeddb/auto';
import {AtlasDB,initialize,mergeBatch,restoreBackup} from '../src/db';
import {validateBatch,type KnowledgeNode} from '../src/model';
import legacy from './fixtures/legacy-seed.json';
const databases:AtlasDB[]=[];
const fresh=()=>{const db=new AtlasDB('cleanup-'+crypto.randomUUID());databases.push(db);return db;};
const legacyDB=async()=>{const db=fresh();await db.nodes.bulkPut(validateBatch({schemaVersion:1,nodes:legacy}));await db.meta.put({key:'initialized',value:true});return db;};
afterEach(async()=>{await Promise.all(databases.splice(0).map(db=>db.delete()));});

describe('空白知识库与预置内容清理',()=>{
  it('首次打开为空白，之后重新初始化仍为空白',async()=>{const db=fresh();expect(await initialize(db)).toEqual([]);expect(await initialize(db)).toEqual([]);});
  it('已有浏览器的预置内容清空，并可从清理前备份恢复',async()=>{const db=await legacyDB();await db.meta.put({key:'recent',value:['least-squares']});expect(await initialize(db)).toEqual([]);expect((await db.meta.get('recent'))?.value).toEqual([]);const saved=(await db.meta.get('before-sample-cleanup-v1'))?.value as {schemaVersion:1;nodes:KnowledgeNode[]};expect(saved.nodes).toHaveLength(16);await restoreBackup(saved,db);expect(await initialize(db)).toHaveLength(16);});
  it('保留自己添加或编辑的笔记及其必要上级',async()=>{const db=await legacyDB();await db.nodes.update('least-squares',{title:'我修改的估计方法',sample:false});await db.nodes.add(validateBatch({schemaVersion:1,nodes:[{id:'my-note',parentId:'interpretation',level:3,title:'我自己添加的笔记',sample:false}]},await db.nodes.toArray())[0]);const remaining=await initialize(db);expect(remaining.find(n=>n.id==='least-squares')?.title).toBe('我修改的估计方法');expect(remaining.some(n=>n.id==='my-note')).toBe(true);expect(remaining.some(n=>n.id==='models')).toBe(true);expect(remaining.some(n=>n.id==='interpretation')).toBe(true);expect(remaining.some(n=>n.id==='residual')).toBe(false);expect(validateBatch({schemaVersion:1,nodes:remaining})).toHaveLength(remaining.length);});
  it('后续用户主动导入的内容不会再次被清理',async()=>{const db=fresh();await initialize(db);await mergeBatch({schemaVersion:1,nodes:legacy},db);expect(await initialize(db)).toHaveLength(16);});
});
