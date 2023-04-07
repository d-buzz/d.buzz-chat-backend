#Backend 

## Installation

```bash
$ yarn
```

## Setting up Database

Configure database connection with src/data-source.ts file,
which uses the following environemental variables for setup:

```
BASE_URL  default: 'http://localhost'
PORT      default: 3000
DB_TYPE   default: 'postgres', or 'sqlite'
DATABASE_URL default example: `postgres://postgres:test1234567@localhost:5432/test`
ACCOUNT   default: ''
NETNAME   default: 'main' example: 'main[account]', 'main[STM8945...]'
NODES     default: '' example: 'https://apiexample1.com:3000;https://apiexample2.com:3000'
NODE_HOST default: 'localhost' example: '0.0.0.0'
```
Optional variables for signing guest account creation requests:
```
GUEST_ACCOUNT      default: ''
GUEST_POSTING_KEY 
```

### SQLite

Set DB_TYPE to 'sqlite' and DATABASE_URL to ':memory:' or file path, eg: 'dbfile.db'.

### Postgres

Install postgress and set the DATABASE_URL, 

The BASE_URL, PORT are to be set to the public website this api will be accessible from.
NETNAME use 'main' as default or any other for testing purposes or for creating a node network
that will be separate from the main one. The NETNAME can also constain a comma separated list
of accounts or public keys which are used for validation of guest account creation requests. 
NODES is a list of semicolon separated urls of seed nodes.
ACCOUNT is hive account this node will authenticate as.

## Build shared library

```bash
$ yarn buildlib
```

## Running the app

Choose one of the following ways to run the app:
```bash
# watch and recompile on file changes, use SQLite in-memory DB, port 3001, no nodes
$ PORT=3001 DB_TYPE="sqlite" DATABASE_URL=":memory:" NODES="" yarn run start:watch
# use SQLite file database, port 3001, no nodes
$ PORT=3001 DB_TYPE="sqlite" DATABASE_URL="dbfile.db" yarn run start
# use Postgres database, port 3001, no nodes
$ PORT=3001 DB_TYPE="sqlite" DATABASE_URL="postgres://postgres:test1234567@localhost:5432/test" yarn run start

```


## Signing Guest Account Creation Requests
The backend can sign guest account creation requests by setting the variables
GUEST_ACCOUNT and GUEST_POSTING_KEY. If you are signing with a key without an account
set GUEST_ACCOUNT to an empty string.

If you would like to customize/integrate
guest account creation into your API (for example: to add email verifiaction)
you can use the following API:
```
var createAccountMessage = SignableMessage.create(
    GUEST_ACCOUNT, msg.getUser(), msg.getJSONString(), SignableMessage.TYPE_ACCOUNT); 
createAccountMessage.signWithKey(GUEST_POSTING_KEY, GUEST_ACCOUNT.length>0?'p':'@');
```
To find which guest accounts are available you can use '/api/availableAccount/username' API.






