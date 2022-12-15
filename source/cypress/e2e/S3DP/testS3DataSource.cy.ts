/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'cypress-localstorage-commands';
import { uniqueId } from 'lodash';

export interface DataProductJson extends JQuery<HTMLElement> {
  domainId: string;
  dataProductId: string;
  sourceDetails: string;
}

describe('complete e2e creation of a domain, amazon s3 data product, query with governance checking, delete data product and domain ', () => {
  const baseApiUrl = Cypress.env('baseApiUrl');
  const awsregion = Cypress.env('awsregion');
  const testDomain = uniqueId('test_' + new Date().getTime().toString(36));
  const objectKey = 'data/socialGeneratedData.csv';
  const objectPath = 'cypress/fixtures/socialGeneratedData.csv';
  const bucket = 'amazon-s3-data-source-cypress-test-' + new Date().getTime().toString(36);
  let uniqDataProductId: string | number | RegExp;

  before(() => {
    cy.signIn();
    cy.exec(
      `python cypress/scripts/aws_helper.py s3_upload --bucket ${bucket} --file_path ${objectPath} --key ${objectKey} --region ${awsregion}`,
    ).then((result) => {
      cy.log(result.stdout);
    });
  });

  after(() => {
    cy.clearLocalStorageSnapshot();
    cy.clearLocalStorage();
    cy.exec(`python cypress/scripts/aws_helper.py s3_delete --bucket ${bucket} --key ${objectKey}`).then((result) => {
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

  it('create a amazon s3 data product', () => {
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

      cy.contains('.MuiTypography-root', 'Amazon S3').click();
      cy.contains('.MuiButton-label', 'Next').click();
      cy.get('input[name="sourceDetails.s3Path"]').type(`s3://${bucket}/data`);
      cy.contains('.MuiTypography-root', 'On Demand').click();
      cy.contains('.MuiTypography-root', 'Append').click();
      cy.contains('.MuiButton-label', 'Next').click();

      cy.contains('.MuiButtonBase-root', 'Continue with current schema', { timeout: 300000 })
        .should('not.be.disabled')
        .click();
      cy.contains('.MuiButton-label', 'Submit', { timeout: 50000 }).click();

      cy.contains('Building', { timeout: 50000 });
      cy.wait('@dataProductCreated', { timeout: 300000 }).its('response.statusCode').should('be.equal', 200);
      cy.wait('@governancePolicy', { timeout: 300000 }).its('response.statusCode').should('be.equal', 200);
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
