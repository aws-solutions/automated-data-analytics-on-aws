# Connectors

This folder contains all the built-in "ingress" connectors available with the current solution and provides _**an** interface_ for registering them.

Ingress connectors consist of both back-end CDK infrastructure and scripts, and front-end UI components. The CDK infra targets both _static_ (deployed with solution) and _dynamic_ (deployed per data product) along with supplying python scripts used for previewing/sampling connector data. The UI elements of a connector are applied during data product creation (wizard) and on the details page of data products using the connector.

## Disclaimer

> The _interface_ defined here is considered temporary and expected to drastically change in future releases.

> In a future release, the solution will refactor this connector _interface_ to completely decouple connectors and support third-party connector integration in a more pluggable way. To get to this future state, we first need to consolidate, co-locate, and decouple the indvidual connector code/resources from the rest of the solution as much as possible and provide _**an** interface_ to baseline against.

### Goals of current interface

1. Co-locate all code/resources for an individual connector in a single directory
1. Minimize touch points for integrating connectors with the solution
1. Define _**an** interface_ for connectors that provides a baseline for the _**right** interface_ in the future

> _LIMITATION_: Due to current tight coupling of connectors into the infrastructure code, the connectors are currently defined within the `@ada/infra` package but will later be refactored into separate packages. Because of this, the core definition of a connector must be environment agnostic, meaning it can not require modules that are explicitly Node (CDK) or Web (React) only; but it can require `types` from anywhere (eg: `import type { SomeNodeType } from 'my-node-module'`).

### Folder Structure

> The _connectors_ folder is aliased to `@ada/connectors` and supports nested modlues via `@ada/connectors/xxx`

```
./connectors
├── README.md
├── common # Common modules/resources utilized by multiple connectors
│   ├── google # Common Google connector modules
│   └── ...
├── index.ts # Imports all connector definitions
├── interface.ts # Connector interface (The "API" for connectors)
├── register-infra.ts # Alias to `sources/register-infra`
├── __init__.py # Python package for all connector related modules
├── poetry.toml # Poetry config
├── pyproject.toml # Poetry project config - used to map schema-preview dependencies for development
└── source
    ├── {connector-folder} # Folder for each connector source
    │   ├── index.ts # Connector definition (environment agnostic)
    │   ├── docker-image # (Optional) docker image for connector
    │   │   ├── Dockerfile
    │   │   └── ...
    │   └── infra # Connector CDK infrastructure
    │   │   ├──  dynamic # CDK infrastructure deployed for each Data Product
    │   │   ├──  static # CDK infrastructure deployed with solution
    │   │   └── register.ts # Module to register all connector infra
    │   └── preview # (optional) Python based modules for generating preview and sampling data
    │       ├── __init__.py # Connector python definition
    │       ├── __tests__/... # Python test files
    │       └── pull_samples.py # Python module to pull sample data for the connector
    ├── index.ts # Connector registry - must add import for each connector here
    ├── register-infra.ts # Connector infra registry - must add infra register import for each connector here
    └── __init__.py # Python package to index/register all connector modules
```

---

## Connector Interface (API-ish)

> [connectors/interface.ts](./interface.ts) => `@ada/connectors/interface` (alias) \
> In the future, this will likely be moved into the actual API rather than coupled in the source code

The `Connectors` namespace defines the connector contract (`Connectors.IConnector` interface), handles connector registration (`Connectors.register(...)`) which binds the connector into the solution, and provides common utility functionality to both defining and using connectors.

