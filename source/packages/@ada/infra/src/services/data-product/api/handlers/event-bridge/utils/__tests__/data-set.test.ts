/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DataSetIds, OntologyNamespace } from '@ada/common';
import { columnMetadataToList, getSchemaSimilarityScore, reconcileDataSets, resolveColumn } from '../data-set';

describe('data-set', () => {
  describe('reconcileDataSets', () => {
    it('should reconcile data sets when there is a single matching dataset', () => {
      expect(
        reconcileDataSets(
          {
            [DataSetIds.DEFAULT]: {
              name: 'My DataSet',
              description: 'This is my dataset',
              identifiers: {},
              columnMetadata: {
                name: {
                  dataType: 'varchar',
                  ontologyNamespace: OntologyNamespace.DEFAULT,
                  ontologyAttributeId: 'name-ontology',
                  description: 'The name of a person',
                },
                age: {
                  dataType: 'int',
                  ontologyNamespace: OntologyNamespace.DEFAULT,
                  ontologyAttributeId: 'person-age',
                  description: 'The age of a person',
                },
              },
            },
          },
          {
            differentDataSetId: {
              identifiers: { catalog: 'catalog', database: 'database', table: 'table' },
              columnMetadata: {
                name: {
                  dataType: 'string',
                },
                age: {
                  dataType: 'int',
                },
              },
            },
          },
        ),
      ).toEqual({
        differentDataSetId: {
          name: 'My DataSet',
          description: 'This is my dataset',
          identifiers: { catalog: 'catalog', database: 'database', table: 'table' },
          columnMetadata: {
            name: {
              dataType: 'string',
              ontologyAttributeId: 'name-ontology',
              ontologyNamespace: OntologyNamespace.DEFAULT,
              description: 'The name of a person',
            },
            age: {
              dataType: 'int',
              ontologyAttributeId: 'person-age',
              ontologyNamespace: OntologyNamespace.DEFAULT,
              description: 'The age of a person',
            },
          },
        },
      });
    });

    it('should reconcile data sets by their id', () => {
      expect(
        reconcileDataSets(
          {
            [DataSetIds.DEFAULT]: {
              name: 'My DataSet',
              description: 'This is my dataset',
              identifiers: {},
              columnMetadata: {
                name: {
                  dataType: 'varchar',
                  ontologyAttributeId: 'name-ontology',
                  ontologyNamespace: OntologyNamespace.DEFAULT,
                  description: 'The name of a person',
                },
                age: {
                  dataType: 'int',
                  ontologyAttributeId: 'person-age',
                  ontologyNamespace: OntologyNamespace.DEFAULT,
                  description: 'The age of a person',
                },
              },
            },
            anotherDataSet: {
              name: 'Another DataSet',
              description: 'This is another dataset',
              identifiers: {},
              columnMetadata: {
                lightsaberColour: {
                  dataType: 'varchar',
                  description: 'Lightsaber colour',
                },
              },
            },
          },
          {
            [DataSetIds.DEFAULT]: {
              identifiers: { catalog: 'catalog', database: 'database', table: 'table' },
              columnMetadata: {
                name: {
                  dataType: 'string',
                },
                age: {
                  dataType: 'int',
                },
              },
            },
            anotherDataSet: {
              identifiers: {},
              columnMetadata: {
                lightsaberColour: {
                  dataType: 'varchar',
                },
              },
            },
          },
        ),
      ).toEqual({
        [DataSetIds.DEFAULT]: {
          name: 'My DataSet',
          description: 'This is my dataset',
          identifiers: { catalog: 'catalog', database: 'database', table: 'table' },
          columnMetadata: {
            name: {
              dataType: 'string',
              ontologyAttributeId: 'name-ontology',
              ontologyNamespace: OntologyNamespace.DEFAULT,
              description: 'The name of a person',
            },
            age: {
              dataType: 'int',
              ontologyAttributeId: 'person-age',
              ontologyNamespace: OntologyNamespace.DEFAULT,
              description: 'The age of a person',
            },
          },
        },
        anotherDataSet: {
          name: 'Another DataSet',
          description: 'This is another dataset',
          identifiers: {},
          columnMetadata: {
            lightsaberColour: {
              dataType: 'varchar',
              description: 'Lightsaber colour',
            },
          },
        },
      });
    });

    it('should reconcile data sets by their similarity when ids do not match', () => {
      expect(
        reconcileDataSets(
          {
            dataSet1: {
              name: 'My DataSet',
              description: 'This is my dataset',
              identifiers: {},
              columnMetadata: {
                name: {
                  dataType: 'varchar',
                  ontologyAttributeId: 'name-ontology',
                  ontologyNamespace: OntologyNamespace.DEFAULT,
                  description: 'The name of a person',
                },
                age: {
                  dataType: 'int',
                  ontologyAttributeId: 'person-age',
                  ontologyNamespace: OntologyNamespace.DEFAULT,
                  description: 'The age of a person',
                },
              },
            },
            dataSet2: {
              name: 'Another DataSet',
              description: 'This is another dataset',
              identifiers: {},
              columnMetadata: {
                lightsaberColour: {
                  dataType: 'varchar',
                  description: 'Lightsaber colour',
                },
                age: {
                  dataType: 'int',
                  description: 'Lightsaber age',
                },
              },
            },
          },
          {
            [DataSetIds.DEFAULT]: {
              identifiers: { catalog: 'catalog', database: 'database', table: 'table' },
              columnMetadata: {
                name: {
                  dataType: 'string',
                },
                age: {
                  dataType: 'int',
                },
              },
            },
            anotherDataSet: {
              identifiers: {},
              columnMetadata: {
                lightsaberColour: {
                  dataType: 'varchar',
                },
              },
            },
          },
        ),
      ).toEqual({
        [DataSetIds.DEFAULT]: {
          name: 'My DataSet',
          description: 'This is my dataset',
          identifiers: { catalog: 'catalog', database: 'database', table: 'table' },
          columnMetadata: {
            name: {
              dataType: 'string',
              ontologyAttributeId: 'name-ontology',
              ontologyNamespace: OntologyNamespace.DEFAULT,
              description: 'The name of a person',
            },
            age: {
              dataType: 'int',
              ontologyAttributeId: 'person-age',
              ontologyNamespace: OntologyNamespace.DEFAULT,
              description: 'The age of a person',
            },
          },
        },
        anotherDataSet: {
          name: 'Another DataSet',
          description: 'This is another dataset',
          identifiers: {},
          columnMetadata: {
            lightsaberColour: {
              dataType: 'varchar',
              description: 'Lightsaber colour',
            },
          },
        },
      });
    });

    it('should reconcile data sets when one is a superset of another', () => {
      expect(
        reconcileDataSets(
          {
            dataSet1: {
              name: 'My DataSet',
              description: 'This is my dataset',
              identifiers: {},
              columnMetadata: {
                name: {
                  dataType: 'varchar',
                  ontologyAttributeId: 'name-ontology',
                  ontologyNamespace: OntologyNamespace.DEFAULT,
                  description: 'The name of a person',
                },
                age: {
                  dataType: 'int',
                  ontologyAttributeId: 'person-age',
                  ontologyNamespace: OntologyNamespace.DEFAULT,
                  description: 'The age of a person',
                },
              },
            },
            dataSet2: {
              name: 'Another DataSet',
              description: 'This is another dataset',
              identifiers: {},
              columnMetadata: {
                name: {
                  dataType: 'varchar',
                  description: 'Lightsaber name',
                },
                lightsaberColour: {
                  dataType: 'varchar',
                  description: 'Lightsaber colour',
                },
                age: {
                  dataType: 'int',
                  description: 'Lightsaber age',
                },
              },
            },
          },
          {
            [DataSetIds.DEFAULT]: {
              identifiers: { catalog: 'catalog', database: 'database', table: 'table' },
              columnMetadata: {
                name: {
                  dataType: 'string',
                },
                age: {
                  dataType: 'int',
                },
              },
            },
            anotherDataSet: {
              identifiers: {},
              columnMetadata: {
                name: {
                  dataType: 'varchar',
                },
                lightsaberColour: {
                  dataType: 'varchar',
                },
                age: {
                  dataType: 'int',
                },
              },
            },
          },
        ),
      ).toEqual({
        [DataSetIds.DEFAULT]: {
          name: 'My DataSet',
          description: 'This is my dataset',
          identifiers: { catalog: 'catalog', database: 'database', table: 'table' },
          columnMetadata: {
            name: {
              dataType: 'string',
              ontologyAttributeId: 'name-ontology',
              ontologyNamespace: OntologyNamespace.DEFAULT,
              description: 'The name of a person',
            },
            age: {
              dataType: 'int',
              ontologyAttributeId: 'person-age',
              ontologyNamespace: OntologyNamespace.DEFAULT,
              description: 'The age of a person',
            },
          },
        },
        anotherDataSet: {
          name: 'Another DataSet',
          description: 'This is another dataset',
          identifiers: {},
          columnMetadata: {
            name: {
              dataType: 'varchar',
              description: 'Lightsaber name',
            },
            lightsaberColour: {
              dataType: 'varchar',
              description: 'Lightsaber colour',
            },
            age: {
              dataType: 'int',
              description: 'Lightsaber age',
            },
          },
        },
      });
    });
  });

  describe('getSchemaSimilarityScore', () => {
    // Helpers for getting the score of more concisely defined schemas
    const toColumnMetadata = (columns: { [name: string]: string }) =>
      Object.fromEntries(Object.entries(columns).map(([name, dataType]) => [name, { dataType }]));
    const getScore = (discovered: { [name: string]: string }, current: { [name: string]: string }): number => {
      const discoveredMetadata = toColumnMetadata(discovered);
      const currentMetadata = toColumnMetadata(current);
      return getSchemaSimilarityScore(discoveredMetadata, columnMetadataToList(discoveredMetadata), currentMetadata);
    };

    it('should return a greater score for matching column names', () => {
      expect(
        getScore(
          {
            name: 'varchar',
            age: 'int',
          },
          {
            name: 'string',
            age: 'bigint',
          },
        ),
      ).toBeGreaterThan(
        getScore(
          {
            name: 'varchar',
            age: 'int',
          },
          {
            year: 'int',
            month: 'int',
            day: 'int',
          },
        ),
      );
    });

    it('should return a greater score for matching names and types', () => {
      expect(
        getScore(
          {
            name: 'varchar',
            age: 'int',
          },
          {
            name: 'varchar',
            age: 'int',
          },
        ),
      ).toBeGreaterThan(
        getScore(
          {
            name: 'varchar',
            age: 'int',
          },
          {
            name: 'string',
            age: 'int',
          },
        ),
      );
    });

    it('should return a greater score when there are fewer non-matching columns', () => {
      expect(
        getScore(
          {
            name: 'varchar',
            age: 'int',
          },
          {
            name: 'varchar',
            age: 'int',
            another: 'string',
          },
        ),
      ).toBeGreaterThan(
        getScore(
          {
            name: 'varchar',
            age: 'int',
          },
          {
            name: 'string',
            age: 'int',
            another: 'string',
            yetAnother: 'bigint',
          },
        ),
      );
    });
  });

  describe('resolveColumn', () => {
    it('should retain existing column metadata if there is no update', () => {
      const existingColumn = {
        isActive: {
          dataType: 'boolean',
        },
      };

      const isActiveColumn = {
        dataType: 'boolean',
      };

      expect(resolveColumn(existingColumn, isActiveColumn, 'isactive')).toEqual({
        dataType: 'boolean',
      });
    });

    it('should retain ontology attributes if they are already set', () => {
      const existingColumn = {
        greeting: {
          ontologyAttributeId: 'name',
          piiClassification: 'NAME',
          ontologyNamespace: 'pii_classifications',
          dataType: 'string',
        },
      };

      const greetingColumn = {
        dataType: 'string',
        piiClassification: 'CLASSIFIED',
      };

      expect(resolveColumn(existingColumn, greetingColumn, 'greeting')).toEqual({
        ...existingColumn.greeting,
      });
    });

    it('should automap pii and retain already set ontology attribute', () => {
      const existingColumn = {
        artist: {
          ontologyAttributeId: 'artist',
          ontologyNamespace: 'music',
          dataType: 'string',
        },
      };

      const artistColumn = {
        dataType: 'string',
        piiClassification: 'NAME',
      };

      expect(resolveColumn(existingColumn, artistColumn, 'artist')).toEqual({
        ...existingColumn.artist,
        piiClassification: 'NAME',
      });
    });

    it('should automap pii as ontology attribute if none is set', () => {
      const existingColumn = {
        artist: {
          dataType: 'string',
        },
      };

      const artistColumn = {
        dataType: 'string',
        piiClassification: 'name',
        ontologyNamespace: OntologyNamespace.PII_CLASSIFICATIONS,
      };

      expect(resolveColumn(existingColumn, artistColumn, 'artist')).toEqual({
        dataType: 'string',
        piiClassification: 'name',
        ontologyNamespace: OntologyNamespace.PII_CLASSIFICATIONS,
        ontologyAttributeId: 'name',
      });
    });

    it('should map pii not detected entity types correctly', () => {
      const existingColumn = {
        artist: {
          dataType: 'string',
        },
      };

      const artistColumn = {
        dataType: 'string',
        piiClassification: '',
        ontologyNamespace: undefined,
      };

      expect(resolveColumn(existingColumn, artistColumn, 'artist')).toEqual({
        dataType: 'string',
      });
    });
  });
});
