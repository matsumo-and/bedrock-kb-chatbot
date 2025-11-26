#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { AmazonBedrockKbStack } from "../lib/bedrock-kb-stack";
import { NetworkStack } from "../lib/network-stack";
import { SecretsStack } from "../lib/secrets-stack";
import { getConfig } from "../lib/config/environmental_config";

const app = new cdk.App();

// 環境名を取得
const stage = app.node.tryGetContext("stage") || "test";
const stagePrefix = stage.charAt(0).toUpperCase() + stage.slice(1);

// 環境設定を取得（エントリーポイントでのみ呼び出す）
const config = getConfig(stage);

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT ?? process.env.AWS_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION,
};

// Secrets スタック（認証情報を管理）
const secretsStack = new SecretsStack(app, `SecretsStack${stagePrefix}`, {
  envName: stage,
  confluence: { ...config.bedrockKb?.confluence },
  env,
  description: `Secrets management (Confluence credentials, etc.) for ${stage} environment`,
});

// Network スタック（VPCとSubnetを管理）
const networkStack = new NetworkStack(app, `NetworkStack${stagePrefix}`, {
  envName: stage,
  config,
  env,
  description: `Network infrastructure (VPC, Subnets) for ${stage} environment`,
});

// Bedrock Knowledge Base スタック
new AmazonBedrockKbStack(app, `BedrockKbStack${stagePrefix}`, {
  envName: stage,
  config,
  vpc: networkStack.vpc,
  auroraSecretArn: secretsStack.auroraSecretArn,
  confluenceSecretArn: secretsStack.confluenceSecretArn,
  env,
  description: `Bedrock Knowledge Base stack with Aurora PostgreSQL for ${stage} environment`,
});
