#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { AmazonBedrockKbStack } from "../lib/bedrock-kb-stack";

const app = new cdk.App();

// 環境名を取得（デフォルトは 'dev'）
const env = app.node.tryGetContext("env") || "dev";
const envPrefix = env.charAt(0).toUpperCase() + env.slice(1);

// Bedrock Knowledge Base スタック
new AmazonBedrockKbStack(app, `BedrockKbStack${envPrefix}`, {
  envName: env,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description: `Bedrock Knowledge Base stack with Aurora PostgreSQL for ${env} environment`,
});
