import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const ymd = (d: Date) =>
  `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;

const optionalText = z
  .string()
  .nullish()
  .transform((v) => v?.trim() || undefined);

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z
    .object({
      // 空欄なら「日記　YYYYMMDD」（日付は date から）にする
      title: z.string().nullish(),
      date: z.coerce.date(),
      // 管理画面では複数選択。昔の記事の「category: 雑記」のような1つだけの書き方も読める
      category: z.union([z.string(), z.array(z.string())]).nullish(),
      // 管理画面の「画像」欄（旧）。表示は remark-post-images.mjs が行う
      images: z.array(z.string()).nullish().transform((v) => v ?? []),
      // 本の感想用。書名が入っている記事だけが本棚ページに並ぶ
      book: z
        .object({
          title: optionalText,
          author: optionalText,
          rating: z.coerce.number().int().min(1).max(5).nullish().catch(undefined),
          cover: optionalText,
        })
        .nullish(),
    })
    .transform(({ category, book, ...d }) => {
      const list = (Array.isArray(category) ? category : [category])
        .map((c) => c?.trim())
        .filter((c): c is string => !!c);
      return {
        ...d,
        title: d.title?.trim() || `日記　${ymd(d.date)}`,
        categories: list.length ? [...new Set(list)] : ['雑記'],
        book: book?.title
          ? { title: book.title, author: book.author, rating: book.rating ?? undefined, cover: book.cover }
          : undefined,
      };
    }),
});

export const collections = { blog };
