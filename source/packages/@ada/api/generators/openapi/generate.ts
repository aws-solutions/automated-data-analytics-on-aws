/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import generateClients from './generate-clients';
import generateDocs from './generate-docs';
import generateSpec from './generate-spec';

async function main() {
  // spec generator MUST be called first
  await generateSpec();

  await generateClients();
  await generateDocs();
}

main()
  .then(() => console.log('generate open api'))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
