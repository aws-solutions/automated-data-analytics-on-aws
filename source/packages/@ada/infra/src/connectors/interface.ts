/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DataProductUpdatePolicy, DataProductUpdateTriggerType, UpdateTriggerScheduleRate } from '@ada/common';
import { JSONSchema4 as JsonSchema, validate as validateJsonSchema } from 'json-schema';
import { UnionToIntersection } from 'type-fest';
import type { DataProductInput, DataProductUpdateTrigger } from '@ada/api';
import type { DynamicInfra, StaticInfra } from '@ada/data-product-infra-types';
import type { Field } from '@data-driven-forms/react-form-renderer/common-types';
import type { IStateMachine } from 'aws-cdk-lib/aws-stepfunctions';

/* eslint-disable max-len, @typescript-eslint/no-namespace */

export namespace Connectors {
  /**
   * Individual connector definition interface
   */
  export interface IConnector<TSourceDetails = any, TSourceDetailsFormData extends IFormData<any> = any> {
    /** Unique identifier for the connector */
    readonly ID: ID;

    /** Name of the folder within connectors/sources where the connector is located */
    readonly FOLDER: string;

    /** Interface reference for the `sourceDetails` property of data products of this connector type */
    readonly ISourceDetails: TSourceDetails;

    /** Interface reference for the `sourceDetails` wizard form input fields for data products using this connector type */
    readonly ISourceDetailsFormData: TSourceDetailsFormData;

    /** Docker image [name, source] tuple for managing docker image for this connector */
    readonly DOCKER_IMAGE?: IDockerImageTuple;

    /** Connector metadata */
    readonly METADATA: Metadata;

    /** Connector general configuration */
    readonly CONFIG: Config;

    /** Connector JSON Schema definition. Will be used to validate input details for the connector. */
    readonly SCHEMA: Schema;

    /** Connector view (UI) specific configurations */
    readonly VIEW: View<TSourceDetails, TSourceDetailsFormData>;
  }

  /** Record of all registered connectors that maps connector `ID` to respective definition */
  export const REGISTRY = {} as CONNECTOR_REGISTRY;

  export function getRegisteredIds(): ID[] {
    return Object.keys(REGISTRY) as ID[];
  }

  /**
   * Registers a unique connector definition and makes available in the solution.
   *
   * @param connector
   */
  export function register<TID extends ID>(connector: CONNECTOR_REGISTRY[TID]) {
    const _ID = connector.ID as TID;

    if (_ID in REGISTRY) {
      if (JSON.stringify(REGISTRY[_ID]) !== JSON.stringify(connector)) {
        console.debug(`Duplicate connector "${_ID}"`, {
          old: REGISTRY[_ID],
          new: connector,
        });
        throw new Error(`Attempt to register connector with different definition: ${_ID}`);
      }
      // NB: since connector definition is the same, duplicate registry is safe to ignore
      return;
    }

    REGISTRY[_ID] = connector;

    // Update Id enum-ish mapping for Id string literal definition
    Id[_ID] = _ID as any;

    if (connector.DOCKER_IMAGE) {
      DOCKER_IMAGES.push(connector.DOCKER_IMAGE);
    }

    if (connector.CONFIG.supports.source?.query === true) {
      CATEGORIES.SOURCE_QUERY_ENABLED_CONNECTORS.add(_ID);
    }

    if (connector.CONFIG.managedSecret?.enabled === true) {
      CATEGORIES.STORED_SECRET_CONNECTORS.add(_ID);
    }
  }

  /**
   * Get list of all enabled connectors from registry.
   *
   * @returns All connectors from registry that are **not** disabled
   */
  export function getAllConnectors(): IConnector[] {
    return Object.values(REGISTRY).filter((_connector) => !_connector.CONFIG.disabled);
  }

  /**
   * Finds a connector definition based on unique id.
   * @param id The unique id of the connector
   * @returns The connector mapped to the id
   * @throws Throws error is connector is not found.
   */
  export function find(id: ID) {
    if (id in REGISTRY) {
      return REGISTRY[id];
    }

    throw new Error(`Connector not found with id "${id}"`);
  }

  /** Record of registered connector ids to literal string values */
  export const Id = {} as { [K in keyof CONNECTOR_REGISTRY]: K };
  /** Union type of all registered connector ids */
  export type ID = keyof typeof Id;

