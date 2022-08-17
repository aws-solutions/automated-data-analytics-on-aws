#!/bin/bash

# Script to scan a given docker image with tern. Assumes prepare-scan-docker-images.sh has already been run.

set -e

# Set the current working directory to the script directory
cd "$(dirname "${BASH_SOURCE[0]}")"

# Run the scan, mounting the given folder containing the Dockerfile into the tern container instance
(docker run \
  --privileged \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --mount type=bind,source=$PWD/../$2,target=/temp \
  ternd report -d /temp/Dockerfile) > ./scan-images/output/$1.txt

# TODO: consider machine-readable output format and post processing against allow or deny list of licenses
