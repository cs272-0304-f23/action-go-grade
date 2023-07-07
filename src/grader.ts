import * as core from '@actions/core'

import { exec } from '@actions/exec'
import { type Rubric } from './rubric'
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
  async grade(stdout: string): Promise<{
    totalPointsAwarded: number
    testResults: TestResult[]
    testsNotRan: string[]
  }> {
    core.info('grading repository...')

    // parse test events from stdout
    const testEvents = parseTestEvents(stdout)

    // assign points based on rubric
    return this.assignPoints(testEvents)
  }

  /**
   * Execs `go test` with specified arguments, capturing the output
   * @returns return code, stdout, stderr of `go test`
   */ 
  async goTest(): Promise<{
    retcode: number,
    stdout: string,
    stderr: string
  }> {
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
    testsNotRan: string[]
  }> {
    // keep track of tests that were not run
    let testsNotRan = new Set(Object.keys(this.rubric.tests))

    let totalPointsAwarded = 0
    let testResults: TestResult[] = []
    for(let event of testEvents) {
      // make test result object
      let tr: TestResult = {
        ...event,
        pointsAwarded: 0,
        pointsPossible: 0,
      }
      // and push it to the list
      testResults.push(tr)

      // skip non-conclusive tests (they don't count for points. eg. output)
      if(!event.isConclusive) {
        continue
      }

      // if the test is in the rubric, assign points and mark as ran
      if(testsNotRan.has(event.test)) {
        tr.pointsPossible = this.rubric.tests[event.test]
        testsNotRan.delete(event.test)
      }

      if(event.action === 'pass') {
        tr.pointsAwarded = tr.pointsPossible
        totalPointsAwarded += tr.pointsAwarded
      }

      core.info(`test=${event.test} action=${event.action} points=${tr.pointsAwarded}/${tr.pointsPossible}`)
    }

    core.info(`tests not ran: ${[...testsNotRan].join(', ') || 'none'}`)

    return {
      totalPointsAwarded,
      testResults,
      testsNotRan: Array.from(testsNotRan),
    }
  }
}

export default Grader
