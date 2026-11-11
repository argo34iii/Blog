import { defineConfig } from 'astro/config';
import remarkBreaks from 'remark-breaks';
import remarkBlankLines from './src/lib/remark-blank-lines.mjs';
import remarkPostImages from './src/lib/remark-post-images.mjs';

export default defineConfig({
  // ドメインを取ったらここを書き換える
  site: 'https://blog.dex34ii.workers.dev',
  markdown: {
    // 改行1つ → そのまま改行、空行を複数 → その分の余白、画像欄の画像を差し込む
    remarkPlugins: [remarkBreaks, remarkBlankLines, remarkPostImages],
  },
});
