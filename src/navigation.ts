export type AtlasRoute={id:string|null;overview:boolean};
export function parseRoute(hash:string):AtlasRoute{
  try{
    const [path,query='']=hash.replace(/^#\/?/,'').split('?');
    return {id:decodeURIComponent(path)||null,overview:!!path&&new URLSearchParams(query).get('view')==='overview'};
  }catch{return {id:null,overview:false};}
}
export function routeHash(id:string|null,overview=false){return id?`#/${encodeURIComponent(id)}${overview?'?view=overview':''}`:'#/';}
export function routeKey(route:AtlasRoute){return routeHash(route.id,route.overview);}
