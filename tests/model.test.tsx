import {describe,it,expect,afterEach} from 'vitest';
import 'fake-indexeddb/auto';
import {renderToStaticMarkup} from 'react-dom/server';
import {Markdown} from '../src/Markdown';
import {AtlasDB,initialize,mergeBatch,restoreBackup} from '../src/db';
import {validateBatch,planMerge,importMarkdown,exportMarkdown,type KnowledgeNode} from '../src/model';
import seed from './fixtures/legacy-seed.json';
const normalized=()=>validateBatch({schemaVersion:1,nodes:seed});
const tests:AtlasDB[]=[];
const makeDB=()=>{const db=new AtlasDB('test-'+crypto.randomUUID());tests.push(db);return db;};
const populateDB=async(db:AtlasDB)=>{await initialize(db);await mergeBatch({schemaVersion:1,nodes:seed},db);return db.nodes.toArray();};
afterEach(async()=>{await Promise.all(tests.splice(0).map(db=>db.delete()));});

describe('课程数据与导入',()=>{
  it('现有示例结构完整，知识点预留所有来源字段',()=>{const nodes=normalized();expect(nodes.length).toBe(16);const topic=nodes.find(n=>n.id==='least-squares')!;expect(topic.sourceFile).toBe('');expect(topic.sourcePage).toBe('');expect(topic.supplement).toBe('');expect(topic.examples?.length).toBe(1);});
  it('合并保留已有内容，允许新知识点复用已有上级',()=>{const old=normalized(),existing=old.find(n=>n.id==='least-squares')!;const incoming=validateBatch({schemaVersion:1,nodes:[{...existing,title:'不应覆盖的标题'},{id:'new-topic',parentId:'models',level:3,title:'新增',sourceFile:'课件.pdf',sourcePage:'3–5',supplement:'待核对'}]},old);const plan=planMerge(old,incoming);expect(plan.skipped).toBe(1);expect(plan.additions.length).toBe(1);expect(plan.nodes.find(n=>n.id===existing.id)?.title).toBe(existing.title);expect(plan.additions[0].sourcePage).toBe('3–5');});
  it('乱序的完整层级可以导入，错误的上级和重复ID会被拒绝',()=>{const nodes=normalized();expect(validateBatch({schemaVersion:1,nodes:[...nodes].reverse()}).length).toBe(nodes.length);expect(()=>validateBatch({schemaVersion:1,nodes:[{id:'x',level:3,parentId:'missing',title:'错误'}]})).toThrow('上级');expect(()=>validateBatch({schemaVersion:1,nodes:[nodes[0],nodes[0]]})).toThrow('重复');expect(()=>validateBatch({schemaVersion:1,nodes:[{...nodes[0],level:1,parentId:'semester-3b'}]},nodes)).toThrow('另一个层级');});
  it('初始化不会覆盖内容或重新填回已经清空的示例',async()=>{const db=makeDB();await populateDB(db);await db.nodes.update('least-squares',{title:'我的笔记'});await initialize(db);expect((await db.nodes.get('least-squares'))?.title).toBe('我的笔记');await db.nodes.clear();await initialize(db);expect(await db.nodes.count()).toBe(0);});
  it('事务导入、备份往返和失败回滚均保留原内容',async()=>{const db=makeDB();const old=await populateDB(db);const extra={id:'batch-new',level:3,parentId:'models',title:'新知识点',sourceFile:'a.pdf',sourcePage:'2',supplement:'备注'};await mergeBatch({schemaVersion:1,nodes:[extra]},db);const before=await db.nodes.toArray();const roundtrip=JSON.parse(JSON.stringify({schemaVersion:1,nodes:before}));const repeated=await mergeBatch(roundtrip,db);expect(repeated.additions).toHaveLength(0);expect(await db.nodes.count()).toBe(old.length+1);await expect(mergeBatch({schemaVersion:1,nodes:[{...extra,id:'valid'},{...extra,id:'invalid',parentId:'missing'}]},db)).rejects.toThrow();expect(await db.nodes.count()).toBe(before.length);expect((await db.nodes.get('batch-new'))?.supplement).toBe('备注');});
});
describe('Markdown、公式与示例',()=>{
  it('导出再导入保留正文、例题、来源和补充说明',()=>{const node={...normalized().find(n=>n.id==='least-squares')!,sourceFile:'第一章.pdf',sourcePage:'12–14',supplement:'**重点**：条件不可省略。'} as KnowledgeNode;const result=importMarkdown(exportMarkdown(node),'note.md','models');expect(result.title).toBe(node.title);expect(result.body).toBe(node.body);expect(result.examples?.[0].prompt).toBe(node.examples?.[0].prompt);expect(result.examples?.[0].solution).toBe(node.examples?.[0].solution);expect(result.sourceFile).toBe(node.sourceFile);expect(result.sourcePage).toBe(node.sourcePage);expect(result.supplement).toBe(node.supplement);});
  it('普通Markdown保留一般标题、表格与代码',()=>{const md='# 示例\n\n## 条件\n\n|a|b|\n|-|-|\n|1|2|\n\n```python\nprint(1)\n```';const n=importMarkdown(md,'test.md','models');expect(n.body).toContain('## 条件');const html=renderToStaticMarkup(<Markdown>{n.body||''}</Markdown>);expect(html).toContain('<table>');expect(html).toContain('language-python');});
  it('不执行原始HTML或危险链接，公式仍可正常排版',()=>{const html=renderToStaticMarkup(<Markdown>{'<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[坏链接](javascript:alert%281%29)\n\n$x^2$\n\n$$\\frac{1}{2}$$'}</Markdown>);expect(html).not.toContain('<script');expect(html).not.toContain('onerror=');expect(html).not.toContain('href="javascript:');expect(html).toContain('katex');expect(html).toContain('katex-display');});
  it('手算最小二乘示例与残差平方和正确',()=>{const x=[1,2,3],y=[2,3,5],xb=2,yb=10/3;const slope=x.reduce((s,v,i)=>s+(v-xb)*(y[i]-yb),0)/x.reduce((s,v)=>s+(v-xb)**2,0);const intercept=yb-slope*xb;expect(slope).toBeCloseTo(1.5,12);expect(intercept).toBeCloseTo(1/3,12);expect(y.reduce((s,v,i)=>s+(v-intercept-slope*x[i])**2,0)).toBeCloseTo(1/6,12);});
});


