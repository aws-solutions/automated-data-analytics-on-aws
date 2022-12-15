# Schema Preview Docker Image

This docker image provides the necessary environment to run glue python scripts in a lambda function.

## Dev

### Make sure you have the lambda runtime env installed

```
mkdir -p ~/.aws-lambda-rie && curl -Lo ~/.aws-lambda-rie/aws-lambda-rie \
  https://github.com/aws/aws-lambda-runtime-interface-emulator/releases/latest/download/aws-lambda-rie \
  && chmod +x ~/.aws-lambda-rie/aws-lambda-rie
```

(See https://docs.aws.amazon.com/lambda/latest/dg/images-test.html#images-test-add for more details)

### Build the docker image

```
docker build -t ada:schema-preview .
```

### Run the lambda

Change the aws profile `default` below as appropriate for your aws credentials.

You can also adjust the the command to select the appropriate lambda handler.

```
docker run -d -v ~/.aws-lambda-rie:/aws-lambda -p 9000:8080 \
  --env AWS_ACCESS_KEY_ID="$(aws configure get default.aws_access_key_id)" \
  --env AWS_SECRET_ACCESS_KEY="$(aws configure get default.aws_secret_access_key)" \
  --env AWS_SESSION_TOKEN="$(aws configure get default.aws_session_token)" \
  --env AWS_REGION="$(aws configure get default.region)" \
  --env TEMP_BUCKET_NAME=my-temp-s3-bucket \
  --env KEY_ID=your-kms-key \
  --env PULL_DATA_SAMPLE_ROLE_ARN=arn-of-a-role-in-your-account-eg-Admin \
  --entrypoint /aws-lambda/aws-lambda-rie ada:schema-preview \
  python3 -m awslambdaric handlers.transform.handler
```

### Call the lambda

```
curl -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" -d '{}'
```

If making changes to the handler, you will need to stop your docker container, rebuild and rerun.
