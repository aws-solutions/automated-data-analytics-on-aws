/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { FileSystem } from 'aws-cdk-lib';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as execa from 'execa';

const INFRA_DIR = path.resolve(__dirname, '../');
const OUT_FOLDER = path.resolve(INFRA_DIR, 'built-docker-images');

const exec = (command: string) => execa.command(command, { stdio: 'inherit', encoding: 'utf-8' });

/**
 * Builds a docker image for use as a tarball image asset
 */
(async () => {
  const name = process.argv[2];
  const dockerImagePath = path.join(INFRA_DIR, process.argv[3]);

  // run `yarn build` before checking fingerprint if exists
  if (await fs.pathExists(path.join(dockerImagePath, 'package.json'))) {
    console.debug('docker image folder contains package.json - running "yarn install --frozen-lock && yarn build"')
    await execa.command('yarn install --frozen-lock', { cwd: dockerImagePath, stdio: 'inherit' })
    await execa.command('yarn build', { cwd: dockerImagePath, stdio: 'inherit' })
  }

  const outputPath = path.join(OUT_FOLDER, `${name}.tar`);
  const fingerprintPath = path.join(OUT_FOLDER, `${name}.fingerprint`);

  // Hash the docker image path and determine whether we need to re-build the image
  const fingerprint = FileSystem.fingerprint(dockerImagePath);
  if (fs.existsSync(outputPath) && fs.existsSync(fingerprintPath) && fs.readFileSync(fingerprintPath, { encoding: 'utf-8', flag: 'r' }) === fingerprint) {
    console.log(`Already built latest docker image ${name}`);
    return;
  }

  // Build the docker image into a tarball
  await exec(`docker build -t ada:${name} ${dockerImagePath} --platform=linux/amd64`);
  await exec(`docker save ada:${name} -o ${outputPath}`);

  // Write back the fingerprint
  fs.writeFileSync(fingerprintPath, fingerprint, { encoding: 'utf-8', flag: 'w' });
})();
