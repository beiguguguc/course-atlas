import {afterEach,describe,expect,it,vi} from 'vitest';
import 'fake-indexeddb/auto';
import {AtlasDB,mergeBatch,restoreBackup,topicUpdateBackupKey} from '../src/db';
import {planMerge,validateBatch,type Backup,type KnowledgeNode} from '../src/model';

const initial=()=>validateBatch({schemaVersion:1,nodes:[
  {id:'semester',parentId:null,level:0,title:'我的学期'},
  {id:'course',parentId:'semester',level:1,title:'我的课程'},
  {id:'chapter',parentId:'course',level:2,title:'第一章'},
  {id:'theorem',parentId:'chapter',level:3,title:'原定理',body:'我修改过的正文',supplement:'我的备注',sourceFile:'旧讲义.pdf',createdAt:100,updatedAt:200,
    examples:[{id:'old-question',title:'旧例题',prompt:'旧题目',solution:'旧解答'}]},
]});
const updated=(existing=initial())=>({...existing.find(n=>n.id==='theorem')!,title:'新版定理',body:'新版正文',supplement:'新版备注',sourceFile:'新讲义.pdf',
  examples:[{id:'new-question',title:'新版例题',prompt:'新题目',solution:'新解答'}]});
const batch=(nodes:KnowledgeNode[]|unknown[])=>({schemaVersion:1,nodes});
const databases:AtlasDB[]=[];
const createDB=async()=>{const db=new AtlasDB('update-test-'+crypto.randomUUID());databases.push(db);await mergeBatch(batch(initial()),db);return db;};
afterEach(async()=>{vi.restoreAllMocks();await Promise.all(databases.splice(0).map(db=>db.delete()));});

describe('知识点覆盖导入',()=>{
  it('只有显式选择更新时才整条替换，例题列表也以新版为准',()=>{
    const old=initial(),incoming=validateBatch(batch([updated(old)]),old);
    expect(planMerge(old,incoming).updates).toHaveLength(0);
    expect(planMerge(old,incoming).nodes.find(n=>n.id==='theorem')?.body).toBe('我修改过的正文');
    const plan=planMerge(old,incoming,true),node=plan.nodes.find(n=>n.id==='theorem')!;
    expect(plan.additions).toHaveLength(0);
    expect(plan.updates).toHaveLength(1);
    expect(plan.skipped).toBe(0);
    expect(node).toMatchObject({id:'theorem',parentId:'chapter',level:3,title:'新版定理',body:'新版正文',supplement:'新版备注',sourceFile:'新讲义.pdf',createdAt:100});
    expect(node.updatedAt).toBeGreaterThan(200);
    expect(node.examples?.map(e=>e.id)).toEqual(['new-question']);
  });

  it('覆盖不是局部补丁：省略的可选内容按文件默认值清空',()=>{
    const old=initial();
    const incoming=validateBatch(batch([{id:'theorem',parentId:'chapter',level:3,title:'简版定理'}]),old);
    const node=planMerge(old,incoming,true).updates[0];
    expect(node.body).toBe('');expect(node.supplement).toBe('');expect(node.sourceFile).toBe('');expect(node.examples).toEqual([]);
  });

  it('同批新增知识点，同时保留既有学期、课程、章节和文件外的笔记',()=>{
    const old=initial(),extra={...old[3],id:'my-other-note',title:'我的其他笔记'};
    old.push(extra);
    const incoming=validateBatch(batch([{...old[1],title:'不应覆盖课程名'},{...updated(old)},{...old[3],id:'new-theorem',title:'新增知识点'}]),old);
    const plan=planMerge(old,incoming,true);
    expect(plan.additions.map(n=>n.id)).toEqual(['new-theorem']);
    expect(plan.updates.map(n=>n.id)).toEqual(['theorem']);
    expect(plan.skipped).toBe(1);
    expect(plan.nodes.find(n=>n.id==='course')).toEqual(old[1]);
    expect(plan.nodes.find(n=>n.id==='my-other-note')).toEqual(extra);
  });

  it('只改变文件时间戳不算更新，反复导入不会重复或刷新修改时间',()=>{
    const old=initial(),incoming=validateBatch(batch([{...old[3],createdAt:999,updatedAt:999}]),old);
    const plan=planMerge(old,incoming,true);
    expect(plan.updates).toHaveLength(0);expect(plan.additions).toHaveLength(0);expect(plan.skipped).toBe(1);
    expect(plan.nodes.find(n=>n.id==='theorem')).toEqual(old[3]);
  });

  it('更新落盘并保存可恢复的整库备份；重复导入保留这份备份',async()=>{
    const db=await createDB(),before=await db.nodes.toArray();
    const file=batch([updated(before),{...updated(before),id:'new-theorem'}]);
    const result=await mergeBatch(file,db,true);
    expect(result.updates).toHaveLength(1);expect(result.additions).toHaveLength(1);
    expect(await db.nodes.count()).toBe(5);
    expect((await db.nodes.get('theorem'))?.body).toBe('新版正文');
    const saved=(await db.meta.get(topicUpdateBackupKey))!.value as Backup;
    expect(saved.nodes).toEqual(before);
    const again=await mergeBatch(file,db,true);
    expect(again.additions).toHaveLength(0);expect(again.updates).toHaveLength(0);
    expect((await db.meta.get(topicUpdateBackupKey))?.value).toEqual(saved);
    await restoreBackup(saved,db);
    expect(await db.nodes.toArray()).toEqual(before);
  });

  it('重复编号或改变上级的文件整批拒绝，不写入新内容或备份',async()=>{
    const db=await createDB(),before=await db.nodes.toArray(),topic=updated(before);
    await expect(mergeBatch(batch([topic,topic]),db,true)).rejects.toThrow('重复');
    await expect(mergeBatch(batch([topic,{...topic,id:'new-theorem',parentId:'missing'}]),db,true)).rejects.toThrow('上级');
    await expect(mergeBatch(batch([{...topic,parentId:'another-chapter'},{...before[0],id:'another-chapter',level:2,parentId:'course'}]),db,true)).rejects.toThrow('另一个层级');
    expect(await db.nodes.toArray()).toEqual(before);
    expect(await db.meta.get(topicUpdateBackupKey)).toBeUndefined();
  });

  it('写入失败时，新增、覆盖和自动备份一起回滚',async()=>{
    const db=await createDB(),before=await db.nodes.toArray(),topic=updated(before);
    vi.spyOn(db.nodes,'bulkPut').mockRejectedValueOnce(new Error('模拟写入失败'));
    await expect(mergeBatch(batch([topic,{...topic,id:'new-theorem'}]),db,true)).rejects.toThrow('模拟写入失败');
    expect(await db.nodes.toArray()).toEqual(before);
    expect(await db.meta.get(topicUpdateBackupKey)).toBeUndefined();
  });
});
