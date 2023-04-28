/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'cypress-localstorage-commands';
import { uniqueId } from 'lodash';

export interface DataProductJson extends JQuery<HTMLElement> {
  domainId: string;
  dataProductId: string;
  sourceDetails: string;
}

function create_date() {
  // offset 5 days
  const dateOffset = 24 * 60 * 60 * 1000 * 5;
  const date = new Date();
  date.setTime(date.getTime() - dateOffset);

  const year = date.toLocaleString('default', { year: 'numeric' });
  const month = date.toLocaleString('default', { month: '2-digit' });
  const day = date.toLocaleString('default', { day: '2-digit' });

  return `${year}/${month}/${day}`;
}

describe('complete e2e creation of a domain, cloudtrail data product, query with governance checking, delete data product and domain ', () => {
  const baseApiUrl = Cypress.env('baseApiUrl');
  const testDomain = uniqueId('test_' + new Date().getTime().toString(36));
  const awsregion = Cypress.env('awsregion');
  let uniqDataProductId: string | number | RegExp;

  const cloudtrailName = uniqueId('cypress-cloudtrail-dp-trail_' + new Date().getTime().toString(36));
  const bucketName = uniqueId('cypress-cloudtrail-dp-bucket-' + new Date().getTime().toString(36));
  let trailArn = '';

  before(() => {
    cy.signIn();
    cy.exec(
      `python cypress/scripts/aws_helper.py cloudtrail_create --trailname ${cloudtrailName} --bucketname ${bucketName} --region ${awsregion}`,
    ).then((result) => {
      cy.log(result.stdout);
      trailArn = result.stdout;
    });
  });

  after(() => {
    cy.clearLocalStorageSnapshot();
    cy.clearLocalStorage();

    cy.exec(
      `python cypress/scripts/aws_helper.py cloudtrail_delete --trailname ${cloudtrailName} --bucketname ${bucketName}`,
    ).then((result) => {
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

  it('create cloudtrail data product', () => {
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

      cy.contains('.MuiTypography-root', 'Amazon CloudTrail').click();
      cy.contains('.MuiButton-label', 'Next').click();

      cy.get('input[name="sourceDetails.cloudTrailTrailArn"]').type(trailArn);
      cy.get('input[name="sourceDetails.cloudTrailEventTypes"]').check('Management');
      cy.get('input[name="sourceDetails.cloudTrailDateFrom"]').type(create_date());
      cy.get('input[name="sourceDetails.crossAccountRoleArn"]').clear();
      cy.get('input[name="updateTrigger.triggerType"]').check('ON_DEMAND');

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
    cy.queryAndGovernance(testDomain, uniqDataProductId, 'Management');
  });

  it('should delete a data product', () => {
    cy.deleteDataProduct(testDomain, baseApiUrl, uniqDataProductId);
  });

  it('should delete data domain', () => {
    cy.deleteDataDomain(testDomain);
  });
});
