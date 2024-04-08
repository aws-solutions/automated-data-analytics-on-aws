#!/bin/bash

ACCOUNT=$(aws sts get-caller-identity | jq -r '.Account')
REGION=${AWS_REGION:=us-east-1}
ECR_REPO="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com"
TAG=${VERSION_TAG:=latest}

# clone superset source
git clone --depth 1 --branch 3.1.1 https://github.com/apache/superset.git
cd superset
cp ../Dockerfile.* .

APP_IMAGE=${ECR_REPO}/superset-app:${TAG}
NODE_IMAGE=${ECR_REPO}/superset-node:${TAG}
DB_IMAGE=${ECR_REPO}/superset-postgres:${TAG}

# build docker images
aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ECR_REPO}

aws ecr describe-repositories --repository-names "superset-app" "superset-node" "superset-postgres"
if [[ $? == 254 ]]; then
    aws ecr create-repository --repository-name superset-app
    aws ecr create-repository --repository-name superset-node
    aws ecr create-repository --repository-name superset-postgres
fi;

docker build -f Dockerfile.DB -t ${DB_IMAGE} .
docker build -f Dockerfile.Node -t ${NODE_IMAGE} .
docker build -f Dockerfile.SuperSet -t ${APP_IMAGE} --build-arg ADA_ATHENA_ENDPOINT_URL=$ADA_ATHENA_ENDPOINT_URL .

docker push ${DB_IMAGE}
docker push ${NODE_IMAGE}
docker push ${APP_IMAGE}

cd ..
# download Partner solution for AWS VPC
echo "Download AWS Partner Solution to deploy VPC for Superset"
curl -o superset-vpc.yaml https://aws-ia-us-east-1.s3.us-east-1.amazonaws.com/cfn-ps-aws-vpc/templates/aws-vpc.template.yaml

# download GCR solution template
## pip install cfn-flip
echo "Download Superset Solution template"
curl -o superset.yaml https://aws-ia-us-east-1.s3.us-east-1.amazonaws.com/cfn-ps-apache-superset/templates/superset-entrypoint-existing-vpc.template.yaml
python update-template.py superset.yaml superset-updated.yaml $DB_IMAGE $NODE_IMAGE $APP_IMAGE $ADA_ATHENA_ENDPOINT_URL

# deploy VPC
echo "Deploying VPC for Superset"
AVAILABLITY_ZONES=$(aws ec2 describe-availability-zones --region=$REGION | jq -r '.AvailabilityZones[].ZoneName' | head -n2 |  tr '\n' ',' |  sed 's/,$//')
echo "Deploy VPC to 2 Availibility Zones $AVAILABLITY_ZONES"
aws cloudformation deploy --template-file superset-vpc.yaml --stack-name superset-vpc --s3-bucket $CFN_TEMP_BUCKET \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --parameter-overrides "AvailabilityZones=$AVAILABLITY_ZONES" "NumberOfAZs=2" "CreateVPCFlowLogsToCloudWatch=true"

# read output
VPC_OUTPUT=$(aws cloudformation describe-stacks --stack-name superset-vpc --region=$REGION)
VPC_ID=$(echo $VPC_OUTPUT | jq -r '.Stacks[0].Outputs[] | select (.OutputKey == "VPCID") | .OutputValue')
PUBLIC_SUBNET_1=$(echo $VPC_OUTPUT | jq -r '.Stacks[0].Outputs[] | select (.OutputKey == "PublicSubnet1ID") | .OutputValue')
PUBLIC_SUBNET_2=$(echo $VPC_OUTPUT | jq -r '.Stacks[0].Outputs[] | select (.OutputKey == "PublicSubnet2ID") | .OutputValue')
PRIVATE_SUBNET_1=$(echo $VPC_OUTPUT | jq -r '.Stacks[0].Outputs[] | select (.OutputKey == "PrivateSubnet1AID") | .OutputValue')
PRIVATE_SUBNET_2=$(echo $VPC_OUTPUT | jq -r '.Stacks[0].Outputs[] | select (.OutputKey == "PrivateSubnet2AID") | .OutputValue')

# deploy Superset
echo "Deploying Superset Solution"
aws cloudformation deploy --template-file superset-updated.yaml --stack-name superset --s3-bucket $CFN_TEMP_BUCKET \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --parameter-overrides 'SuperSetUserPassword=DevTest12345!' "PublicSubnet1=$PUBLIC_SUBNET_1" "PublicSubnet2=$PUBLIC_SUBNET_2" "PrivateSubnet1=$PRIVATE_SUBNET_1" "PrivateSubnet2=$PRIVATE_SUBNET_2" "Vpc=$VPC_ID"

