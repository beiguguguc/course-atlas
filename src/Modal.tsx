import {useEffect,useRef,type ReactNode} from 'react';
import {X} from 'lucide-react';
export function Modal({title,children,onClose,wide=false,className=''}:{title:string;children:ReactNode;onClose:()=>void;wide?:boolean;className?:string}){
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const el=dialog.current!;el.showModal();const before=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{el.close();document.body.style.overflow=before;};},[]);
  return <dialog ref={dialog} className={`modal ${wide?'wide':''} ${className}`} aria-label={title} onCancel={e=>{e.preventDefault();onClose();}}><div className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={20}/></button></div>{children}</dialog>;
}
