import * as core from '@actions/core'
import axios from 'axios'

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
export function parseRubric(rubricUrl: string): Rubric {
  // initialize rubric with default values
  const rubric: Rubric = {
    latePenalty:  0.02,
    maxPenalty:  0.26,
    tests:  {},
    pointsPossible: 100,
    dueDate: DateTime.now()
  }

  core.info('Parsing rubric from ' + rubricUrl)
  axios.get(rubricUrl)
  .then((resp) => {
    if(resp.status !== 200) {
      throw new Error(`Failed to fetch rubric from course site. Status code: ${resp.status}`)
    }
    const parsedRubric = resp.data
    core.info("Rubric parsed: " + JSON.stringify(parsedRubric))
    if(parsedRubric.dueDate) {
      core.info("Due date found: " + parsedRubric.dueDate)
      parsedRubric.dueDate = DateTime.fromISO(parsedRubric.dueDate + eod, { zone })
    }

    // merge parsed rubric into rubric
    Object.assign(rubric, parsedRubric)
  }).catch((err) => {
    core.error(err)
  })

  return rubric
}
