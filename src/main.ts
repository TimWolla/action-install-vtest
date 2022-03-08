/* The MIT License (MIT)
 *
 * Copyright (c) 2020 Tim Düsterhus
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import * as cache from '@actions/cache'
import * as core from '@actions/core'
import * as path from 'path'
import * as tc from '@actions/tool-cache'
import {Octokit} from '@octokit/action'
import {exec} from '@actions/exec'

async function run(): Promise<void> {
  try {
    const branch = core.getInput('branch', {
      required: true
    })

    let commit: string

    if (!/^[0-9a-f]{40}$/.test(branch)) {
      const client = new Octokit()

      const {data} = await client.request(
        'GET /repos/{owner}/{repo}/branches/{branch}',
        {
          owner: 'vtest',
          repo: 'vtest',
          branch
        }
      )

      commit = data.commit.sha
    } else {
      commit = branch
    }

    const restored = await cache.restoreCache(['VTest'], `vtest-${commit}`)

    if (restored === undefined) {
      const vtest_tar_gz = await tc.downloadTool(
        `https://github.com/vtest/VTest/archive/${commit}.tar.gz`
      )
      const vtest_path = await tc.extractTar(vtest_tar_gz, 'VTest', [
        'xv',
        '--strip-components=1'
      ])
      await exec('make', ['-C', vtest_path, 'FLAGS=-O2 -s -Wall'])

      try {
        await cache.saveCache(['VTest'], `vtest-${commit}`)
      } catch (error) {
        if (error instanceof Error) {
          core.error(`Failed to save the cache: ${error.message}`)
        } else {
          throw error
        }
      }
    }

    core.addPath('VTest')
    core.setOutput('commit', commit)

    const matchersPath = path.join(__dirname, '../..', '.github')
    core.info(`##[add-matcher]${path.join(matchersPath, 'vtest.json')}`)
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed('Caught non-Error object.')
    }
  }
}

run()
