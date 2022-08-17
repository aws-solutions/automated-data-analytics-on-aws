# Ada source code

## Requirements

To build and run the application the following dependencies are required:

- Node (v14.x.x)
- yarn (`npm install --global yarn`)
- Java (eg. `openjdk version "1.8.0_312"`). We strongly recommend using Amazon Corretto 8 as the default JAVA version
  `export JAVA_HOME=/Library/Java/JavaVirtualMachines/amazon-corretto-8.jdk/Contents/Home` (https://docs.aws.amazon.com/corretto/latest/corretto-8-ug/macos-install.html)
- Maven (>= v3.6)
- pipenv (`pip3 install pipenv`)
- pyenv (`brew install pyenv`)

To deploy the application you're required to have AWS profile configured correctly in your machine

# Deployment steps

- `yarn install`
- `yarn build`
- `yarn deploy-sandbox`

## Useful commands

- `yarn run build` compile typescript to js, and run the unit tests
- `yarn run test` perform the jest unit tests
- `cdk deploy` deploy this stack to your default AWS account/region
- `cdk diff` compare deployed stack with current state
- `cdk synth` emits the synthesized CloudFormation template

## CDK Context

The solution utilizes [CDK Runtime Context](https://docs.aws.amazon.com/cdk/v2/guide/context.html) to configure additional functionaly and override defaults.

The full list of supported CDK context properties is available in [Solution Context](./packages/@ada/infra/src/common/context/README.md) documentation.

## Working with Lambda functions

Lambda functions should be grouped into a package their containing microservice, eg

```
|- packages/
  |- @ada/
    |- ontology-service-lambdas/
      |- test/
      |- index.ts
      |- package.json
```

This function is referenced in the stack (the `packages/@ada/infra` file) as:

```
  code: lambda.Code.fromAsset('../ontology-service-lambdas'),
  runtime: lambda.Runtime.NODEJS_12_X,
  handler: 'index.doSomethingHandler'
```
