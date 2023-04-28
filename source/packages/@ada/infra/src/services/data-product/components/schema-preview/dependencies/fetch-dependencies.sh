#!/usr/bin/env bash
set -eo pipefail

DEPENDENCY_DIR=/cache/$1
LAST_UPDATE_FILE_NAME=last-update-date.txt
LAST_UPDATE_DATE_FILE=$DEPENDENCY_DIR/$LAST_UPDATE_FILE_NAME

FETCH_DEPENDENCY=false

# Check if dependency cache exists and expired
if [ ! -f "$LAST_UPDATE_DATE_FILE" ]; then
    if [ -d $DEPENDENCY_DIR ]; then
        echo "No valid last update date file found for cached dependencies" 
        rm -rf $DEPENDENCY_DIR/*
    else  
        echo "Cached dependencies doesn't exist" 
        mkdir -p $DEPENDENCY_DIR
    fi 
    FETCH_DEPENDENCY=true
else
    REFRESH_DATE=$(date -d "-10 days" +%Y%m%d)
    LAST_UPDATE_DATE="$(<$LAST_UPDATE_DATE_FILE)"
    echo "Found last update date is $LAST_UPDATE_DATE, refresh date (now -10 days) is $REFRESH_DATE"
    if [ "$REFRESH_DATE" -gt "$LAST_UPDATE_DATE" ]; then 
        echo "Cached dependencies expired, remove stale dependencies"
        rm -rf $DEPENDENCY_DIR/*
        FETCH_DEPENDENCY=true
    else 
        echo "Cached dependencies not expired."
    fi
fi

if [ "$FETCH_DEPENDENCY" = true ]; then
    echo "Refreshing dependencies"
    
    yum install -y git wget zip tar

    pwd
    ls -l $DEPENDENCY_DIR
    cd $DEPENDENCY_DIR
    
    # dependency source
    GLUE_SOURCE=https://github.com/awslabs/aws-glue-libs.git
    SPARK_SOURCE=https://aws-glue-etl-artifacts.s3.amazonaws.com/glue-3.0/spark-3.1.1-amzn-0-bin-3.2.1-amzn-3.tgz
    MAVEN_SOURCE=https://aws-glue-etl-artifacts.s3.amazonaws.com/glue-common/apache-maven-3.6.0-bin.tar.gz

    # download dependencies
    git clone -b glue-3.0 $GLUE_SOURCE
    wget $SPARK_SOURCE
    wget $MAVEN_SOURCE

    tar zxfv apache-maven-3.6.0-bin.tar.gz
    tar xfv spark-3.1.1-amzn-0-bin-3.2.1-amzn-3.tgz

    rm spark-3.1.1-amzn-0-bin-3.2.1-amzn-3.tgz
    rm apache-maven-3.6.0-bin.tar.gz

    MAVEN_HOME="$DEPENDENCY_DIR/apache-maven-3.6.0"
    GLUE_HOME="$DEPENDENCY_DIR/aws-glue-libs"
    GLUE_JARS_DIR="$GLUE_HOME/jarsv1"

    # Inlining the glue setup script actions
    cd $GLUE_HOME && rm -f PyGlue.zip && zip -r PyGlue.zip awsglue

    # Run mvn copy-dependencies target to pull the glue jars to the jars directory
    $MAVEN_HOME/bin/mvn -f $GLUE_HOME/pom.xml -DoutputDirectory=$GLUE_JARS_DIR dependency:copy-dependencies

    # Delete netty jars since they clash with those bundled with spark
    # https://github.com/awslabs/aws-glue-libs/issues/25
    rm -rf $GLUE_JARS_DIR/netty*

    # Write the last update date
    date +%Y%m%d > $LAST_UPDATE_DATE_FILE

    echo "Dependency cache is populated on $(date +%Y%m%d)"
else
    echo "Use cached dependencies"
fi