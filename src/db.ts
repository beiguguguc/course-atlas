import Dexie,{type Table} from 'dexie';
import seed from './seed.json';
import {validateBatch,planMerge,type KnowledgeNode} from './model';
export class AtlasDB extends Dexie{
  nodes!:Table<KnowledgeNode,string>;meta!:Table<{key:string;value:unknown},string>;
  constructor(name='course-atlas-v1'){super(name);this.version(1).stores({nodes:'id,parentId,level,order',meta:'key'});}
}
export const db=new AtlasDB();
export async function initialize(database:AtlasDB=db){
  await database.transaction('rw',database.nodes,database.meta,async()=>{
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
        await database.meta.put({key:'before-sample-cleanup-v1',value:{schemaVersion:1,exportedAt:new Date().toISOString(),nodes:current}});
        await database.nodes.bulkDelete(removed);
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
  return database.transaction('rw',database.nodes,database.meta,async()=>{
    const current=await database.nodes.toArray();
    const parsed=validateBatch(input,current);
    const plan=planMerge(current,parsed,overwriteTopics);
    if(plan.updates.length){
      await database.meta.put({key:topicUpdateBackupKey,value:{schemaVersion:1,exportedAt:new Date().toISOString(),nodes:current}});
    }
    await database.nodes.bulkAdd(plan.additions);
    await database.nodes.bulkPut(plan.updates);
    return plan;
  });
}
export async function restoreBackup(input:unknown,database:AtlasDB=db){const parsed=validateBatch(input);return database.transaction('rw',database.nodes,database.meta,async()=>{await database.nodes.clear();await database.nodes.bulkAdd(parsed);await database.meta.put({key:'initialized',value:true});await database.meta.put({key:'recent',value:[]});return parsed;});}
