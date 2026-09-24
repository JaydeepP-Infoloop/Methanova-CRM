#!/bin/bash
# Single-node replica set so Mongoose multi-document transactions work locally.
sleep 2
mongosh --quiet --eval 'try { rs.status() } catch (e) { rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "localhost:27017" }] }) }'
