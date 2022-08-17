/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'cypress-localstorage-commands';
import { uniqueId } from 'lodash';

export interface DataProductJson extends JQuery<HTMLElement> {
  domainId: string;
  dataProductId: string;
  sourceDetails: string;
}

describe('complete e2e creation of a domain, data product, query with governance checking, delete data product and domain ', () => {
  const baseApiUrl = Cypress.env('baseApiUrl');
  const testDomain = uniqueId('test_' + new Date().getTime().toString(36));
  let uniqDataProductId: string | number | RegExp;
  before(() => {
    cy.signIn();
  });

  after(() => {
    cy.clearLocalStorageSnapshot();
    cy.clearLocalStorage();
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
    cy.visit('/data-product');
    cy.contains('.MuiButton-label', 'Create domain').click();
    cy.get('#name').clear();
    cy.get('#name').type(testDomain);
    cy.intercept(`${baseApiUrl}data-product/domain/${testDomain}`).as('TestDomain');
    cy.contains('.MuiButton-label', 'Submit').click();
    cy.contains('.MuiAlert-message', `Created domain "${testDomain}"`, { timeout: 20000 });
    cy.wait('@TestDomain', { timeout: 20000 }).its('response.statusCode').should('be.equal', 200);
  });

  it('create simple file upload data product', () => {
    cy.visit('/data-product');
    // load json file from fixture's alias
    cy.get('@data').then((dp: DataProductJson) => {
      uniqDataProductId = uniqueId(dp.dataProductId + new Date().getTime().toString(36));
      cy.intercept(`${baseApiUrl}data-product/domain/${testDomain}/data-product/${uniqDataProductId}`).as(
        'dataProductCreated',
      );
      cy.intercept(`${baseApiUrl}governance/policy/domain/${testDomain}/data-product/${uniqDataProductId}`).as(
        'governancePolicy',
      );
      // start create data product
      cy.contains('.MuiButton-label', 'Create data product').click();
      cy.get('body').click();
      cy.wait('@domains', { timeout: 20000 }).its('response.statusCode').should('be.equal', 200);
      cy.wait('@groups', { timeout: 20000 }).its('response.statusCode').should('be.equal', 200);
      cy.wait('@scripts', { timeout: 20000 }).its('response.statusCode').should('be.equal', 200);

      // fill in data product details
      cy.get('[id="domainId"]').click();
      cy.contains('.MuiButtonBase-root', testDomain).click();
      cy.get('body').click();
      cy.get('#name').clear();
      cy.get('#name').type(uniqDataProductId);
      cy.get('#description').clear();
      cy.get('#description').type('cypress testing data product');

      // choose source type : File upload, and upload a fixture
      cy.contains('.MuiTypography-root', 'File Upload').click();
      cy.contains('.MuiButton-label', 'Next').click();
      cy.get('input[type="file"]').attachFile('socialGeneratedData.csv');
      cy.contains('.MuiButton-label', 'Next').click();

      // preview schema may take up to 10 seconds
      cy.contains('.MuiButtonBase-root', 'Continue with current schema', { timeout: 300000 })
        .should('not.be.disabled')
        .click();
      cy.contains('.MuiButton-label', 'Submit', { timeout: 50000 }).click();

      // verify data product is building
      cy.contains('Building', { timeout: 50000 });
      cy.wait('@dataProductCreated', { timeout: 300000 }).its('response.statusCode').should('be.equal', 200);
      cy.wait('@governancePolicy', { timeout: 300000 }).its('response.statusCode').should('be.equal', 200);
    });
  });

  it('should query the data product and check governance', () => {
    cy.visit(`/data-product/${testDomain}`);
    cy.contains(uniqDataProductId, { timeout: 50000 }).click();
    cy.contains('Ready', { timeout: 600000 });
    cy.contains(uniqDataProductId, { timeout: 50000 }).click();
    cy.contains('.MuiButton-label', 'Query ').click();
    cy.contains('.MuiButton-label', 'Execute').click();
    // check that the field has been hashed
    cy.contains('.MuiTableCell-root', '100', { timeout: 50000 })
      .siblings()
      .contains(/^[a-f0-9]{12}/);
  });

  it('should delete a data product', () => {
    cy.visit(`/data-product/${testDomain}`);
    cy.intercept('DELETE', `${baseApiUrl}data-product/domain/${testDomain}/data-product/${uniqDataProductId}`).as(
      'dataProductDeleted',
    );
    cy.contains(uniqDataProductId, { timeout: 50000 }).click();
    cy.contains('Ready', { timeout: 50000 });
    cy.contains('.MuiButton-label', 'Actions').click();
    cy.contains('.MuiButtonBase-root', 'Delete').click();
    cy.get('[data-testid="modal"]').get('input').last().type('delete');
    cy.contains('.MuiButton-label', 'Delete').click();
    cy.wait('@dataProductDeleted', { timeout: 20000 }).its('response.statusCode').should('be.equal', 200);
  });

  it('should delete data domain', () => {
    cy.visit('/data-product');
    cy.contains('.MuiButton-label', 'Choose domain').click();
    cy.contains('.MuiButtonBase-root', testDomain).click();
    cy.contains('No records found', { timeout: 5000 });
    cy.contains('.MuiButton-label', 'Delete domain').click();
    cy.get('[data-testid="modal"]').get('input').last().type('delete');
    cy.get('[data-testid="modal"]').contains('.MuiButton-label', 'Delete').click({ force: true });
  });
});