  /** Union type of all registered connector `sourceDetails` interfaces */
  export type SourceDetails = CONNECTOR_REGISTRY[ID]['ISourceDetails'];
  /** Lookup table of connector `sourceDetails` interfaces based on connector id */
  export type ISourceDetails = {
    [K in keyof CONNECTOR_REGISTRY]: CONNECTOR_REGISTRY[K]['ISourceDetails'];
  };

  /** Union type of all registered connector `sourceDetails` form data interfaces */
  export type SourceDetailsFormData = CONNECTOR_REGISTRY[ID]['ISourceDetailsFormData'];
  /** Lookup table of connector `sourceDetails` form data based on connector id */
  export type ISourceDetailsFormData = {
    [K in keyof CONNECTOR_REGISTRY]: CONNECTOR_REGISTRY[K]['ISourceDetailsFormData'];
  };

  /**
   * Tuple mapping of docker image `name` to `source` folder containing the DockerFile
   *
   * The `source` folder is relative name of folder within the "connectors/sources" folder.
   */
  export type IDockerImageTuple = Readonly<[name: string, source: string]>;
  /**
   * Registry for all connector based docker images.
   *
   * Stores tuple mapping of `[name, source]` for each connector defined,
   * where `name` is the docker image name and `source` is the relative folder
   * path with the "connectors/sources/" where the respective DockerFile is located.
   */
  export const DOCKER_IMAGES: IDockerImageTuple[] = [
    // NB: list additional docker images related to connectors here that are not directly defined by connectors
    ['data-import-base-image', 'common/common/docker-image'],
  ];
  /**
   * Gets docker image name for a given connector by id
   *
   * To get full path of image must call `getDockerImagePath` util
   * @param id The id of the connector to get docker image name for
   * @returns The name of the docker image
   */
  export function getDockerImageName(id: ID) {
    const [name] = REGISTRY[id].DOCKER_IMAGE || [];
    if (name == null) {
      console.debug(REGISTRY[id]);
      throw new Error(`Failed to find docker image definition for connector "${id}"`);
    }
    return name;
  }

  /**
   * Gets the `managedSecred` configuration associated with a given connector
   * @param id The id of the connector to get config for.
   * @returns {Config['managedSecret']} The `managedSecret` config of connector if exists,
   * otherwise returns `undefined`.
   */
  export function getManagedSecretConfig(id: ID) {
    return find(id).CONFIG.managedSecret;
  }

  /**
   * Connector metadata
   */
  export interface Metadata {
    /** Display name of the connector that is shown in the UI */
    label: string;
    /** Short description of the connector shown in the UI */
    description: string;
    /**
     * Name of icon for the connector
     * @todo currently not implemented; icons are currently defined in `@ada/website/src/connectors/icons`
     */
    icon: string;
    /**
     * Help panel details for this connector.
     * @todo currently not implemented; connectors do not have specific help content
     */
    help?: {
      title: string;
      markdown: string;
    };
    /**
     * Links associated with this connector
     * @todo currently not implemented
     */
    links?: {
      /**
       * Learn more link to browse additional documentation for this connector
       * @todo currently not implemented
       */
      learnMore?: string;
    };
  }

  /** Connector stability */
  export enum Stability {
    /** Fully tested and ready for production use cases */
    STABLE = 'stable',
    /** Still experimental and may have issues, not recommended for production use cases */
    EXPERIMENTAL = 'experimental',
  }

  /**
   * Connector configuration definition
   */
  export interface Config {
    /**
     * Indicates if the connector is disabled.
     *
     * If connector is `disabled` it will **not** be registered, resulting in the
     * connector not being deployed and removed from the ui.
     *
     * > WARNING: Changing an **enabled** connector to **disabled** could break any
     * existing data products that use the connector. Particularly if the connector
     * deploys any static infrastructure that is required by data product dynamic infrastructure.
     */
    disabled?: boolean;

    /**
     * Indicates the stability of the connector.
     *
     * The stability will be displayed in the UI to indicate the readiness of
     * the connector for production use cases.
     */
    stability: Stability;
    /**
     * Indicates if the connector is **deprecated** and is not recommended for
     * creating new data products. Deprecated connectors will still be available
     * but will be marked in the UI.
     */
    deprecated?: boolean;

