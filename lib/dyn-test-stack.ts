import { CfnParameter, Duration, Stack, StackProps } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dyndb from 'aws-cdk-lib/aws-dynamodb';
import * as path from 'path';

export class DynTestStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    // parameters
    const s3_bucket = new CfnParameter(this, 'S3Bucket', {
      type: 'String',
      description: 'S3 Bucket where account-emails.csv is located',
      default: 'audit-413157014023-accounts'
    });
    // Bucket should have only import data files
    const dyndb_table_name = new CfnParameter(this, 'DynamoDBTableName', {
      type: 'String',
      description: 'DynamoDB Table name to import account-emails.csv data',
      default: 'rd-sample'
    });

    // Policies for CW Logs
    const cwLogsPolicy = new iam.Policy(this, 'cw-logs-policy', {
      statements: [
        new iam.PolicyStatement({
          actions: [
            "logs:CreateLogGroup",
            "logs:CreateLogStream"
          ],
          effect: iam.Effect.ALLOW,
          resources: [
            `arn:aws:logs:${region}:${accountId}:log-group:/aws/lambda/*`
          ]
        }),
        new iam.PolicyStatement({
          actions: [
            "logs:PutLogEvents"
          ],
          effect: iam.Effect.ALLOW,
          resources: [
            `arn:aws:logs:${region}:${accountId}:log-group:/aws/lambda/*:log-stream:*`
          ]
        })
      ]
    });
    // Policies for DynDbImporterRole
    const dynDbImporterPolicy = new iam.Policy(this, 'dyndb-importer-policy', {
      statements: [
        new iam.PolicyStatement({
          actions: [
            "dynamodb:CreateTable",
            "dynamodb:ImportTable",
            "dynamodb:DescribeTable",
            "dynamodb:DescribeImport",
            "dynamodb:DeleteBackup",
            "dynamodb:DeleteTable",
            "dynamodb:ListImports"    
          ],
          effect: iam.Effect.ALLOW,
          resources: [
            `arn:aws:dynamodb:${region}:${accountId}:table/${dyndb_table_name.valueAsString}`,
            `arn:aws:dynamodb::${accountId}:global-table/${dyndb_table_name.valueAsString}`,
            `arn:aws:dynamodb:${region}:${accountId}:table/${dyndb_table_name.valueAsString}/backup/*`,
          ]
        }),
        new iam.PolicyStatement({
          actions: [
            "dynamodb:ListTables",
            "dynamodb:ListGlobalTables"
          ],
          effect: iam.Effect.ALLOW,
          resources: [ "*" ]
        }),
        new iam.PolicyStatement({
          actions: [
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:DescribeLogGroups",
            "logs:DescribeLogStreams",
            "logs:PutRetentionPolicy"
          ],
          effect: iam.Effect.ALLOW,
          resources: [
            `arn:aws:logs:${region}:${accountId}:log-group:*`
          ]
        }),
        new iam.PolicyStatement({
          actions: [
            "logs:PutLogEvents"
          ],
          effect: iam.Effect.ALLOW,
          resources: [
            `arn:aws:logs:${region}:${accountId}:log-group:*:log-stream:*`
          ]
        })
      ]
    });
    // Role for DynDbImporter
    const dynDbImporterRole = new iam.Role(this, 'DynDbImporterRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role for DynDbImporter Lambda'
    });
    dynDbImporterRole.attachInlinePolicy(dynDbImporterPolicy);
    dynDbImporterRole.attachInlinePolicy(cwLogsPolicy);
    dynDbImporterRole.addManagedPolicy(
      iam.ManagedPolicy.fromManagedPolicyArn(
        this, 'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess',
        'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess'));
    // DynDbImporter Lambda - Image based
    const dynDbImporter = new lambda.DockerImageFunction(this, 'DynDbImporter', {
      code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../src/lambda/dyndb-import-test')),
      description: 'Image-based Lambda to import CSV data into DynamoDB table',
      environment: {
        'log_level': 'INFO',
        'table_name': dyndb_table_name.valueAsString,
        's3_bucket': s3_bucket.valueAsString
      },
      memorySize: 512,
      role: dynDbImporterRole,
      timeout: Duration.seconds(300)
    });
  }
}
