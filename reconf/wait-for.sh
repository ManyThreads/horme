#!/bin/sh

set -e

host="$0"
cmd="$@"

wait-for-it neo4j:7687
wait-for-it mosquitto:1883

exec $cmd