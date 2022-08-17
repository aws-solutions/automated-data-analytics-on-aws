#!/usr/bin/env bash
set -eo pipefail

CACHE_PATH="$HOME/.dep-cache"
IMAGE_NAME='schema-preview'

docker run -v $(pwd):/app -v $CACHE_PATH:/cache -v ~/.m2:/root/.m2 -w /app public.ecr.aws/amazoncorretto/amazoncorretto:8 ./fetch-dependencies.sh $IMAGE_NAME
echo "Try to remove depenndencies in docker image"
rm -rf ../docker-image/dependencies
echo "Copy dependencies from cache to docker image"
cp -r -v $CACHE_PATH/$IMAGE_NAME ../docker-image/dependencies
ls -l ../docker-image/dependencies