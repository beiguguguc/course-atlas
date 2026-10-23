import ReactMarkdown,{defaultUrlTransform,type Components} from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import EmbeddedImage,{isEmbeddedRasterImage} from './EmbeddedImage';
export function normalizeDisplayMath(text:string){let fence='';return text.split('\n').map(line=>{const marker=line.match(/^ {0,3}(`{3,}|~{3,})/);if(marker){if(!fence)fence=marker[1];else if(marker[1][0]===fence[0]&&marker[1].length>=fence.length)fence='';return line;}if(fence)return line;const math=line.match(/^ {0,3}\$\$(.+)\$\$\s*$/);return math?`$$\n${math[1]}\n$$`:line;}).join('\n');}
export function Markdown({children,components={}}:{children:string;components?:Components}){return <div className="markdown"><ReactMarkdown skipHtml remarkPlugins={[remarkGfm,remarkMath]} rehypePlugins={[[rehypeKatex,{trust:false,strict:'ignore',throwOnError:false,maxExpand:500,maxSize:50}]]} urlTransform={(url,key,node)=>key==='src'&&node.tagName==='img'&&isEmbeddedRasterImage(url)?url:defaultUrlTransform(url)} components={{a:({node,...props})=><a {...props} target="_blank" rel="noopener noreferrer"/>,img:({src,alt,title})=><EmbeddedImage src={src} alt={alt} title={title}/>,...components}}>{normalizeDisplayMath(children)}</ReactMarkdown></div>;}
