import * as cdk from "aws-cdk-lib";
import { aws_secretsmanager, CfnOutput } from "aws-cdk-lib";
import type { Construct } from "constructs";

interface SecretsStackProps extends cdk.StackProps {
  stage: string;
  confluence: {
    confluenceAppKey?: string;
    confluenceAppSecret?: string;
    confluenceAccessToken?: string;
    confluenceRefreshToken?: string;
  };
}

export class SecretsStack extends cdk.Stack {
  public readonly auroraSecretArn: string;
  public readonly confluenceSecretArn?: string;

  constructor(scope: Construct, id: string, props: SecretsStackProps) {
    super(scope, id, props);

    const { stage, confluence } = props;
    const tag = `bedrock-kb-${stage}`;

    // Aurora PostgreSQL のパスワード用シークレット
    const auroraSecret = new aws_secretsmanager.Secret(this, "AuroraSecret", {
      secretName: `${tag}-aurora-secret`,
      description: "Aurora PostgreSQL credentials for Bedrock Knowledge Base",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: "postgres" }),
        generateStringKey: "password",
        excludeCharacters: ' "@#$%^&*()_-+={}[]|;:,<>.?/',
        passwordLength: 32,
      },
    });

    this.auroraSecretArn = auroraSecret.secretArn;

    // Output for Aurora secret
    new CfnOutput(this, "AuroraSecretArn", {
      value: auroraSecret.secretArn,
      description: "Aurora PostgreSQL credentials secret ARN",
      exportName: `${tag}-aurora-secret-arn`,
    });

    const confluenceSecret = new aws_secretsmanager.Secret(
      this,
      "ConfluenceSecret",
      {
        secretName: `${tag}-confluence-credentials`,
        description: "Confluence credentials for Bedrock Knowledge Base",
        generateSecretString: {
          secretStringTemplate: JSON.stringify({
            confluenceAppKey: confluence.confluenceAppKey,
            confluenceAppSecret: confluence.confluenceAppSecret,
            confluenceAccessToken: confluence.confluenceAccessToken,
            confluenceRefreshToken: confluence.confluenceRefreshToken,
          }),
          excludeCharacters: ' "@#$%^&*()_-+={}[]|;:,<>.?/',
        },
      },
    );

    this.confluenceSecretArn = confluenceSecret.secretArn;

    // Output for Confluence secret
    new CfnOutput(this, "ConfluenceSecretArn", {
      value: confluenceSecret.secretArn,
      description: "Confluence credentials secret ARN",
      exportName: `${tag}-confluence-secret-arn`,
    });

    new CfnOutput(this, "ConfluenceSecretUpdateCommand", {
      value: `aws secretsmanager update-secret --secret-id ${confluenceSecret.secretArn} --secret-string '{"confluenceAppKey":"your-app-key","confluenceAppSecret":"your-app-secret","confluenceAccessToken":"your-access-token","confluenceRefreshToken":"your-refresh-token"}'`,
      description: "Command to update Confluence credentials",
    });
  }
}
