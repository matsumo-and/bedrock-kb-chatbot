#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { AmazonBedrockKbStack } from "../lib/bedrock-kb-stack";
import { NetworkStack } from "../lib/network-stack";
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

// Network スタック（VPCとSubnetを管理）
const networkStack = new NetworkStack(app, `NetworkStack${stagePrefix}`, {
  envName: stage,
  config,
  env
});

// Bedrock Knowledge Base スタック
new AmazonBedrockKbStack(app, `BedrockKbStack${stagePrefix}`, {
  envName: stage,
  config,
  vpc: networkStack.vpc,
  env,
});