describe('备份完整恢复与特殊Markdown',()=>{
  it('完整恢复可找回修改前内容，错误文件不能清空现有数据',async()=>{const db=makeDB();await populateDB(db);const original=await db.nodes.toArray();await db.nodes.update('least-squares',{title:'已修改'});await restoreBackup({schemaVersion:1,nodes:original},db);expect((await db.nodes.get('least-squares'))?.title).toBe('最小二乘估计');await expect(restoreBackup({schemaVersion:1,nodes:[{id:'broken',level:3,parentId:'missing',title:'无效'}]},db)).rejects.toThrow();expect(await db.nodes.count()).toBe(original.length);await restoreBackup({schemaVersion:1,nodes:[]},db);await initialize(db);expect(await db.nodes.count()).toBe(0);});
  it('代码围栏里的分节标题不会被误解析为例题或来源',()=>{const md='# 代码笔记\n\n```markdown\n## 例题 1：代码内标题\n### 解答\n## 来源\n```\n\n## 例题 1：真实例题\n题目\n### 解答\n解答';const result=importMarkdown(md,'code.md','models');expect(result.body).toContain('## 例题 1：代码内标题');expect(result.examples).toHaveLength(1);expect(result.examples?.[0].title).toBe('真实例题');expect(result.examples?.[0].solution).toBe('解答');});
  it('发布的两个JSON导入示例均有效',async()=>{const full=await import('../public/examples/course-batch.json');const incremental=await import('../public/examples/knowledge-points-batch.json');expect(validateBatch(full.default)).toHaveLength(4);expect(validateBatch(incremental.default,normalized())).toHaveLength(2);});
});
