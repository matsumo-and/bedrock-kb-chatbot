import { amazonaurora, bedrock } from "@cdklabs/generative-ai-cdk-constructs";
import * as cdk from "aws-cdk-lib";
import {
  type aws_ec2,
  aws_s3,
  aws_secretsmanager,
  CfnOutput,
  Duration,
  RemovalPolicy,
} from "aws-cdk-lib";
import type { Construct } from "constructs";

interface BedrockKbStackProps extends cdk.StackProps {
  stage: string;
  /**
   * VPC (NetworkStackから渡される)
   */
  vpc: aws_ec2.IVpc;
  /**
   * Confluence設定（オプショナル）
   */
  confluence?: {
    /**
     * Confluence Secret ARN
     */
    secretArn: string;
    /**
     * ConfluenceのホストURL
     */
    hostUrl: string;
    /**
     * 対象とするスペース
     */
    spaces: string[];
  };
}

export class AmazonBedrockKbStack extends cdk.Stack {
  public readonly vectorStore: amazonaurora.AmazonAuroraVectorStore;
  public readonly auroraClusterId: string;

  constructor(scope: Construct, id: string, props: BedrockKbStackProps) {
    super(scope, id, props);

    const { stage, vpc, confluence } = props;

    const tag = `bedrock-kb-${stage}`;
    const bucketName = `${tag}-${this.account}`;

    // S3 bucket for the data source
    const dataSourceBucket = new aws_s3.Bucket(this, "DataSourceBucket", {
      bucketName: bucketName,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: true,
      lifecycleRules: [
        {
          id: "delete-old-versions",
          noncurrentVersionExpiration: Duration.days(30),
        },
      ],
    });

    // Aurora cluster identifier
    this.auroraClusterId = `${tag}-aurora-cluster`;

    // AmazonAuroraVectorStore を使用して新規にAuroraクラスタとVector Storeを作成
    this.vectorStore = new amazonaurora.AmazonAuroraVectorStore(
      this,
      "VectorStore",
      {
        embeddingsModelVectorDimension: 1024, // Titan Embed Text v2の次元数
        vpc: vpc,
        clusterId: this.auroraClusterId,
      },
    );

    // Knowledge Base の作成（IAM roleは自動作成される）
    const knowledgeBase = new bedrock.VectorKnowledgeBase(
      this,
      "KnowledgeBase",
      {
        vectorStore: this.vectorStore,
        embeddingsModel:
          bedrock.BedrockFoundationModel.TITAN_EMBED_TEXT_V2_1024,
        name: `${tag}-knowledge-base`,
        description: `Knowledge base for ${stage} environment with Aurora PostgreSQL`,
        instruction:
          "Use this knowledge base to answer questions based on the provided documents.",
      },
    );

    // S3 Data Source
    knowledgeBase.addS3DataSource({
      bucket: dataSourceBucket,
      dataSourceName: `${tag}-s3-data-source`,
      chunkingStrategy: bedrock.ChunkingStrategy.fixedSize({
        maxTokens: 300,
        overlapPercentage: 20,
      }),
    });

    // Confluence Data Source (if configured)
    if (confluence) {
      knowledgeBase.addConfluenceDataSource({
        dataSourceName: `${tag}-confluence-data-source`,
        confluenceUrl: confluence.hostUrl,
        authType:
          bedrock.ConfluenceDataSourceAuthType.OAUTH2_CLIENT_CREDENTIALS,
        authSecret: aws_secretsmanager.Secret.fromSecretCompleteArn(
          this,
          "ConfluenceSecret",
          confluence.secretArn,
        ),
        filters: [
          {
            objectType: bedrock.ConfluenceObjectType.SPACE,
            includePatterns: confluence.spaces,
          },
        ],
      });
    }

    // Outputs
    new CfnOutput(this, "KnowledgeBaseId", {
      value: knowledgeBase.knowledgeBaseId,
      description: "Knowledge Base ID",
      exportName: `${tag}-kb-id`,
    });

    new CfnOutput(this, "KnowledgeBaseArn", {
      value: knowledgeBase.knowledgeBaseArn,
      description: "Knowledge Base ARN",
      exportName: `${tag}-kb-arn`,
    });

    new CfnOutput(this, "S3BucketName", {
      value: dataSourceBucket.bucketName,
      description: "S3 bucket name for data sources",
      exportName: `${tag}-s3-bucket`,
    });

    // Output the AWS CLI commands to upload files to the S3 bucket
    const uploadCommand = `aws s3 cp --recursive ./data s3://${bucketName}/documents/`;
    new CfnOutput(this, "UploadCommand", {
      value: uploadCommand,
      description: "AWS CLI command to upload files to the S3 bucket",
    });
  }
}
