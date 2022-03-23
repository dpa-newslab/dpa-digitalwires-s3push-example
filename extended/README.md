# S3push Setup

There are three `node.js` projects based on the
[serverless Framework](https://www.serverless.com/) which enable you to
automatically process dpa articles received via s3push.

S3push transfers new or updated articles directly to any S3-Bucket
you own. From there, the articles can be picked up regularly, or
automatically converted into the format you need using cloud-based functions
(AWS-Lambda), and imported into your CMS.

You need admin credentials for an AWS account to build and deploy these examples.

## TL;DR

```
# please ensure aws-credentials are set to admin-user of your aws-account
npm install

cd base_resources
nano serverless.yml  # please look for "CHANGE THIS" to change bucket names and prefix

cd preprocess
nano serverless.yml   # please look for "CHANGE THIS" to change bucket names and prefix

cd sqs_receive
nano serverless.yml   # please look for "CHANGE THIS" to change bucket names and prefix

cd ..
npm run s3push-install
npm run s3push-deploy

# please use the output for the next step
```

## Requirements

This setup was tested with:

* Node.js v12.22.7
* Serverless v3.7.1

## base_resources

This project sets up the S3 bucket and a SNS-topic for incoming articles.

1. Customize the `serverless.yml` file in the editor:

```
cd base_resources

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

  <...>

provider:
  <...>
  stage:              ${opt:stage, 'dev'}  # CHANGE THIS!
  # TODO: create deployment bucket or comment the deploymentBucket with results in a default deployment bucket
  # aws s3api create-bucket --bucket <deploymentBucketName> --region eu-central-1 --create-bucket-configuration LocationConstraint=eu-central-1
  deploymentBucket:   serverless-deployments-${self:provider.region}-${env:USER,"someUser"}  # CHANGE THIS!
```

2. Deploy to AWS with the helper script we created:

```
# Start from root directory
npm install
npm run s3push-base-resources:deploy
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

To set up the delivery on dpa's side, please activate and configure
the s3push API in the customer portal of dpa
[API-Portal](https://api-portal.dpa-newslab.com). If you run into any problems
during the process, please contact our customer service.

## Preprocess

The project `preprocess` creates some infrastructure needed for two basic steps
during the import process into a CMS:

1. Ensure only new articles will be processed
2. Convert received articles to the format required by the CMS

Therefore, the project creates a SQS-queue receiving SNS-notifications for
incoming articles and a lambda function transforming new ones, saving them to S3
and sending a SNS-FIFO-notification. The function also ensures only new and unseen
articles get transformed by using a [padded_version_string](preprocess/handler.js#L47)
and a [DynamoDB-table](preprocess/handler.js#L59).

This kind of setup is necessary because the infrastructure we use to deliver our
articles is distributed and redundant. To make sure you have received everything,
delivery of articles, article changes and article deletions happens _at least once_.

The installation is handled in the same way as in `base_resources`.

1. Customize the `serverless.yml` file in the editor:

```
cd preprocess

# please ensure aws-credentials are set to admin-user of your aws-account
nano serverless.yml
```

The bucket name, the prefix in and the prefix out refer to the defined variables
in the `serverless.yml` of the `base_resources` project. So there is no need to
make changes here.

```
  s3_bucket_name: ${file(../base_resources/serverless.yml):custom.s3_bucket_name}
  s3_prefix_in: ${file(../base_resources/serverless.yml):custom.s3_prefix_in}
  s3_prefix_out: ${file(../base_resources/serverless.yml):custom.s3_prefix_out}
```

2. Deploy to AWS with the helper script we created:

```
# Start from root directory
npm install
npm run s3push-preprocess-deploy
```

### Article ordering and deduplication

The ordering of articles received through s3push is not guaranteed. Therefore it
is your responsibility to prevent old revisions of articles overwriting new
revisions. To do this, this project stores all s3push-received articles in a
DynamoDB-Table. By using URN as partition and a [padded_version_string](preprocess/handler.js#L47)
as sort key, querying for the latest version of an article is very efficient.

By [querying for the latest entry](preprocess/handler.js#L58) before transforming
an article, the project ensures that only the newest version will be further
processed. Using SNS-FIFO-notifications and SQS-FIFO-queues in all following steps
guarantees, that an article's `padded_version_string` will be monotonic increasing
in all following processing steps.

To remove duplicate articles within short time ranges (which might occur
sometimes due to technical or editorial processes), the lambda-function creates
a hash for each transformed article and uses it as
[DeduplicationId](preprocess/handler.js#L111) for the
"article transformed"-SNS-notification.

### Transformation

To implement your own transformation, customize the functions defined in
[convert.js](preprocess/convert.js) as shown for digitalwires-JSON to NITF
conversion in [nitfConvert.js](preprocess/nitfConvert.js).

If you implemented your own `convert.js` for some kind of standard-CMS format,
we'd be happy to receive a pull request to improve this project.

## Receive messages from SQS

The final step is receiving the transformed data. `sqs_receive` creates a
SQS-FIFO-queue. Transformed articles are collected there. 

To install repeat the steps used to deploy the other projects:

1. Customize the `serverless.yml` file in the editor:

```
cd sqs_receive

# please ensure aws-credentials are set to admin-user of your aws-account
nano serverless.yml
```

The bucket name refers to the defined variables
in the `serverless.yml` of the `base_resources` project. So there is no need to
make changes here.

```
  s3_bucket_name: ${file(../base_resources/serverless.yml):custom.s3_bucket_name}
```

2. Deploy to AWS with the helper script we created:

```
# Start from root directory
npm install
npm run s3push-sqs:deploy
```

For local tests a small python script fetches all messages from an AWS SQS queue
and downloads the new transformed files to the local file system.

```
python sqs_receive.py --queue_url {S3PushDeliveryQueueUrl} --output {LOCAL_DIR}
```

## How to continue

You might continue your import process by reading transformed articles from the
second SQS-queue. If you want to send them to some kind of API, please check
[dpa-digitalwires-s3push-webhook](https://github.com/dpa-newslab/dpa-digitalwires-s3push-webhook).
You'll find two more sample projects:

- [basic](https://github.com/dpa-newslab/dpa-digitalwires-s3push-webhook/tree/main/basic): How to send s3-received json objects to an API-endpoint
- [extended](https://github.com/dpa-newslab/dpa-digitalwires-s3push-webhook/tree/main/extended): How to send json objects to an API-endpoint and asynchronously check for successful CMS-insertion

## Deinstallation

You can remove everything created in this example project via NPM, including the
infrastructure configured and deployed in your AWS account.

```
# Start from root directory
npm run s3push-remove
```
