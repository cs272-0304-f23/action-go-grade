import * as core from '@actions/core'

import { exec } from '@actions/exec'
import { Rubric } from './rubric'
import { TestEvent, parseTestEvents } from './events'

export interface TestResult extends TestEvent {
  pointsAwarded: number
  pointsPossible: number
}

class Grader {
  testArguments = ['./...']
  rubric: Rubric

  constructor(rubric: Rubric, testArguments?: string) {
    this.rubric = rubric
    if (testArguments) {
      this.testArguments = testArguments.split(/\s/).filter(arg => arg.length)
    }
  }

  /**
   * Grades the owning repository based on the results of a `go test` run
   * interprets the points awarded based on the provided test rubric.
   */
  async grade(): Promise<{
    totalPointsAwarded: number
    testResults: TestResult[]
  }> {
    core.info('grading repository...')
    // run go test
    const { retcode, stdout, stderr } = await this.goTest()
    if(retcode !== 0) {
      core.debug('go test failed')
      core.debug(stdout)
      core.debug(stderr)
      return {
        totalPointsAwarded: 0,
        testResults: [],
      }
    }

    // parse test events from stdout
    const testEvents = parseTestEvents(stdout)

    // assign points based on rubric
    return this.assignPoints(testEvents)
  }

  /**
   * Execs `go test` with specified arguments, capturing the output
   * @returns return code, stdout, stderr of `go test`
   */ 
  private async goTest(): Promise<{retcode: number, stdout: string, stderr: string}> {
    let stdout = ''
    let stderr = ''

    const opts = {
      cwd: '.',
      ignoreReturnCode: true,
      listeners: {
        stdout: (data: Buffer) => {
          stdout += data.toString()
        },
        stderr: (data: Buffer) => {
          stderr += data.toString()
        },
      },
    }

    const retcode = await exec(
      'go',
      ['test', '-json', ...this.testArguments],
      opts
    )

    return {
      retcode,
      stdout,
      stderr,
    }
  }

  private async assignPoints(testEvents: TestEvent[]): Promise<{
    totalPointsAwarded: number
    testResults: TestResult[]
  }> {
    let totalPointsAwarded = 0
    let testResults: TestResult[] = []
    for(let event of testEvents) {
      // skip non-conclusive tests and tests not in rubric
      if(!event.isConclusive || !this.rubric.tests[event.test]) {
        continue
      }

      // make test result object
      let tr: TestResult = {
        ...event,
        pointsAwarded: 0,
        pointsPossible: this.rubric.tests[event.test],
      }
      
      if(event.action === 'pass') {
        tr.pointsAwarded = tr.pointsPossible
        totalPointsAwarded += tr.pointsAwarded
      }
      testResults.push(tr)

      core.info(`test: ${event.test} action: ${event.action} points: ${tr.pointsAwarded}/${tr.pointsPossible}`)
    }

    return {
      totalPointsAwarded,
      testResults,
    }
  }
}

export default Grader
