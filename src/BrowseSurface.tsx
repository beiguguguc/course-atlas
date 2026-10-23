import type {ReactNode} from 'react';
import {AnimatePresence,LayoutGroup,MotionConfig,motion,useReducedMotion} from 'motion/react';
import {ArrowLeft,ArrowUpRight,BookMarked,BookOpen,ChevronRight,FileText,Layers3,Plus,Upload} from 'lucide-react';
import {children,countTopics,levelNames,type KnowledgeNode,type Level} from './model';
import './overview.css';

type Props={
  nodes:KnowledgeNode[];
  current?:KnowledgeNode;
  onNavigate:(id:string|null)=>void;
  onAdd:()=>void;
  onImportMarkdown:()=>void;
  onOverview:()=>void;
  renderMenu:(node:KnowledgeNode)=>ReactNode;
  onSettled:(id:string|null)=>void;
};
const icons=[Layers3,BookOpen,BookMarked,FileText];
const headings=['你的学期','这学期的课程','课程章节','章节知识点'];

export default function BrowseSurface({nodes,current,onNavigate,onAdd,onImportMarkdown,onOverview,renderMenu,onSettled}:Props){
  const reduced=useReducedMotion();
  const level=(current?Math.min(current.level+1,3):0) as Level;
  const items=children(nodes,current?.id||null);
  const spring=reduced?{duration:0}:{type:'spring' as const,stiffness:290,damping:34,mass:0.9};
  const fade={duration:reduced?0:0.18};
  const shared={layout:spring,opacity:fade};
  const currentIcon=current?icons[current.level]:Layers3;
  const CurrentIcon=currentIcon;
  const summary=(node:KnowledgeNode)=>{
    if(node.level===3)return node.examples?.length?`${node.examples.length} 道例题`:'概念与公式';
    const direct=children(nodes,node.id).length;
    return `${direct} 个${levelNames[node.level+1]}${node.level<2?` · ${countTopics(nodes,node.id)} 个知识点`:''}`;
  };
  const empty=<div className="empty-library">
    <div className="empty-pages" aria-hidden="true"><i/><i/><span><Layers3 size={35}/></span></div>
    <h2>从第一个{levelNames[level]}开始</h2>
    <p>{level===0?'把这一学期的课程与理解，慢慢放进来。':level===3?'记录一个概念、一条公式，或导入 Markdown 笔记。':`添加${levelNames[level]}，继续整理这一层的知识。`}</p>
    <button className="primary-button" onClick={onAdd}><Plus size={18}/>添加{levelNames[level]}</button>
  </div>;

  return <MotionConfig reducedMotion="user"><LayoutGroup id="study-navigation"><div className="browse-stage">
    <AnimatePresence initial={false} mode="popLayout">
      {!current?<motion.section key="library-home" className="library-home" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={fade}>
        <header className="library-heading">
          <div><span className="browse-eyebrow">你的学习空间</span><h1>我的<span>知识库</span></h1><p>从一个学期出发，让知识逐渐连起来。</p></div>
          {items.length>0&&<button className="primary-button" onClick={onAdd}><Plus size={18}/>添加学期</button>}
        </header>
        {items.length>0?<>
          <div className="browse-section-heading"><h2>所有学期</h2><span>{items.length} 个学期</span></div>
          <div className="semester-shelf">
            {items.map((node,index)=><motion.article className="semester-cover" key={node.id} layoutId={`surface-${node.id}`} transition={shared} onLayoutAnimationComplete={()=>onSettled(null)} style={{borderRadius:30}} whileHover={reduced?undefined:{y:-4}}>
              <button className="semester-open" onClick={()=>onNavigate(node.id)} aria-label={`打开学期：${node.title}`}>
                <div className="cover-top"><motion.span className="browse-node-icon" layoutId={`icon-${node.id}`} transition={spring}><Layers3 size={23}/></motion.span><span className="cover-index">学期 {String(index+1).padStart(2,'0')}</span></div>
                <div className="cover-illustration" aria-hidden="true"><i/><i/><i/><span/></div>
                <div className="cover-copy"><motion.h2 layoutId={`title-${node.id}`} layout="position" transition={spring}>{node.title}</motion.h2><p>{node.description||'在这里，整理这一学期的知识。'}</p></div>
                <div className="cover-bottom"><span>{summary(node)}</span><span className="cover-arrow"><ArrowUpRight size={20}/></span></div>
              </button>
              {renderMenu(node)}
            </motion.article>)}
          </div>
          <button className="browse-add" onClick={onAdd}><span><Plus size={18}/></span>新建一个学期</button>
        </>:empty}
      </motion.section>:<motion.section key={current.id} className={`study-surface study-level-${current.level}`} layoutId={`surface-${current.id}`} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={shared} onLayoutAnimationComplete={()=>onSettled(current.id)} style={{borderRadius:30}}>
        <motion.header layout className="surface-heading">
          <button className="surface-back" onClick={()=>onNavigate(current.parentId)}><ArrowLeft size={17}/><span>返回{current.level===0?'知识库':levelNames[current.level-1]}</span></button>
          <div className="surface-label"><motion.span className="browse-node-icon" layoutId={`icon-${current.id}`} transition={spring}><CurrentIcon size={23}/></motion.span><span>{levelNames[current.level]}</span></div>
          <div className="surface-title-row"><motion.h1 layoutId={`title-${current.id}`} layout="position" transition={spring}>{current.title}</motion.h1><div className="surface-actions">
            {current.level===2&&<button className="soft-button" onClick={onImportMarkdown}><Upload size={16}/><span>导入 Markdown</span></button>}
            <button className="primary-button" onClick={onAdd}><Plus size={17}/>添加{levelNames[level]}</button>{renderMenu(current)}
          </div></div>
          <p className="surface-description">{current.description||`从这里，继续探索${levelNames[level]}中的知识。`}</p>
          <div className="surface-stats"><span>{items.length} 个{levelNames[level]}</span>{current.level<2&&<><i/><span>{countTopics(nodes,current.id)} 个知识点</span></>}</div>
        </motion.header>
        <motion.div layout className="directory-content" initial={{opacity:0,y:reduced?0:12}} animate={{opacity:1,y:0}} transition={{duration:reduced?0:0.25,delay:reduced?0:0.16}}>
          {current.level===1&&<button className="overview-entry" onClick={onOverview}><span className="overview-symbol" aria-hidden="true"><i/><i/><i/></span><span><strong>课程总览</strong><small>一眼查看各章与知识分支</small></span><ArrowUpRight size={22}/></button>}
          {items.length>0?<>
            <div className="browse-section-heading"><h2>{headings[level]}</h2><span>选择{levelNames[level]}，继续深入</span></div>
            <div className="course-directory">
              {items.map((node,index)=>{
                const Icon=icons[node.level];
                return <motion.article className={`directory-entry directory-level-${node.level}`} key={node.id} layoutId={`surface-${node.id}`} transition={shared} style={{borderRadius:22}} whileHover={reduced?undefined:{x:3}}>
                  <button className="directory-open" onClick={()=>onNavigate(node.id)} aria-label={`打开${levelNames[node.level]}：${node.title}`}>
                    <motion.span className="browse-node-icon" layoutId={`icon-${node.id}`} transition={spring}><Icon size={23}/></motion.span>
                    <span className="directory-copy"><span className="directory-label">{node.level===3?node.kind||'知识点':`${levelNames[node.level]} ${String(index+1).padStart(2,'0')}`}</span><motion.h2 layoutId={`title-${node.id}`} layout="position" transition={spring}>{node.title}</motion.h2>{node.description&&<span className="directory-description">{node.description}</span>}</span>
                    <span className="directory-trailing"><span>{summary(node)}</span><ChevronRight size={21}/></span>
                  </button>{renderMenu(node)}
                </motion.article>;
              })}
            </div>
            <button className="browse-add" onClick={onAdd}><span><Plus size={18}/></span>添加{levelNames[level]}</button>
          </>:empty}
        </motion.div>
      </motion.section>}
    </AnimatePresence>
  </div></LayoutGroup></MotionConfig>;
}
