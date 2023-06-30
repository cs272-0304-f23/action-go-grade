import * as core from "@actions/core";

import Grader from './grader'
import Renderer from "./renderer";

import { parseRubric } from './rubric'
import TimeKeeper, { createArtifact } from './deadline'

class Runner {
  grader: Grader
  timeKeeper: TimeKeeper

  constructor() {
    // Parse rubric from owning repository
    const rubric = parseRubric()

    // Parse module directory and test arguments from GitHub Actions environment
    const testArguments = core.getInput('testArguments')
    this.grader = new Grader(rubric, testArguments)
    
    this.timeKeeper = new TimeKeeper(rubric)
  }

  /**
   * Runs the action. 
   */
  async run() {
    // run go test
    const { retcode, stdout, stderr } = await this.grader.goTest()

    // grade the assignment (this will not fail the action; if `go test` fails, we just award 0 points)
    const { totalPointsAwarded, testResults, testsNotRan } = await this.grader.grade(stdout)

    // interpret the results of the time keeper. Will not fail the action.
    const gradeResults = this.timeKeeper.checkDeadline(totalPointsAwarded)

    // produce artifact
    createArtifact(gradeResults)

    // generate summary
    new Renderer(gradeResults, testResults, testsNotRan, stderr).writeSummary()

    // fail the action if the go test failed
    if(retcode !== 0) {
      core.setFailed(`go test failed with code ${retcode}. Some tests were unsuccessful.`)
    }
  }
}

export default Runner
