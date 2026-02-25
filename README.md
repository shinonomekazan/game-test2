# 華やかなテトリス (Glamorous Tetris)

Webブラウザで遊べる、カラフルで華やかなテトリスゲームです。

## 特徴

- 🎨 美しいグラデーションとカラフルなブロック
- ✨ ライン消去時のパーティクルエフェクト
- 📊 スコア、レベル、ライン数の表示
- 👀 次のブロックのプレビュー
- 🎮 直感的なキーボード操作
- 📱 レスポンシブデザイン

## プレイ方法

### オンラインでプレイ
GitHub Pagesで公開されているゲームをプレイできます：
- URL: `https://shinonomekazan.github.io/game-test2/`

### ローカルでプレイ
1. `index.html` をWebブラウザで開いてください
2. キーボードで操作します：
   - **←** : 左に移動
   - **→** : 右に移動
   - **↓** : 高速落下
   - **↑** : ブロックを回転
   - **スペース** : 一時停止/再開

## ゲームルール

- 落ちてくるブロック（テトロミノ）を配置して、横一列を埋めるとラインが消えます
- ラインを消すとスコアが増加します
- 10ライン消すごとにレベルが上がり、ブロックの落下速度が速くなります
- ブロックが上まで積み上がるとゲームオーバーです

## スコアリング

- 1ライン消去: 100点 × レベル
- 2ライン消去: 300点 × レベル
- 3ライン消去: 500点 × レベル
- 4ライン消去: 800点 × レベル

## 技術スタック

- HTML5 Canvas
- CSS3 (グラデーション、アニメーション、ブラー効果)
- Vanilla JavaScript (フレームワーク不要)

## スクリーンショット

![テトリスゲーム](https://github.com/user-attachments/assets/9cd5dc28-66d6-41ec-9d56-1b8f1595a4ae)

![ゲームプレイ](https://github.com/user-attachments/assets/d4b22f56-a346-48a1-8908-a4c8519d0dad)

## ライセンス

このプロジェクトはオープンソースです。

## 色違いゲーム – Firebase Firestoreランキング設定

色違いゲームのランキングは Firebase Firestore を使って全プレイヤー間で共有できます。
設定を行うまでは `localStorage`（ブラウザローカル）をフォールバックとして使用します。

### 必要なもの

- Google アカウント
- Firebase プロジェクト（無料プランで利用可能）

### 手順

1. **Firebase プロジェクトを作成する**
   - [Firebase Console](https://console.firebase.google.com/) を開く
   - 「プロジェクトを追加」をクリックしてプロジェクトを作成する

2. **Firestore データベースを作成する**
   - Firebase Console でプロジェクトを開く
   - 左メニューの「Firestore Database」をクリック
   - 「データベースを作成」→「テストモードで開始」を選択（後でルールを変更可能）

3. **Webアプリを登録して設定を取得する**
   - Firebase Console のプロジェクト設定（歯車アイコン）を開く
   - 「アプリを追加」→「Web」(`</>`) を選択
   - アプリ名を入力して登録すると `firebaseConfig` オブジェクトが表示される

4. **`color-game/firebase-config.js` を編集する**
   - 上記で取得した値を `YOUR_*` のプレースホルダーと置き換える

   ```javascript
   const firebaseConfig = {
       apiKey: "実際のAPIキー",
       authDomain: "your-project-id.firebaseapp.com",
       projectId: "your-project-id",
       storageBucket: "your-project-id.appspot.com",
       messagingSenderId: "実際のSenderID",
       appId: "実際のAppID"
   };
   ```

5. **Firestore セキュリティルールを設定する**
   - Firebase Console の「Firestore Database」→「ルール」タブを開く
   - ランキングの読み書きを許可する最小限のルール例：

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /colorGameRanking/{doc} {
         allow read: if true;
         allow create: if request.resource.data.score is int
                       && request.resource.data.score >= 0
                       && request.resource.data.name is string;
       }
     }
   }
   ```

### 動作の仕組み

- **スコア保存時**: Firestore の `colorGameRanking` コレクションにドキュメントを追加します。同時に `localStorage` にも保存（オフライン時のフォールバック）。
- **ランキング表示時**: Firestore からスコア上位10件を取得して表示します。Firestore が利用できない場合は `localStorage` のデータを使用します。

## GitHub Pages デプロイ手順

このリポジトリはGitHub Actionsを使用して自動的にGitHub Pagesにデプロイされます。

### 初回セットアップ（リポジトリ管理者が実行）

1. GitHubリポジトリの **Settings** タブを開く
2. 左サイドバーの **Pages** をクリック
3. **Source** セクションで以下を設定：
   - **Source**: "GitHub Actions" を選択
4. 設定を保存

### デプロイの仕組み

- `main` ブランチにプッシュすると自動的にデプロイされます
- GitHub Actionsワークフローが `.github/workflows/deploy.yml` で定義されています
- デプロイ状況は **Actions** タブで確認できます

### 手動デプロイ

必要に応じて、**Actions** タブから "Deploy to GitHub Pages" ワークフローを手動実行することもできます。

### デプロイ後の確認

デプロイが完了すると、以下のURLでゲームにアクセスできます：
- `https://shinonomekazan.github.io/game-test2/`