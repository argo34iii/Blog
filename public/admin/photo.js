// 本文ツールバーの画像ボタンを「カメラロールを直接開く」動作に置き換える。
// 選んだ画像は Sveltia の addFile で記事の下書きに追加し、記事と同じコミットで保存される。
// 保存先は config.yml の uploads フィールドの media_folder（記事の日付のフォルダ）。
// ※ Sveltia の内部の見た目（ボタンの aria-label や textarea の id）に依存しているので、
//   index.html でバージョンを固定している。上げるときは画像ボタンの動作を確認すること。
(() => {
  const CMS = window.CMS;
  const h = CMS.React.createElement;
  const { useEffect, useRef } = CMS.React;

  // 画像を記事に紐付けておくための隠しフィールド。addFile を外から呼べるようにする
  let bridge = null;
  const PhotoUploads = (props) => {
    const valueRef = useRef(props.value);
    valueRef.current = props.value;
    useEffect(() => {
      bridge = {
        addFile: props.addFile,
        remember: (url) => {
          const list = Array.isArray(valueRef.current) ? [...valueRef.current] : [];
          list.push(url);
          valueRef.current = list;
          props.onChange(list);
        },
      };
      return () => { bridge = null; };
    }, [props.addFile, props.onChange]);
    const n = Array.isArray(props.value) ? props.value.length : 0;
    return h('p', { style: { margin: 0, fontSize: '0.85em', opacity: 0.7 } },
      n ? `この記事に追加した画像: ${n}枚` : '本文ツールバーの画像ボタンで追加した画像がここに記録されます');
  };
  CMS.registerFieldType('photo-uploads', PhotoUploads);

  // 最後にカーソルがあった本文の位置を覚えておく
  const lastCaret = new WeakMap();
  document.addEventListener('selectionchange', () => {
    const el = document.activeElement;
    if (el instanceof HTMLTextAreaElement && el.id.endsWith('-plain-text')) {
      lastCaret.set(el, [el.selectionStart, el.selectionEnd]);
    }
  });

  const setTextareaValue = (ta, value) => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, value);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const insertIntoTextarea = (ta, text) => {
    const [start, end] = lastCaret.get(ta) ?? [ta.value.length, ta.value.length];
    const before = ta.value.slice(0, start);
    const after = ta.value.slice(end);
    // 画像は行として独立させる
    const pre = before && !before.endsWith('\n') ? '\n' : '';
    const post = after.startsWith('\n') ? '' : '\n';
    setTextareaValue(ta, before + pre + text + post + after);
    const pos = (before + pre + text + post).length;
    ta.focus();
    ta.setSelectionRange(pos, pos);
    lastCaret.set(ta, [pos, pos]);
  };

  const pickImages = () =>
    new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.style.display = 'none';
      input.addEventListener('change', () => {
        resolve([...(input.files ?? [])]);
        input.remove();
      });
      input.addEventListener('cancel', () => {
        resolve([]);
        input.remove();
      });
      document.body.append(input);
      input.click();
    });

  const isImageButton = (btn) =>
    btn.getAttribute('aria-controls')?.endsWith('-plain-text') &&
    (btn.getAttribute('aria-label') === 'Image' || btn.textContent.trim() === 'image' || btn.getAttribute('aria-label') === '画像');

  document.addEventListener(
    'click',
    async (event) => {
      const btn = event.target instanceof Element ? event.target.closest('button[aria-controls]') : null;
      if (!btn || !isImageButton(btn)) return;
      const ta = document.getElementById(btn.getAttribute('aria-controls'));
      if (!(ta instanceof HTMLTextAreaElement) || !bridge) return; // 想定外の状態なら元の動作に任せる

      event.preventDefault();
      event.stopImmediatePropagation();

      const files = await pickImages();
      for (const file of files) {
        try {
          const url = await bridge.addFile(file);
          bridge.remember(url);
          insertIntoTextarea(ta, `![](${url})`);
        } catch (e) {
          alert(`画像を追加できませんでした: ${e?.message ?? e}`);
        }
      }
    },
    true,
  );
})();
