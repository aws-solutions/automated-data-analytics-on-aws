#!/usr/bin/env bash

# This script is meant to run in ECS

echo "starting import ..."

python3 dynamodb_data_import.py

echo "done"
