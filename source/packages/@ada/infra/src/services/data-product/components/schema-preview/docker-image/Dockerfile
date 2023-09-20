FROM public.ecr.aws/amazoncorretto/amazoncorretto:8 AS sandbox

RUN mkdir /glue

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
  libcurl-devel \
  tree

# Address scan vulnerabilities:
# https://alas.aws.amazon.com/AL2/ALAS-2022-1764.html
# https://alas.aws.amazon.com/AL2/ALAS-2022-1758.html
# https://alas.aws.amazon.com/AL2/ALAS-2022-1759.html
# https://alas.aws.amazon.com/AL2/ALAS-2022-1754.html
RUN yum update -y \
  expat \
  cyrus-sasl 

# Microsoft SQL Server driver
RUN yum install -y unixODBC-devel
RUN curl https://packages.microsoft.com/config/rhel/6/prod.repo > /etc/yum.repos.d/mssql-release.repo
RUN ACCEPT_EULA=Y yum install -y msodbcsql17

WORKDIR /glue

RUN pip3 install --upgrade pip
# Install any other lambda dependencies
RUN pip3 install \
  awswrangler[sqlserver] regex 

# copy all dependencies into glue directory
COPY ./dependencies .

ENV SPARK_HOME /glue/spark-3.1.1-amzn-0-bin-3.2.1-amzn-3
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
ENV SPARK_PY4J_PATH $SPARK_HOME/python/lib/py4j-0.10.9-src.zip
ENV GLUE_PYTHON_PATH $GLUE_HOME/PyGlue.zip
ENV PYTHONPATH $SPARK_PYTHON_PATH:$SPARK_PY4J_PATH:$GLUE_PYTHON_PATH:$PYTHONPATH

ENV PYSPARK_DRIVER_PYTHON python3
ENV PYSPARK_PYTHON python3
ENV SPARK_SCALA_VERSION 2.12
ENV SPARK_LOCAL_IP 127.0.0.1

RUN yum clean all
RUN rm -rf /var/cache/yum

# Install python deps via poetry project - https://python-poetry.org/docs/
RUN pip3 install 'poetry==1.1.15'
COPY pyproject.toml .
COPY poetry.lock .
RUN poetry config virtualenvs.create false
RUN poetry install --extras "ada-docker-image" --no-dev --no-interaction --no-ansi

# Replace the spark-class launcher script with our own (see details in spark-class)
COPY spark-class .
RUN mv spark-class $SPARK_HOME/bin/
RUN chmod +x $SPARK_HOME/bin/spark-class

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

FROM sandbox AS build
# copy all handler code
COPY handlers handlers
# remove all tests from build
RUN find ./handlers -type d -name __tests__ -exec "rm -rf {} || exit 0" \;

# Run tests
FROM build AS test
# copy all code + tests into testing dir
COPY handlers /glue/tests/handlers
# working dir must be parent of "handlers" for `handlers` modules
WORKDIR /glue/tests
# Install dev dependencies
RUN poetry install --no-root --no-interaction --no-ansi
# RUN pip3 install pytest
ENV TEMP_BUCKET_NAME test-temp-bucket
ENV KEY_ID test-key-id
ENV AWS_DEFAULT_REGION ap-test-1
ENV PULL_DATA_SAMPLE_ROLE_ARN some-test-role-arn
ENV AWS_REGION=ap-test-1 \
  AWS_ACCESS_KEY_ID=testAccessKey \
  AWS_SECRET_ACCESS_KEY=testSecretAccessKey \
  AWS_SESSION_TOKEN=testSessionToken
RUN pytest -vv --capture=tee-sys
RUN echo "success" > /glue/handlers/test_result.txt

FROM build AS prod
# Docker skips the 'test' stage unless there's a dependency, so copy the test result file and delete it
COPY --from=test /glue/handlers/test_result.txt .
RUN rm test_result.txt
# define lambda docker entry
ENTRYPOINT [ "python3", "-m", "awslambdaric" ]
CMD [ "handlers.transform.handler" ]
