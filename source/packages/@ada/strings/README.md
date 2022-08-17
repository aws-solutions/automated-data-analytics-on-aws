# Ada Strings

This package provides strongly typed string dictionary with i18n localization support.

Utlizeds the [typesafe-i18n](https://typesafe-i18n.pages.dev/) generator for ensuring strict typing.

## Usage

### ENTITY

Entities are core types used in the solution, such as `DataProduct`, `Domain`, and `Ontology`.
The entity name used in the solution may differ from the name exposed to end users, such as we may rename `DataSet` to `Table`,
but the entity type in the system must be maintained througout.

All entities have several forms that can be used as string values as follows.

#### **Singular Entity** - `LL.ENTITY.{EntityName}()`

```js
LL.ENTITY.DataProduct(); // => "Data Product"
```

#### **Plural Entities** - `LL.ENTITY.{EntityNames}()`

```js
LL.ENTITY.DataProducts(); // => "Data Products"
```

#### **singular entity** - `LL.ENTITY.{entity_name}()`

```js
LL.ENTITY.data_product(); // => "data product"
```

#### **singular entities** - `LL.ENTITY.{entity_name}()`

```js
LL.ENTITY.data_products(); // => "data products"
```

#### **`$` Infered Plural Entity(s)** - `LL.ENTITY.{EntityName$}()`

```js
LL.ENTITY.DataProducts$(1); // => "Data Product"
LL.ENTITY.DataProducts$(3); // => "Data Products"
```

#### **`$` Infrered plural entity(s)** - `LL.ENTITY.{entity_name$}()`

```js
LL.ENTITY.data_products$(1); // => "data product"
LL.ENTITY.data_products$(3); // => "data products"
```

#### **`^` Named entity** - `LL.ENTITY.{entity_name^}('name')`

```js
LL.ENTITY['DataProduct^']('Name'); // => "Name Data Product"
LL.ENTITY['data_product^']('Name'); // => "Name data products"
```

#### **`#` Entity Count** - `LL.ENTITY['EntityNames#']()`

```js
LL.ENTITY['DataProducts#'](1); // => "1 Data Product"
LL.ENTITY['DataProducts#'](3); // => "3 Data Products"
```

#### **`#` entity count** - `LL.ENTITY['entity_names#']()`

```js
LL.ENTITY['data_products#'](1); // => "1 data product"
LL.ENTITY['data_products#'](3); // => "3 data products"
```

#### **`@` Properties** - `LL.ENTITY['EnityName@']()`

```js
LL.ENTITY['DataProduct@'].name.label(); // => "Name of the data product"
LL.ENTITY['DataProduct@'].schema.label(); // => "The schema for this data product"
```

#### \*\*`__EVENT` Singular Events - `LL.ENTITY.EntityName__EVENT_NAME(name?:string)`

Available events:

```js
FETCHING | FETCHED | FAILED_TO_FETCH;
CREATING | CREATED | FAILED_TO_CREATE;
UPDATING | UPDATED | FAILED_TO_UPDATE;
CREATING_OR_UPDATING | CREATED_OR_UPDATED | FAILED_TO_CREATE_OR_UPDATE;
DELETING | DELETED | FAILED_TO_DELETE;
```

```js
LL.ENTITY.DataProduct__CREATING(); // => 'Creating data product'
LL.ENTITY.DataProduct__CREATING('foo'); // => 'Creating data product "foo"'
LL.ENTITY.DataProduct__CREATED(); // => 'Created data product'
LL.ENTITY.DataProduct__CREATED('foo'); // => 'Created data product "foo"'
```

#### \*\*`__EVENT` Plural Events - `LL.ENTITY.EntityNames__EVENT_NAME(details?:string)`

> Same as "Singular Events" except key is prefixed with plural version

```js
LL.ENTITY.DataProducts__CREATING(); // => 'Creating data products'
LL.ENTITY.DataProducts__CREATING('with message'); // => 'Creating data products "with message"'
LL.ENTITY.DataProducts__CREATED(); // => 'Created data prodcuts'
LL.ENTITY.DataProducts__CREATED('with message'); // => 'Created data products "with message"'
```

## Folder Structure

```
├── markdown (large text such as help rendered in website)
├── dictionary (localized string dictionary)
│   └── en (locale)
│       ├── entities (solution entities and generator helpers)
│       │   └── entity (contains individual entity string definitions)
│       └── views (contains based on views - website/ui specific)
│           └── view (contains individual view sets)
└── i18n (generator)
    └── en (wrapper for dictionary into typesafe-i18n system)
```

## String Syntax

### Entities

Entities are core types defines within the solution and folow a common "string" definition pattern.

```js
// StringEntityDefinition
const EntityName: StringEntityDefinition<'EntityName'> = {
	[EntityName]: 'Pascal Name',
	[EntityNames]: 'Plural Pascal Name',
	[entity_name]: 'lowercase name',
	[entity_names]: 'plural lowercase name',

	description: 'Description for single entity',
	descriptions: 'Description for collection of this this entity',

	// Property definitions for this entity
	properites: {
		[propertyName]: {
			label?: 'string',
			description?: 'string',
			placeholder?: 'string',
			hintText?: 'string',
			emptyText?: 'string',
		}
	}
}

// Example
const DataProduct: StringEntityDefinition<'DataProduct'> = {
	DataProduct: 'Data Product',
	DataProducts: 'Data Products',
	data_product: 'data product',
	data_products: 'data products',

	description: 'Single data product',
	descriptions: 'List of data products',

	// Property definitions for this entity
	properites: {
		foo: {
			label: 'Foo Label',
			description: 'The foo description',
		},
		bar: {
			label: 'Bar Label',
			description: 'The bar description',
		},
	}
}
```

When this is generated it will result in the a auto generated interpolations and flattened mappings.

```js
{
	EntityName: 'Pascal Name',
	EntityNames: 'Plural Pascal Name',
	entity_name: 'lowercase name',
	entity_names: 'plural lowercase name',

	// mapped descriptions
	EntityName_description: 'Description for single entity',
	EntityNames_description: 'Description for collection of this this entity',

	// interpolations
	// - automatic pluralization based on count
	EntityNames$: '{{ Pascal Name || ? Pascal Names }}',
	entity_names$: '{{ lowercase name || ? plural lowcase name }}',
	// - automatic count
	'EntityNames#': '{0?:number} {{ Pascal Name || ? Pascal Names }}',
	'entity_names#': '{0?:number} {{ lowercase name || ? plural lowcase name }}',

	// Property definitions for this entity
	'EntityName@': {
		propertyName: {
			label?: 'string',
			description?: 'string',
			placeholder?: 'string',
			hintText?: 'string',
			emptyText?: 'string',
		}
	}
}
```
