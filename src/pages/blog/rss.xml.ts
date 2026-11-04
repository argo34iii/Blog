import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPosts, excerpt, postUrl, BLOG_NAME } from '../../lib/blog';

export async function GET(context: APIContext) {
  const posts = await getPosts();
  return rss({
    title: BLOG_NAME,
    description: 'gmiiのブログ',
    site: context.site!,
    items: posts.slice(0, 20).map((p) => ({
      title: p.data.title,
      pubDate: p.data.date,
      description: excerpt(p, 200),
      link: postUrl(p),
    })),
  });
}
