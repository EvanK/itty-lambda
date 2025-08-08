#!/bin/env bash

## script stays in terraform directory, gets run from its grandchild dir
## as part of the impl's package script `npm run build` 

# show our work
set -x

# our dest and src paths
LAMBDA_ROOT=$PWD
PROJECT_ROOT=$(realpath $PWD/../../../../)

# ensure project deps are installed
(cd $PROJECT_ROOT; npm i)

# copy project modules to here
cp -r $PROJECT_ROOT/node_modules $LAMBDA_ROOT/

# compile latest typescript
(cd $PROJECT_ROOT; npm run tsc)

# copy latest build and package file into dep
mkdir -p $LAMBDA_ROOT/node_modules/itty-lambda
cp -r $PROJECT_ROOT/build $LAMBDA_ROOT/node_modules/itty-lambda/
cp -r $PROJECT_ROOT/package.json $LAMBDA_ROOT/node_modules/itty-lambda/
