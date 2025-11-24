/**
 * 環境設定の型定義
 */
export interface EnvironmentConfig {
  /**
   * 環境名（dev, prod など）
   */
  envName: string;

  /**
   * AWSアカウントID
   * @default - CDK_DEFAULT_ACCOUNT環境変数を使用
   */
  account?: string;

  /**
   * AWSリージョン
   * @default - CDK_DEFAULT_REGION環境変数を使用
   */
  region?: string;

  /**
   * VPCの設定
   */
  vpc: {
    /**
     * VPCのCIDRブロック
     */
    cidr: string;
    /**
     * 使用する最大アベイラビリティゾーン数
     */
    maxAzs: number;
  };

  /**
   * Bedrock Knowledge Base の設定
   */
  bedrockKb?: {
    /**
     * 埋め込みモデルのARN
     */
    embeddingModelArn: string;
    /**
     * Aurora PostgreSQL の設定
     */
    aurora: {
      /**
       * インスタンスタイプ
       */
      instanceType: string;
      /**
       * PostgreSQLのバージョン
       */
      version: string;
    };
    /**
     * Confluence の設定
     */
    confluence?: {
      /**
       * Confluence認証情報のシークレットARN
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
  };
}

/**
 * 環境別の設定
 *
 * 各環境（dev, prod）に応じた設定値を定義します。
 * 新しい環境を追加する場合は、このオブジェクトに設定を追加してください。
 */
export const environmentConfigs: { [key: string]: EnvironmentConfig } = {
  dev: {
    envName: "dev",
    vpc: {
      cidr: "10.0.0.0/16",
      maxAzs: 2,
    },
    bedrockKb: {
      embeddingModelArn:
        "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0",
      aurora: {
        instanceType: "t3.medium",
        version: "15.4",
      },
      confluence: {
        secretArn: "", // 環境変数から設定: process.env.CONFLUENCE_SECRET_ARN
        hostUrl: "https://your-domain.atlassian.net", // 環境変数から設定: process.env.CONFLUENCE_HOST_URL
        spaces: ["*"],
      },
    },
  },
};

/**
 * 指定された環境の設定を取得する
 *
 * @param environment - 環境名（'dev', 'prod' など）
 * @returns 指定された環境の設定
 * @throws 指定された環境が存在しない場合はエラー
 *
 * @example
 * ```typescript
 * const config = getConfig('dev');
 * console.log(config.vpc.cidr); // '10.0.0.0/16'
 * ```
 */
export function getConfig(environment: string): EnvironmentConfig {
  const config = environmentConfigs[environment];
  if (!config) {
    throw new Error(`Unknown environment: ${environment}`);
  }
  return config;
}
