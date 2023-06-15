import { exec } from '@actions/exec'

type TestResults = {
  retcode: number
  stdout: string
  stderr: string
}

type Rubric = {
  cases: Map<string, number>
  pointsPossible: number
}

class Grader {
  moduleDirectory = '.'
  testArguments = ['./...']

  constructor(moduleDirectory?: string, testArguments?: string) {
    if (moduleDirectory) {
      this.moduleDirectory = moduleDirectory
    }
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
  }> {
    let { pointsPossible } = this.parseRubric()
    let { retcode, stdout, stderr } = await this.goTest()

    return {
      pointsAwarded: 0,
      pointsPossible,
    }
  }

  /**
   * Execs `go test` with specified arguments, capturing the output
   * @returns return code, stdout, stderr of `go test`
   */ 
  private async goTest(): Promise<TestResults> {
    let stdout = ''
    let stderr = ''

    const opts = {
      cwd: this.moduleDirectory,
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

  private parseRubric(): Rubric {
    return {
      cases: new Map(),
      pointsPossible: 100,
    }
  }
}

export default Grader
