#!/bin/sh
set -e
./vendor/bin/phpunit --colors=always "$@"
