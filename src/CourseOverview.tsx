import {useState} from 'react';
import {motion,useReducedMotion} from 'motion/react';
import {ArrowLeft,BookOpen,Compass,Plus,Search} from 'lucide-react';
import {children,countTopics,type KnowledgeNode} from './model';
import {compactTopicTitle,courseOutline,type OutlineGroup} from './outline';
import './overview.css';

type Props={nodes:KnowledgeNode[];course:KnowledgeNode;onNavigate:(id:string)=>void;onBack:()=>void;onAdd:()=>void};
function TopicNames({topics,onNavigate}:{topics:KnowledgeNode[];onNavigate:Props['onNavigate']}){
  return <ul className="outline-names">{topics.map(n=><li key={n.id}><button onClick={()=>onNavigate(n.id)} title={n.description||n.title}>{compactTopicTitle(n.title)}</button></li>)}</ul>;
}
function Branch({group,depth=0,onNavigate}:{group:OutlineGroup;depth?:number;onNavigate:Props['onNavigate']}){
  const Heading=depth===0?'h3':'h4';
  return <section className={`outline-branch outline-depth-${depth}`} aria-label={group.title}>
    <Heading>{group.title}</Heading>
    {group.topics.length>0&&<TopicNames topics={group.topics} onNavigate={onNavigate}/>}
    {group.groups.map(child=><Branch key={JSON.stringify(child.path)} group={child} depth={depth+1} onNavigate={onNavigate}/>)}
  </section>;
}
export default function CourseOverview({nodes,course,onNavigate,onBack,onAdd}:Props){
  const [query,setQuery]=useState(''),reduced=useReducedMotion();
  const chapters=courseOutline(nodes,course.id,query),ordered=children(nodes,course.id),total=countTopics(nodes,course.id);
  return <motion.section className="course-overview" initial={{opacity:0,y:reduced?0:6}} animate={{opacity:1,y:0}} transition={{duration:reduced?0:.2}}>
    <button className="back-link" onClick={onBack}><ArrowLeft size={16}/>返回课程</button>
    <header className="outline-heading"><div><span className="browse-eyebrow"><Compass size={14}/>课程总览</span><h1>{course.title}</h1></div><span className="outline-summary">{ordered.length} 章<span> / </span>{total} 个知识点</span></header>
    {ordered.length>0&&<div className="outline-toolbar"><p>章节与各层分支全部展开，直接查找。</p><label className="outline-search"><Search size={15}/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="查找章节、主题或知识点" aria-label="筛选课程总览"/></label></div>}
    <div className="outline-chapters" aria-label="完整课程目录">
      {chapters.map(({chapter,root,total,visible})=><section className="outline-chapter" key={chapter.id} aria-labelledby={`chapter-${chapter.id}`}>
        <header className="outline-chapter-heading"><span aria-hidden="true">{String(ordered.findIndex(n=>n.id===chapter.id)+1).padStart(2,'0')}</span><h2 id={`chapter-${chapter.id}`}>{chapter.title}</h2><small>{query?`${visible} / ${total}`:total} 个知识点</small></header>
        {total?<div className={`outline-groups ${root.groups.length?'is-grouped':'is-flat'}`}>
          {root.groups.map(group=><Branch key={JSON.stringify(group.path)} group={group} onNavigate={onNavigate}/>)}
          {root.topics.length>0&&<section className="outline-branch outline-ungrouped">{root.groups.length>0&&<h3>其他知识点</h3>}<TopicNames topics={root.topics} onNavigate={onNavigate}/></section>}
        </div>:<p className="outline-empty-chapter">还没有知识点</p>}
      </section>)}
    </div>
    {ordered.length===0?<div className="outline-empty"><BookOpen size={29}/><h2>从第一章开始</h2><p>添加章节后，这里会显示整门课的知识目录。</p><button className="primary-button" onClick={onAdd}><Plus size={17}/>添加章节</button></div>:!chapters.length&&<p className="outline-empty">没有找到匹配的章节、主题或知识点。</p>}
  </motion.section>;
}
