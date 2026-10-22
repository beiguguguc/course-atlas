import type {KnowledgeNode} from './model';

export type KnowledgeLink={id:string;fromId:string;toId:string;note:string;createdAt:number;updatedAt:number};
// Node IDs cannot contain a colon, so this key is unique in either direction.
export function linkKey(a:string,b:string){return [a,b].sort().join('::');}
export function validateLinks(input:unknown,nodes:KnowledgeNode[]):KnowledgeLink[]{
  const raw=(input as {links?:unknown})?.links;
  if(raw===undefined)return [];
  if(!Array.isArray(raw)||raw.length>20000)throw Error('links 需要为数组，最多 20000 个关联。');
  const topics=new Set(nodes.filter(n=>n.level===3).map(n=>n.id)),seen=new Set<string>();
  return raw.map(value=>{
    if(!value||typeof value!=='object')throw Error('知识点关联格式不正确。');
    const link=value as Record<string,unknown>;
    if(typeof link.fromId!=='string'||typeof link.toId!=='string'||!topics.has(link.fromId)||!topics.has(link.toId))throw Error('关联的两端必须是已有或本次导入的知识点。');
    if(link.fromId===link.toId)throw Error('知识点不能关联自己。');
    const [fromId,toId]=[link.fromId,link.toId].sort(),id=linkKey(fromId,toId);
    if(seen.has(id))throw Error('文件中存在重复的知识点关联。');
    seen.add(id);
    if(typeof (link.note??'')!=='string'||String(link.note??'').length>600)throw Error('关联说明最多 600 字。');
    return {id,fromId,toId,note:String(link.note??'').trim(),createdAt:Number.isFinite(link.createdAt)?Number(link.createdAt):Date.now(),updatedAt:Number.isFinite(link.updatedAt)?Number(link.updatedAt):Date.now()};
  });
}
export function relatedTopics(links:KnowledgeLink[],nodes:KnowledgeNode[],id:string){
  const byId=new Map(nodes.filter(n=>n.level===3).map(n=>[n.id,n]));
  return links.filter(l=>l.fromId===id||l.toId===id).flatMap(link=>{
    const node=byId.get(link.fromId===id?link.toId:link.fromId);
    return node?[{link,node}]:[];
  }).sort((a,b)=>a.node.title.localeCompare(b.node.title,'zh-CN'));
}
