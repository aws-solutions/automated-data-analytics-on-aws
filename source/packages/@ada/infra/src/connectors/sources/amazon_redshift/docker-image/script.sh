#!/usr/bin/env bash

# This script is meant to run in ECS

echo "starting import ..."

python3 redshift_data_import.py

echo "done import"
