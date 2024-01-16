# use the official MongoDB image as the base image
FROM mongo:latest

# Cceate the keyfile directory and generate the keyfile during the image build
RUN mkdir /data/keys
RUN openssl rand -base64 756 > /data/keys/keyfile
RUN chmod 600 /data/keys/keyfile
RUN chown 999 /data/keys/keyfile
RUN chgrp 999 /data/keys/keyfile

CMD ["mongod", "--replSet", "rs0", "--bind_ip_all", "--keyFile", "/data/keys/keyfile"]
