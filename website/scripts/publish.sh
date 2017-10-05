#!/bin/bash

set -e

yarn
yarn build
rm -rf ./gh-pages
git clone git@github.com:alangpierce/sucrase.git --branch gh-pages gh-pages
rm -rf ./gh-pages/*
cp -r build gh-pages
cd gh-pages
git add -A
git commit -m 'Update website'
git push
