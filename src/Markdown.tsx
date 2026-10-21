import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
export function normalizeDisplayMath(text:string){let fence='';return text.split('\n').map(line=>{const marker=line.match(/^ {0,3}(`{3,}|~{3,})/);if(marker){if(!fence)fence=marker[1];else if(marker[1][0]===fence[0]&&marker[1].length>=fence.length)fence='';return line;}if(fence)return line;const math=line.match(/^ {0,3}\$\$(.+)\$\$\s*$/);return math?`$$\n${math[1]}\n$$`:line;}).join('\n');}
export function Markdown({children}:{children:string}){return <div className="markdown"><ReactMarkdown skipHtml remarkPlugins={[remarkGfm,remarkMath]} rehypePlugins={[[rehypeKatex,{trust:false,strict:'ignore',throwOnError:false,maxExpand:500,maxSize:50}]]} components={{a:({node,...props})=><a {...props} target="_blank" rel="noopener noreferrer"/>,img:({alt})=><span className="image-note">[图片：{alt||'请补充图片说明'}]</span>}}>{normalizeDisplayMath(children)}</ReactMarkdown></div>;}
