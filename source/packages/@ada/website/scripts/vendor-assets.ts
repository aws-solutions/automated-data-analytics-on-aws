/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as StreamZip from 'node-stream-zip';
import * as fs from 'fs-extra';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import { URL } from 'url';

export const TMPDIR_PREFIX = 'asset-uploader';
export const SRC_VENDOR_DIR = path.resolve(__dirname, '..', 'src', 'vendor');
export const GOOGLE_VENDOR_DIR = path.join(SRC_VENDOR_DIR, 'google');

export const GCP_ICON_ZIP = 'https://cloud.google.com/icons/files/google-cloud-icons.zip';
export const GA_ICON_URL = 'https://www.gstatic.com/analytics-suite/header/suite/v2/ic_analytics.svg';

export const GCP_ICONS_TO_EXTRACT = [
  'cloud_storage/cloud_storage.png',
  'cloud_storage/cloud_storage.svg',
  'bigquery/bigquery.png',
  'bigquery/bigquery.svg',
];

async function tmpdir(name: string): Promise<string> {
  const dir = path.join(os.tmpdir(), TMPDIR_PREFIX, name);
  await fs.ensureDir(dir);
  return dir;
}

async function downloadFile(urlToDownload: string, destination: string): Promise<string> {
  const filename = path.basename(new URL(urlToDownload).pathname);
  const saveTo = path.extname(destination).startsWith('.') ? destination : path.join(destination, filename);

  return new Promise<string>((resolve, reject) => {
    https
      .get(urlToDownload, (res) => {
        const writeStream = fs.createWriteStream(saveTo);

        res.pipe(writeStream);

        writeStream.on('finish', () => {
          writeStream.close();
          resolve(saveTo);
        });
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}

export async function downloadGCPIconZip(): Promise<StreamZip.StreamZipAsync> {
  const tmpDir = await tmpdir('gcp-icons');
  const file = await downloadFile(GCP_ICON_ZIP, tmpDir);
  console.debug('downloadGCPIconZip:', tmpDir, file.length);

  return new StreamZip.async({ file });
}

export async function extractGCPIcons(): Promise<void> {
  console.debug('extractGCPIcons: start');
  const zip = await downloadGCPIconZip();

  try {
    await Promise.all(
      GCP_ICONS_TO_EXTRACT.map(async (entryPath) => {
        const outputPath = path.join(GOOGLE_VENDOR_DIR, path.basename(entryPath));
        await fs.ensureDir(path.dirname(outputPath));
        return zip.extract(entryPath, outputPath);
      }),
    );
  } finally {
    await zip.close();
  }

  console.debug('extractGCPIcons: complete');
}

export async function downloadGAIcon(): Promise<void> {
  const outputPath = path.join(GOOGLE_VENDOR_DIR, 'ga.svg');
  await fs.ensureDir(path.dirname(outputPath));
  await downloadFile(GA_ICON_URL, outputPath);
}

export async function main() {
  await Promise.all([extractGCPIcons(), downloadGAIcon()]);
}

(async () => {
  await main();
})();
