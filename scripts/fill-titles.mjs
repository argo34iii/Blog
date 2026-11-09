// タイトルが空の記事に「日記　YYYYMMDD」（date 欄から）を書き込む。
// 変更したファイル名を標準出力に出す。
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'src/content/blog';
for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
  const path = join(dir, file);
  const text = readFileSync(path, 'utf8');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) continue;
  const fm = m[1];
  const date = fm.match(/^date:\s*['"]?(\d{4})-(\d{2})-(\d{2})/m);
  if (!date) continue;
  const titleLine = fm.match(/^title:[ \t]*(.*)$/m);
  const value = titleLine ? titleLine[1].trim() : '';
  if (value && value !== "''" && value !== '""' && value !== 'null' && value !== '~') continue;

  const title = `title: 日記　${date[1]}${date[2]}${date[3]}`;
  const newFm = titleLine ? fm.replace(titleLine[0], title) : `${title}\n${fm}`;
  writeFileSync(path, text.replace(fm, newFm));
  console.log(path);
}
