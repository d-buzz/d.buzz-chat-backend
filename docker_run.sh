#!/bin/sh
docker run --env-file ./.env --init --network=host backend
