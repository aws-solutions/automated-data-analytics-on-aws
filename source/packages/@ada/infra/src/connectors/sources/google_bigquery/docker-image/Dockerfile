FROM ada:data-import-base-image

RUN curl -sSL https://sdk.cloud.google.com | bash > /dev/null
ENV PATH $PATH:/root/google-cloud-sdk/bin

COPY requirements.txt requirements.txt
RUN pip3 install -r requirements.txt
COPY . .

CMD ["/script.sh"]
