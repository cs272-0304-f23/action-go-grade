import * as yaml from 'js-yaml'
import * as core from '@actions/core'

import { DateTime, Settings } from 'luxon'
const zone = 'America/Los_Angeles';
const eod = 'T23:59:59';
Settings.defaultZone = zone;

export type Rubric = {
  tests: {[testName: string]: number}
  pointsPossible: number
  dueDate: DateTime
  latePenalty: number
  maxPenalty: number
}


/**
 * Parses the rubric from the owning repository
 * @returns the rubric as an object
 */
export function parseRubric(): Rubric {
  // initialize rubric with default values
  let latePenalty = 0.02
  let maxPenalty = 0.26
  let tests: {[testName: string]: number} = {}
  let pointsPossible = 100
  let dueDate = DateTime.now()

  core.info('Parsing rubric from GitHub context...')
  // read rubric from github environment variables
  const rubric = core.getInput('rubric')
  if(rubric) {
    // note this can throw an error (but we want it to so the action fails with invalid rubric)
    const rubricObj = yaml.load(rubric) as Partial<Rubric>
    if(rubricObj.latePenalty) {
      latePenalty = rubricObj.latePenalty
      core.info(`\tFound late penalty: ${latePenalty}`)
    }
    if(rubricObj.maxPenalty) {
      maxPenalty = rubricObj.maxPenalty
      core.info(`\tFound max penalty: ${maxPenalty}`)
    }
    if(rubricObj.tests) {
      tests = rubricObj.tests
      core.info(`\tFound tests: ${JSON.stringify(tests)}`)
    }
    if(rubricObj.pointsPossible) {
      pointsPossible = rubricObj.pointsPossible
      core.info(`\tFound points possible: ${pointsPossible}`)
    }
    if(rubricObj.dueDate) {
      dueDate = DateTime.fromISO(rubricObj.dueDate + eod, { zone })
      core.info(`\tFound due date: ${dueDate.toLocaleString(DateTime.DATETIME_FULL)}`)
    }
  }

  return {
    tests,
    pointsPossible,
    dueDate,
    latePenalty,
    maxPenalty
  }
}
