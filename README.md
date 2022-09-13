# Welcome to your CDK TypeScript project

This is a simple project using CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Purpose
- Import CSV data file from S3 Bucket into DynamoDB Table

## Notes
- S3 Bucket should have only CSV data files and nothing else
  - Not using S3KeyPrefix parameter in dynamodb import call
- S3 Bucket belongs to same account where cdk is executed
  - Lambda function is created as part of deployment
  - Required IAM Roles are created as part of deployment
- Lambda function is Image-based
  - It appears default runtime provisioned by AWS for Lambda function does not have latest `boto3` version
  - So, we use Image-based Lambda function here

## CSV file format
- Name: `account-emails.csv`
- Header:
```
account_id,owner_email,tech_owner_email
```
- Data:
```
123456789111,abcd.efgh.ijkl@example.com,abcd.efgh.ijkl@example.com
234567892222,abcd.efgh.ijkl@example.com,abcd.efgh.ijkl@example.com
```

## Useful commands

* `cdk deploy --parameters S3Bucket=audit-413157014023-accounts --parameters DynamoDBTableName=rd-sample`
* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template
