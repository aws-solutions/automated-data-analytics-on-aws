#!/usr/bin/env bash

# This script is meant to run in ECS
#
# required envs are:
#
# CLIENT_EMAIL: the Google Service Account email address <name>@<project-id>.iam.gserviceaccount.com
# CLIENT_ID: the client id 
# PRIVATE_KEY_ID: private key ID
# PRIVATE_KEY_SECRET: private key secret name to be used to retrieve the value from
# PROJECT_ID: the google cloud project id
# QUERY: base64 encoded query to be executed to extract the data
# S3_OUTPUT_BUCKET_URI: the Amazon S3 bucket where to copy the data to. eg. s3://bucket-name/path/to/data
#
# optional envs
#
# AUTH_PROVIDER_X509_CERT_URL: can com from service account configuration, default: https://www.googleapis.com/oauth2/v1/certs
# TOKEN_URI: can com from service account configuration, default: https://oauth2.googleapis.com/token
# AUTH_URI: can com from service account configuration, default: https://accounts.google.com/o/oauth2/auth
# CLIENT_X509_CERT_URL: can com from service account configuration, default: https://www.googleapis.com/robot/v1/metadata/x509/[client-email]

# from https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html
echo "preparing import ..."
if [ -z "$local" ]; then
  output=$(curl 169.254.170.2$AWS_CONTAINER_CREDENTIALS_RELATIVE_URI | head -n 1 | cut -d $' ' -f2)
  export AWS_ACCESS_KEY_ID=$(jq -r .AccessKeyId <<< "$output")
  export AWS_SECRET_ACCESS_KEY=$(jq -r .SecretAccessKey <<< "$output")
  export AWS_SECURITY_TOKEN=$(jq -r .Token <<< "$output")

  aws --version

  if [ -z "${AUTH_PROVIDER_X509_CERT_URL}" ]; then AUTH_PROVIDER_X509_CERT_URL="https://www.googleapis.com/oauth2/v1/certs"; fi;
  if [ -z "${TOKEN_URI}" ]; then TOKEN_URI="https://oauth2.googleapis.com/token"; fi;
  if [ -z "${AUTH_URI}" ]; then AUTH_URI="https://accounts.google.com/o/oauth2/auth"; fi;
  if [ -z "${CLIENT_X509_CERT_URL}" ]; then 
    ENCODED_CLIENT_EMAIL=$(jq -R -r @uri <<< $CLIENT_EMAIL)
    CLIENT_X509_CERT_URL="https://www.googleapis.com/robot/v1/metadata/x509/$ENCODED_CLIENT_EMAIL"; 
  fi;

  PRIVATE_KEY=$(aws secretsmanager get-secret-value --secret-id $PRIVATE_KEY_SECRET | jq -r '.SecretString')

  mkdir /.credentials
  jq -n "{
    type:\"service_account\",
    project_id:\"$PROJECT_ID\",
    private_key_id:\"$PRIVATE_KEY_ID\",
    private_key:\"$PRIVATE_KEY\",
    client_email:\"$CLIENT_EMAIL\",
    client_id:\"$CLIENT_ID\",
    auth_uri:\"$AUTH_URI\",
    token_uri:\"$TOKEN_URI\",
    auth_provider_x509_cert_url:\"$AUTH_PROVIDER_X509_CERT_URL\",
    client_x509_cert_url:\"$CLIENT_X509_CERT_URL\"
  }" > /.credentials/service_account.json

  export GOOGLE_APPLICATION_CREDENTIALS="/.credentials/service_account.json"

fi
echo "done"

echo "starting import ..."

python3 import.py

echo "done"
