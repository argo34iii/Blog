import { defineConfig } from 'astro/config';
import remarkBreaks from 'remark-breaks';
import remarkBlankLines from './src/lib/remark-blank-lines.mjs';
import remarkPostImages from './src/lib/remark-post-images.mjs';
import sites from './src/data/sites.json' with { type: 'json' };

// 1つのリポジトリから、ホームページとブログを別々のサイトとして書き出す。
//   npm run build       → ブログ（dist/、wrangler.jsonc で blog に公開）
//   npm run build:home  → ホームページ（dist-home/、wrangler.home.jsonc で home に公開）
const target = process.env.SITE_TARGET === 'home' ? 'home' : 'blog';

const routes = {
  home: [['/', 'index.astro']],
  blog: [
    ['/', 'index.astro'],
    ['/[id]', '[id].astro'],
    ['/page/[page]', 'page/[page].astro'],
    ['/category/[category]', 'category/[category].astro'],
    ['/archive/[month]', 'archive/[month].astro'],
    ['/books', 'books.astro'],
    ['/rss.xml', 'rss.xml.ts'],
  ],
};

const siteRoutes = {
  name: 'site-routes',
  hooks: {
    'astro:config:setup': ({ injectRoute }) => {
      for (const [pattern, file] of routes[target]) {
        injectRoute({ pattern, entrypoint: `./src/sites/${target}/${file}` });
      }
    },
  },
};

export default defineConfig({
  // URL は管理画面の「サイト設定 → URL」で変える（独自ドメインを付けたときなど）
  site: target === 'home' ? sites.homeUrl : sites.blogUrl,
  outDir: target === 'home' ? './dist-home' : './dist',
  integrations: [siteRoutes],
  markdown: {
    // 改行1つ → そのまま改行、空行を複数 → その分の余白、画像欄の画像を差し込む
    remarkPlugins: [remarkBreaks, remarkBlankLines, remarkPostImages],
  },
});
