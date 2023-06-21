import * as core from "@actions/core";

import * as luxon from "luxon"
const zone = 'America/Los_Angeles';
const eod = 'T23:59:59';
luxon.Settings.defaultZone = zone;

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
    // grade the assignment (this will not fail the action; if `go test` fails, we just award 0 points)
    const { pointsAwarded, pointsPossible } = await this.grader.grade()

    // interpret the results of the time keeper. Will not fail the action.
    const gradeResults = await this.timeKeeper.checkDeadline(pointsAwarded, pointsPossible)

    // produce artifact
    createArtifact(gradeResults)

    // generate summary
    new Renderer().writeSummary(gradeResults)
  }
}

export default Runner
