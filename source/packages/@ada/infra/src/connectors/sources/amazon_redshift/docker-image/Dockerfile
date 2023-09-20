FROM ada:data-import-base-image

COPY requirements.txt requirements.txt
RUN pip3 install -r requirements.txt
COPY . .

CMD ["/script.sh"]