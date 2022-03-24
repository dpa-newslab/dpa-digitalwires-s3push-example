 
# S3-Push Example

These are instructions on how to set up an S3 bucket in your own AWS account to
receive articles via s3push. New articles are sent to a SQS-queue using SNS-notifications.

## TL;DR

```
# please ensure aws-credentials are set to admin-user of your aws-account
npm install

nano serverless.yml   # please look for "CHANGE THIS" to change bucket names and prefix

npm run s3push-deploy

# please use the output for the next step
```

## Requirements

### NodeJS

Make sure that you have installed [Node.js](https://nodejs.org/en/download/)
on your system. Please use a version >=12.

```
node --version
v12.22.7
```

### Serverless Framework

Make sure that you have installed [serverless.com](https://www.serverless.com)
on your system. The current project was tested with `v3.8.0`.

```
npm install -g serverless
```

### AWS Credentials

Configure your AWS credentials. You can find more information 
[here](https://docs.aws.amazon.com/cli/latest/userguide/cli-config-files.html):

If the file `~/.aws/credentials` exists, the required environment variable
in the shell can reference it:

```
export AWS_PROFILE=...
```

Or you copy the AWS credentials after creating a user directly into the shell
and set the following environment variables:

```
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
```

## Instructions

1. Adjust the `serverless.yml` file in the editor:

Please select an S3 bucket name that does not yet exist and that does not have
any slashes ("/") in the name and in the prefix.

```
custom:
  # Please set bucket name and prefix
  s3_bucket_name: ${self:custom.global_resource_prefix}-dpa-s3push-incoming-mycompany-com # CHANGE THIS!
  s3_prefix_in: prefix # CHANGE THIS!
```

2. Deploy to AWS with the helper script we created:

```
npm install
npm run s3push-deploy
```

3. If the installation is successful, the following output appears:

```
Stack Outputs
S3PushSecretAccessKey: xxxx
S3PushUrlPrefix: s3://<s3_s3push_bucket_name>/<s3_s3push_prefix>
S3PushAccessKeyId: AKIAIxxxxx
...
```

To set up the delivery, either contact your contact person at dpa or configure
the API in the [customer portal](https://api-portal.dpa-newslab.com).

## Accessing the data

Whether data has been delivered to your S3 bucket can be tested with the
following command:

```
aws s3 ls s3://<s3_s3push_bucket_name>/<s3_s3push_prefix> --recursive
```

## Receive messages from SQS

The final step is receiving the data. A small python script fetches all messages
from an AWS SQS queue and downloads the files to the local file system.

```
python sqs_receive.py --queue_url {S3PushDeliveryQueueUrl} --output {LOCAL_DIR}
```

## Uninstalling

Removing the package via NPM:

```
npm run s3push-remove
```

Removing the AWS S3 bucket:

```
aws s3 rm s3://<s3_s3push_bucket_name>/<s3_s3push_prefix --recursive
```

## Next steps

In the repository [extend example](https://github.com/dpa-newslab/dpa-digitalwires-s3push-example/tree/main/extended) you will find another
best practice in which we will show you how to transform the incoming JSON
articles into other formats using a lambda trigger, bring articles in the correct order and deduplicate them. 
