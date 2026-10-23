import {useState} from 'react';
import {createPortal} from 'react-dom';
import {Modal} from './Modal';
import './embedded-images.css';

/** Only self-contained raster data is loaded; imported notes never fetch remote images. */
export function isEmbeddedRasterImage(value:unknown):value is string{
  if(typeof value!=='string'||value.length>100000)return false;
  const match=value.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if(!match||match[2].length%4!==0)return false;
  const prefix=atob(match[2].slice(0,16));
  return match[1]==='png'?prefix.startsWith('\x89PNG\r\n\x1a\n'):
    match[1]==='jpeg'?prefix.startsWith('\xff\xd8\xff'):
    prefix.startsWith('RIFF')&&prefix.slice(8,12)==='WEBP';
}

export default function EmbeddedImage({src,alt,title}:{src?:string;alt?:string;title?:string}){
  const [open,setOpen]=useState(false);
  if(!isEmbeddedRasterImage(src))return <span className="image-note">[图片：{alt||'请补充图片说明'}]</span>;
  const label=alt||'知识点配图';
  return <span className="embedded-figure">
    <button type="button" className="embedded-image-button" onClick={()=>setOpen(true)} aria-label={'放大图片：'+label}>
      <img src={src} alt={label} title={title} loading="lazy" decoding="async"/>
    </button>
    <span className="embedded-image-hint">点击图片放大</span>
    {open&&createPortal(<Modal title="查看配图" className="image-preview-modal" wide onClose={()=>setOpen(false)}>
      <div className="image-preview-body"><img src={src} alt={label}/><p>{title||label}</p></div>
    </Modal>,document.body)}
  </span>;
}
