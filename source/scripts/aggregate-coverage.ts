/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as path from 'path'
import * as execa from 'execa'
import * as fs from 'fs-extra'
import * as find from 'find'

const SOURCE_DIR = path.resolve(__dirname, '..')
const ROOT_DIR = path.resolve(SOURCE_DIR, '..')

const NYCOUTPUT_DIR = path.join(ROOT_DIR, '.nyc_output')
const JACOCOOUTPUT_DIR = path.join(ROOT_DIR, '.jacoco')

type YarnWorkspaces = Record<string, {
  location: string
}>

async function aggregateCoverage () {
  await fs.ensureDir(NYCOUTPUT_DIR)
  await fs.emptyDir(NYCOUTPUT_DIR)

  await fs.ensureDir(JACOCOOUTPUT_DIR)
  await fs.emptyDir(JACOCOOUTPUT_DIR)

  const workspaces: YarnWorkspaces = JSON.parse((await execa.command('yarn workspaces info', { cwd: SOURCE_DIR })).stdout)

  await Promise.all(Object.entries(workspaces).map(([name, workspace]) => {
    return (async () => {
      const packageDir = path.join(SOURCE_DIR, workspace.location)

      const jsCoverageFiles = await new Promise<string[]>((resolve, reject) => {
        try {
          find.file(/\/coverage-final\.json$/, packageDir, (files) => {
            resolve(files.filter((_file) => !_file.includes('node_modules')))
          })
        } catch (error: any) {
          reject(error)
        }
      })
      await Promise.all(jsCoverageFiles.map((_file, _index, _array) => {
        const output = path.join(NYCOUTPUT_DIR, `${name.split('/')[1]}${_array.length > 1 ? '-' + _index : ''}.json`)
        console.info(`Copy ${name} js coverage file:`, _file)
        return fs.copy(_file, output, )
      }))

      const javaCoverageFile = path.join(packageDir, 'target/site/jacoco/jacoco.xml')
      if (await fs.pathExists(javaCoverageFile)) {
        await fs.copy(javaCoverageFile, path.join(JACOCOOUTPUT_DIR, `${name.split('/')[1]}.xml`), )
      }
    })()
  }))

  const nyc = (await execa.command('yarn bin nyc', { cwd: SOURCE_DIR })).stdout

  await execa.command(`${nyc} report --reporter lcov`, { cwd: ROOT_DIR })
}

(async () => {
  await aggregateCoverage();
  process.exit()
})();
