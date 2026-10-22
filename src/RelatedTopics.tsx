import {useState} from 'react';
import {ArrowUpRight,Check,Link2,Pencil,Plus,Search,Unlink,X} from 'lucide-react';
import {Modal} from './Modal';
import {relatedTopics,type KnowledgeLink} from './links';
import {trailOf,type KnowledgeNode} from './model';
import './relations.css';

type Props={nodes:KnowledgeNode[];current:KnowledgeNode;links:KnowledgeLink[];onNavigate:(id:string)=>void;onSave:(target:string,note:string)=>Promise<void>;onRemove:(id:string)=>Promise<void>};
export default function RelatedTopics({nodes,current,links,onNavigate,onSave,onRemove}:Props){
  const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[target,setTarget]=useState<KnowledgeNode|null>(null),[note,setNote]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[course,setCourse]=useState('');
  const related=relatedTopics(links,nodes,current.id),existing=new Set(related.map(r=>r.node.id));
  const context=(node:KnowledgeNode)=>trailOf(nodes,node.id).slice(0,-1).map(n=>n.title).join(' / ');
  const topics=nodes.filter(n=>n.level===3&&n.id!==current.id&&!existing.has(n.id));
  const courses=nodes.filter(n=>n.level===1).sort((a,b)=>a.title.localeCompare(b.title,'zh-CN'));
  const results=topics.filter(n=>(!course||trailOf(nodes,n.id)[1]?.id===course)&&`${context(n)} ${n.title} ${n.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a,b)=>a.title.localeCompare(b.title,'zh-CN'));
  const start=(node?:KnowledgeNode,link?:KnowledgeLink)=>{setQuery('');setCourse('');setTarget(node??null);setNote(link?.note??'');setError('');setOpen(true);};
  const save=async()=>{if(!target||busy)return;setBusy(true);setError('');try{await onSave(target.id,note);setOpen(false);}catch(e){setError(e instanceof Error?e.message:'保存失败，请重试。');}finally{setBusy(false);}};
  const remove=async(id:string)=>{if(busy)return;setBusy(true);try{await onRemove(id);}catch(e){setError(e instanceof Error?e.message:'移除失败，请重试。');}finally{setBusy(false);}};
  return <section className="related-section" aria-label="关联知识点">
    <div className="related-heading"><div><span className="browse-eyebrow"><Link2 size={15}/>让知识连起来</span><h2>关联知识点{related.length>0&&<span>{related.length}</span>}</h2></div><button className="soft-button" onClick={()=>start()}><Plus size={16}/>添加关联</button></div>
    {related.length?<div className="related-list">{related.map(({link,node})=><div className="related-item" key={link.id}><button className="related-open" onClick={()=>onNavigate(node.id)}><span className="related-mark"><Link2 size={19}/></span><span><strong>{node.title}</strong><small>{context(node)}</small>{link.note&&<p>{link.note}</p>}</span><ArrowUpRight size={18}/></button><div className="related-actions"><button className="icon-button" onClick={()=>start(node,link)} aria-label={`编辑与${node.title}的关联`} disabled={busy}><Pencil size={15}/></button><button className="icon-button" onClick={()=>void remove(link.id)} aria-label={`移除与${node.title}的关联`} disabled={busy}><Unlink size={16}/></button></div></div>)}</div>:<p className="related-empty">遇到相似的定理、相通的方法？把它们连在这里。<br/>支持跨课程关联，建立一次，两边都能跳转。</p>}
    {error&&!open&&<p className="error-message" role="alert">{error}</p>}
    {open&&<Modal title={target&&existing.has(target.id)?'编辑知识点关联':'添加知识点关联'} onClose={()=>!busy&&setOpen(false)}>
      <div className="modal-body relation-modal-body"><p className="muted">连接「{current.title}」与另一个知识点，关联会同时出现在两边。</p>
        {target?<div className="chosen-topic"><span className="related-mark"><Check size={20}/></span><span><strong>{target.title}</strong><small>{context(target)}</small></span>{!existing.has(target.id)&&<button className="icon-button" onClick={()=>setTarget(null)} aria-label="重新选择知识点"><X size={18}/></button>}</div>:<>
          <label className="search-input"><Search size={18}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索知识点、课程或章节" aria-label="搜索关联知识点"/></label>
          <label className="relation-course-filter">课程范围<select value={course} onChange={e=>setCourse(e.target.value)}><option value="">全部课程</option>{courses.map(n=><option value={n.id} key={n.id}>{n.title} · {trailOf(nodes,n.id)[0]?.title}</option>)}</select></label>
          <div className="relation-options" aria-label="可关联的知识点">{results.slice(0,40).map(n=><button key={n.id} onClick={()=>setTarget(n)}><span><strong>{n.title}</strong><small>{context(n)}</small></span><Plus size={17}/></button>)}{!results.length&&<p className="muted">{topics.length?'没有找到匹配的知识点。':'暂时没有其他可关联的知识点，先在课程中添加内容。'}</p>}</div>
          {results.length>40&&<p className="relation-hint">显示前 40 项，输入名称或选择课程可缩小范围。</p>}
        </>}
        {target&&<label className="relation-note">关联说明 <span>可选</span><textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={600} rows={3} placeholder="例如：这个定理在另一门课中的应用"/><small>{note.length} / 600</small></label>}
        {error&&<p className="error-message" role="alert">{error}</p>}
      </div><div className="modal-footer"><button className="soft-button" onClick={()=>setOpen(false)} disabled={busy}>取消</button><button className="primary-button" onClick={()=>void save()} disabled={!target||busy}>{busy?'正在保存…':'保存关联'}</button></div>
    </Modal>}
  </section>;
}
