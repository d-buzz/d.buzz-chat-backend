#!/bin/sh
source .env

# If there is $SQL_USER and no DB yet, create it.
if [ -n "$SQL_USER" ] && ! [ -f /dbdata/pg_hba.conf ] ;
then
    echo "Setting up PostgreSQL"
    echo "Setting permissions for /dbdata and /run/postgresql"
    mkdir /dbdata
    chown -R postgres /dbdata && \
    mkdir /run/postgresql
    chown -R postgres /run/postgresql
    echo "Initializing database"
    su - postgres -c "initdb /dbdata" &&\
    echo "host all  all    0.0.0.0/0  md5" >> /dbdata/pg_hba.conf &&\
    echo "listen_addresses='*'" >> /dbdata/postgresql.conf &&\
    su - postgres -c "pg_ctl start -D /dbdata" &&\
    echo "Creating user $SQL_USER" &&\
    su - postgres -c "psql -U postgres -c \"CREATE USER $SQL_USER WITH PASSWORD '$SQL_PASSWORD';\"" &&\
    echo "Creating the database and connecting to it" &&\
    psql -U postgres -c "CREATE DATABASE stdb;" &&\
    psql -U postgres -c "\c stdb;" &&\
    echo "Granting privileges to $SQL_USER" &&\
    psql -U postgres -c "GRANT pg_read_all_data TO $SQL_USER;" &&\
    psql -U postgres -c "GRANT pg_write_all_data TO $SQL_USER;" &&\
    # echo "Importing SQL"
    # psql -U postgres -d stdb -f CREATE.sql &&\
    echo "Starting PostgreSQL..."
    su - postgres -c "pg_ctl start -D /dbdata"
    # Start the web server.
    echo "Starting the app."
    yarn run start
else
    # Prepare files necessary for PostgreSQL's socket.
    echo "Preparing..."
    mkdir /run/postgresql
    chown -R postgres /run/postgresql

    # Start PostgreSQL server.
    echo "Starting PostgreSQL..."
    su - postgres -c "pg_ctl start -D /dbdata"
    
    # Import the database structure to pick up any updates to it
    # echo "Importing SQL"
    # psql -U postgres -d stdb -f CREATE.sql &&\

    # Start the web server.
    echo "Starting the app."
    yarn run start
fi

