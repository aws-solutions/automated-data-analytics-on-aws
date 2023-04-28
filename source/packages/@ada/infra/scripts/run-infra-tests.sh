#/usr/bin/bash 
set -e

apt update -y
apt install -y openjdk-11-jdk-headless net-tools

cd /source/packages/@ada/infra
yarn test:node14 $@

# fix up the path
sed -i "s|\/source\/packages\/|"$SOURCE_DIR"\/source\/packages\/|g" ./coverage/coverage-final.json
