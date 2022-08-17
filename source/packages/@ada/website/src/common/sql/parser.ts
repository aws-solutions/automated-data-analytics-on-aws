/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import MySQLParser from 'ts-mysql-parser';

const parser = new MySQLParser();

export function parseSQL(sql: string) {
  const result = parser.parse(sql);
  if (result.parserError) {
    throw new Error(result.parserError.message);
  }
  return result;
}

export function isValidSQL(sql: string) {
  try {
    parseSQL(sql);
    return true;
  } catch (error) {
    return false;
  }
}
