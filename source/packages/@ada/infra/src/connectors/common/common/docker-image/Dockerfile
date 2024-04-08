FROM public.ecr.aws/amazonlinux/amazonlinux:2

RUN yum update -y
RUN yum install -y --skip-broken \
  which \
  curl \
  unzip \
  gzip \
  zip \
  jq \
  tar \
  wget

RUN yum groupinstall "Development Tools" -y && yum install gcc bzip2-devel libffi-devel sqlite-devel cmake -y

# install openssl 1.1.1w
RUN cd /usr/src && wget https://www.openssl.org/source/old/1.1.1/openssl-1.1.1w.tar.gz && tar xzf openssl-1.1.1w.tar.gz
RUN cd /usr/src/openssl-1.1.1w && ./config --prefix=/usr/local/custom-openssl --openssldir=/etc/ssl && make -j1 depend && make -j8 && make install_sw

# install python 3.12
RUN cd /usr/src && wget https://www.python.org/ftp/python/3.12.2/Python-3.12.2.tgz && tar xzf Python-3.12.2.tgz
RUN cd /usr/src/Python-3.12.2 && ./configure -C --with-openssl=/usr/local/custom-openssl --with-openssl-rpath=auto --enable-loadable-sqlite-extensions --enable-optimizations && make -j 8 && make altinstall
RUN ln -s /usr/local/bin/python3.12 /usr/bin/python3
RUN ln -s /usr/local/bin/pip3.12 /usr/bin/pip3

RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
RUN unzip awscliv2.zip
RUN ./aws/install

COPY requirements.txt requirements.txt
RUN pip3 install -r requirements.txt
