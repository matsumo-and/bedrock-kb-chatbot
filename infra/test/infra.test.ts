import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { AmazonBedrockKbStack } from "../lib/bedrock-kb-stack";
import { getConfig } from "../lib/config/environmental_config";

describe("BedrockKbStack Configuration", () => {
  test("getConfig は環境名を含む設定を返す", () => {
    const config = getConfig("dev");
    expect(config.envName).toBe("dev");
    expect(config.vpc).toBeDefined();
    expect(config.bedrockKb).toBeDefined();
  });

  test("getConfig は未知の環境に対してエラーを投げる", () => {
    expect(() => getConfig("unknown")).toThrow("Unknown environment: unknown");
  });

  test("スタックは config を通じて設定を受け取る", () => {
    const app = new cdk.App();
    const config = getConfig("dev");

    const stack = new AmazonBedrockKbStack(app, "TestStack", {
      config,
    });

    const template = Template.fromStack(stack);

    // VPCが作成されることを確認
    template.resourceCountIs("AWS::EC2::VPC", 1);
    // Knowledge Baseが作成されることを確認
    template.resourceCountIs("AWS::Bedrock::KnowledgeBase", 1);
  });

  test("スタックコンストラクタは config.envName を使用する", () => {
    const app = new cdk.App();
    const config = getConfig("dev");

    const stack = new AmazonBedrockKbStack(app, "TestStack", {
      config,
    });

    const template = Template.fromStack(stack);
    const templateJson = template.toJSON();

    // S3バケットのリソースを取得
    const s3Buckets = Object.values(templateJson.Resources).filter(
      (resource: any) => resource.Type === "AWS::S3::Bucket",
    );

    expect(s3Buckets).toHaveLength(1);
    const bucketResource = s3Buckets[0] as any;

    // BucketNameのFn::Join配列の最初の要素に "bedrock-kb-dev" が含まれることを確認
    const joinArray = bucketResource.Properties.BucketName["Fn::Join"];
    expect(joinArray[1][0]).toContain("bedrock-kb-dev");
  });

  test("bedrock-kb-stack.ts は getConfig をインポートしない", () => {
    const stackFileContent = require("node:fs").readFileSync(
      require("node:path").join(__dirname, "../lib/bedrock-kb-stack.ts"),
      "utf-8",
    );

    // getConfig の import がないことを確認
    expect(stackFileContent).not.toContain('import { getConfig }');
    expect(stackFileContent).not.toContain("import { getConfig }");
    expect(stackFileContent).not.toContain("from './config/environmental_config'");
  });

  test("bedrock-kb-stack.ts は EnvironmentConfig 型のみをインポートする", () => {
    const stackFileContent = require("node:fs").readFileSync(
      require("node:path").join(__dirname, "../lib/bedrock-kb-stack.ts"),
      "utf-8",
    );

    // 型のみのインポートであることを確認
    expect(stackFileContent).toContain('import type { EnvironmentConfig }');
  });
});