    /**
     * Configures a unique managed SSM secret for the c
     */
    managedSecret?: {
      /** Indicates that this connector requires a managed secret */
      enabled: boolean;

      secretDetails: {
        /** The property name from the source details schema that defines the secret name */
        secretNameProperty: string;
        /** The property name from the source details schema that defines the secret key value */
        secretValueProperty: string;
      }[];
    };

    /** Mapping of features/functionality this source type supports */
    supports: {
      /**
       * Indicates if the source type supports schema preview during creation.
       */
      preview: boolean;
      /**
       * Indicates if the source type support automatic transforms.
       */
      automaticTransforms: boolean;
      /**
       * Indicates if the source type support custom transforms.
       */
      customTransforms: boolean;
      /**
       * Indicate if the source type support automatic PII detection
       */
      disableAutomaticPii?: boolean;
      /**
       * Indicates what types of update triggers to source supports.
       * If `false` the source does not support updates after initial import.
       * Otherwise is explicit map of supported triggers.
       */
      updateTriggers: false | Record<DataProductUpdateTriggerType, boolean>;
      /**
       * Indicates update trigger schedules supported by the source.
       * If `false` then source does not support scheduling.
       * Otherwise is explicit map of available scheduling options.
       */
      updateTriggerScheduleRate: null | Record<UpdateTriggerScheduleRate, boolean>;

      /**
       * Indicates update policy supported by the source.
       * If `false` then source does not support specifying the policy.
       * Otherwise is explicit map of available policy update options.
       */
      updateTriggerUpdatePolicy?: null | Record<DataProductUpdatePolicy, boolean>;

      /** Raw source data configuration */
      source?: {
        /** Supports querying the raw source data directly */
        query: boolean;
      };
    };
  }

  /** Interface for defining data product `sourceDetails` JSON schema */
  export interface Schema extends JsonSchema {}

  /** Interface for defining data product form data used in the wizard  */
  export interface IFormData<
    TSourceDetails,
    TUpdateTrigger extends DataProductUpdateTrigger = DataProductUpdateTrigger,
  > {
    /** Form data interface for data product `sourceDetails` in the wizard */
    sourceDetails: TSourceDetails;
    /** Form data interface for `updateTrigger` in the wizard */
    updateTrigger: TUpdateTrigger;
  }

  /**
   * Function interface for converting *Form Data* to *Source Details* when creating
   * creating a new data product for this connector in the UI wizard.
   */
  export interface ISourceDetailsFormDataToInputData<
    TFormData extends IFormData<any> = IFormData<any>,
    TSourceDetails = any,
  > {
    (formData: TFormData): TSourceDetails;
  }

  /**
   * View (UI) specific configuartion for connector.
   */
  export interface View<TSourceDetails = any, TFormData extends IFormData<any> = IFormData<any>> {
    /** Configuration of the wizard UI used to create new data products for the connector. */
    Wizard: {
      /** List of fields rendered in the wizard step of data product creation for this connector. */
      fields: Field[];
      /** Function that converts *form data* to *source details input* on submit of the wizard for the connector. */
      sourceDetailsFormDataToInputData: ISourceDetailsFormDataToInputData<TFormData, TSourceDetails>;
    };
    /** Configuration of the summary component used to display *source details* of data products using the connector. */
    Summary: {
      /** Ordered list of properties to render in summary table */
      properties: {
        key: Exclude<keyof TSourceDetails, number | Symbol>;
        label: string;
        valueRenderer?: (value: any) => any;
      }[];
    };
  }

  /**
   * Defines sets of connectors based on different categories, such as listing
   * set of connector ids that support quering raw data.
   *
   * > These category sets are automatically updated during connector registration.
   */
  export namespace CATEGORIES {
    /** Set of connector ids that support querying raw source data */
    export const SOURCE_QUERY_ENABLED_CONNECTORS = new Set<ID>();
    /** Set of connector ids that require managed SSM secret to be created */
    export const STORED_SECRET_CONNECTORS = new Set<ID>();
  }

  /** Interface for registering connector infra */
  export type IConnectorInfra<TParams, TRefs, TStaticStack> = Infra.Static.IConnectorStaticInfra<
    TParams,
    TRefs,
    TStaticStack
  >;

