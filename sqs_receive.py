# -*- coding: utf-8 -*-
#
# Copyright 2022, 2022 dpa-IT Services GmbH
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import argparse
import boto3
import botocore
import json
import os

parser = argparse.ArgumentParser(
    description='Saves all messages from an AWS SQS queue into a folder.')

parser.add_argument(
    '-q', '--queue_url', dest='queue_url', type=str, required=True,
    help='The URL of the AWS SQS queue to save.')

parser.add_argument(
    '-o', '--output', dest='output', type=str, default='queue-messages',
    help='The output folder for saved messages.')

parser.add_argument(
    '-r', '--region', dest='aws_region', type=str, required=False,
    help='The AWS region where the queue is located.')

parser.add_argument(
    '-k', '--key', dest='aws_key', type=str, required=False,
    help='Your AWS account key.')

parser.add_argument(
    '-s', '--secret', dest='aws_secret', type=str, required=False,
    help='Your AWS account secret.')

parser.add_argument(
    '-d', '--delete', dest='delete', default=False, action='store_true',
    help='Whether or not to delete saved messages from the queue.')

args = parser.parse_args()

if not os.path.exists(args.output):
    os.makedirs(args.output)

aws_region = args.aws_region if args.aws_region else os.environ.get(
    'AWS_REGION', 'eu-central-1')
output = args.output

sqs_client = boto3.client('sqs', region_name=aws_region)
queue_url = args.queue_url
s3_client = boto3.client('s3', region_name=aws_region)


def remove_message(msg):
    """Delete received message from queue"""
    receipt_handle = msg.get('ReceiptHandle')
    try:
        # Delete received message from queue
        sqs_client.delete_message(QueueUrl=queue_url,
                                  ReceiptHandle=receipt_handle)
    except Exception as e:
        print('ERROR during delete_message')
        raise e


def receive_messages():
    """Poll queue for new messages and save to local disk"""
    count = 0
    while True:
        response = sqs_client.receive_message(
            QueueUrl=queue_url,
            AttributeNames=[
                'SentTimestamp'
            ],
            MaxNumberOfMessages=1,
            MessageAttributeNames=['All'],
            VisibilityTimeout=5,
            WaitTimeSeconds=3
        )

        messages = response.get('Messages', [])
        print('Number of messages: ', len(messages))
        for msg in messages:
            body = json.loads(msg.get('Body', {}))
            records = body.get('Records', [])

            if len(records) == 0:
                remove_message(msg)
                continue

            rec = records[0]

            # Example Record-Entry
            #{
            #    'eventTime': '2019-02-25T11:05:19.845Z',
            #    'requestParameters': {
            #        'sourceIPAddress': 'xxx'
            #    },
            #    'eventSource': 'aws:s3',
            #    'awsRegion': 'eu-central-1',
            #    'responseElements': {
            #        'x-amz-id-2': 'XW4VRt20iWL3udedacv8ptD+Tsw4Ln1k24+yTNEDBTZKOTBdtOmN9TkuZzgU4NnvJrDFeds/HTw=',
            #        'x-amz-request-id': 'EB2FE3E39A425E11'
            #    },
            #    'eventVersion': '2.1',
            #    's3': {
            #        'configurationId': '4c8b6a07-d8ea-47e8-8783-001f65adb852',
            #        'bucket': {
            #            'name': 'xxx',
            #            'ownerIdentity': {
            #                'principalId': 'A2DK60M1RTRDJ9'
            #            },
            #            'arn': 'arn:aws:s3:::xxx'
            #        },
            #        'object': {
            #            'key': 'transformed/prefix/feed/infoline-vor-24h/articles/2019-02-25T11-05-18-dpa-190223-99-103479-wl18dv-v4-te6drxmlfndlar6l6prk2mgermu5fyyc.xml',
            #            'sequencer': '005C73CBEFCB80D11C',
            #            'size': 8859,
            #            'eTag': '0b01b3b24b78d08fdb3028b1a8e14d50'
            #        },
            #        's3SchemaVersion': '1.0'
            #    },
            #    'eventName': 'ObjectCreated:Put',
            #    'userIdentity': {
            #        'principalId': 'AWS:AROAIPSIV4OVF6M7HBQDS:xxx'
            #    }
            #}

            event_name = rec.get('eventName')
            if event_name != 'ObjectCreated:Put':
                remove_message(msg)
                continue

            s3_data = rec.get('s3', {})
            s3_bucket_name = s3_data.get('bucket', {}).get('name')
            s3_xml_fn = s3_data.get('object', {}).get('key')
            local_filename = os.path.join(output, os.path.basename(s3_xml_fn))

            try:
                s3_client.download_file(s3_bucket_name, s3_xml_fn,
                                        local_filename)
            except botocore.exceptions.ClientError as e:
                if e.response['Error']['Code'] == "404":
                    print("The object does not exist.")
                else:
                    raise

            count += 1
            print('{} Saved message to {}'.format(count, local_filename))
            remove_message(msg)


if __name__ == '__main__':
    receive_messages()
