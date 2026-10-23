import React from 'react';
import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {Markdown} from '../src/Markdown';
import {isEmbeddedRasterImage} from '../src/EmbeddedImage';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jUwAAAAAASUVORK5CYII=';
describe('知识点中的内嵌配图',()=>{
  it('显示自包含的栅格图片，保留替代说明与放大入口',()=>{
    expect(isEmbeddedRasterImage(png)).toBe(true);
    const html=renderToStaticMarkup(<Markdown>{'![投影示意]('+png+')'}</Markdown>);
    expect(html).toContain('src="'+png+'"');expect(html).toContain('alt="投影示意"');expect(html).toContain('放大图片：投影示意');
  });
  it('远程和本地文件地址仍只显示说明，不发起图片加载',()=>{
    const html=renderToStaticMarkup(<Markdown>{'![外链](https://example.com/a.png)\n\n![本地](file:///D:/private.png)'}</Markdown>);
    expect(html).not.toContain('<img');expect(html).toContain('[图片：外链]');expect(html).toContain('[图片：本地]');
  });
  it('拒绝 SVG、伪造格式和过大的内容，图片 URL 不能变成可执行链接',()=>{
    for(const value of ['data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',png.replace('image/png','image/jpeg'),png+'A'.repeat(100000)])expect(isEmbeddedRasterImage(value)).toBe(false);
    const html=renderToStaticMarkup(<Markdown>{'[数据链接]('+png+')\n\n[坏链接](javascript:alert%281%29)\n\n$x^2$'}</Markdown>);
    expect(html).not.toContain('href="data:');expect(html).not.toContain('href="javascript:');expect(html).toContain('katex');
  });
});
