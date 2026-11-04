// Markdown では空行を何行入れても段落の区切り1つにまとめられてしまう。
// 2行目以降の余分な空行を、その行数ぶんの余白として残すプラグイン。
const LINE_HEIGHT_EM = 1.8; // Base.astro の line-height に合わせる

export default function remarkBlankLines() {
  return (tree) => {
    const out = [];
    let prev = null;
    for (const node of tree.children) {
      if (prev?.position && node.position) {
        const extra = node.position.start.line - prev.position.end.line - 2;
        if (extra > 0) {
          out.push({
            type: 'html',
            value: `<div class="blank-lines" style="height:${(extra * LINE_HEIGHT_EM).toFixed(1)}em" aria-hidden="true"></div>`,
          });
        }
      }
      out.push(node);
      prev = node;
    }
    tree.children = out;
  };
}
