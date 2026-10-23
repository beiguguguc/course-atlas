import {Children,isValidElement,useEffect,useRef,useState,type ReactNode} from 'react';
import {Check,Copy,Download} from 'lucide-react';
import {Modal} from './Modal';
import {Markdown} from './Markdown';
import guide from './content/user-guide.md?raw';
import './guide.css';

function plainText(value:ReactNode):string{
  return Children.toArray(value).map(child=>typeof child==='string'||typeof child==='number'?String(child):isValidElement<{children?:ReactNode}>(child)?plainText(child.props.children):'').join('');
}
function headings(text:string){
  let fence='';const sections:{id:string;title:string}[]=[];
  for(const line of text.replace(/\r\n?/g,'\n').split('\n')){
    const marker=line.match(/^ {0,3}(`{3,}|~{3,})/);
    if(marker){if(!fence)fence=marker[1];else if(marker[1][0]===fence[0]&&marker[1].length>=fence.length)fence='';continue;}
    const heading=!fence&&line.match(/^## (.+)$/);
    if(heading)sections.push({id:`guide-section-${sections.length+1}`,title:heading[1]});
  }
  return sections;
}
const sections=headings(guide);
const guideImageRoot='https://beiguguguc.github.io/course-atlas/docs/images/';
const guideImages:Record<string,{width:number;height:number}>={
  'guide-import.jpg':{width:600,height:680},
  'guide-overview.jpg':{width:1265,height:940},
  'guide-example.jpg':{width:1265,height:1178},
};
function imageSource(src:string|undefined){
  if(!src?.startsWith(guideImageRoot))return undefined;
  const name=src.slice(guideImageRoot.length);
  return Object.hasOwn(guideImages,name)?{src:`${import.meta.env.BASE_URL}docs/images/${name}`,...guideImages[name]}:undefined;
}
function CopyBlock({children}:{children:ReactNode}){
  const [state,setState]=useState<'idle'|'copied'|'error'>('idle');
  useEffect(()=>{if(state!=='copied')return;const timer=setTimeout(()=>setState('idle'),2500);return()=>clearTimeout(timer);},[state]);
  const code=Children.toArray(children).find(child=>isValidElement(child));
  const language=isValidElement<{className?:string}>(code)?code.props.className?.replace('language-',''):'';
  const label=language==='text'?'提示词':language==='json'?'JSON':language==='markdown'?'Markdown':'内容';
  const copy=async()=>{try{await navigator.clipboard.writeText(plainText(children).replace(/\n$/,''));setState('copied');}catch{setState('error');}};
  return <div className="guide-code-block"><div className="guide-code-toolbar"><span>{language==='text'?'可复制的 AI 提示词':`${label} 示例`}</span><button type="button" onClick={()=>void copy()} aria-label={`复制${label}`}>{state==='copied'?<Check size={14}/>:<Copy size={14}/>}<span>{state==='copied'?'已复制':`复制${label}`}</span></button></div><pre>{children}</pre>{state==='error'&&<p className="guide-copy-status" role="status">浏览器未允许复制，请选中文本后手动复制。</p>}<span className="sr-only" role="status">{state==='copied'?'复制成功':''}</span></div>;
}
export default function GuideModal({onClose}:{onClose:()=>void}){
  const content=useRef<HTMLDivElement>(null);
  const jump=(id:string)=>{const panel=content.current,heading=panel?.querySelector<HTMLElement>(`#${id}`);if(!panel||!heading)return;const top=heading.getBoundingClientRect().top-panel.getBoundingClientRect().top+panel.scrollTop-20;panel.scrollTo({top:Math.max(0,top),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});heading.focus({preventScroll:true});};
  const download=()=>{const url=URL.createObjectURL(new Blob([guide],{type:'text/markdown;charset=utf-8'}));const anchor=document.createElement('a');anchor.href=url;anchor.download='知序-使用教程与说明.md';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),2000);};
  return <Modal title="使用教程与说明" className="guide-modal" wide onClose={onClose}>
    <div className="guide-tools"><p>也可以下载整份教程，交给 AI 阅读并协助整理。</p><button className="soft-button" onClick={download}><Download size={16}/><span>下载 Markdown</span></button></div>
    <div className="guide-layout"><nav className="guide-toc" aria-label="使用教程目录"><span className="guide-toc-label">阅读目录</span>{sections.map(section=><button key={section.id} onClick={()=>jump(section.id)}>{section.title}</button>)}</nav>
      <div className="guide-content" ref={content} tabIndex={0} aria-label="使用教程正文"><Markdown components={{h2:({children})=><h2 id={sections.find(s=>s.title===plainText(children))?.id} tabIndex={-1}>{children}</h2>,pre:({children})=><CopyBlock>{children}</CopyBlock>,img:({src,alt,title})=>{const local=imageSource(src);return local?<span className="guide-figure"><a href={local.src} target="_blank" rel="noopener noreferrer" aria-label={`查看大图：${alt||'界面示例'}`}><img {...local} alt={alt||'界面示例'} loading="lazy" decoding="async"/></a><span className="guide-caption">{title||alt} <span>点击图片查看大图</span></span></span>:<span className="image-note">[图片：{alt||'界面示例'}]</span>;}}}>{guide}</Markdown></div>
    </div><div className="modal-footer"><span>内容保存在你的浏览器，换设备前记得导出备份。</span><button className="primary-button" onClick={onClose}>开始使用</button></div>
  </Modal>;
}