  /**
   * CDK infrastructure specific configuration for connectors.
   */
  export namespace Infra {
    type INFRA_ID = keyof CONNECTOR_INFRA_REGISTRY;

    export type For<TID extends INFRA_ID> = CONNECTOR_INFRA_REGISTRY[TID];

    export type StaticStackFor<TID extends INFRA_ID> = For<TID>['STACK'];
    export type ParamsFor<TID extends INFRA_ID> = For<TID>['PARAMS'];
    export type RefsFor<TID extends INFRA_ID> = For<TID>['REFS'];
    export type IRefsFor<TID extends INFRA_ID> = Static.IConnectorRef<For<TID>['REFS']>;

    /** Interface for registering the CDK infrasructure for a given connector */
    interface IInfraRegistration {
      /**
       * Static integrator defintion that binds connector specific *static* infrastructure
       * functionality with respective *Static Infra* constructs.
       *
       * Manages binding both the `StaticInfrastructureStack` and `StaticInfrastructureReferences` constructs
       * that bridge the *static* and *dynamic* infrastructure of the solution for data products.
       */
      staticIntegrator: Static.Integrator<INFRA_ID>;
      /**
       * The connector specific *Stack* class that is synthesized for new data products
       * of this connector type.
       */
      dynamicStackClass: DynamicInfra.StackClass;
    }

    const _registeredInfraIds = new Set<ID>();

    export function getRegisteredInfraIds(): ID[] {
      return Array.from(_registeredInfraIds.values());
    }

    /**
     * Registers the connector infrastructure code with the solution.
     *
     * If the connector is disabled ()
     *
     * - Registers the *static* infra
     * - Registers the *dynamic* infra
     * @param id The unique id of the connector to register
     * @param config The infrastructure configuration definition for this connector
     */
    export function register(id: ID, config: IInfraRegistration) {
      if (_registeredInfraIds.has(id)) {
        // Ignore duplicate infra registration; can happen during testing and is ok
        // if happens outside of testing as long as ignored here.
        return;
      }

      _registeredInfraIds.add(id);

      if (find(id).CONFIG.disabled === true) {
        console.warn(`Connector ${id} is disabled - infra will not be registered`);
        return;
      }

      // NB: ensure infra is only registered by Node environment processes to not break
      // the environment agnostic requirements for the core interface

      if (process.env == null) {
        throw new Error('Connectors.Infra.register MUST only be called for Node runtime environments');
      }

      const { staticIntegrator, dynamicStackClass } = config;

      Static.registerConnector(staticIntegrator);

      Dynamic.register(id, dynamicStackClass);
    }

    /**
     * Dynamic connector infrastructure namespace.
     *
     * *Dynamic* refers to resources that are created on-demand for each data product
     * that uses the given connector.
     */
    export namespace Dynamic {
      /**
       * Mapping of connector id to *dynamic* stack class.
       *
       * This is utilized during data product creation when synthesizing *dynamic* stack for
       * new data products of a given connector type. The data product dynamic infra synthesizer
       * will lookup associated stack class from this mapping and instantiate a new stack based
       * on the connector type being created.
       */
      const _stackClassMap: Map<ID, DynamicInfra.StackClass> = new Map();

      /**
       * Registers the *dynamic* `Stack` class associated with a given connector id
       * @param id The connector id to register
       * @param stackClass The *dynamic* stack class to associate with the connector id
       */
      export function register(id: ID, stackClass: DynamicInfra.StackClass): void {
        if (_stackClassMap.has(id)) {
          console.warn(`Connector ${id} already registered dynamic stack class, ignoring duplicate`);
          return;
        }

        _stackClassMap.set(id, stackClass);
      }

      /**
       * Gets the *dynamic* `Stack` class associates with a given connector id.
       *
       * This is utilized during data product creation when synthesizing *dynamic* stack for
       * new data products of a given connector type. The data product dynamic infra synthesizer
       * will lookup associated stack class and instantiate a new stack based
       * on the connector type returned from this method.
       * @param id The connector id to retried *dynamic* `Stack` class for
       * @returns The *dyanmic* `Stack` class for given connector id
       */
      export function getStackClass(id: ID): DynamicInfra.StackClass {
        const stackClass = _stackClassMap.get(id);
        if (stackClass == null) {
          throw new Error(
            `Connector dynamic stack class does not exist for id "${id}": ${Array.from(_stackClassMap.keys()).join(
              ',',
            )}`,
          );
        }
        return stackClass;
      }
    }

