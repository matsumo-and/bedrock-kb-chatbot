#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { AmazonBedrockKbStack } from "../lib/bedrock-kb-stack";
import { getConfig } from "../lib/config/environmental_config";

const app = new cdk.App();

// 環境名を取得（デフォルトは 'dev'）
const env = app.node.tryGetContext("env") || "dev";
const envPrefix = env.charAt(0).toUpperCase() + env.slice(1);

// 環境設定を取得（エントリーポイントでのみ呼び出す）
const config = getConfig(env);

// Bedrock Knowledge Base スタック
new AmazonBedrockKbStack(app, `BedrockKbStack${envPrefix}`, {
  config,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description: `Bedrock Knowledge Base stack with Aurora PostgreSQL for ${env} environment`,
});
