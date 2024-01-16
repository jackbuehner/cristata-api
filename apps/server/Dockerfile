#Each instruction in this file creates a new layer
# use node as the base image
FROM node:18-alpine3.18
# create a new directory for the app files
RUN mkdir -p /usr/src/_apps/server
# set working directory in the container
WORKDIR /usr/src/_apps/server
# copy the source code of app into the container dir
COPY ../../../ /usr/src/_apps/server
RUN find . -name \*.env -type f -delete
RUN find . -name \*.turbo -type f -delete
RUN find . -name \node_modules -type f -delete
RUN find . -name \src -type f -delete
RUN find . -name \tests -type f -delete
# install the dependencies into the container
RUN npm install
# build the app
RUN npm run build
# expose this port from the container
EXPOSE 3000
# start the app
CMD npm run start:server
