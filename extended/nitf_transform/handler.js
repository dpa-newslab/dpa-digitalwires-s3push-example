/* -*- coding: utf-8 -*-

 Copyright 2021, 2021 dpa-IT Services GmbH

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

const AWS = require('aws-sdk')
const { convert, hasCurrentRubric } = require('./convert')

const S3 = new AWS.S3({signatureVersion: 'v4'})

module.exports.handler = async (event, context, callback) => {
  console.log('EVENT: %j', event)

  try {
    event.Records.forEach(async record => {
      await transform(record)
    })
    callback(null)
  } catch (err) {
    console.log(err)
    callback(err)
  }
}

const transform = async (record) => {
    const Bucket = record.s3.bucket.name,
          Key = record.s3.object.key

    console.log(`reading s3://${Bucket}/${Key}`)
    const data = await S3.getObject({ Bucket, Key }).promise()
    const article = JSON.parse(data.Body.toString('utf-8'))

    if (!hasCurrentRubric(article)) {
      // stop here if no current rubric exists - those articles had been removed in NITF legacy delivery
      console.log('No current rubric in article with URN', article.urn)
      return null
    }

    const converted_article = convert(article)
    console.log(converted_article)

    const prefix_to_remove = /^users\/user01\//
    const destination_key = 'transformed/'+Key.replace(prefix_to_remove,'').replace(/\.json$/, '.xml')

    console.log(`writing xml article to s3://${Bucket}/${destination_key}`)
    await S3.putObject({ Body: converted_article, Bucket, Key: destination_key}).promise()

    // post some notification here...

    return destination_key
}

