import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const ymd = (d: Date) =>
  `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z
    .object({
      // 空欄なら「日記　YYYYMMDD」（日付は date から）にする
      title: z.string().nullish(),
      date: z.coerce.date(),
      category: z.string().default('雑記'),
      // 管理画面の「画像」欄。表示は remark-post-images.mjs が行う
      images: z.array(z.string()).nullish().transform((v) => v ?? []),
    })
    .transform((d) => ({ ...d, title: d.title?.trim() || `日記　${ymd(d.date)}` })),
});

export const collections = { blog };
