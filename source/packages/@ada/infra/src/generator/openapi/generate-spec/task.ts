/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as path from 'path';
import { VError } from 'verror';
import execa from 'execa';

// directly outputing YAML is ideal as clearner for commits/reviews, but the output with `yaml` module creates alias
// and other artifacts that prevent from reading in openapi generator. So just use JSON for now.
const [, , outputFile = process.env.OPENAPI_SPEC_FILE] = process.argv;
if (outputFile == null || !path.isAbsolute(outputFile) || path.extname(outputFile) !== '.json') {
  console.error(
    'openapi:generate-spec: requires output file as argument: must be absolute path with .json extension:',
    outputFile,
  );
  throw new VError({ name: 'InvalidOutputFileError' }, 'Invalid output file passed to generate spec');
}

execa('yarn', ['jest', '--useStderr', '--no-cache', '--coverage', '--projects', require.resolve('./jest.config.generate-spec')], {
  env: {
    OPENAPI_SPEC_FILE: outputFile,
    GENERATING_OPENAPI_SPEC: 'true',
    DISABLE_CDK_BUNDLING: 'true',
  },
  stdio: 'inherit',
})
  .then(() => 'generated spec successfully')
  .catch((error) => {
    console.error('Failed to generate spec');
    console.error(error);
    process.exit(1);
  });
