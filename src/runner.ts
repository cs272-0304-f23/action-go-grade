import * as core from "@actions/core";

import Grader from './grader'
import Renderer from "./renderer";

import { exec } from '@actions/exec'
import { parseRubric } from './rubric'
import TimeKeeper, { createArtifact } from './deadline'

class Runner {
  grader?: Grader
  timeKeeper?: TimeKeeper

  private constructor() {}

  static async create(): Promise<Runner> {
    const runner = new Runner()

    // Parse rubric from owning repository
    const rubricUrl = core.getInput('rubricUrl')
    const rubric = await parseRubric(rubricUrl)

    // Parse module directory and test arguments from GitHub Actions environment
    const testArguments = core.getInput('testArguments')
    
    runner.grader = new Grader(rubric, testArguments)
    runner.timeKeeper = new TimeKeeper(rubric)

    return runner
  }

  /**
   * Builds the project and returns whether or not the build failed.
   */
  private async build(): Promise<boolean> {
    core.info('building project...')
    const opts = {
      cwd: '.',
      ignoreReturnCode: true,
    }

    const retcode = await exec(
      'go',
      ['build', './...'],
      opts
    )

    const buildError = retcode !== 0
    core.info(`build exited with code ${retcode}. ${buildError ? 'Build failed.' : 'Build succeeded.'}`)
    return buildError
  }

  /**
   * Runs the action. 
   */
  async run() {
    if(!this.grader || !this.timeKeeper) {
      throw new Error('Runner not initialized. Did you forget to call Runner.create()?')
    }

    // build the project
    const buildError = await this.build()

    // run go test
    const { retcode, stdout, stderr } = await this.grader.goTest()

    // grade the assignment (this will not fail the action; if `go test` fails, we just award 0 points)
    const { totalPointsAwarded, testResults, testsNotRan } = await this.grader.grade(stdout)

    // interpret the results of the time keeper. Will not fail the action.
    const gradeResults = this.timeKeeper.checkDeadline(totalPointsAwarded)

    // produce artifact
    createArtifact(gradeResults)

    // generate summary
    new Renderer(gradeResults, testResults, testsNotRan, stderr, buildError).writeSummary()

    // fail the action if the go test failed
    if(retcode !== 0) {
      core.setFailed(`go test failed with code ${retcode}. Some tests were unsuccessful.`)
    }
  }
}

export default Runner
