FROM public.ecr.aws/amazonlinux/amazonlinux:2

RUN yum update -y
RUN yum install -y --skip-broken \
  which \
  curl \
  python3 \
  python3-devel \
  unzip \
  gzip \
  zip \
  jq \
  tar

RUN curl -sSL https://sdk.cloud.google.com | bash
ENV PATH $PATH:/root/google-cloud-sdk/bin

RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
RUN unzip awscliv2.zip
RUN ./aws/install

COPY requirements.txt requirements.txt
RUN pip3 install -r requirements.txt
