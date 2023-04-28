#!/usr/bin/env bash

# This script is meant to run in ECS

echo "starting import ..."

python3 mongodb_data_import.py

echo "done"
