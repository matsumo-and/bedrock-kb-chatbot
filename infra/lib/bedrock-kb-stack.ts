import * as cdk from "aws-cdk-lib";
import {
  aws_bedrock,
  aws_ec2,
  aws_iam,
  aws_rds,
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
   * 埋め込みモデルのARN
   */
  embeddingModelArn: string;
  /**
   * VPC (NetworkStackから渡される)
   */
  vpc: aws_ec2.IVpc;
  /**
   * Aurora Secret ARN (SecretsStackから渡される)
   */
  auroraSecretArn: string;
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
  constructor(scope: Construct, id: string, props: BedrockKbStackProps) {
    super(scope, id, props);

    const { stage, embeddingModelArn, vpc, auroraSecretArn, confluence } =
      props;

    const tag = `bedrock-kb-${stage}`;
    const bucketName = `${tag}-${this.account}`;

    // Aurora PostgreSQL 用のセキュリティグループ
    const auroraSecurityGroup = new aws_ec2.SecurityGroup(
      this,
      "AuroraSecurityGroup",
      {
        vpc,
        description: "Security group for Aurora PostgreSQL cluster",
        allowAllOutbound: true,
      },
    );

    // VPC内からのPostgreSQL接続を許可
    auroraSecurityGroup.addIngressRule(
      aws_ec2.Peer.ipv4(vpc.vpcCidrBlock),
      aws_ec2.Port.tcp(5432),
      "Allow PostgreSQL connections from VPC",
    );

    // Aurora PostgreSQL のパスワード用シークレット (SecretsStackから渡される)
    const dbSecret = aws_secretsmanager.Secret.fromSecretCompleteArn(
      this,
      "AuroraSecret",
      auroraSecretArn,
    );

    // Aurora PostgreSQL クラスター
    const auroraCluster = new aws_rds.DatabaseCluster(this, "AuroraCluster", {
      engine: aws_rds.DatabaseClusterEngine.auroraPostgres({
        version: aws_rds.AuroraPostgresEngineVersion.VER_16_9,
      }),
      clusterIdentifier: `${tag}-aurora-cluster`,
      credentials: aws_rds.Credentials.fromSecret(dbSecret),
      writer: aws_rds.ClusterInstance.provisioned("writer", {
        instanceType: aws_ec2.InstanceType.of(
          aws_ec2.InstanceClass.T3,
          aws_ec2.InstanceSize.MEDIUM,
        ),
      }),
      readers: [
        aws_rds.ClusterInstance.provisioned("reader", {
          instanceType: aws_ec2.InstanceType.of(
            aws_ec2.InstanceClass.T3,
            aws_ec2.InstanceSize.MEDIUM,
          ),
        }),
      ],
      vpc,
      vpcSubnets: {
        subnetType: aws_ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [auroraSecurityGroup],
      removalPolicy: RemovalPolicy.DESTROY,
      deletionProtection: false,
      enableDataApi: true,
      // pgvector 拡張を有効化するためのパラメータ
      parameterGroup: aws_rds.ParameterGroup.fromParameterGroupName(
        this,
        "ParameterGroup",
        "default.aurora-postgresql15",
      ),
    });

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

    // Role for the knowledge base
    const knowledgeBaseRole = new aws_iam.Role(this, "KnowledgeBaseRole", {
      roleName: `${tag}-kb-role`,
      assumedBy: new aws_iam.ServicePrincipal("bedrock.amazonaws.com"),
      inlinePolicies: {
        BedrockKbPolicy: new aws_iam.PolicyDocument({
          statements: [
            // Aurora用のシークレットへのアクセス権限
            new aws_iam.PolicyStatement({
              resources: [dbSecret.secretArn],
              actions: ["secretsmanager:GetSecretValue"],
            }),
            // 埋め込みモデルへのアクセス権限
            new aws_iam.PolicyStatement({
              resources: [embeddingModelArn],
              actions: ["bedrock:InvokeModel"],
            }),
            // S3バケットへのアクセス権限
            new aws_iam.PolicyStatement({
              resources: [
                dataSourceBucket.bucketArn,
                `${dataSourceBucket.bucketArn}/*`,
              ],
              actions: ["s3:ListBucket", "s3:GetObject"],
            }),
            // RDS Data APIへのアクセス権限
            new aws_iam.PolicyStatement({
              resources: [auroraCluster.clusterArn],
              actions: [
                "rds-data:ExecuteStatement",
                "rds-data:BatchExecuteStatement",
                "rds-data:BeginTransaction",
                "rds-data:CommitTransaction",
                "rds-data:RollbackTransaction",
              ],
            }),
          ],
        }),
      },
    });

    // Knowledge Base
    const knowledgeBase = new aws_bedrock.CfnKnowledgeBase(
      this,
      "KnowledgeBase",
      {
        knowledgeBaseConfiguration: {
          type: "VECTOR",
          vectorKnowledgeBaseConfiguration: {
            embeddingModelArn: embeddingModelArn,
          },
        },
        name: `${tag}-knowledge-base`,
        roleArn: knowledgeBaseRole.roleArn,
        storageConfiguration: {
          type: "RDS",
          rdsConfiguration: {
            credentialsSecretArn: dbSecret.secretArn,
            databaseName: "postgres",
            resourceArn: auroraCluster.clusterArn,
            tableName: "bedrock_knowledge_base",
            fieldMapping: {
              vectorField: "embedding",
              textField: "text",
              metadataField: "metadata",
              primaryKeyField: "id",
            },
          },
        },
        description: `Knowledge base for ${stage} environment with Aurora PostgreSQL`,
      },
    );

    // Wait for Aurora to be ready
    knowledgeBase.node.addDependency(auroraCluster);

    // S3 data source
    const s3DataSource = new aws_bedrock.CfnDataSource(this, "S3DataSource", {
      name: `${tag}-s3-data-source`,
      knowledgeBaseId: knowledgeBase.ref,
      dataSourceConfiguration: {
        s3Configuration: {
          bucketArn: dataSourceBucket.bucketArn,
          inclusionPrefixes: ["documents/", "knowledge/"],
        },
        type: "S3",
      },
      description: "S3 data source for documents and knowledge files",
    });

    // Confluence data source (if configuration is provided)
    if (confluence) {
      // Reference the existing secret from SecretsStack
      const confluenceSecret = aws_secretsmanager.Secret.fromSecretCompleteArn(
        this,
        "ConfluenceSecret",
        confluence.secretArn,
      );

      // Grant read access to the knowledge base role
      confluenceSecret.grantRead(knowledgeBaseRole);

      new aws_bedrock.CfnDataSource(this, "ConfluenceDataSource", {
        name: `${tag}-confluence-data-source`,
        knowledgeBaseId: knowledgeBase.ref,
        dataSourceConfiguration: {
          type: "CONFLUENCE",
          confluenceConfiguration: {
            sourceConfiguration: {
              authType: "OAUTH2_CLIENT_CREDENTIALS",
              credentialsSecretArn: confluence.secretArn,
              hostType: "SAAS",
              hostUrl: confluence.hostUrl,
            },
            crawlerConfiguration: {
              filterConfiguration: {
                // 特定のスペースやページをフィルタリング
                type: "PATTERN",
                patternObjectFilter: {
                  filters: [
                    {
                      objectType: "Space",
                      inclusionFilters: confluence.spaces,
                    },
                  ],
                },
              },
            },
          },
        },
        description: "Confluence data source for team documentation",
      });
    }

    // VPC Endpoint for Bedrock
    new aws_ec2.InterfaceVpcEndpoint(this, "BedrockEndpoint", {
      vpc,
      service: aws_ec2.InterfaceVpcEndpointAwsService.BEDROCK,
      subnets: {
        subnetType: aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });

    // VPC Endpoint for Bedrock Runtime
    new aws_ec2.InterfaceVpcEndpoint(this, "BedrockRuntimeEndpoint", {
      vpc,
      service: aws_ec2.InterfaceVpcEndpointAwsService.BEDROCK_RUNTIME,
      subnets: {
        subnetType: aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });

    // Outputs
    new CfnOutput(this, "KnowledgeBaseId", {
      value: knowledgeBase.ref,
      description: "Knowledge Base ID",
      exportName: `${tag}-kb-id`,
    });

    new CfnOutput(this, "KnowledgeBaseArn", {
      value: knowledgeBase.attrKnowledgeBaseArn,
      description: "Knowledge Base ARN",
      exportName: `${tag}-kb-arn`,
    });

    new CfnOutput(this, "S3BucketName", {
      value: dataSourceBucket.bucketName,
      description: "S3 bucket name for data sources",
      exportName: `${tag}-s3-bucket`,
    });

    new CfnOutput(this, "AuroraClusterEndpoint", {
      value: auroraCluster.clusterEndpoint.hostname,
      description: "Aurora cluster endpoint",
      exportName: `${tag}-aurora-endpoint`,
    });

    // Output the AWS CLI commands to upload files to the S3 bucket
    const uploadCommand = `aws s3 cp --recursive ./data s3://${bucketName}/documents/`;
    new CfnOutput(this, "UploadCommand", {
      value: uploadCommand,
      description: "AWS CLI command to upload files to the S3 bucket",
    });

    // Output the command to sync the knowledge base
    new CfnOutput(this, "SyncCommand", {
      value: `aws bedrock start-ingestion-job --knowledge-base-id ${knowledgeBase.ref} --data-source-id ${s3DataSource.ref}`,
      description: "AWS CLI command to start ingestion job for S3 data source",
    });
  }
}
