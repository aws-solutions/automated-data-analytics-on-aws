#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
SCRIPT_DIR=$(dirname "${BASH_SOURCE[0]}")
echo Current Directory: $(pwd)
rm -rf "${SCRIPT_DIR}/../public/docs/api"
mkdir -p "${SCRIPT_DIR}/../public/docs/api"
echo "cp ${SCRIPT_DIR}/../../api/docs/html2/index.html ${SCRIPT_DIR}/../public/docs/api/index.html"
cp ${SCRIPT_DIR}/../../api/docs/html2/index.html ${SCRIPT_DIR}/../public/docs/api/index.html
echo "cp ${SCRIPT_DIR}/../../api/spec.yaml ${SCRIPT_DIR}/../public/docs/api/openapi.yaml"
cp ${SCRIPT_DIR}/../../api/spec.yaml ${SCRIPT_DIR}/../public/docs/api/openapi.yaml
