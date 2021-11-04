# S3push Setup

There are two `node.js` projects which enable you to receive articles via
s3push.

S3push transfers new or updated articles directly to any S3-Bucket
of the customer. From there, the articles can be picked up regularly or
transformed into customer-specific formats using cloud-based functions
(AWS-Lambda), and can be automatically imported into the customer's CMS.

## TL;DR

```
npm install

# please ensure aws-credentials are set to admin-user of your aws-account
cd sqs_receive
nano serverless.yml   # please change bucket name and prefix

cd nitf_transform
nano serverless.yml   # please change bucket name and prefix

cd ..
npm run s3push-deploy

# please use the output for the next step
```

## Requirements

This setup was tested with:

* Node.js v12.22.7
* Serverless v2.64.0

## sqs_receive

This project sets up the S3 bucket and defines a Simple Queue Service (SQS).

1. Customize the `serverless.yml` file in the editor:

```
cd sqs_receive

# please ensure aws-credentials are set to admin-user of your aws-account
nano serverless.yml
```

Please select a name for the S3 bucket that does not yet exist and select a
proper name for the `prefix_in` and `prefix_out`. (IMPORTANT: no leading or
trailing slashes ("/") and lowercase only)

```
custom:
  ####
  #### Please set bucket name and prefix_in/_out (lowercase only, no leading and trailing slashes)
  ####
  s3_bucket_name: ${self:custom.global_resource_prefix}-dpa-s3push-incoming-mycompany-com # CHANGE THIS!
  s3_prefix_in: prefix # CHANGE THIS!
  s3_prefix_out: transformed # CHANGE THIS!
```

2. Deploy to AWS with the helper script we created:

```
# Start from root directory
npm install
npm run s3push-sqs:deploy
```

3. If the installation was successful, the following output appears:

```
Stack Outputs
S3PushDeliveryQueueUrl: https://sqs.eu-central-1.amazonaws.com/{accountId}/{qs_name}]
S3PushSecretAccessKey: xxxx
S3PushUrlPrefix: s3://{s3_bucket_name}/{s3_prefix_in}
S3PushAccessKeyId: AKIAIxxxxx
...
```

To set up the delivery, please either contact your contact person or configure
the API in the customer portal of dpa [API-Portal](https://api-portal.dpa-newslab.com).

The URL of the queue is useful to store all incoming transformed files the local
file system which is described in the last section ([Receive messages from SQS](#receive-messages-from-SQS)).

# Transformations

To transform all incoming JSON articles of the S3-Bucket to the respective
format via a lambda-trigger we provide the project `nitf_transform` which
transforms JSON to NITF.

The installation of both are handled in the same way.

1. Customize the `serverless.yml` file in the editor:

```
cd nitf_transform

# please ensure aws-credentials are set to admin-user of your aws-account
nano serverless.yml
```

The bucket name, the prefix in and the prefix out refer to the defined variables
in the `serverless.yml` of the `sqs_receive` project. So there is no need to
make changes here.

```
  s3_bucket_name: ${file(../sqs_receive/serverless.yml):custom.s3_bucket_name}
  s3_prefix_in: ${file(../sqs_receive/serverless.yml):custom.s3_prefix_in}
  s3_prefix_out: ${file(../sqs_receive/serverless.yml):custom.s3_prefix_out}
```

2. Deploy to AWS with the helper script we created:

```
# Start from root directory
npm install
npm run nitf-transform:deploy
```

## Receive messages from SQS

The final step is receiving the data. A small python script fetches all messages
from an AWS SQS queue and downloads the new transformed files to the local file
system.

```
python sqs_receive.py --queue_url {S3PushDeliveryQueueUrl} --output {LOCAL_DIR}
```

## Deinstallation

Remove packages via NPM:

```
# Start from root directory
npm run s3push-sqs-remove
```
