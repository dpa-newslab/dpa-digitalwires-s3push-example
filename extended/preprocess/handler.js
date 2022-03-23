/* -*- coding: utf-8 -*-

 Copyright 2022, 2022 dpa-IT Services GmbH

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

'use strict'

const crypto = require('crypto')
const AWS = require('aws-sdk')
const moment = require('moment')

const {convert, getFileEnding, processingAllowed} = require('./convert')
//Use this line to convert new articles to NITF
//const {convert, getFileEnding, processingAllowed} = require('./nitfConvert')

const S3 = new AWS.S3({signatureVersion: 'v4'})
const docclient = new AWS.DynamoDB.DocumentClient({apiVersion: '2021-08-10'})
const sns = new AWS.SNS({apiVersion: '2010-03-31'})

module.exports.handle_queue = async (event, context, callback) => {
  console.log('EVENT: %j', event)

  const records = event.Records
  if (records.length === 0) return
  const rec = records[0]
  const body = JSON.parse(rec.body)
  try {
    body.Records.forEach(async record => {
      await preprocess(record)
    })
    callback(null)
  } catch (err) {
    console.log(err)
    callback(err)
  }
}

const preprocess = async (record) => {
    const Bucket = record.s3.bucket.name,
          Key = record.s3.object.key

    console.log(`reading s3://${Bucket}/${Key}`)
    const data = await S3.getObject({ Bucket, Key }).promise()
    const new_article = JSON.parse(data.Body.toString('utf-8'))

    // Save received article to the TopicleVersionTable
    await docclient.put({
      TableName: process.env.TABLE_NAME,
      Item: {
        urn: new_article.urn,
        // Create sort key to make efficient latest-version-querying possible
        padded_version_string: `${new_article.version.toString().padStart(16, '0')}/${moment.utc(new_article.version_created).format('YYYY-MM-DDTHH:mm:ss[Z]')}/${moment.utc(new_article.updated).format('YYYY-MM-DDTHH:mm:ss[Z]')}`,
        s3: {
          bucket: Bucket,
          key: Key,
          versionId: record.s3.object.versionId
        },
        ExpirationTime: moment().add(30, "day").unix() //Expire entry in 30 days
      }
    }).promise()

    // Query for latest received version of received article's URN
    const latest_entry = await docclient.query({
      TableName: process.env.TABLE_NAME,
      KeyConditionExpression: 'urn = :urn',
      ExpressionAttributeValues: {
        ':urn': new_article.urn
      },
      // Use strongly consistent read to ensure the previous put has already been done. (Alternatively one might end this lambda function before this step and move all other tasks to another lambda being triggered by a DynamoDB-stream, so the put above will trigger further processing)
      ConsistentRead: true,
      Limit: 1,
      // Sort by descending padded_version_string to get newest version
      ScanIndexForward: false
    }).promise()

    // Load latest article
    const latest_data = await S3.getObject({ 
      Bucket: latest_entry.Items[0].s3.bucket, 
      Key: latest_entry.Items[0].s3.key,
      VersionId: latest_entry.Items[0].s3.versionId
     }).promise()


    const article = JSON.parse(latest_data.Body.toString('utf-8'))

    // Check if further processing and transformation of the article is allowed. There might be cases where this shouldn't be done (e.g. embargoed articles, ...)
    if (!processingAllowed(article)) {
      //stop here if transformation and further processing is not allowed
      return null
    }

    // Convert the article to another format
    const converted_article = convert(article)
    console.log(converted_article)

    const prefix_to_remove = /^users\/user01\//
    const destination_key = `${process.env.S3_BUCKET_PREFIX_OUT}/${Key.replace(prefix_to_remove,'').replace(/\.json$/, getFileEnding())}`

    console.log(`writing transformed article to s3://${Bucket}/${destination_key}`)
    const object_data = await S3.putObject({ Body: converted_article, Bucket, Key: destination_key}).promise()

    //Use custom sns-notification to use AWS-fifo-deduplication based on the article's content
    await sns.publish({
      Message: JSON.stringify({
        'Records': [{
          's3': {
            'bucket': {'name': Bucket},
            'object': {'key': destination_key, 'versionId': object_data.VersionId}
          },
          'eventName': 'ObjectCreated:Put'
        }]
      }),
      MessageGroupId: article.urn,
      TopicArn: process.env.TOPIC_ARN,
      // Compute hash over the transformed article's content to ensure, this notification occurs only once within 5 minutes
      MessageDeduplicationId: crypto.createHash('md5').update(converted_article).digest('hex')
    }).promise()

    return destination_key
}

