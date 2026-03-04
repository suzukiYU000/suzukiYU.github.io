# Robotics Portfolio Template

GitHub Pages向けの1ページポートフォリオです。

## 構成
- `index.html`: 本文構造（プロフィール、主要開発、論文）
- `styles.css`: デザイン（テック感 + アーティスティック）
- `script.js`: スクロール表示演出と年表示

## まず編集する場所
- `index.html` の `Suzuki Yuma` や自己紹介文
- `Main Development` 各カードの内容
- `Papers` セクションのタイトル・学会名・`PDF`リンク
- `footer` のメールアドレスとGitHub URL

## GitHub Pages公開手順
1. GitHubで新規リポジトリを作成（例: `portfolio`）
2. このフォルダのファイルをpush
3. GitHubリポジトリの `Settings > Pages` を開く
4. `Build and deployment` で `Deploy from a branch` を選択
5. Branch を `main` / `/ (root)` にして保存
6. 数分待つと公開URLが発行されます

## 任意カスタム
- 配色: `styles.css` の `:root` 変数
- フォント: `index.html` の Google Fonts 読み込み
- セクション追加: `index.html` に追記し、`styles.css` でクラスを拡張
