#Backend 

## Installation

```bash
$ yarn
```

## Setting up Database

Install postgress and configure database connection with src/data-source.ts file,
which uses the following environemtnal variables for setup:

```
BASE_URL  default: 'http://localhost'
PORT      default: 3000
DATABASE_URL default example: `postgres://postgres:test1234567@localhost:5432/test`
ACCOUNT   default: ''
NETNAME   default: 'main'
NODES     default: '' example: 'https://apiexample1.com:3000;https://apiexample2.com:3000'
```

The BASE_URL, PORT are to be set to the public website this api will be accessible from.
NETNAME use 'main' as default or any other for testing purposes or for creating a node network
that will be separate from the main one.
NODES is a list of semicolon separated urls of seed nodes.
ACCOUNT is hive account this node will authenticate as.

## Build shared library

```bash
$ yarn buildlib
```

## Running the app

```bash
# development
$ yarn run start
```
