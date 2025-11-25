import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { AmazonBedrockKbStack } from "../lib/bedrock-kb-stack";
import { NetworkStack } from "../lib/network-stack";
import { getConfig } from "../lib/config/environmental_config";

describe("Configuration and Stack Structure", () => {
  test("getConfig は環境名を含む設定を返す", () => {
    const config = getConfig("dev");
    expect(config.vpc).toBeDefined();
    expect(config.bedrockKb).toBeDefined();
  });

  test("getConfig は未知の環境に対してエラーを投げる", () => {
    expect(() => getConfig("unknown")).toThrow("Unknown environment: unknown");
  });

  test("NetworkStack は VPC を作成する", () => {
    const app = new cdk.App();
    const config = getConfig("dev");

    const networkStack = new NetworkStack(app, "TestNetworkStack", {
      envName: "dev",
      config,
    });

    const template = Template.fromStack(networkStack);

    // VPCが作成されることを確認
    template.resourceCountIs("AWS::EC2::VPC", 1);
  });

  test("BedrockKbStack は NetworkStack から VPC を受け取る", () => {
    const app = new cdk.App();
    const config = getConfig("dev");

    const networkStack = new NetworkStack(app, "TestNetworkStack", {
      envName: "dev",
      config,
    });

    const bedrockStack = new AmazonBedrockKbStack(app, "TestBedrockStack", {
      envName: "dev",
      config,
      vpc: networkStack.vpc,
    });

    const bedrockTemplate = Template.fromStack(bedrockStack);

    // BedrockKbStackではVPCを作成しないことを確認
    bedrockTemplate.resourceCountIs("AWS::EC2::VPC", 0);
    // Knowledge Baseが作成されることを確認
    bedrockTemplate.resourceCountIs("AWS::Bedrock::KnowledgeBase", 1);
  });

  test("スタックコンストラクタは envName を使用する", () => {
    const app = new cdk.App();
    const config = getConfig("dev");

    const networkStack = new NetworkStack(app, "TestNetworkStack", {
      envName: "dev",
      config,
    });

    const bedrockStack = new AmazonBedrockKbStack(app, "TestBedrockStack", {
      envName: "dev",
      config,
      vpc: networkStack.vpc,
    });

    const template = Template.fromStack(bedrockStack);
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
    expect(stackFileContent).not.toContain("import { getConfig }");
    expect(stackFileContent).not.toContain("import { getConfig }");
    expect(stackFileContent).not.toContain(
      "from './config/environmental_config'",
    );
  });

  test("bedrock-kb-stack.ts は EnvironmentConfig 型のみをインポートする", () => {
    const stackFileContent = require("node:fs").readFileSync(
      require("node:path").join(__dirname, "../lib/bedrock-kb-stack.ts"),
      "utf-8",
    );

    // 型のみのインポートであることを確認
    expect(stackFileContent).toContain("import type { EnvironmentConfig }");
  });
});