Connectors must register both their **type** declarations and **implementation** values with the connector interface, and this must be done for both the _core defintion_ (environment agnostic) and _infra_ (CDK specific). The connector interface declares `CONNECTOR_REGISTRY` and `CONNECTOR_INFRA_REGISTRY` _typescript interfaces_ to abstract this process and enable _static typing_ of connectors throughout, which is made possible by [Typescript extending interface](https://www.typescriptlang.org/docs/handbook/interfaces.html#extending-interfaces) feature.

The [connector/interface.ts](./interface.ts) modules declares empty _interfaces_ for both these registration points that each connector must extends to provide static typings and integration.

### Connector Registration

Connectors are registered by extending the `CONNECTOR_REGISTRY` interface of the `@ada/connectors/interface` module with `ID => Connectors.IConnector` mapping for the connector and registering the connector via `Connector.register()` method.

Additionally, each connector **MUST** be added to [connectors/sources/index.ts](./sources/index.ts) file to ensure it is automatatically registered at the appropriate time.

```ts
export const ID = 'MY_CONNECTOR';
export const CONNECTOR: Connectors.IConnector
export interface ISourceDetails__MY_CONNECTOR { someValie: string; }
export type IFormData__MY_CONNECTOR = Connectors.IFormData<ISourceDetails__MY_CONNECTOR>

export const CONNECTOR: Connectors.IConnector<ISourceDetails__MY_CONNECTOR, IFormData__MY_CONNECTOR> = {
  ..., // add configuration here
}

// Extend the connector interface module to provide static typing for the connector
declare module '@ada/connectors/interface' {
  interface CONNECTOR_REGISTRY {
    // Must follow `ID => IConnector` contract
    [ID]: typeof CONNECTOR;
   }
}

// Register the connector implementation
Connectors.register<typeof ID>(CONNECTOR);
```

> The above example of using `ID` and `CONNECTOR` values (with `[ID]: typeof CONNECTOR`) is not required, but highly recommended as it reduces code and ensures correct mapping of connector throughout.

### Connector _Infra_ Registration

Connector **infra** is registered by extending the `CONNECTOR_INFRA_REGISTRY` interface of the `@ada/connectors/interface` module with `ID => Connectors.IConnectorInfra` mapping for the connector and registering the connector infra via `Connectors.Infra.register()` method which registers both the _static_ and _dynamic_ infrastructure for the connector.

Additionally, each connector **MUST** be added to [connectors/sources/register-infra.ts](./sources/register-infra.ts) file to ensure it is automatatically registered at the appropriate time.

```ts
// {connector-folder}/infra/register.ts
import { Connectors } from '@ada/connectors/interface';
import { ID } from '../index'; // ID = 'MY_CONNECTOR' from above
import { ConnectorIntegrator } from './static';
import DynamicStack from './dynamic/stack';

// Extend the connector interface module to provide static typing for the connector infra
declare module '@ada/connectors/interface' {
  interface CONNECTOR_INFRA_REGISTRY {
    // [ID] references the const ID declared in connector definition ({connector-folder}/index.ts)
    // Must follow `ID => Connectors.IConnectorInfra` contract
    [ID]: Connectors.IConnectorInfra<
      // Static Parameters
      {
        myConnectorBucketArn: string;
      },
      // Static Refs
      {
        myConnectorBucket: IBucket;
      },
      // Static Stack Properties
      {
        readonly myConnectorBucket: Bucket;
      }
    >;
  }
}

// Register the connector infra implementation
Connectors.Infra.register(ID, {
  staticIntegrator: ConnectorIntegrator,
  dynamicStackClass: DynamicStack,
});
```

> Not all connectors create _static_ resources, however for consistency and ease of future integrations it is recommended to always declare/register the _static_ connector definition. See [Amazon S3 connector](./sources//amazon-s3/infra//register.ts) for example.

### Connector Preview (Python)

Schema preview functionality available during the creation of a data product is handled by a custom docker image lambda that mimicks the glue/spark environment.
This core functionality for this is located in [schema-preview/docker-image](../services/data-product/components/schema-preview/docker-image).
To enable co-location during development of connectors, all \*.py files located in the `@ada/infra/src/connectors` folder are copied under the `handlers` folder of the docker image.
To assist with development, the connectors folder contains a `pyproject.toml` file that maps to the docker image directory and support creating a venv using poetry for intellisense support.

When a connector supports schema preview, it must provide functionality for pulling a sample of the data from the source.

> Preview support is enabled via connector **CONFIG** property `supports.preview: true` of connector definition

To provide the pull sample data functionality, a connector must:

1. Define a callback follow the [IPullSampleCallback](../services/data-product/components/schema-preview/docker-image/handlers/common.py#L105) interface
1. Define connector definition following the [IConnector](../services/data-product/components/schema-preview/docker-image/handlers/common.py#L121) interface
1. Register the connector definition by defining `ID=>IConnector` mapping in [./sources/\_\_init\_\_.py](./sources/__init__.py)

#### Example preview python code

```python
from handlers.common import IConnector, IPullSamplesInput, IPullSamplesReturn, Sample

def pull_samples(input: IPullSamplesInput) -> IPullSamplesReturn:
  # just sudo code example
  sample_data = sudo_fetch_sample(..., input.sample_size)
  return [Sample(name, sample_data, ...)]

S3 = IConnector(
  pull_samples=pull_samples
)
```

> [S3 Connector example](./sources/amazon_s3/preview/__init__.py)

> To enable **intellisense** in VSCode, you can do the following
>
> 1. `cd ./source/packages/@ada/infra/src/connectors && poetry install` => creates local .venv in connectors dir
> 1. Add the following to you `.vscode/settings.json` file
>    `"python.analysis.extraPaths": ["./source/packages/@ada/infra/src/connectors/.venv/lib/python3.9/site-packages","./source/packages/@ada/infra/src/services/data-product/components/schema-preview/docker-image",],`

---

## Anatomy of a Connector

**Folder Structure of a Connector**

```
{connector-folder} # Folder for each connector source
  ├── index.ts # Connector definition (environment agnostic)
  ├── docker-image # (Optional) docker image for connector
  │   ├── Dockerfile
  │   └── ...
  └── infra # Connector CDK infrastructure
  │   ├── dynamic # CDK infrastructure deployed for each Data Product
  │   ├── static # CDK infrastructure deployed with solution
  │   └── register.ts # Module to register all connector infra
  └── preview # (optional) Python based modules for generating preview and sampling data
      ├── __init__.py # Connector python definition
      ├── __tests__/... # Python test files
      └── pull_samples.py # Python module to pull sample data for the connector
```

## How to create a _new_ connector

The best way to create a new connector is to look through the [existing connectors](./sources/) source and find a similar connector to baseline from.

1. Find similar [existing connector](./sources/)
   > If unsure, copy the [Amazon S3 connector](./sources/amazon-s3/) as it is most basic implementation. \
   > You might also want to **extend** the _Amazon S3 connector_ which is what the [File Upload connector](./sources/file-upload/) does.
1. Duplicate the connector folder
   > Example: `connectors/sources/amazon-s3` => `connectors/sources/my-connector`
1. Add the connector to [connectors/sources/index.ts](./sources/index.ts)
1. Add the connector to [connectors/sources/register-infra.ts](./sources/register-infra.ts)
1. Update the connector definition (`{connector-folder}/index.ts`)
   - Replace `ID` with a unique id for the connector
   - Change the `CONFIG.stability` value to `Stability.EXPERIMENTAL`
     > This will mark the connector in the UI with **experimental** badge to indicate to users that the connector is not fully stable.
   - Update the respective definition based on your connector
     > Take note of connector specific naming (eg: `ISourceDetails__XXX`), which provide more readable static typings throughout, but not explicitly required.
1. Update all `./infra/...` files to match your connector implementation
1. Update the **icon** for your connector in `source/packages/@ada/website/src/connectors/icons`
   > Currently the icon component is the only part outside of the infra connector folder that must be defined.
1. Implement preview sample data pulling functionality (OPTIONAL)
   > See above for details
1. Test, test, test...
   - Build infra via `cd sources/packages/@ada/infra && yarn build`
     > For faster type checking during development, you can just run `yarn compile --watch`, but it will not build docker images and other necessary resources.
   - Unit testing via `cd sources/packages/@ada/infra && yarn test:nested:connectors`
   - Deploy your connector via CDK deployment of the solution
   - UI development of connector can be done via `cd sources/packages/@ada/website && yarn start`
     > After initial deployment, if only changing the VIEW configuration of connector, there is no need to re-deploy between changes. The fastest way to develop the UI of a deployed connector is to run `yarn compile --watch` in infra package and `yarn start` in website package.
