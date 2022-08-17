/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
const argv = require('minimist')(process.argv.slice(2));
const { execSync } = require('child_process');

const internalPrefix = 'adt';
const errorCodes = {
  INFO: 1,
  LOW: 2,
  MODERATE: 4,
  HIGH: 8,
  CRITICAL: 16,
};

let status = 0;
try {
  const args = Object.keys(argv).filter((k) => !k.startsWith(internalPrefix) && k !== '_');
  const forwardArgs = args.map((q) => `--${q} ${argv[q]}`).join(' ');
  const response = execSync(`yarn audit ${forwardArgs}`);

  console.log(response.toString());
} catch (err) {
  status = err.status;
  console.log(err.stdout.toString());
  console.log(err.stderr.toString());
}

if (argv['adt-suppress-level-exit-code']) {
  if (status < errorCodes[argv.level.toUpperCase()]) {
    console.info(`suppressing error for level ${argv.level}, exit with code 0`);
    process.exit(0);
  }
}

console.info(`Exiting with the status return by yarn audit, ${status}`);
process.exit(status);
