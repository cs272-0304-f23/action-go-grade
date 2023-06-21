import { exec } from '@actions/exec'
import { Rubric } from './rubric'
import { TestEvent, parseTestEvents } from './events'

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
    pointsAwarded: number,
    pointsPossible: number,
    retcode: number,
    stderr: string,
  }> {
    // run go test
    const { retcode, stdout, stderr } = await this.goTest()

    // parse test events from stdout
    const testEvents = parseTestEvents(stdout)

    // assign points based on rubric
    const { pointsAwarded, pointsPossible } = await this.assignPoints(testEvents)

    return {
      pointsAwarded,
      pointsPossible,
      retcode,
      stderr,
    }
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
    pointsPossible: number,
    pointsAwarded: number
  }> {
    let pointsAwarded = 0
    for(let event of testEvents) {
      // skip non-conclusive tests
      if(!event.isConclusive) {
        continue
      }
      
      if(event.action === 'pass') {
        pointsAwarded += this.rubric.tests[event.test] || 0 // if this test is not in the rubric, it is worth 0 points
      }
    }

    return {
      pointsAwarded,
      pointsPossible: this.rubric.pointsPossible,
    }
  }
}

export default Grader
