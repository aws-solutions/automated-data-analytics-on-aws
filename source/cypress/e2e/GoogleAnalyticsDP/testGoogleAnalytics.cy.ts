/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'cypress-localstorage-commands';
import { uniqueId } from 'lodash';

export interface DataProductJson extends JQuery<HTMLElement> {
  domainId: string;
  dataProductId: string;
  sourceDetails: string;
}

describe('complete e2e creation of a domain, google analytics product, query with governance checking, delete data product and domain ', () => {
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
    cy.restoreLocalStorage();
  });

  afterEach(() => {
    cy.saveLocalStorage();
  });

  it('create a data domain', () => {
    cy.createDataDomain(testDomain, baseApiUrl);
  });

  it('create a google analytics data product', () => {
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
      cy.contains('.MuiTypography-root', 'Google Analytics').click();
      cy.contains('.MuiButton-label', 'Next').click();

      cy.get('input[name="sourceDetails.viewId"]').type('173381731');
      cy.get('input[name="sourceDetails.dimensions"]').type('ga:year{enter}');
      cy.get('input[name="sourceDetails.dimensions"]').type('ga:month{enter}');
      cy.get('input[name="sourceDetails.dimensions"]').type('ga:day{enter}');
      cy.get('input[name="sourceDetails.metrics"]').type('ga:visitors{enter}');
      cy.get('input[name="sourceDetails.metrics"]').type('ga:newVisits{enter}');

      cy.contains('.MuiTypography-root', 'From JSON file').click();
      cy.get('input[type="file"]').attachFile('ga-credentials.json');
      cy.wait(2000);

      cy.contains('.MuiTypography-root', 'Schedule').click();
      cy.get('[aria-labelledby="updateTrigger.scheduleRate"]').click();
      cy.wait(2000);
      cy.contains('.MuiButtonBase-root', 'Daily').click();
      cy.contains('.MuiTypography-root', 'Replace').click();
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
    cy.queryAndGovernance(testDomain, uniqDataProductId, new Date().getUTCFullYear(), false);
  });

  it('should delete a data product', () => {
    cy.deleteDataProduct(testDomain, baseApiUrl, uniqDataProductId);
  });

  it('should delete data domain', () => {
    cy.deleteDataDomain(testDomain);
  });
});
