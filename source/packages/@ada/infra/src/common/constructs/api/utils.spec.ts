/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { JsonSchemaType } from 'aws-cdk-lib/aws-apigateway';
import { extendSchema, mergeJsonSchema, normalizeSchema } from './utils';

describe('federated-api/utils', () => {
  describe('mergeJsonSchema', () => {
    describe('properties', () => {
      it('should merge properties', () => {
        expect(
          mergeJsonSchema(
            'TEST',
            {
              id: 'Foo',
              properties: {
                foo: {
                  type: JsonSchemaType.STRING,
                },
                shared: {
                  type: JsonSchemaType.STRING,
                  description: 'from foo',
                },
              },
            },
            {
              id: 'Bar',
              properties: {
                bar: {
                  type: JsonSchemaType.STRING,
                },
                shared: {
                  type: JsonSchemaType.STRING,
                  description: 'from bar',
                },
              },
            },
          ),
        ).toMatchObject({
          id: 'TEST',
          properties: {
            foo: {
              type: JsonSchemaType.STRING,
            },
            bar: {
              type: JsonSchemaType.STRING,
            },
            shared: {
              type: JsonSchemaType.STRING,
              description: 'from bar',
            },
          },
        });
      });
    });
    describe('required', () => {
      it('should concat `required` properties as uniq values and sorted', () => {
        expect(
          mergeJsonSchema(
            'TEST',
            {
              required: ['a', 'b'],
            },
            {
              required: ['b', 'c'],
            },
            {
              required: ['c', 'd'],
            },
          ),
        ).toMatchObject({
          required: ['a', 'b', 'c', 'd'],
        });
      });
    });
    describe('enum', () => {
      it('should concat `enum` properties as uniq values and sorted', () => {
        expect(
          mergeJsonSchema(
            'TEST',
            {
              enum: ['a', 'b'],
            },
            {
              enum: ['b', 'c'],
            },
            {
              enum: ['c', 'd'],
            },
          ),
        ).toMatchObject({
          enum: ['a', 'b', 'c', 'd'],
        });
      });
    });
    describe('additionalProperties', () => {
      it('should use `true` if any schema defines `true`', () => {
        expect(
          mergeJsonSchema(
            'TEST',
            {
              additionalProperties: false,
            },
            {
              additionalProperties: { type: JsonSchemaType.OBJECT },
            },
            {
              additionalProperties: true,
            },
          ),
        ).toMatchObject({
          additionalProperties: true,
        });
      });
      it('should merge additionalProperties schema objects as single object when neither have `allOf` and both objects', () => {
        expect(
          mergeJsonSchema(
            'TEST',
            {
              additionalProperties: { type: JsonSchemaType.OBJECT, properties: { a: { type: JsonSchemaType.STRING } } },
            },
            {
              additionalProperties: { type: JsonSchemaType.OBJECT, properties: { b: { type: JsonSchemaType.STRING } } },
            },
            {
              additionalProperties: { type: JsonSchemaType.OBJECT, properties: { c: { type: JsonSchemaType.STRING } } },
            },
          ),
        ).toMatchObject({
          additionalProperties: {
            type: JsonSchemaType.OBJECT,
            properties: {
              a: { type: JsonSchemaType.STRING },
              b: { type: JsonSchemaType.STRING },
              c: { type: JsonSchemaType.STRING },
            },
          },
        });
      });
      it('should merge additionalProperties when both objects define `allOf`', () => {
        expect(
          mergeJsonSchema(
            'TEST',
            {
              additionalProperties: { type: JsonSchemaType.OBJECT, allOf: [{ type: JsonSchemaType.STRING }] },
            },
            {
              additionalProperties: { type: JsonSchemaType.OBJECT, allOf: [{ type: JsonSchemaType.NUMBER }] },
            },
            {
              additionalProperties: { type: JsonSchemaType.OBJECT, allOf: [{ type: JsonSchemaType.BOOLEAN }] },
            },
          ),
        ).toMatchObject({
          additionalProperties: {
            type: JsonSchemaType.OBJECT,
            allOf: [{ type: JsonSchemaType.STRING }, { type: JsonSchemaType.NUMBER }, { type: JsonSchemaType.BOOLEAN }],
          },
        });
      });
      it('should merge additionalProperties into `allOf` if any schema defines `allOf`', () => {
        expect(
          mergeJsonSchema(
            'TEST',
            {
              additionalProperties: { type: JsonSchemaType.NUMBER },
            },
            {
              additionalProperties: { type: JsonSchemaType.OBJECT, allOf: [{ type: JsonSchemaType.STRING }] },
            },
          ),
        ).toMatchObject({
          additionalProperties: {
            type: JsonSchemaType.OBJECT,
            allOf: [{ type: JsonSchemaType.STRING }, { type: JsonSchemaType.NUMBER }],
          },
        });
      });
      it('should wrap additionalProperties when unable to merge', () => {
        expect(
          mergeJsonSchema(
            'TEST',
            {
              additionalProperties: { type: JsonSchemaType.NUMBER },
            },
            {
              additionalProperties: { type: JsonSchemaType.OBJECT, properties: { a: { type: JsonSchemaType.STRING } } },
            },
          ),
        ).toMatchObject({
          additionalProperties: {
            type: JsonSchemaType.OBJECT,
            allOf: [
              { type: JsonSchemaType.NUMBER },
              { type: JsonSchemaType.OBJECT, properties: { a: { type: JsonSchemaType.STRING } } },
            ],
          },
        });
      });
    });
  });
  describe('normalize', () => {
    it('should hoist and maintain all definitions/refs', () => {
      const schema = normalizeSchema({
        id: 'Foo',
        properties: {
          foo: {
            id: 'FooProps',
            type: JsonSchemaType.OBJECT,
            properties: {
              a: { ref: '#/definitions/a' },
              b: { ref: '#/definitions/b' },
              bar: {
                id: 'Bar',
                properties: {
                  bar: {
                    id: 'BarProps',
                    type: JsonSchemaType.OBJECT,
                    properties: {
                      b: { ref: '#/definitions/b' },
                      c: { ref: '#/definitions/c' },
                    },
                    definitions: {
                      B: {
                        id: 'B',
                        type: JsonSchemaType.STRING,
                      },
                      C: {
                        id: 'C',
                        type: JsonSchemaType.STRING,
                      },
                    },
                  },
                },
              },
            },
            definitions: {
              A: {
                id: 'A',
                type: JsonSchemaType.STRING,
              },
              B: {
                id: 'B',
                type: JsonSchemaType.STRING,
              },
            },
          },
        },
      });

      expect(schema).toMatchSnapshot();
    });
  });
  describe('extendsSchema', () => {
    describe('definitions', () => {
      it('should merge schema and maintain models', () => {
        const schema = extendSchema(
          {
            id: 'Foo',
            properties: {
              a: { ref: '#/definitions/a' },
              b: { ref: '#/definitions/b' },
              foo: {
                id: 'FooProps',
                type: JsonSchemaType.OBJECT,
                properties: {
                  a: { ref: '#/definitions/a' },
                  b: { ref: '#/definitions/b' },
                },
                definitions: {
                  A: {
                    id: 'A',
                    type: JsonSchemaType.STRING,
                  },
                  B: {
                    id: 'B',
                    type: JsonSchemaType.STRING,
                  },
                },
              },
            },
          },
          {
            id: 'Bar',
            properties: {
              bar: {
                id: 'BarProps',
                type: JsonSchemaType.OBJECT,
                properties: {
                  b: { ref: '#/definitions/b' },
                  c: { ref: '#/definitions/c' },
                  baz: {
                    id: 'Baz',
                    properties: {
                      a: { ref: '#/definitions/a' },
                      d: { ref: '#/definitions/d' },
                      bar: {
                        id: 'BazProps',
                        type: JsonSchemaType.OBJECT,
                        properties: {
                          a: { ref: '#/definitions/a' },
                          d: { ref: '#/definitions/d' },
                        },
                        definitions: {
                          A: {
                            id: 'A',
                            type: JsonSchemaType.STRING,
                          },
                          D: {
                            id: 'D',
                            type: JsonSchemaType.STRING,
                          },
                        },
                      },
                    },
                  },
                },
                definitions: {
                  B: {
                    id: 'B',
                    type: JsonSchemaType.STRING,
                  },
                  C: {
                    id: 'C',
                    type: JsonSchemaType.STRING,
                  },
                },
              },
            },
          },
          {
            id: 'Biz',
            properties: {
              a: { ref: '#/definitions/a' },
              d: { ref: '#/definitions/d' },
              bar: {
                id: 'BizProps',
                type: JsonSchemaType.OBJECT,
                properties: {
                  a: { ref: '#/definitions/a' },
                  d: { ref: '#/definitions/d' },
                },
                definitions: {
                  A: {
                    id: 'A',
                    type: JsonSchemaType.STRING,
                  },
                  D: {
                    id: 'D',
                    type: JsonSchemaType.STRING,
                  },
                },
              },
            },
          },
        );

        expect(schema).toMatchSnapshot();
      });
    });
  });
});
