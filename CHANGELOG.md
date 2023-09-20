# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2023-09-15

### Added

- New added Oracle DB Connector
- New added RedShift Connector
- New added Customer groups support in Governance Settings

### Changed

- Fix BigQuery and Goggle Analytics connector issue
- Fix security vulnerabilities found by yarn audit and Dependabot
- Misc bug fixes
- Misc documentation fixes

## [1.2.0] - 2023-04-11

### Added

- New added DynamoDB Connector
- New added CloudTrail Connector
- New added MongoDB Connector

### Changed

- Upgrade node version to 16
- Upgrade AWS Glue lib to 3.0
- Dockerise build steps for Java packages to simplified prerequisite
- Fix security vulnerabilities found by yarn audit and Dependabot
- Misc bug fixes
- Misc documentation fixes

## [1.1.0] - 2022-12-19

### Added

- Add database connectors to support Mysql5, PostgreSQL, and Microsoft SQL server databases
- Add Ada Data Ingress Gateway to enable Ada integration with data sources in isolated VPCs or on-premise network
- Add AWS CloudWatch Logs connector
- Add Add AWS CloudwWatch Log JSON explode transform for parsing embedded json messages

### Changed

- Fix issue that repeated importing might cause duplicate data rows
- Improve CloudFormation One Click deployment experience
- Upgrade CDK version to 2.53.0
- Fix security vulnerabilities found by yarn audit and Dependabot
- Misc documentation fixes

## [1.0.2] - 2022-10-05

### Changed

- Upgrade `aws-cdk-lib` and `@aws-cdk/aws-lambda-python-alpha` to 2.41.0 to fix python bundling issue
- Remove IAM role self-assuming code due to IAM service behavior change ([Issue 11](https://github.com/aws-solutions/automated-data-analytics-on-aws/issues/11))
- Fix Lambda policy size limit growing when creating data products
- Fix custom transform validation issue
- Fix security vulnerabilities found by yarn audit and Dependabot
- Misc documentation fixes

## [1.0.1] - 2022-08-25

### Added

- Allow s3 domain name without region in the Content Security Policy for pre-signed url

## [1.0.0] - 2022-08-05

### Added

- All files, initial version
