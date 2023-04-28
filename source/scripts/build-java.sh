#!/usr/bin/bash
set -e

cd /source/packages/@ada/$1
shift
echo "mvn clean $@"
mvn clean $@


