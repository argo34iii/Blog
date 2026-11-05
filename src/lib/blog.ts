import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

export const SITE_NAME = 'gmii';
export const BLOG_NAME = 'デ';
export const PER_PAGE = 10;

export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('blog');
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

// 日付は UTC で保存されているので UTC で読む
export const formatDate = (d: Date) =>
  `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;

export const monthKey = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

export const monthLabel = (key: string) => {
  const [y, m] = key.split('-');
  return `${y}年${Number(m)}月`;
};

export const postUrl = (p: Post) => `/blog/${p.id}/`;
export const categoryUrl = (c: string) => `/blog/category/${encodeURIComponent(c)}/`;
export const archiveUrl = (key: string) => `/blog/archive/${key}/`;

// 本文から抜粋を作る（Markdown記法をざっくり除去）
export function excerpt(p: Post, length = 120): string {
  const text = (p.body ?? '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > length ? text.slice(0, length) + '…' : text;
}

export function countBy<T>(items: T[], key: (t: T) => string): [string, number][] {
  const map = new Map<string, number>();
  for (const it of items) map.set(key(it), (map.get(key(it)) ?? 0) + 1);
  return [...map.entries()];
}
