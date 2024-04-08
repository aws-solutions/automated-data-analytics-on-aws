
FROM ada:data-import-base-image

RUN curl -sSL https://sdk.cloud.google.com | bash > /dev/null
ENV PATH $PATH:/root/google-cloud-sdk/bin

RUN pip3 install gsutil
COPY . .

CMD ["/script.sh"]
