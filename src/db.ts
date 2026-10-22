import Dexie,{type Table} from 'dexie';
import seed from './seed.json';
import {validateBatch,planMerge,descendants,type Backup,type KnowledgeNode} from './model';
import {linkKey,validateLinks,type KnowledgeLink} from './links';
export class AtlasDB extends Dexie{
  nodes!:Table<KnowledgeNode,string>;meta!:Table<{key:string;value:unknown},string>;links!:Table<KnowledgeLink,string>;
  constructor(name='course-atlas-v1'){super(name);this.version(1).stores({nodes:'id,parentId,level,order',meta:'key'});this.version(2).stores({links:'id,fromId,toId'});}
}
export const db=new AtlasDB();
export async function initialize(database:AtlasDB=db){
  await database.transaction('rw',database.nodes,database.meta,database.links,async()=>{
    if(!await database.meta.get('initialized')){
      await database.nodes.bulkPut(validateBatch({schemaVersion:1,nodes:seed}));
      await database.meta.put({key:'initialized',value:true});
    }
    if(!await database.meta.get('preloaded-samples-cleared-v1')){
      const current=await database.nodes.toArray();
      const byId=new Map(current.map(n=>[n.id,n]));
      // Keep personal notes and the ancestors required to reach them.
      const keep=new Set<string>();
      for(const node of current.filter(n=>!n.sample)){
        let item:KnowledgeNode|undefined=node;
        while(item&&!keep.has(item.id)){keep.add(item.id);item=item.parentId?byId.get(item.parentId):undefined;}
      }
      const removed=current.filter(n=>n.sample&&!keep.has(n.id)).map(n=>n.id);
      if(removed.length){
        await database.meta.put({key:'before-sample-cleanup-v1',value:{schemaVersion:1,exportedAt:new Date().toISOString(),nodes:current,links:await database.links.toArray()}});
        await database.nodes.bulkDelete(removed);
        await database.links.filter(l=>removed.includes(l.fromId)||removed.includes(l.toId)).delete();
        const recent=(await database.meta.get('recent'))?.value;
        await database.meta.put({key:'recent',value:Array.isArray(recent)?recent.filter(id=>!removed.includes(id)):[]});
      }
      await database.meta.put({key:'preloaded-samples-cleared-v1',value:true});
    }
  });
  return database.nodes.toArray();
}
export const topicUpdateBackupKey='before-topic-update-import-v1';
export async function mergeBatch(input:unknown,database:AtlasDB=db,overwriteTopics=false){
  return database.transaction('rw',database.nodes,database.meta,database.links,async()=>{
    const current=await database.nodes.toArray();
    const links=await database.links.toArray();
    const parsed=validateBatch(input,current);
    const plan=planMerge(current,parsed,overwriteTopics);
    const incomingLinks=validateLinks(input,plan.nodes),existingLinks=new Set(links.map(l=>l.id));
    const addedLinks=incomingLinks.filter(l=>!existingLinks.has(l.id));
    if(plan.updates.length){
      await database.meta.put({key:topicUpdateBackupKey,value:{schemaVersion:1,exportedAt:new Date().toISOString(),nodes:current,links}});
    }
    await database.nodes.bulkAdd(plan.additions);
    await database.nodes.bulkPut(plan.updates);
    await database.links.bulkAdd(addedLinks);
    return {...plan,addedLinks,links:[...links,...addedLinks]};
  });
}
export async function restoreBackup(input:unknown,database:AtlasDB=db){const parsed=validateBatch(input),links=validateLinks(input,parsed);return database.transaction('rw',database.nodes,database.meta,database.links,async()=>{await database.nodes.clear();await database.nodes.bulkAdd(parsed);await database.links.clear();await database.links.bulkAdd(links);await database.meta.put({key:'initialized',value:true});await database.meta.put({key:'recent',value:[]});return parsed;});}
export async function exportBackup(database:AtlasDB=db):Promise<Backup>{
  return database.transaction('r',database.nodes,database.links,async()=>({schemaVersion:1,exportedAt:new Date().toISOString(),nodes:await database.nodes.toArray(),links:await database.links.toArray()}));
}
export async function saveLink(fromId:string,toId:string,note:string,database:AtlasDB=db){
  return database.transaction('rw',database.nodes,database.links,async()=>{
    const id=linkKey(fromId,toId),old=await database.links.get(id),now=Date.now();
    const [checked]=validateLinks({links:[{fromId,toId,note,createdAt:old?.createdAt??now,updatedAt:now}]},await database.nodes.toArray());
    await database.links.put(checked);
    return database.links.toArray();
  });
}
export async function deleteBranch(id:string,database:AtlasDB=db){
  return database.transaction('rw',database.nodes,database.links,database.meta,async()=>{
    const ids=new Set(descendants(await database.nodes.toArray(),id).map(n=>n.id));
    await database.links.filter(l=>ids.has(l.fromId)||ids.has(l.toId)).delete();
    await database.nodes.bulkDelete([...ids]);
    const recent=(await database.meta.get('recent'))?.value;
    if(Array.isArray(recent))await database.meta.put({key:'recent',value:recent.filter(x=>!ids.has(x))});
    return {nodes:await database.nodes.toArray(),links:await database.links.toArray(),removed:ids};
  });
}
