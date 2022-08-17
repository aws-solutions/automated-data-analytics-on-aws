#!/bin/bash

# Script to download and build the tern docker container, used for scanning docker images

set -e

# Set the current working directory to the script directory
cd "$(dirname "${BASH_SOURCE[0]}")"

# Clean up previous runs
rm -rf ./scan-images
mkdir -p ./scan-images/output

# Download and extract tern
curl https://github.com/tern-tools/tern/archive/refs/tags/v2.9.1.tar.gz -L -o ./scan-images/tern.tar.gz
cd ./scan-images
tar -xvzf tern.tar.gz
cd tern-2.9.1

# Build the ternd docker image used for scans
docker build -f docker/Dockerfile -t ternd .
