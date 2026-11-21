# gmii-site

## 手元で確認

```
npm install
npm run dev
```

http://localhost:4321 で表示されます。

## 記事を書く

`src/content/blog/` に Markdown ファイルを追加します。ファイル名がURLになります（`hello.md` → `/blog/hello/`）。

```
---
title: 記事タイトル
date: 2026-11-04
---

本文
```

## トップページのリンクを足す

`src/pages/index.astro` に `<p><a href="...">名前</a></p>` を追加します。

## 公開（Cloudflare Pages）

1. このフォルダを GitHub のリポジトリに push
2. Cloudflare ダッシュボード → Workers & Pages → 作成 → Pages → Git に接続
3. リポジトリを選び、ビルド設定を以下にする
   - フレームワーク: Astro
   - ビルドコマンド: `npm run build`
   - 出力ディレクトリ: `dist`
4. 以降は push するたびに自動で公開されます

ドメインを取ったら、Pages のプロジェクト設定 → カスタムドメインで紐付け、`astro.config.mjs` の `site` を書き換えてください。

## ホームページとブログ

1つのリポジトリから、2つのサイトを書き出して別々に公開しています。

| サイト | ビルド | 公開設定 | 中身 |
|---|---|---|---|
| ブログ | `npm run build`（dist/） | `wrangler.jsonc`（Worker 名 blog） | `src/sites/blog/` |
| ホームページ | `npm run build:home`（dist-home/） | `wrangler.home.jsonc`（Worker 名 home） | `src/sites/home/` |

Cloudflare の Workers Builds では、ホームページ側のプロジェクトを次の設定にしています。
- ビルドコマンド: `npm run build:home`
- デプロイコマンド: `npx wrangler deploy -c wrangler.home.jsonc`

お問い合わせの通知用シークレット（DISCORD_WEBHOOK_URL / RESEND_API_KEY / CONTACT_EMAIL）は home 側に設定します。
管理画面（/admin/）はブログ側にあります。
