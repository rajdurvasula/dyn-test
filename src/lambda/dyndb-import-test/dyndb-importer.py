import os
import sys
import boto3
import json
import logging
import traceback
from datetime import datetime, date

session = boto3.Session()

LOGGER = logging.getLogger()
if 'log_level' in os.environ:
    LOGGER.setLevel(os.environ['log_level'])
    LOGGER.info('Log level set to %s' % LOGGER.getEffectiveLevel())
else:
    LOGGER.setLevel(logging.ERROR)

def json_serial(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError('Type %s not serializable' % type(obj))

def add_identity(db_client, table_name, account_id, owner_email, tech_owner_email):
    try:
        db_client.put_item(
            TableName=table_name,
            Item = {
                'account_id': {
                    'S': account_id
                },
                'account_email': {
                    'S': owner_email
                },
                'tech_owner_email': {
                    'S': tech_owner_email
                }
            }
        )
        LOGGER.info('Row created')
    except Exception as e:
        LOGGER.error(f'failed in put_item(..): {e}')
        LOGGER.error(str(e))
        LOGGER.error(traceback.format_exc())

def delete_if_exists(db_client, table_name):
    waiter_config = {
        'Delay': 60,
        'MaxAttempts': 5
    }
    table_found = False
    try:
        paginator = db_client.get_paginator('list_tables')
        iterator = paginator.paginate()
        for page in iterator:
            for table in page['TableNames']:
                if table_name == table:
                    table_found = True
                    break
    except Exception as e:
        LOGGER.error(f'Failed in list_tables(..): {e}')
        LOGGER.error(str(e))
        raise ValueError(traceback.format_exc())
    if not table_found:
        LOGGER.info('Table: {} not found.'.format(table_name))
    else:
        LOGGER.info('Table: {} found. Deleting Table before data import ..'.format(table_name))
        try:
            response = db_client.delete_table(TableName=table_name)
            LOGGER.info(json.dumps(response, default=json_serial, indent=2))
            waiter = db_client.get_waiter('table_not_exists')
            waiter.wait(TableName=table_name, WaiterConfig=waiter_config)
            LOGGER.info('Table: {} does not exist'.format(table_name))
        except Exception as e:
            LOGGER.error(f'Failed in delete_table(..): {e}')
            LOGGER.error(str(e))
            raise ValueError(traceback.format_exc())

def import_data(db_client, table_name, s3_bucket):
    LOGGER.info('Importing data into Table: {} from S3 Bucket: {} ..'.format(table_name, s3_bucket))
    s3_bucket_source = { 
        'S3Bucket': s3_bucket
    }
    input_format_options = {
        'Csv': {
            'Delimiter': ',',
            'HeaderList': [ 'account_id', 'owner_email', 'tech_owner_email' ]
        }
    }
    table_creation_params = {
        'TableName': table_name,
        'AttributeDefinitions': [
            {
                'AttributeName': 'account_id',
                'AttributeType': 'S'
            },
            {
                'AttributeName': 'owner_email',
                'AttributeType': 'S'
            }
        ],
        'KeySchema': [
            {
                'AttributeName': 'account_id',
                'KeyType': 'HASH'
            },
            {
                'AttributeName': 'owner_email',
                'KeyType': 'RANGE'
            }
        ],
        'BillingMode': 'PAY_PER_REQUEST'
    }
    try:
        response = db_client.import_table(
            S3BucketSource=s3_bucket_source,
            InputFormat='CSV',
            InputFormatOptions=input_format_options,
            TableCreationParameters=table_creation_params
        )
        LOGGER.info(json.dumps(response, default=json_serial, indent=2))
        import_table_desc = response['ImportTableDescription']
        return {
            'TableArn': import_table_desc['TableArn'],
            'ImportArn': import_table_desc['ImportArn'],
            'ImportStatus': import_table_desc['ImportStatus'],
            'S3Bucket': import_table_desc['S3BucketSource']['S3Bucket']
        }
    except Exception as e:
        LOGGER.error(f'Failed in import_table(..): {e}')
        LOGGER.error(str(e))
        LOGGER.error(traceback.format_exc())

def lambda_handler(event, context):
    LOGGER.info(f"REQUEST RECEIVED: {json.dumps(event, default=str)}")
    table_name = os.environ['table_name']
    s3_bucket = os.environ['s3_bucket']
    db_client = session.client('dynamodb')
    delete_if_exists(db_client, table_name)
    result = import_data(db_client, table_name, s3_bucket)
    return result
