# Bedrock KB ChatBot

Amazon Bedrock Knowledge Base を活用した AI チャットボットアプリケーション

## 🎯 概要

Bedrock KB ChatBot は、Amazon Bedrock の Knowledge Base 機能を活用して構築された AI チャットボットです。Next.js と AWS CDK を使用して、モダンでスケーラブルなアーキテクチャを実現しています。

## 🚀 主な機能

- Amazon Bedrock Knowledge Base との統合
- リアルタイムチャット機能
- レスポンシブデザイン
- TypeScript による型安全性

## 🛠 技術スタック

### フロントエンド
- **Next.js 16** - React フレームワーク
- **React 19** - UI ライブラリ
- **Tailwind CSS 4** - CSS フレームワーク
- **TypeScript 5** - 型付き JavaScript
- **Biome** - Linter & Formatter

### インフラストラクチャ
- **AWS CDK** - Infrastructure as Code
- **Amazon Bedrock** - AI/ML サービス
- **TypeScript** - CDK の実装言語

## 📋 前提条件

- Node.js 20.x 以上
- Yarn または npm
- AWS CLI（設定済み）
- AWS アカウント
- Amazon Bedrock へのアクセス権限

## 📦 プロジェクト構成

```
bedrock-kb-chatbot/
├── app/                    # Next.js アプリケーション
│   ├── src/               # ソースコード
│   ├── public/            # 静的ファイル
│   ├── package.json       # 依存関係
│   └── README.md          # アプリの詳細
│
├── infra/                 # AWS CDK インフラストラクチャ
│   ├── lib/              # CDK スタック定義
│   ├── bin/              # CDK エントリーポイント
│   ├── test/             # テストファイル
│   ├── package.json      # 依存関係
│   └── README.md         # インフラの詳細
│
└── README.md             # このファイル
```

## 🚀 クイックスタート

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd bedrock-kb-chatbot
```

### 2. インフラストラクチャのセットアップ

```bash
cd infra
yarn install  # または npm install
yarn build    # TypeScript のビルド
yarn cdk deploy  # AWS へのデプロイ
```

詳細な手順は [infra/README.md](./infra/README.md) を参照してください。

### 3. アプリケーションの起動

```bash
cd app
yarn install  # または npm install
yarn dev      # 開発サーバーの起動
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてアプリケーションを確認します。

詳細な手順は [app/README.md](./app/README.md) を参照してください。

## 📝 開発コマンド

### アプリケーション (app/)

```bash
yarn dev        # 開発サーバーの起動
yarn build      # プロダクションビルド
yarn start      # プロダクションサーバーの起動
yarn lint       # Biome によるコード検査
yarn format     # Biome によるコードフォーマット
```

### インフラストラクチャ (infra/)

```bash
yarn build      # TypeScript のビルド
yarn watch      # ファイル変更の監視とビルド
yarn test       # Jest によるテスト実行
yarn cdk synth  # CloudFormation テンプレートの生成
yarn cdk deploy # AWS へのデプロイ
yarn cdk diff   # 変更内容の確認
```
