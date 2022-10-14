# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2022-08-05

### Added

- All files, initial version

## [1.0.1] - 2022-08-25

### Added

- Allow s3 domain name without region in the Content Security Policy for pre-signed url

## [1.0.2] - 2022-10-05

### Changed
- Upgrade `aws-cdk-lib` and `@aws-cdk/aws-lambda-python-alpha` to 2.41.0 to fix python bundling issue
- Remove IAM role self-assuming code due to IAM service behavior change ([Issue 11](https://github.com/aws-solutions/automated-data-analytics-on-aws/issues/11))
- Fix Lambda policy size limit growing when creating data products
- Fix custom transform validation issue
- Fix security vulnerabilities found by yarn audit and Dependabot 
- Misc documentation fixes

