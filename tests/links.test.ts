import {afterEach,describe,expect,it,vi} from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import {AtlasDB,deleteBranch,exportBackup,mergeBatch,restoreBackup,saveLink,topicUpdateBackupKey} from '../src/db';
import {linkKey,relatedTopics,validateLinks} from '../src/links';
import {validateBatch,type Backup} from '../src/model';
import {parseRoute,routeHash} from '../src/navigation';

const fixture=()=>validateBatch({schemaVersion:1,nodes:[
  {id:'term',parentId:null,level:0,title:'我的学期'},
  {id:'course-a',parentId:'term',level:1,title:'课程甲'},
  {id:'chapter-a',parentId:'course-a',level:2,title:'第一章'},
  {id:'topic-a',parentId:'chapter-a',level:3,title:'知识甲',body:'原笔记'},
  {id:'course-b',parentId:'term',level:1,title:'课程乙'},
  {id:'chapter-b',parentId:'course-b',level:2,title:'第一章'},
  {id:'topic-b',parentId:'chapter-b',level:3,title:'知识乙'},
  {id:'topic-c',parentId:'chapter-b',level:3,title:'知识丙'},
]});
const databases:AtlasDB[]=[];
const makeDB=async()=>{const database=new AtlasDB('links-test-'+crypto.randomUUID());databases.push(database);await mergeBatch({schemaVersion:1,nodes:fixture()},database);return database;};
afterEach(async()=>{vi.restoreAllMocks();await Promise.all(databases.splice(0).map(d=>d.delete()));});

describe('知识点双向关联与数据保留',()=>{
  it('旧版数据库升级保留笔记和元数据，只新增关联表',async()=>{
    const name='links-test-'+crypto.randomUUID(),old=new Dexie(name);
    old.version(1).stores({nodes:'id,parentId,level,order',meta:'key'});
    const nodes=fixture();await old.table('nodes').bulkPut(nodes);await old.table('meta').put({key:'recent',value:['topic-a']});old.close();
    const upgraded=new AtlasDB(name);databases.push(upgraded);
    expect(await upgraded.nodes.toArray()).toEqual([...nodes].sort((a,b)=>a.id.localeCompare(b.id)));
    expect((await upgraded.meta.get('recent'))?.value).toEqual(['topic-a']);
    expect(await upgraded.links.count()).toBe(0);
  });
  it('同一跨课程关联两边可见；反方向保存只更新说明，不产生重复',async()=>{
    const db=await makeDB();await saveLink('topic-a','topic-b','相同思想',db);
    const links=await saveLink('topic-b','topic-a','  更新说明  ',db),nodes=await db.nodes.toArray();
    expect(links).toHaveLength(1);expect(links[0].note).toBe('更新说明');
    expect(relatedTopics(links,nodes,'topic-a')[0].node.id).toBe('topic-b');
    expect(relatedTopics(links,nodes,'topic-b')[0].node.id).toBe('topic-a');
    const name=db.name;db.close();const reopened=new AtlasDB(name);databases.push(reopened);
    expect(await reopened.links.get(linkKey('topic-a','topic-b'))).toEqual(links[0]);
  });
  it('拒绝自关联、非知识点、悬空目标、超长说明和反向重复',async()=>{
    const db=await makeDB();
    await expect(saveLink('topic-a','topic-a','',db)).rejects.toThrow('自己');
    await expect(saveLink('topic-a','course-b','',db)).rejects.toThrow('两端');
    await expect(saveLink('topic-a','missing','',db)).rejects.toThrow('两端');
    await expect(saveLink('topic-a','topic-b','x'.repeat(601),db)).rejects.toThrow('600');
    expect(()=>validateLinks({links:[{fromId:'topic-a',toId:'topic-b'},{fromId:'topic-b',toId:'topic-a'}]},fixture())).toThrow('重复');
    expect(await db.links.count()).toBe(0);
  });
  it('覆盖导入旧格式内容时保留手动关联，自动备份也包含关联',async()=>{
    const db=await makeDB();const before=await saveLink('topic-a','topic-b','自己添加的关联',db);
    await mergeBatch({schemaVersion:1,nodes:[{...fixture()[3],body:'补充后的正文'}]},db,true);
    expect(await db.links.toArray()).toEqual(before);
    const backup=(await db.meta.get(topicUpdateBackupKey))?.value as Backup;
    expect(backup.links).toEqual(before);expect(backup.nodes.find(n=>n.id==='topic-a')?.body).toBe('原笔记');
  });
  it('完整备份可往返恢复；重复合并保留已有说明并加入新关联',async()=>{
    const db=await makeDB();await saveLink('topic-a','topic-b','原说明',db);const saved=await exportBackup(db);
    const imported={...saved,links:[{fromId:'topic-b',toId:'topic-a',note:'不覆盖原说明'},{fromId:'topic-b',toId:'topic-c',note:'新增'}]};
    const plan=await mergeBatch(imported,db);expect(plan.addedLinks).toHaveLength(1);expect(plan.links).toHaveLength(2);
    expect((await db.links.get(linkKey('topic-a','topic-b')))?.note).toBe('原说明');
    expect((await mergeBatch(imported,db)).addedLinks).toHaveLength(0);
    await restoreBackup(saved,db);expect(await db.links.toArray()).toEqual(saved.links);
    await restoreBackup({schemaVersion:1,nodes:fixture()},db);expect(await db.links.count()).toBe(0);
  });
  it('非法关联导致导入整批拒绝，节点与关联不发生部分写入',async()=>{
    const db=await makeDB();const before=await exportBackup(db);
    await expect(mergeBatch({schemaVersion:1,nodes:[{...fixture()[3],id:'new-topic'}],links:[{fromId:'new-topic',toId:'missing'}]},db)).rejects.toThrow('两端');
    expect(await db.nodes.toArray()).toEqual(before.nodes);expect(await db.links.toArray()).toEqual(before.links);
  });
  it('删除课程只清理相关关联，不删除另一门课及它内部的关联',async()=>{
    const db=await makeDB();await saveLink('topic-a','topic-b','跨课程',db);await saveLink('topic-b','topic-c','同课程',db);
    await db.meta.put({key:'recent',value:['topic-a','topic-b']});
    const result=await deleteBranch('course-a',db);
    expect(result.removed.has('topic-a')).toBe(true);expect(result.links).toHaveLength(1);
    expect(result.links[0].id).toBe(linkKey('topic-b','topic-c'));
    expect(await db.nodes.get('topic-b')).toBeDefined();expect((await db.meta.get('recent'))?.value).toEqual(['topic-b']);
  });
  it('删除失败时，关联清理也回滚',async()=>{
    const db=await makeDB();await saveLink('topic-a','topic-b','保留',db);const before=await exportBackup(db);
    vi.spyOn(db.nodes,'bulkDelete').mockRejectedValueOnce(new Error('写入失败'));
    await expect(deleteBranch('course-a',db)).rejects.toThrow('写入失败');
    expect(await db.nodes.toArray()).toEqual(before.nodes);expect(await db.links.toArray()).toEqual(before.links);
  });
});
describe('总览路由',()=>{
  it('兼容原有知识点网址，总览可以独立刷新，异常编码安全回到首页',()=>{
    expect(parseRoute('#/topic-a')).toEqual({id:'topic-a',overview:false});
    expect(parseRoute(routeHash('course-a',true))).toEqual({id:'course-a',overview:true});
    expect(parseRoute('#/%broken')).toEqual({id:null,overview:false});
    expect(parseRoute('#/')).toEqual({id:null,overview:false});
  });
});
