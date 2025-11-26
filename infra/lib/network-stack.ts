import * as cdk from "aws-cdk-lib";
import { aws_ec2 } from "aws-cdk-lib";
import type { Construct } from "constructs";
import type { EnvironmentConfig } from "./config/environmental_config";

interface NetworkStackProps extends cdk.StackProps {
  envName: string;
  config: EnvironmentConfig;
}

export class NetworkStack extends cdk.Stack {
  public readonly vpc: aws_ec2.Vpc;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    const { envName, config } = props;
    const tag = `bedrock-kb-${envName}`;

    // VPC の作成
    this.vpc = new aws_ec2.Vpc(this, "BedrockKbVpc", {
      vpcName: `${tag}-vpc`,
      ipAddresses: aws_ec2.IpAddresses.cidr(config.vpc.cidr),
      maxAzs: config.vpc.maxAzs,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "public",
          subnetType: aws_ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "private",
          subnetType: aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, "VpcId", {
      value: this.vpc.vpcId,
      description: "VPC ID for Bedrock KB infrastructure",
      exportName: `${tag}-vpc-id`,
    });

    new cdk.CfnOutput(this, "VpcCidr", {
      value: this.vpc.vpcCidrBlock,
      description: "VPC CIDR block",
      exportName: `${tag}-vpc-cidr`,
    });
  }
}
