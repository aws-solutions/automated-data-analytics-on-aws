/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as path from 'path'
import * as execa from 'execa'

/**
 * List of permitted SPDX identifiers
 */
const PERMITTED_LICENSES = [
  'MIT',
  'MIT*',
  'Apache-2.0',
  'Unlicense',
  '(Unlicense OR Apache-2.0)',
  'BSD',
  'BSD*',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'Zlib',
  'WTFPL',
  '(MIT OR GPL-3.0-or-later)',
  'CC-BY-4.0',
  '(OFL-1.1 AND MIT)',
  '(MIT OR CC0-1.0)',
];

// verified with `yarn why xxx` and viewing license on associate url
const APPROVED_PKG_LIST: string[] = [
  'amazon-cognito-identity-js', // aws package
  'paho-mqtt', // From @aws-amplify
  '@sinonjs/text-encoding', // From @aws-amplify
  'tslib', // From @aws-amplify
  'json-schema', // Included in aws sdk - (AFL-2.1 OR BSD-3-Clause)
  'cli-color', // ISC License
  'difflib', // PSF - http://docs.python.org/license.html
  'dreamopt', // The MIT License (MIT)
  'es5-ext', // ISC License
  'heap', // The MIT License,
  "pako", // (MIT AND Zlib) from @aws-amplify
]

const UNKNOWN = 'Unknown'

type PkgLicense = [name: string, version: string, license: string, url: string, vendorUrl: string, vendorName: string]
interface YarnLicensesList {
  data: {
    head: [
      "Name",
      "Version",
      "License",
      "URL",
      "VendorUrl",
      "VendorName"
    ],
    body: PkgLicense[]
  }
}

async function checkLicenses () {
  const result: YarnLicensesList = JSON.parse((await execa.command(`yarn licenses --production --no-progress --silent --ignore-platform --ignore-engine --ignore-optional --json list`, {
    cwd: path.resolve(__dirname, '..')
  })).stdout)

  const unpermittedPkgs: PkgLicense[] = result.data.body.reduce((unpermitted, pkg) => {
    // ignore packages without url/vendorUrl/vendorName (build artifacts like workspace-aggregator-9df07b1e-e872-43bf-a1bb-6e362fd05511)
    if (pkg[3] === UNKNOWN && pkg[4] === UNKNOWN && pkg[5] === UNKNOWN) {
      return unpermitted
    }

    const pkgName = pkg[0]
    if (pkgName.startsWith('@ada/') || APPROVED_PKG_LIST.includes(pkgName)) {
      return unpermitted
    }
    const license = pkg[2]
    if (PERMITTED_LICENSES.includes(license) !== true) {
      return unpermitted.concat([pkg])
    }
    return unpermitted
  }, [] as PkgLicense[])

  return unpermittedPkgs
}

/**
 * Check the license of all dependencies, and throw an error if any non permitted licenses.
 */
const main = async () => {
  const unpermitted = await checkLicenses();

  if (unpermitted.length > 0) {
    console.error(JSON.stringify(unpermitted, null, 2))
    throw new Error('Found unpermitted thirdparty licenses')
  }
};

(async () => {
  await main();
})();
