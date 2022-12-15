/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'cypress-file-upload';
import 'cypress-localstorage-commands';
import Auth from '@aws-amplify/auth';

const username = Cypress.env('username');
const password = Cypress.env('password');
const userPoolId = Cypress.env('userPoolId');
const clientId = Cypress.env('userPoolClientId');

const awsconfig = {
  aws_user_pools_id: userPoolId,
  aws_user_pools_web_client_id: clientId,
};

Auth.configure(awsconfig);

Cypress.Commands.add('signIn', () => {
  cy.then(() => Auth.signIn(username, password)).then((cognitoUser) => {
    const idToken = cognitoUser.signInUserSession.idToken.jwtToken;
    const accessToken = cognitoUser.signInUserSession.accessToken.jwtToken;

    const makeKey = (name) =>
      `CognitoIdentityServiceProvider.${cognitoUser.pool.clientId}.${cognitoUser.username}.${name}`;

    cy.setLocalStorage(makeKey('accessToken'), accessToken);
    cy.setLocalStorage(makeKey('idToken'), idToken);
    cy.setLocalStorage(
      `CognitoIdentityServiceProvider.${cognitoUser.pool.clientId}.LastAuthUser`,
      cognitoUser.username,
    );
  });
  cy.saveLocalStorage();
});

Cypress.Commands.add('createDataDomain', (domainName, apiUrl) => {
  cy.visit('/data-product');
  cy.contains('.MuiButton-label', 'Create domain').click();
  cy.get('#name').clear();
  cy.get('#name').type(domainName);
  cy.intercept(`${apiUrl}data-product/domain/${domainName}`).as('TestDomain');
  cy.contains('.MuiButton-label', 'Submit').click();
  cy.contains('.MuiAlert-message', `Created domain "${domainName}"`, { timeout: 20000 });
  cy.wait('@TestDomain', { timeout: 20000 }).its('response.statusCode').should('be.equal', 200);
});

Cypress.Commands.add('queryAndGovernance', (domainName, uniqDataProductId, value, checkHash=true) => {
  cy.visit(`/data-product/${domainName}`);
  cy.contains(uniqDataProductId, { timeout: 50000 }).click();
  cy.contains('Ready', { timeout: 6000000 });
  cy.contains(uniqDataProductId, { timeout: 50000 }).click();
  cy.contains('.MuiButton-label', 'Query ').click();
  cy.contains('.MuiButton-label', 'Execute').click();
  // check that the field has been hashed
  if (checkHash) {
    cy.contains('.MuiTableCell-root', value, { timeout: 50000 })
    .siblings()
    .contains(/^[a-f0-9]{12}/);
  } else {
    cy.contains('.MuiTableCell-root', value, { timeout: 50000 })
  }
});

Cypress.Commands.add('deleteDataProduct', (domainName, apiUrl, uniqDataProductId) => {
  cy.visit(`/data-product/${domainName}`);
  cy.intercept('DELETE', `${apiUrl}data-product/domain/${domainName}/data-product/${uniqDataProductId}`).as(
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

Cypress.Commands.add('deleteDataDomain', (domainName) => {
  cy.visit('/data-product');
  cy.contains('.MuiButton-label', 'Choose domain').click();
  cy.contains('.MuiButtonBase-root', domainName).click();
  cy.contains('No records found', { timeout: 50000 });
  cy.contains('.MuiButton-label', 'Delete domain').click();
  cy.get('[data-testid="modal"]').get('input').last().type('delete');
  cy.get('[data-testid="modal"]').contains('.MuiButton-label', 'Delete').click({ force: true });
});
