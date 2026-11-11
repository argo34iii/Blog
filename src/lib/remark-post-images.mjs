// 記事の「画像」欄（frontmatter の images）を本文に差し込む。
// 本文に [画像1] / ［画像1］ と書くとその位置に表示し、
// 本文で使われなかった画像は記事の最後にまとめて表示する。

const MARKER = /[［\[]画像\s*(\d+)[］\]]/g;

const escapeAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const safeSrc = (s) => typeof s === 'string' && /^(\/|https?:\/\/)/.test(s);

const imgHtml = (src, n) =>
  `<img class="post-image" src="${escapeAttr(src)}" alt="画像${n}" loading="lazy" decoding="async" />`;

export default function remarkPostImages() {
  return (tree, file) => {
    const fm = file.data?.astro?.frontmatter ?? {};
    const images = Array.isArray(fm.images) ? fm.images.filter(safeSrc) : [];
    if (images.length === 0) return;

    const used = new Set();

    const walk = (node) => {
      if (!node.children) return;
      const out = [];
      for (const child of node.children) {
        if (child.type === 'text' && MARKER.test(child.value)) {
          MARKER.lastIndex = 0;
          let last = 0;
          for (const m of child.value.matchAll(MARKER)) {
            const n = Number(m[1]);
            const src = images[n - 1];
            if (!src) continue; // 存在しない番号はそのまま文字として残す
            if (m.index > last) out.push({ type: 'text', value: child.value.slice(last, m.index) });
            out.push({ type: 'html', value: imgHtml(src, n) });
            used.add(n);
            last = m.index + m[0].length;
          }
          if (last < child.value.length) out.push({ type: 'text', value: child.value.slice(last) });
        } else {
          walk(child);
          out.push(child);
        }
      }
      node.children = out;
    };
    walk(tree);

    const rest = images.map((src, i) => [src, i + 1]).filter(([, n]) => !used.has(n));
    if (rest.length) {
      tree.children.push({
        type: 'html',
        value: `<div class="post-images">${rest.map(([src, n]) => imgHtml(src, n)).join('')}</div>`,
      });
    }
  };
}
