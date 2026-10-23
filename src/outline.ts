import {children,type KnowledgeNode} from './model';

export type OutlineGroup={title:string;path:string[];groups:OutlineGroup[];topics:KnowledgeNode[]};
export type ChapterOutline={chapter:KnowledgeNode;root:OutlineGroup;total:number;visible:number};
export function validateOutlinePath(value:unknown):string[]{
  if(!Array.isArray(value)||value.length>5)throw Error('目录分组需要为数组，最多 5 层。');
  return value.map(label=>{
    if(typeof label!=='string'||!label.trim()||label.trim().length>80)throw Error('每层目录分组需要为 1–80 字的名称。');
    return label.trim();
  });
}
/** Explicit metadata only: grouping never guesses meaning from a topic title. */
export function planOutline(input:unknown,nodes:KnowledgeNode[]){
  const raw=(input as {outlineUpdates?:unknown})?.outlineUpdates;
  if(raw===undefined)return {nodes,updates:[] as KnowledgeNode[]};
  if(!Array.isArray(raw)||raw.length>10000)throw Error('outlineUpdates 需要为数组，最多 10000 条。');
  const byId=new Map(nodes.map(n=>[n.id,n])),seen=new Set<string>(),updates:KnowledgeNode[]=[];
  for(const entry of raw){
    if(!entry||typeof entry!=='object')throw Error('目录分组更新格式不正确。');
    const item=entry as Record<string,unknown>,node=typeof item.id==='string'?byId.get(item.id):undefined;
    if(!node||node.level!==3)throw Error(`目录分组找不到对应知识点：${String(item.id)}`);
    if(seen.has(node.id))throw Error('目录分组文件中有重复的知识点编号。');
    seen.add(node.id);
    const outlinePath=validateOutlinePath(item.outlinePath);
    if(JSON.stringify(node.outlinePath??[])!==JSON.stringify(outlinePath))updates.push({...node,outlinePath,updatedAt:Math.max(Date.now(),node.updatedAt+1)});
  }
  const replacements=new Map(updates.map(n=>[n.id,n]));
  return {nodes:nodes.map(n=>replacements.get(n.id)??n),updates};
}
function makeGroup(title='',path:string[]=[]):OutlineGroup{return {title,path,groups:[],topics:[]};}
export function groupTopics(topics:KnowledgeNode[]):OutlineGroup{
  const root=makeGroup(),groups=new Map<string,OutlineGroup>();
  for(const topic of topics){
    let parent=root;
    for(const [i,title] of (topic.outlinePath??[]).entries()){
      const path=topic.outlinePath!.slice(0,i+1),key=JSON.stringify(path);
      let group=groups.get(key);
      if(!group){group=makeGroup(title,path);groups.set(key,group);parent.groups.push(group);}
      parent=group;
    }
    parent.topics.push(topic);
  }
  return root;
}
function topicCount(group:OutlineGroup):number{return group.topics.length+group.groups.reduce((sum,g)=>sum+topicCount(g),0);}
function filterGroup(group:OutlineGroup,query:string,inherited=false):OutlineGroup{
  const matched=inherited||group.title.toLocaleLowerCase().includes(query);
  return {...group,topics:group.topics.filter(n=>matched||`${n.title} ${n.description}`.toLocaleLowerCase().includes(query)),groups:group.groups.map(g=>filterGroup(g,query,matched)).filter(g=>topicCount(g)>0)};
}
export function courseOutline(nodes:KnowledgeNode[],courseId:string,query=''):ChapterOutline[]{
  const search=query.trim().toLocaleLowerCase();
  return children(nodes,courseId).map(chapter=>{
    const topics=children(nodes,chapter.id),root=groupTopics(topics);
    const filtered=search?filterGroup(root,search,chapter.title.toLocaleLowerCase().includes(search)):root;
    return {chapter,root:filtered,total:topics.length,visible:topicCount(filtered)};
  }).filter(item=>!search||item.visible>0||item.chapter.title.toLocaleLowerCase().includes(search));
}
export function compactTopicTitle(title:string){return title.replace(/^\d+(?:\.\d+)+\s+/,'');}
