import { defineConfig } from 'astro/config';
import remarkBreaks from 'remark-breaks';
import remarkBlankLines from './src/lib/remark-blank-lines.mjs';

export default defineConfig({
  // ドメインを取ったらここを書き換える
  site: 'https://blog.dex34ii.workers.dev',
  markdown: {
    // 改行1つ → そのまま改行、空行を複数 → その分の余白
    remarkPlugins: [remarkBreaks, remarkBlankLines],
  },
});