    /**
     * Static connector infrastructure namespace.
     *
     * *Static* refers to resources that are created as part of the solution deployment, and
     * are available across multiple data products.
     */
    export namespace Static {
      /** Helper interface to proxy the definitions from connector infra into typings */
      export interface IConnectorStaticInfra<TParams, TRefs, TStack> {
        PARAMS: TParams;
        REFS: TRefs;
        STACK: TStack;
      }

      // NB: create intersection of all infra props to extend the `StaticInfra` definitions in `/common/services/types/data-product-infra.ts`
      /** Intersection of all connector *static* infra defined parameters */
      export type PARAMS = UnionToIntersection<CONNECTOR_INFRA_REGISTRY[INFRA_ID]['PARAMS']>;
      /** Intersection of all connector *static* infra defined references */
      export type REFS = UnionToIntersection<CONNECTOR_INFRA_REGISTRY[INFRA_ID]['REFS']>;
      /** Intersection of all connector *static* infra defined stack properties */
      export type STACKS = UnionToIntersection<CONNECTOR_INFRA_REGISTRY[INFRA_ID]['STACK']>;

      /**
       * Decorates the `StaticInfrastructureStack` class with all registered connector decorators
       * @param constructor The base `StaticInfrastructureStack` class to decorate
       * @returns Decorated `StaticInfrastructureStack` class with all registered connectors applied
       */
      export function withStaticInfra<T extends StaticInfra.Stack.IBaseConstructConstructor>(
        constructor: T,
      ): StaticInfra.Stack.IConstructConstructor {
        return Array.from(_integrators.values()).reduce((_class, _integrator) => {
          // apply connector decorator if exists, otherwise just return current class
          return _integrator.staticInfra ? _integrator.staticInfra(_class) : _class;
        }, constructor as any);
      }
      /**
       * Decorates the `StaticInfrastructureReferences` class with all registered connector decorators
       * @param constructor The base `StaticInfrastructureReferences` class to decorate
       * @returns Decorated `StaticInfrastructureReferences` class with all registered connectors applied
       */
      export function withStaticInfraRefs<T extends StaticInfra.Refs.IBaseConstructConstructor>(
        constructor: T,
      ): StaticInfra.Refs.IConstructConstructor {
        return Array.from(_integrators.values()).reduce((_class, _integrator) => {
          // apply connector decorator if exists, otherwise just return current class
          return _integrator.staticInfraRefs ? _integrator.staticInfraRefs(_class) : _class;
        }, constructor as any);
      }

      /** Helper interface for extending the `staticInfrastructureReferences` property of the `StaticInfrastructureStack` class */
      export type IConnectorRef<T> = {
        staticInfrastructureReferences: StaticInfra.Refs.IBaseConstruct['staticInfrastructureReferences'] & T;
      };

      /**
       * Interface for connectors to define the *static* infrastructure integrations
       */
      export interface Integrator<TID extends INFRA_ID> {
        /** Connector id which is associated with this integrator definition */
        ID: TID;
        /**
         * `StaticInfrastructureStack` decorator to apply connector functionality to the base class
         */
        staticInfra?: (
          constructor: StaticInfra.Stack.IBaseConstructConstructor,
        ) => new (...args: StaticInfra.Stack.IConstructParameters) => StaticInfra.Stack.IBaseConstruct &
          StaticStackFor<TID>;
        /**
         * `StaticInfrastructureReferences` decorator to apply connector functionality to the base class
         */
        staticInfraRefs?: (
          constructor: StaticInfra.Refs.IBaseConstructConstructor,
        ) => new (...args: StaticInfra.Refs.IConstructParameters) => StaticInfra.Refs.IBaseConstruct & IRefsFor<TID>;
      }

      /** Mapping of connector id to *static* connector integration definition */
      const _integrators: Map<INFRA_ID, Integrator<INFRA_ID>> = new Map();

