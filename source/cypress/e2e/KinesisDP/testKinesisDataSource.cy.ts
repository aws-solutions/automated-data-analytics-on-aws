/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'cypress-localstorage-commands';
import { uniqueId } from 'lodash';

export interface DataProductJson extends JQuery<HTMLElement> {
  domainId: string;
  dataProductId: string;
  sourceDetails: string;
}

describe('complete e2e creation of a domain, kinesis data product, query with governance checking, delete data product and domain ', () => {
  const baseApiUrl = Cypress.env('baseApiUrl');
  const testDomain = uniqueId('test_' + new Date().getTime().toString(36));
  let uniqDataProductId: string | number | RegExp;
  const kinesisStreamName = "cypress-data-product-ks"
  const partitionKey = 'data/socialGeneratedData.csv';
  const filePath = 'cypress/fixtures/socialGeneratedData.csv';

  before(() => {
    cy.signIn();
    cy.exec(`python cypress/scripts/aws_helper.py kinesis_create --streamname ${kinesisStreamName}`).then((result) => {
      cy.log(result.stdout);
    });
  });

  after(() => {
    cy.clearLocalStorageSnapshot();
    cy.clearLocalStorage();
    cy.exec(`python cypress/scripts/aws_helper.py kinesis_delete --streamname ${kinesisStreamName}`).then((result) => {
      cy.log(result.stdout)
    });
  });

    beforeEach(function () {
      cy.fixture('createDataProduct').as('data');
      cy.fixture('socialGeneratedData.csv');
      cy.intercept(`${baseApiUrl}identity/group?pageSize=100`).as('groups');
      cy.intercept(`${baseApiUrl}data-product/domain`).as('domains');
      cy.intercept(`${baseApiUrl}data-product/scripts?pageSize=100`).as('scripts');

      cy.restoreLocalStorage();
    });

    afterEach(() => {
      cy.saveLocalStorage();
    });

    it('create a data domain', () => {
      cy.createDataDomain(testDomain, baseApiUrl);
    });

    it('create a kinesis data product', () => {
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
        cy.wait('@domains', { timeout: 20000 }).its('response.statusCode').should('be.equal', 200);
        cy.wait('@groups', { timeout: 20000 }).its('response.statusCode').should('be.equal', 200);

        cy.get('[id="domainId"]').click();
        cy.contains('.MuiButtonBase-root', testDomain).click();
        cy.get('body').click();
        cy.get('#name').clear();
        cy.get('#name').type(uniqDataProductId);
        cy.get('#description').clear();
        cy.get('#description').type('cypress testing data product');

        cy.exec(`python cypress/scripts/aws_helper.py kinesis_summary --streamname ${kinesisStreamName}`).then((result) => {
          cy.contains('.MuiTypography-root', 'Amazon Kinesis Stream').click();
          cy.contains('.MuiButton-label', 'Next').click();
          cy.get('input[name="sourceDetails.kinesisStreamArn"]').type(result.stdout);
          cy.contains('.MuiTypography-root', 'Automatic').click();
          cy.contains('.MuiButton-label', 'Next').click();
          cy.contains('.MuiButton-label', 'Submit', { timeout: 50000 }).click();

          cy.contains('Building', { timeout: 100000 });
          cy.contains('Importing', { timeout: 500000 });          
          cy.exec(`python cypress/scripts/aws_helper.py kinesis_data --streamname ${kinesisStreamName} --file_path ${filePath} --partitionkey ${partitionKey}`).then((result) => {
            cy.log(result.stdout)
            cy.wait('@dataProductCreated', { timeout: 300000 }).its('response.statusCode').should('be.equal', 200);
            cy.wait('@governancePolicy', { timeout: 300000 }).its('response.statusCode').should('be.equal', 200);
          });
        });
      });
    });

    it('should query the data product and check governance', () => {
      cy.queryAndGovernance(testDomain, uniqDataProductId, 100);
    });

    it('should delete a data product', () => {
      cy.deleteDataProduct(testDomain, baseApiUrl, uniqDataProductId);
    });

    it('should delete data domain', () => {
      cy.deleteDataDomain(testDomain);
    });
});
