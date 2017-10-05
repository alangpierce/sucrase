#!/bin/bash

set -e

yarn
yarn build
rm -rf ./gh-pages
mkdir ./gh-pages
cd gh-pages
git init
git remote add origin git@github.com:alangpierce/sucrase.git
cp -r ../build/* .
git add -A
git commit -m 'Update website'
git push origin HEAD:gh-pages -f
