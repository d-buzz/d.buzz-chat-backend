# Initiate a container to build the application in.
FROM alpine:latest
ENV NODE_ENV=build
WORKDIR /usr/src/app

# Copy the necessary files into container.\
# COPY .env ./
COPY package*.json ./
COPY yarn.lock ./
# COPY resources/CREATE.sql ./

# Install the dependencies required to build and run the application.

# RUN apk add --no-cache python3 \
RUN apk add --no-cache npm \
    nodejs \
    postgresql14

# Copy the application source into the container and ensure entrypoint is executable.
COPY . .
RUN chmod +x docker_entrypoint.sh

# Build the application.
RUN npm install -g yarn
RUN yarn install
RUN yarn run build

# Expose the web server's port.
EXPOSE 3001
# EXPOSE 5432

# Setup volume for PostgreSQL

VOLUME [ "/dbdata" ]

# Run the application.
ENTRYPOINT [ "/usr/src/app/docker_entrypoint.sh" ]

