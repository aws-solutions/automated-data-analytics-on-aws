FROM public.ecr.aws/amazoncorretto/amazoncorretto:8 AS build

RUN mkdir glue

RUN yum update -y
RUN yum install -y \
  python3 \
  python3-devel \
  tar \
  git \
  wget \
  zip \
  gcc-c++ \
  make \
  cmake \
  automake \
  autoconf \
  libtool \
  unzip \
  libcurl-devel

# Address scan vulnerabilities:
# https://alas.aws.amazon.com/AL2/ALAS-2022-1764.html
# https://alas.aws.amazon.com/AL2/ALAS-2022-1758.html
# https://alas.aws.amazon.com/AL2/ALAS-2022-1759.html
# https://alas.aws.amazon.com/AL2/ALAS-2022-1754.html
RUN yum update -y \
  expat \
  cyrus-sasl

WORKDIR ./glue

# Install any other lambda dependencies
RUN pip3 install \
  awswrangler regex

# copy all dependencies into glue directory
COPY ./dependencies .

ENV SPARK_HOME /glue/spark-2.4.3-bin-spark-2.4.3-bin-hadoop2.8
ENV MAVEN_HOME /glue/apache-maven-3.6.0
ENV GLUE_HOME /glue/aws-glue-libs
ENV GLUE_JARS_DIR $GLUE_HOME/jarsv1

ENV PATH $PATH:$MAVEN_HOME/bin:$SPARK_HOME/bin:$JAVA_HOME/bin:$GLUE_HOME/bin

# Generate spark-defaults.conf
ENV SPARK_CONF_DIR ${GLUE_HOME}/conf
RUN mkdir $SPARK_CONF_DIR && rm -f $SPARK_CONF_DIR/spark-defaults.conf
RUN echo "spark.driver.extraClassPath $GLUE_JARS_DIR/*" >> $SPARK_CONF_DIR/spark-defaults.conf
RUN echo "spark.executor.extraClassPath $GLUE_JARS_DIR/*" >> $SPARK_CONF_DIR/spark-defaults.conf

# Expose environment variables set by glue-setup.sh
ENV SPARK_CONF_DIR $GLUE_HOME/conf
ENV SPARK_PYTHON_PATH $SPARK_HOME/python/
ENV SPARK_PY4J_PATH $SPARK_HOME/python/lib/py4j-0.10.7-src.zip
ENV GLUE_PYTHON_PATH $GLUE_HOME/PyGlue.zip
ENV PYTHONPATH $SPARK_PYTHON_PATH:$SPARK_PY4J_PATH:$GLUE_PYTHON_PATH:$PYTHONPATH

ENV PYSPARK_DRIVER_PYTHON python3
ENV PYSPARK_PYTHON python3
ENV SPARK_SCALA_VERSION 2.11
ENV SPARK_LOCAL_IP 127.0.0.1

RUN yum clean all
RUN rm -rf /var/cache/yum

# Replace the spark-class launcher script with our own (see details in spark-class)
COPY spark-class .
RUN mv spark-class $SPARK_HOME/bin/
RUN chmod +x $SPARK_HOME/bin/spark-class

# Install lambda dependencies
COPY requirements.txt .
RUN pip3 install -r requirements.txt

# Set up sandbox environment for transform scripts
RUN mkdir /sandbox
RUN mkdir /tmp/transform-io
RUN virtualenv -p python3.7 --always-copy /sandbox

# Install sandbox environment dependencies - these are the same as glue provides, see:
# https://docs.aws.amazon.com/glue/latest/dg/aws-glue-programming-python-libraries.html#glue20-modules-provided
COPY transform-sandbox-requirements.txt /sandbox/
RUN source /sandbox/bin/activate && \
  pip3 install -r /sandbox/transform-sandbox-requirements.txt && \
  deactivate
# Ensure spark/glue libs are made available to the sandbox venv
RUN echo $SPARK_PYTHON_PATH > /sandbox/lib/python3.7/site-packages/spark-python.pth
RUN echo $SPARK_PY4J_PATH > /sandbox/lib/python3.7/site-packages/spark-py4j.pth
RUN echo $GLUE_PYTHON_PATH > /sandbox/lib/python3.7/site-packages/glue-python.pth

# Copy function code
COPY handlers/constants.py .
COPY handlers/transform.py .
COPY handlers/pull_data_sample.py .
ADD handlers/transform-templates ./transform-templates

# Run tests
FROM build AS test
COPY handlers /glue/tests
WORKDIR /glue/tests
RUN pip3 install pytest
ENV TEMP_BUCKET_NAME test-temp-bucket
ENV KEY_ID test-key-id
ENV AWS_DEFAULT_REGION ap-test-1
ENV PULL_DATA_SAMPLE_ROLE_ARN some-test-role-arn
ENV AWS_REGION=ap-test-1 \
    AWS_ACCESS_KEY_ID=test-access-key \
    AWS_SECRET_ACCESS_KEY=test-secret-access-key \
    AWS_SESSION_TOKEN=test-session-token
RUN pytest -vv
RUN echo "success" > /glue/test_result.txt

FROM build AS prod
# Docker skips the 'test' stage unless there's a dependency, so copy the test result file and delete it
COPY --from=test /glue/test_result.txt .
RUN rm /glue/test_result.txt
ENTRYPOINT [ "python3", "-m", "awslambdaric" ]
CMD [ "transform.handler" ]
