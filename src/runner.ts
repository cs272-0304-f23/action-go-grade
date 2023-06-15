import * as core from "@actions/core";

import * as luxon from "luxon"
const zone = 'America/Los_Angeles';
const eod = 'T23:59:59';
luxon.Settings.defaultZone = zone;

import Grader from './grader'
import TimeKeeper, { createArtifact } from './deadline'
import Renderer from "./renderer";

class Runner {
  grader: Grader
  timeKeeper: TimeKeeper

  constructor() {
    // Parse due date from GitHub Actions environment
    const dueDateStr = core.getInput('due_date', { required: true })
    const dueDate = luxon.DateTime.fromISO(dueDateStr + eod, { zone })
    this.timeKeeper = new TimeKeeper(dueDate)

    const moduleDirectory = core.getInput('moduleDirectory')
    const testArguments = core.getInput('testArguments')
    this.grader = new Grader(moduleDirectory, testArguments)
  }

  /**
   * Runs the action. 
   * For now, we just print out the inputs to ensure that the action is working.
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
