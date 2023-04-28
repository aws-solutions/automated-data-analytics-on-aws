/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'cypress-localstorage-commands';
import { uniqueId } from 'lodash';

export interface DataProductJson extends JQuery<HTMLElement> {
  domainId: string;
  dataProductId: string;
  sourceDetails: string;
}

describe('complete e2e creation of a domain, amazon dynamoDB data product, query with governance checking, delete data product and domain ', () => {
  const baseApiUrl = Cypress.env('baseApiUrl');
  const testDomain = uniqueId('test_' + new Date().getTime().toString(36));
  const tableName = 'amazon-dynamoDB-data-source-cypress-test-' + new Date().getTime().toString(36);
  const value = 123456789101;
  let uniqDataProductId: string | number | RegExp;

  before(() => {
    cy.signIn();
    cy.exec(`python cypress/scripts/aws_helper.py dynamodb_table_create --table_name ${tableName}`).then((result) => {
      cy.log(result.stdout);
    });
    cy.wait(5000);
    cy.exec(
      `python cypress/scripts/aws_helper.py dynamodb_record_create --table_name ${tableName} --id ${value} --value ${value}`,
    ).then((result) => {
      cy.log(result.stdout);
    });
  });

  after(() => {
    cy.clearLocalStorageSnapshot();
    cy.clearLocalStorage();
    cy.exec(`python cypress/scripts/aws_helper.py dynamodb_table_delete --table_name ${tableName}`).then((result) => {
      cy.log(result.stdout);
    });
  });

  beforeEach(function () {
    cy.fixture('createDataProduct').as('data');
    cy.restoreLocalStorage();
  });

  afterEach(() => {
    cy.saveLocalStorage();
  });

  it('create a data domain', () => {
    cy.createDataDomain(testDomain, baseApiUrl);
  });

  it('create an amazon dynamoDB data product', () => {
    cy.visit('/data-product');

    cy.get('@data').then((dp: DataProductJson) => {
      uniqDataProductId = uniqueId(dp.dataProductId + new Date().getTime().toString(36));
      cy.intercept(`${baseApiUrl}data-product/domain/${testDomain}/data-product/${uniqDataProductId}`).as(
        'dataProductCreated',
      );
      cy.intercept(`${baseApiUrl}governance/policy/domain/${testDomain}/data-product/${uniqDataProductId}`).as(
        'governancePolicy',
      );
      cy.contains('.MuiButton-label', 'Create data product').click();
      cy.get('body').click();

      cy.get('[id="domainId"]').click();
      cy.contains('.MuiButtonBase-root', testDomain).click();
      cy.get('body').click();
      cy.get('#name').clear();
      cy.get('#name').type(uniqDataProductId);
      cy.get('#description').clear();
      cy.get('#description').type('cypress testing data product');

      cy.contains('.MuiTypography-root', 'Amazon DynamoDB').click();
      cy.contains('.MuiButton-label', 'Next').click();
      cy.exec(`python cypress/scripts/aws_helper.py dynamodb_table_summary --table_name ${tableName}`).then(
        (result) => {
          cy.get('input[name="sourceDetails.dynamoDbTableArn.tableArn"]').type(result.stdout);
          cy.contains('.MuiTypography-root', 'On Demand').click();
          cy.contains('.MuiButton-label', 'Next').click();

          cy.contains('.MuiButtonBase-root', 'Continue with current schema', { timeout: 300000 })
            .should('not.be.disabled')
            .click();
          cy.contains('.MuiButton-label', 'Submit', { timeout: 50000 }).click();

          cy.contains('Building', { timeout: 50000 });
          cy.wait('@dataProductCreated', { timeout: 300000 }).its('response.statusCode').should('be.equal', 200);
          cy.wait('@governancePolicy', { timeout: 300000 }).its('response.statusCode').should('be.equal', 200);
        },
      );
    });
  });

  it('should query the data product and check governance', () => {
    cy.queryAndGovernance(testDomain, uniqDataProductId, value, false);
  });

  it('should delete a data product', () => {
    cy.deleteDataProduct(testDomain, baseApiUrl, uniqDataProductId);
  });

  it('should delete data domain', () => {
    cy.deleteDataDomain(testDomain);
  });
});
