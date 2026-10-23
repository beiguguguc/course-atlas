import {afterEach,describe,expect,it,vi} from 'vitest';
import 'fake-indexeddb/auto';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import CourseOverview from '../src/CourseOverview';
import {AtlasDB,exportBackup,mergeBatch,restoreBackup,topicUpdateBackupKey} from '../src/db';
import {compactTopicTitle,courseOutline,groupTopics,planOutline,validateOutlinePath} from '../src/outline';
import {exportMarkdown,importMarkdown,planMerge,validateBatch,type Backup} from '../src/model';
const fixture=()=>validateBatch({schemaVersion:1,nodes:[
  {id:'term',parentId:null,level:0,title:'学期'},
  {id:'course',parentId:'term',level:1,title:'演示课程'},
  {id:'c1',parentId:'course',level:2,title:'第一章',order:1},
  {id:'c2',parentId:'course',level:2,title:'第二章',order:2},
  {id:'c3',parentId:'course',level:2,title:'第三章',order:3},
  {id:'a',parentId:'c1',level:3,title:'1.1 定义甲',body:'自己改过的正文',supplement:'私人备注',outlinePath:['结构','概念'],order:1,createdAt:123,examples:[{id:'e',title:'旧题',prompt:'题目',solution:'解答'}]},
  {id:'b',parentId:'c1',level:3,title:'1.2 性质乙',outlinePath:['结构','性质','等价条件'],order:2},
  {id:'c',parentId:'c1',level:3,title:'未分组的知识点',order:3},
  {id:'d',parentId:'c2',level:3,title:'另一章的知识点',outlinePath:['应用','概念']},
]});
const databases:AtlasDB[]=[];
async function makeDB(){const d=new AtlasDB('outline-'+crypto.randomUUID());databases.push(d);await mergeBatch({schemaVersion:1,nodes:fixture()},d);return d;}
afterEach(async()=>{vi.restoreAllMocks();await Promise.all(databases.splice(0).map(d=>d.delete()));});
describe('全部展开的课程知识目录',()=>{
  it('初次渲染即包含所有章节、各级主题和叶子，空章节也保留',()=>{
    const nodes=fixture(),html=renderToStaticMarkup(<CourseOverview nodes={nodes} course={nodes[1]} onNavigate={()=>{}} onBack={()=>{}} onAdd={()=>{}}/>);
    for(const title of ['第一章','第二章','第三章','结构','概念','性质','等价条件','定义甲','性质乙','未分组的知识点','另一章的知识点'])expect(html).toContain(title);
    expect(html).not.toContain('选择一章');expect(html).not.toContain('aria-expanded');
    expect(html).toContain('还没有知识点');
  });
  it('分组路径生成多层树，保留原章节及每个知识点的唯一身份',()=>{
    const nodes=fixture(),tree=courseOutline(nodes,'course');
    expect(tree.map(t=>t.chapter.id)).toEqual(['c1','c2','c3']);
    expect(tree[0].root.groups[0].groups[1].groups[0].topics[0].id).toBe('b');
    expect(tree[0].root.topics[0].id).toBe('c');
    expect(nodes.find(n=>n.id==='b')?.parentId).toBe('c1');
    expect(groupTopics([nodes[5],{...nodes[6],outlinePath:['另一结构','概念']}]).groups).toHaveLength(2);
    expect(compactTopicTitle('1.2 性质乙')).toBe('性质乙');expect(compactTopicTitle('L2 空间')).toBe('L2 空间');
  });
  it('搜索具体名称保留祖先，搜索主题显示所属分支，搜索章节显示整章',()=>{
    expect(courseOutline(fixture(),'course','性质乙')[0].root.groups[0].groups[0].groups[0].topics[0].id).toBe('b');
    expect(courseOutline(fixture(),'course','结构')[0].visible).toBe(2);
    expect(courseOutline(fixture(),'course','第一章')[0].visible).toBe(3);
    expect(courseOutline(fixture(),'course','不存在')).toEqual([]);
  });
});
describe('目录分组更新与原内容保留',()=>{
  it('仅分组更新不覆盖标题、正文、例题、备注、创建时间和链接',async()=>{
    const db=await makeDB();const before=await db.nodes.get('a');
    const result=await mergeBatch({schemaVersion:1,nodes:[],outlineUpdates:[{id:'a',outlinePath:['新主题','新子主题']}]},db);
    const after=await db.nodes.get('a');
    expect(after).toEqual({...before,outlinePath:['新主题','新子主题'],updatedAt:after!.updatedAt});
    expect(result.additions).toHaveLength(0);expect(result.updates).toHaveLength(0);expect(result.outlineUpdates).toHaveLength(1);
    const saved=(await db.meta.get(topicUpdateBackupKey))!.value as Backup;expect(saved.nodes.find(n=>n.id==='a')).toEqual(before);
    expect((await mergeBatch({schemaVersion:1,nodes:[],outlineUpdates:[{id:'a',outlinePath:['新主题','新子主题']}]},db)).outlineUpdates).toHaveLength(0);
    expect((await db.meta.get(topicUpdateBackupKey))?.value).toEqual(saved);
  });
  it('覆盖旧格式内容时保留分组；显式空路径可以取消分组',()=>{
    const nodes=fixture(),incoming={...nodes[5],body:'新正文'};delete incoming.outlinePath;
    expect(planMerge(nodes,validateBatch({schemaVersion:1,nodes:[incoming]},nodes),true).updates[0].outlinePath).toEqual(['结构','概念']);
    expect(planMerge(nodes,validateBatch({schemaVersion:1,nodes:[{...incoming,outlinePath:[]}]},nodes),true).updates[0].outlinePath).toEqual([]);
  });
  it('拒绝重复、悬空或非知识点目标；失败时整批回滚',async()=>{
    const db=await makeDB(),before=await db.nodes.toArray();
    const update={id:'a',outlinePath:['新主题']};
    for(const updates of [[update,update],[update,{id:'missing',outlinePath:[]}],[{id:'c1',outlinePath:[]}],[{id:'a',outlinePath:['']}]] ){
      await expect(mergeBatch({schemaVersion:1,nodes:[],outlineUpdates:updates},db)).rejects.toThrow();
      expect(await db.nodes.toArray()).toEqual(before);
    }
    vi.spyOn(db.nodes,'bulkPut').mockRejectedValueOnce(new Error('写入失败'));
    await expect(mergeBatch({schemaVersion:1,nodes:[],outlineUpdates:[update]},db)).rejects.toThrow('写入失败');
    expect(await db.nodes.toArray()).toEqual(before);expect(await db.meta.get(topicUpdateBackupKey)).toBeUndefined();
  });
  it('同批新知识点可分组，整库备份往返保留路径',async()=>{
    const db=await makeDB();
    await mergeBatch({schemaVersion:1,nodes:[{id:'new',parentId:'c2',level:3,title:'新增笔记'}],outlineUpdates:[{id:'new',outlinePath:['新主题']}]},db);
    const saved=await exportBackup(db);expect(saved.nodes.find(n=>n.id==='new')?.outlinePath).toEqual(['新主题']);
    await restoreBackup(saved,db);expect((await exportBackup(db)).nodes).toEqual(saved.nodes);
  });
  it('路径深度与长度有界，Markdown 导出再导入保留分组及正文',()=>{
    expect(validateOutlinePath([' 主题 ',' 子主题 '])).toEqual(['主题','子主题']);
    expect(()=>validateOutlinePath(['一','二','三','四','五','六'])).toThrow('5');
    expect(()=>validateOutlinePath(['x'.repeat(81)])).toThrow('80');
    const node=fixture()[5],restored=importMarkdown(exportMarkdown(node),'笔记.md','c1');
    expect(restored.outlinePath).toEqual(node.outlinePath);expect(restored.body).toBe(node.body);expect(restored.examples?.[0].solution).toBe('解答');
    expect(planOutline({},fixture()).updates).toEqual([]);
  });
});
