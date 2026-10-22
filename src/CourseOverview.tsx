import {useState} from 'react';
import {AnimatePresence,MotionConfig,motion,useReducedMotion} from 'motion/react';
import {ArrowLeft,ArrowUpRight,BookOpen,ChevronRight,Compass,Plus} from 'lucide-react';
import {children,countTopics,type KnowledgeNode} from './model';
import './overview.css';

type Props={nodes:KnowledgeNode[];course:KnowledgeNode;selected:string|null;onSelect:(id:string|null)=>void;onNavigate:(id:string)=>void;onBack:()=>void;onAdd:()=>void};
export default function CourseOverview({nodes,course,selected,onSelect,onNavigate,onBack,onAdd}:Props){
  const reduced=useReducedMotion(),chapters=children(nodes,course.id);
  const active=chapters.find(n=>n.id===selected),topics=active?children(nodes,active.id):[];
  const [filter,setFilter]=useState('');
  const visible=topics.filter(n=>`${n.title} ${n.description}`.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase()));
  const spring=reduced?{duration:0}:{type:'spring' as const,stiffness:260,damping:32};
  const select=(id:string|null)=>{setFilter('');onSelect(id);};
  return <MotionConfig reducedMotion="user"><section className="course-overview">
    <button className="back-link" onClick={onBack}><ArrowLeft size={16}/>返回课程</button>
    <header className="overview-heading"><div><span className="browse-eyebrow"><Compass size={15}/>课程总览</span><h1>{course.title}</h1><p>先看全貌，再走进每一个知识点。</p></div><div className="overview-count"><strong>{countTopics(nodes,course.id)}</strong><span>个知识点 · {chapters.length} 个章节</span></div></header>
    {chapters.length? <>
      <div className="overview-instruction"><span>{active?'切换章节，或收起回到全貌':'选择一章，让知识展开'}</span>{active&&<button className="text-button" onClick={()=>select(null)}>收起全部<ArrowUpRight size={15}/></button>}</div>
      <motion.div layout transition={spring} className={`overview-rail ${active?'has-selection':'is-idle'}`} aria-label="章节选择">
        {chapters.map((chapter,index)=><motion.button layout="position" transition={spring} key={chapter.id} className={`chapter-lens ${active?.id===chapter.id?'selected':''}`} aria-expanded={active?.id===chapter.id} aria-controls="overview-chapter-content" onClick={()=>select(active?.id===chapter.id?null:chapter.id)}>
          <motion.span layout="position" className="lens-number">{String(index+1).padStart(2,'0')}</motion.span><span className="lens-title">{chapter.title}<small>{children(nodes,chapter.id).length} 个知识点</small></span><ChevronRight size={18} className="lens-arrow"/>
        </motion.button>)}
      </motion.div>
      <AnimatePresence initial={false} mode="wait">
        {active&&<motion.div id="overview-chapter-content" key={active.id} className="overview-focus" initial={{opacity:0,y:reduced?0:14}} animate={{opacity:1,y:0}} exit={{opacity:0,y:reduced?0:-8}} transition={{duration:reduced?0:.24}}>
          <div className="focus-top"><span className="focus-index" aria-hidden="true">{String(chapters.indexOf(active)+1).padStart(2,'0')}</span><div><span className="browse-eyebrow">本章知识</span><h2>{active.title}</h2>{active.description&&<p>{active.description}</p>}</div><button className="soft-button" onClick={()=>onNavigate(active.id)}>进入章节<ArrowUpRight size={16}/></button></div>
          {topics.length>12&&<label className="overview-filter"><span>快速定位</span><input type="search" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="输入本章知识点名称" aria-label="筛选本章知识点"/><small>{visible.length} / {topics.length}</small></label>}
          {topics.length?<div className="overview-topics" aria-label={`${active.title}的知识点`}>
            {visible.map((topic,index)=><motion.button key={topic.id} className="overview-topic" initial={{opacity:0,y:reduced?0:7}} animate={{opacity:1,y:0}} transition={{duration:reduced?0:.23,delay:reduced?0:Math.min(index*.018,.22)}} onClick={()=>onNavigate(topic.id)}>
              <span className="topic-number">{String(topics.indexOf(topic)+1).padStart(2,'0')}</span><span className="overview-topic-copy"><strong>{topic.title}</strong><small>{topic.kind||'知识点'}{topic.examples?.length?` · ${topic.examples.length} 道例题`:''}</small></span><ArrowUpRight size={18}/>
            </motion.button>)}
            {!visible.length&&<p className="overview-empty">没有找到这个名称，试试其他关键词。</p>}
          </div>:<div className="overview-empty"><BookOpen size={28}/><p>这一章还没有知识点。</p><button className="text-button" onClick={()=>onNavigate(active.id)}>进入章节添加<ChevronRight size={16}/></button></div>}
        </motion.div>}
      </AnimatePresence>
    </>:<div className="overview-empty"><BookOpen size={32}/><h2>从第一章开始</h2><p>添加章节后，这里会展开整门课的知识目录。</p><button className="primary-button" onClick={onAdd}><Plus size={17}/>添加章节</button></div>}
  </section></MotionConfig>;
}
