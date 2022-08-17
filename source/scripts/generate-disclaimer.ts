/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as path from 'path'
import * as execa from 'execa'
import * as fs from 'fs-extra'

const SOURCE_DIR = path.resolve(__dirname, '..')
const ROOT_DIR = path.resolve(SOURCE_DIR, '..')

const THIRDPARTY_LICENSES = path.join(ROOT_DIR, 'THIRDPARTY_LICENSES.txt')

async function generateDisclaimer () {
  let disclaimer = (await execa.command('yarn licenses --prod --silent --no-progress generate-disclaimer', { cwd: SOURCE_DIR })).stdout

  disclaimer = disclaimer.replace(/THE WORKSPACE AGGREGATOR [\w ]+ PRODUCT/i, 'THIS PRODUCT')

  await fs.writeFile(THIRDPARTY_LICENSES, disclaimer)
}

(async () => {
  await generateDisclaimer();
  process.exit()
})();
