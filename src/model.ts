export type Level=0|1|2|3;
export type Example={id:string;title:string;prompt:string;solution:string};
export type KnowledgeNode={id:string;parentId:string|null;level:Level;title:string;description:string;color:string;order:number;createdAt:number;updatedAt:number;sample?:boolean;kind?:string;body?:string;examples?:Example[];sourceFile?:string;sourcePage?:string;supplement?:string;source?:string};
export type Backup={schemaVersion:1;exportedAt?:string;nodes:KnowledgeNode[];links?:import('./links').KnowledgeLink[]};
export const levelNames=['学期','课程','章节','知识点'];
export const palette=['#d5e8f1','#bbd1e7','#e2e4ed','#dfe9e5','#eae5df','#e8e2e9'];
export const uid=()=>crypto.randomUUID();
export const children=(nodes:KnowledgeNode[],id:string|null)=>nodes.filter(n=>n.parentId===id).sort((a,b)=>a.order-b.order||a.title.localeCompare(b.title,'zh-CN'));
export function trailOf(nodes:KnowledgeNode[],id:string|null){const out:KnowledgeNode[]=[];const seen=new Set<string>();let current=nodes.find(n=>n.id===id);while(current&&!seen.has(current.id)){out.unshift(current);seen.add(current.id);current=nodes.find(n=>n.id===current!.parentId);}return out;}
export function descendants(nodes:KnowledgeNode[],id:string){const found=new Set([id]);let changed=true;while(changed){changed=false;for(const n of nodes)if(n.parentId&&found.has(n.parentId)&&!found.has(n.id)){found.add(n.id);changed=true;}}return nodes.filter(n=>found.has(n.id));}
export function countTopics(nodes:KnowledgeNode[],id:string){return descendants(nodes,id).filter(n=>n.level===3).length;}
export function validateBatch(input:unknown,existing:KnowledgeNode[]=[]):KnowledgeNode[]{
  if(!input||typeof input!=='object')throw Error('请使用课程知识库 JSON 文件。');
  const data=input as Record<string,unknown>;
  if(data.schemaVersion!==1||!Array.isArray(data.nodes))throw Error('文件需要包含 schemaVersion: 1 和 nodes 数组。');
  if(data.nodes.length>10000)throw Error('单次导入最多支持 10000 条内容。');
  const ids=new Set<string>();
  const text=(value:unknown,name:string,max=100000)=>{if(typeof value!=='string'||value.length>max)throw Error(`${name}必须是长度不超过 ${max} 的文字。`);return value;};
  const parsed=data.nodes.map((raw:unknown):KnowledgeNode=>{
    if(!raw||typeof raw!=='object')throw Error('每条内容都需要是一个对象。');const n=raw as Record<string,unknown>;
    const id=text(n.id,'id',120);if(!/^[\w-]+$/.test(id)||ids.has(id))throw Error(`内容 ID 无效或在文件中重复：${id}`);ids.add(id);
    if(!Number.isInteger(n.level)||Number(n.level)<0||Number(n.level)>3)throw Error(`${id} 的 level 必须为 0、1、2 或 3。`);
    const title=text(n.title,'标题',100).trim();if(!title)throw Error('内容标题不能为空。');
    const parentId=n.parentId===null?null:text(n.parentId,'parentId',120);const level=n.level as Level;
    if(level===0&&parentId!==null||level>0&&parentId===null)throw Error(`${title} 的上级层级不正确。`);
    const result:KnowledgeNode={id,parentId,level,title,description:text(n.description??'','简介',600),color:typeof n.color==='string'&&/^#[0-9a-f]{6}$/i.test(n.color)?n.color:'#d5e8f1',order:Number.isFinite(n.order)?Number(n.order):0,createdAt:Number.isFinite(n.createdAt)?Number(n.createdAt):Date.now(),updatedAt:Number.isFinite(n.updatedAt)?Number(n.updatedAt):Date.now(),sample:n.sample===true};
    if(level===3){result.kind=text(n.kind??'概念','分类',30);result.body=text(n.body??'','正文');result.sourceFile=text(n.sourceFile??'','来源文件',500);result.sourcePage=text(n.sourcePage??'','页码',100);result.supplement=text(n.supplement??'','补充说明');result.source=typeof n.source==='string'&&/^https?:\/\//i.test(n.source)?n.source:'';
      if(!Array.isArray(n.examples??[])||((n.examples??[]) as unknown[]).length>100)throw Error('examples 需要为数组，最多 100 道例题。');
      const exampleIds=new Set<string>();result.examples=((n.examples??[]) as Record<string,unknown>[]).map((e,i)=>{if(!e||typeof e!=='object')throw Error('例题格式不正确。');const exampleId=typeof e.id==='string'?text(e.id,'例题编号',120):`${id}-example-${i}`;if(!exampleId||exampleIds.has(exampleId))throw Error('同一知识点中的例题编号不能为空或重复。');exampleIds.add(exampleId);return {id:exampleId,title:text(e.title??`例题 ${i+1}`,'例题标题',100),prompt:text(e.prompt??'','例题题目'),solution:text(e.solution??'','例题解答')};});
    }return result;
  });
  const map=new Map(existing.map(n=>[n.id,n]));
  for(const n of parsed){const old=map.get(n.id);if(old&&(old.level!==n.level||old.parentId!==n.parentId))throw Error(`已有 ID「${n.id}」对应另一个层级或上级，请为新内容换一个 ID。`);if(!old)map.set(n.id,n);}
  for(const n of parsed)if(n.parentId){const parent=map.get(n.parentId);if(!parent||parent.level!==n.level-1)throw Error(`「${n.title}」找不到正确的上级。请一并导入上级，或使用已有上级的 ID。`);}
  return parsed;
}
function topicContent(node:KnowledgeNode){
  return JSON.stringify([node.title,node.description,node.color,node.order,node.sample===true,node.kind??'概念',node.body??'',
    (node.examples??[]).map(e=>[e.id,e.title,e.prompt,e.solution]),node.sourceFile??'',node.sourcePage??'',node.supplement??'',node.source??'']);
}
export function planMerge(existing:KnowledgeNode[],incoming:KnowledgeNode[],overwriteTopics=false){
  const byId=new Map(existing.map(n=>[n.id,n]));
  const additions:KnowledgeNode[]=[],updates:KnowledgeNode[]=[];
  let skipped=0;
  for(const node of incoming){
    const old=byId.get(node.id);
    if(!old)additions.push(node);
    else if(overwriteTopics&&old.level===3&&node.level===3&&topicContent(old)!==topicContent(node)){
      updates.push({...node,createdAt:old.createdAt,updatedAt:Math.max(Date.now(),old.updatedAt+1)});
    }else skipped++;
  }
  const replacements=new Map(updates.map(n=>[n.id,n]));
  return {additions,updates,skipped,nodes:[...existing.map(n=>replacements.get(n.id)??n),...additions]};
}
export function exportMarkdown(n:KnowledgeNode){const parts=[`# ${n.title}`];if(n.description)parts.push(`> ${n.description}`);parts.push('## 定理与一般形式',n.body||'');for(const [i,e] of (n.examples||[]).entries())parts.push(`## 例题 ${i+1}：${e.title}`,e.prompt,'### 解答',e.solution);if(n.sourceFile||n.sourcePage)parts.push('## 来源',`来源文件：${n.sourceFile||'未填写'}\n\n页码：${n.sourcePage||'未填写'}`);if(n.supplement)parts.push('## 补充说明',n.supplement);return parts.join('\n\n')+'\n';}
export function importMarkdown(content:string,filename:string,parentId:string):KnowledgeNode{
  const lines=content.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').split('\n');let title=filename.replace(/\.md$/i,'');const first=lines.findIndex(l=>l.trim());if(first>=0&&/^#\s+/.test(lines[first])){title=lines[first].replace(/^#\s+/,'').trim();lines.splice(first,1);}
  let mode:'body'|'prompt'|'solution'|'source'|'supplement'='body';const body:string[]=[],supplement:string[]=[],source:string[]=[];const examples:Example[]=[];let current:Example|undefined;let description='',fence='';
  for(const line of lines){const marker=line.match(/^ {0,3}(`{3,}|~{3,})/);const inCode=!!fence||!!marker;if(marker){if(!fence)fence=marker[1];else if(marker[1][0]===fence[0]&&marker[1].length>=fence.length)fence='';}if(!inCode){if(/^##\s+(定理与一般形式|一般形式|定理|正文)\s*$/.test(line)){mode='body';continue;}
    const example=line.match(/^##\s+例题(?:\s*\d+)?(?:[：:]\s*(.*))?\s*$/);if(example){current={id:uid(),title:example[1]||`例题 ${examples.length+1}`,prompt:'',solution:''};examples.push(current);mode='prompt';continue;}
    if(/^###\s+解答\s*$/.test(line)&&current){mode='solution';continue;}if(/^##\s+来源\s*$/.test(line)){mode='source';continue;}if(/^##\s+补充说明\s*$/.test(line)){mode='supplement';continue;}
    if(!description&&mode==='body'&&/^>\s+/.test(line)&&!body.some(x=>x.trim())){description=line.replace(/^>\s+/,'');continue;}}
    if(mode==='body')body.push(line);else if(mode==='supplement')supplement.push(line);else if(mode==='source')source.push(line);else if(current)current[mode==='prompt'?'prompt':'solution']+=line+'\n';
  }
  for(const e of examples){e.prompt=e.prompt.trim();e.solution=e.solution.trim();}
  return {id:uid(),parentId,level:3,title:title.slice(0,100)||'未命名知识点',description:description.slice(0,600),body:body.join('\n').trim(),kind:'笔记',examples,color:'#d5e8f1',order:Date.now(),createdAt:Date.now(),updatedAt:Date.now(),sourceFile:source.join('\n').match(/来源文件：[ \t]*(.+)/)?.[1]||filename,sourcePage:source.join('\n').match(/页码：[ \t]*(.+)/)?.[1]||'',supplement:supplement.join('\n').trim()};
}