      /**
       * Registers the *static* instructure for given connector
       * @param integrator The *static* integration for given connector
       */
      export function registerConnector<TID extends INFRA_ID>(integrator: Integrator<TID>): void {
        if (_integrators.has(integrator.ID)) {
          // TODO: should be fine there is duplicate, better than none, but try to find the sweet spot to apply connectors to ensure registered when needed
          // in different parts of the application and testing
          console.warn(`Connector ${integrator.ID} already registered integrator, ignoring duplicate`);
          return;
        }
        _integrators.set(integrator.ID, integrator);
      }

      /**
       * Namespace for interface definitions used by connectors to define
       * common "import data" related *static* infrastructure
       */
      export namespace ImportData {
        /** StateMachine definitions for common "import data" patterns */
        export namespace StateMachine {
          /**
           * Interface for defining a parameter that is added to *static* SSM secret parameter
           * for a StateMachine.
           */
          export interface Param {
            readonly importDataStateMachineArn: string;
            readonly lastUpdatedDetailTableName?: string;
            readonly otherArns?: { [id: string]: string };
          }

          /**
           * Interface for dereferencing a StateMachine parameter defined by *static* stack
           */
          export interface Ref {
            readonly importDataStateMachine: IStateMachine;
            readonly lastUpdatedDetailTableName?: string;
            readonly otherConstructs?: { [id: string]: any };
          }
        }
      }
    }
  }

  /**
   * Helper methods for working with connector schemas
   */
  export namespace Schema {
    /**
     * Get the associates JSON schema for a given connector
     * @param id The connector id to get associated schema for
     * @returns {JsonSchema} The JsonSchema associated with the given connector id
     */
    export function getSchemaByID(id: ID): JsonSchema {
      return REGISTRY[id].SCHEMA;
    }

    /**
     * Gets the associates JSON schema of the connector type of a given data product
     * @param {DataProductInput} dataProduct The data product input to retrieve connector schema for
     * @returns {JsonSchema} The connector schema
     */
    export function getSchemaByDataProductInput(dataProduct: DataProductInput): JsonSchema {
      return getSchemaByID(dataProduct.sourceType as ID);
    }

    /**
     * Validates data product input value against the associated connector Json Schema
     * @param {DataProductInput} dataProduct The data product input to validate
     * @returns {ValidationResult} Returns the validation results from validating the input against schema
     */
    export function validateDataProductInput(dataProduct: DataProductInput) {
      if (dataProduct.sourceDetails == null) {
        throw new Error('Missing sourceDetails for data product');
      }
      const schema = getSchemaByDataProductInput(dataProduct);
      return validateJsonSchema(dataProduct.sourceDetails, schema);
    }

    /**
     * Validates any value against the Json schema for a given connector.
     * @param id The connector id to valide value against
     * @param instance The value to validate
     * @returns {ValidationResult} Returns the validation results
     */
    export function validate(id: ID, instance: any) {
      return validateJsonSchema(instance, getSchemaByID(id));
    }
  }
}

/**
 * Connector *Registry* that each connector extends to apply connector specific configuration mapping.
 *
 * For a connector to be statically typed, it must register its `IConnector` definition
 * against its unique `ID` in this registry.
 *
 * ```ts
 * interface CONNECTOR_REGISTRY {
 *  [ID]: Connectors.IConnector<>;
 * }
 * ```
 *
 * @ATTENTION Connectors **MUST** follow this exact pattern, otherwise all connector typings will be corrupted.
 *
 * @see https://www.typescriptlang.org/docs/handbook/interfaces.html#extending-interfaces
 */
export interface CONNECTOR_REGISTRY {}

/**
 * Connector **Infra** *Registry* that each connector extends to apply connector specific **infra** configuration mapping.
 *
 * For a connector to be statically typed, it must register its `IConnector` definition
 * against its unique `ID` in this registry.
 *
 * ```ts
 * interface CONNECTOR_INFRA_REGISTRY {
 *  [ID]: Connectors.IConnectorInfra<>;
 * }
 * ```
 *
 * @ATTENTION Connectors **MUST** follow this exact pattern, otherwise all connector typings will be corrupted.
 *
 * @see https://www.typescriptlang.org/docs/handbook/interfaces.html#extending-interfaces
 */
export interface CONNECTOR_INFRA_REGISTRY {}
