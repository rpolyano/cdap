/*
 * Copyright © 2019 Cask Data, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
*/

import { ConnectionType } from '../../app/cdap/components/DataPrepConnections/ConnectionType';
import { DEFAULT_GCP_PROJECTID, DEFAULT_GCP_SERVICEACCOUNT_PATH } from '../support/constants';
/**
 * Uploads a pipeline json from fixtures to input file element.
 *
 * @fileName - Name of the file from fixture folder including extension
 * @selector - css selector to query for the input[type="file"] element.
 */
Cypress.Commands.add('upload_pipeline', (fileName, selector) => {
  return cy.get(selector).then((subject) => {
    return cy.fixture(fileName).then((pipeline1) => {
      const el = subject[0];
      const blob = new Blob([JSON.stringify(pipeline1, null, 2)], { type: 'application/json' });
      return cy.window().then((win) => {
        const testFile = new win.File([blob], fileName, {
          type: 'application/json',
        });
        const dataTransfer = new win.DataTransfer();
        dataTransfer.items.add(testFile);
        el.files = dataTransfer.files;
        return cy.wrap(subject).trigger('change', { force: true });
      });
    });
  });
});

Cypress.Commands.add('cleanup_pipelines', (headers, pipelineName) => {
  return cy
    .request({
      method: 'GET',
      url: `http://${Cypress.env('host')}:11015/v3/namespaces/default/apps/${pipelineName}`,
      failOnStatusCode: false,
      headers,
    })
    .then((response) => {
      if (response.status === 200) {
        return cy.request({
          method: 'DELETE',
          url: `http://${Cypress.env('host')}:11015/v3/namespaces/default/apps/${pipelineName}`,
          failOnStatusCode: false,
          headers,
        });
      }
    });
});

Cypress.Commands.add(
  'fill_GCS_connection_create_form',
  (
    connectionId,
    projectId = DEFAULT_GCP_PROJECTID,
    serviceAccountPath = DEFAULT_GCP_SERVICEACCOUNT_PATH
  ) => {
    cy.visit('/cdap/ns/default/connections');
    cy.get('[data-cy="wrangler-add-connection-button"]').click();
    cy.get(`[data-cy="wrangler-connection-${ConnectionType.GCS}`).click();
    cy.get(`[data-cy="wrangler-${ConnectionType.GCS}-connection-name"]`).type(connectionId);
    cy.get(`[data-cy="wrangler-${ConnectionType.GCS}-connection-projectid"]`).type(projectId);
    cy.get(`[data-cy="wrangler-${ConnectionType.GCS}-connection-serviceaccount-filepath"]`).type(
      serviceAccountPath
    );
  }
);

Cypress.Commands.add('create_GCS_connection', (connectionId) => {
  cy.fill_GCS_connection_create_form(connectionId);
  cy.get(`[data-cy="wrangler-${ConnectionType.GCS}-add-connection-button"]`).click({
    timeout: 60000,
  });
});

Cypress.Commands.add('test_GCS_connection', (connectionId, projectId, serviceAccountPath) => {
  cy.fill_GCS_connection_create_form(connectionId, projectId, serviceAccountPath);
  cy.get(`[data-cy="wrangler-${ConnectionType.GCS}-test-connection-button"]`).click({
    timeout: 60000,
  });
});

Cypress.Commands.add(
  'fill_BIGQUERY_connection_create_form',
  (
    connectionId,
    projectId = DEFAULT_GCP_PROJECTID,
    serviceAccountPath = DEFAULT_GCP_SERVICEACCOUNT_PATH
  ) => {
    cy.visit('/cdap/ns/default/connections');
    cy.get('[data-cy="wrangler-add-connection-button"]').click();
    cy.get(`[data-cy="wrangler-connection-${ConnectionType.BIGQUERY}`).click();
    cy.get(`[data-cy="wrangler-${ConnectionType.BIGQUERY}-connection-name"]`).type(connectionId);
    cy.get(`[data-cy="wrangler-${ConnectionType.BIGQUERY}-connection-projectid"]`).type(projectId);
    cy.get(
      `[data-cy="wrangler-${ConnectionType.BIGQUERY}-connection-serviceaccount-filepath"]`
    ).type(serviceAccountPath);
  }
);

Cypress.Commands.add('create_BIGQUERY_connection', (connectionId) => {
  cy.fill_BIGQUERY_connection_create_form(connectionId);
  cy.get(`[data-cy="wrangler-${ConnectionType.BIGQUERY}-add-connection-button"]`).click({
    timeout: 60000,
  });
});

Cypress.Commands.add('test_BIGQUERY_connection', (connectionId, projectId, serviceAccountPath) => {
  cy.fill_BIGQUERY_connection_create_form(connectionId, projectId, serviceAccountPath);
  cy.get(`[data-cy="wrangler-${ConnectionType.BIGQUERY}-test-connection-button"]`).click({
    timeout: 60000,
  });
});

Cypress.Commands.add(
  'fill_SPANNER_connection_create_form',
  (
    connectionId,
    projectId = DEFAULT_GCP_PROJECTID,
    serviceAccountPath = DEFAULT_GCP_SERVICEACCOUNT_PATH
  ) => {
    cy.visit('/cdap/ns/default/connections');
    cy.get('[data-cy="wrangler-add-connection-button"]').click();
    cy.get(`[data-cy="wrangler-connection-${ConnectionType.SPANNER}`).click();
    cy.get(`[data-cy="wrangler-${ConnectionType.SPANNER}-connection-name"]`).type(connectionId);
    cy.get(`[data-cy="wrangler-${ConnectionType.SPANNER}-connection-projectid"]`).type(projectId);
    cy.get(
      `[data-cy="wrangler-${ConnectionType.SPANNER}-connection-serviceaccount-filepath"]`
    ).type(serviceAccountPath);
  }
);

Cypress.Commands.add('create_SPANNER_connection', (connectionId) => {
  cy.fill_SPANNER_connection_create_form(connectionId);
  cy.get(`[data-cy="wrangler-${ConnectionType.SPANNER}-add-connection-button"]`).click({
    timeout: 60000,
  });
});

Cypress.Commands.add('test_SPANNER_connection', (connectionId, projectId, serviceAccountPath) => {
  cy.fill_SPANNER_connection_create_form(connectionId, projectId, serviceAccountPath);
  cy.get(`[data-cy="wrangler-${ConnectionType.SPANNER}-test-connection-button"]`).click({
    timeout: 60000,
  });
});
