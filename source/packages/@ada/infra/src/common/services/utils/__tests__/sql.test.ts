/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { buildCreateExternalTableQuery, buildCtasQuery, buildDropTableQuery } from '../sql';

describe('sql', () => {
  it('should build a CTAS query', () => {
    expect(
      buildCtasQuery({
        selectQuery: 'SELECT * FROM foo.bar',
        database: 'my-database',
        tableName: 'my-table-name',
        outputS3Path: 's3://foo/bar',
      }),
    ).toBe(`CREATE TABLE "my-database"."my-table-name"
WITH (
  external_location = 's3://foo/bar',
  format = 'PARQUET'
) AS (SELECT * FROM foo.bar)`);
  });

  it('should build a drop table query', () => {
    expect(buildDropTableQuery({ database: 'my-database', tableName: 'my-table-name' })).toBe(
      'DROP TABLE `my-database`.`my-table-name`',
    );
  });

  it('should build a create external table query for csv data', () => {
    expect(
      buildCreateExternalTableQuery({
        database: 'my_database',
        tableName: 'my_table',
        columns: [
          { name: 'name', type: 'string' },
          { name: 'age', type: 'int' },
        ],
        classification: 'csv',
        s3Path: 's3://foo/bar/',
      }),
    ).toBe(
      `CREATE EXTERNAL TABLE my_database.my_table (\`name\` string,\`age\` int) ROW FORMAT DELIMITED FIELDS TERMINATED BY ',' LOCATION 's3://foo/bar/' TBLPROPERTIES ('classification'='csv','skip.header.line.count'='1')`,
    );
  });

  it('should build a create external table query for csv data with an alternate delimiter', () => {
    expect(
      buildCreateExternalTableQuery({
        database: 'my_database',
        tableName: 'my_table',
        columns: [
          { name: 'name', type: 'string' },
          { name: 'age', type: 'int' },
        ],
        classification: 'csv',
        s3Path: 's3://foo/bar/',
        metadata: { delimiter: '|' },
      }),
    ).toBe(
      `CREATE EXTERNAL TABLE my_database.my_table (\`name\` string,\`age\` int) ROW FORMAT DELIMITED FIELDS TERMINATED BY '|' LOCATION 's3://foo/bar/' TBLPROPERTIES ('classification'='csv','skip.header.line.count'='1')`,
    );
  });

  it('should build a create external table query for json data', () => {
    expect(
      buildCreateExternalTableQuery({
        database: 'my_database',
        tableName: 'my_table',
        columns: [
          { name: 'name', type: 'string' },
          { name: 'age', type: 'int' },
        ],
        classification: 'json',
        s3Path: 's3://foo/bar',
      }),
    ).toBe(
      `CREATE EXTERNAL TABLE my_database.my_table (\`name\` string,\`age\` int) ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe' WITH SERDEPROPERTIES ('ignore.malformed.json'='true') LOCATION 's3://foo/bar/' TBLPROPERTIES ('classification'='json')`,
    );
  });

  it('should build a create external table query for parquet data', () => {
    expect(
      buildCreateExternalTableQuery({
        database: 'my_database',
        tableName: 'my_table',
        columns: [
          { name: 'name', type: 'string' },
          { name: 'age', type: 'int' },
        ],
        classification: 'parquet',
        s3Path: 's3://foo/bar',
      }),
    ).toBe(
      `CREATE EXTERNAL TABLE my_database.my_table (\`name\` string,\`age\` int) STORED AS PARQUET LOCATION 's3://foo/bar/' TBLPROPERTIES ('classification'='parquet')`,
    );
  });

  it('should throw an error when building a create external table query for an unsupported format', () => {
    expect(() =>
      buildCreateExternalTableQuery({
        database: 'my_database',
        tableName: 'my_table',
        columns: [
          { name: 'name', type: 'string' },
          { name: 'age', type: 'int' },
        ],
        classification: 'avro',
        s3Path: 's3://foo/bar',
      }),
    ).toThrow('Unsupported data type avro');
  });
});
