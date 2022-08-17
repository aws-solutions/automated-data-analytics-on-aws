/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { BUILD_DIR, OPENAPI_SPEC_FILE, OPENAPI_SPEC_JSON_FILE, PACKAGE_ROOT } from './constants';
import { serializeArgs } from './utils';
import execa from 'execa';

export async function main(): Promise<void> {
  const jsonSpecFile = await generateCdkSpec();

  await generateYamlSpec(jsonSpecFile);
}

export default main;

if (process.argv[1] === __filename) {
  main()
    .then(() => console.log('generate openapi-spec complete'))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

async function mkdtemp(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ada-openapi-spec-'));
}

async function generateCdkSpec(): Promise<string> {
  const dir = path.join(BUILD_DIR);
  await fs.ensureDir(dir);
  const outputFile = OPENAPI_SPEC_JSON_FILE;
  console.log('generate openapi spec from cdk:', outputFile);
  await execa.command(`yarn generate:openapi:spec ${outputFile}`, {
    cwd: path.join(__dirname, '../../../infra'),
    stdio: 'inherit',
  });

  return outputFile;
}

async function generateYamlSpec(jsonSpecFile: string) {
  console.info(`generating openapi-yaml spec`);
  const dir = await mkdtemp();

  const args = serializeArgs({
    // global: {
    // },
    additional: {
      disallowAdditionalPropertiesIfNotPresent: true,
    },
  });

  // https://openapi-generator.tech/docs/usage#generate
  /* eslint-disable */
  await execa(
    'openapi-generator-cli',
    [
      'generate',
      // '--verbose',
      '--log-to-stderr', // without this error messages are cryptic and not actionable
      '--generator-name',
      'openapi-yaml',
      // '--skip-validate-spec',
      '--skip-operation-example',
      ...args,
      '--input-spec',
      jsonSpecFile,
      '--output',
      dir,
    ],
    {
      cwd: PACKAGE_ROOT,
      stdio: 'inherit',
    },
  );
  console.info(`generated openapi-yaml spec:`, dir);
  /* eslint-enable */

  // copy the yaml spec to committed location so we can track changes to the schema in CR
  const specOutputFile = path.join(dir, 'openapi', 'openapi.yaml');
  // if (await fs.pathExists(OPENAPI_SPEC_YAML_FILE)) {
  //   // make the spec file writable
  //   await execa.command(`chmod 666 ${OPENAPI_SPEC_YAML_FILE}`);
  // }
  // make the spec file readonly
  await fs.copy(specOutputFile, OPENAPI_SPEC_FILE, { overwrite: true });
  await fs.chmod(OPENAPI_SPEC_FILE, fs.constants.S_IRUSR);
}
