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
export async function parseRubric(rubricUrl: string): Promise<Rubric> {
  // initialize rubric with default values
  const rubric: Rubric = {
    latePenalty:  0.02,
    maxPenalty:  0.26,
    tests:  {},
    pointsPossible: 0,
    dueDate: DateTime.now()
  }

  core.info('Parsing rubric from ' + rubricUrl)
  const resp = await axios.get(rubricUrl).catch((err) => {
    throw new Error(`Failed to fetch rubric from course site. Error: ${err}`)
  })

  if(resp.status !== 200) {
    throw new Error(`Failed to fetch rubric from course site. Status code: ${resp.status}`)
  }
  const parsedRubric = resp.data
  if(parsedRubric.dueDate) {
    core.info("Due date found: " + parsedRubric.dueDate)
    parsedRubric.dueDate = DateTime.fromISO(parsedRubric.dueDate + eod, { zone })
  }

  // merge parsed rubric into rubric
  Object.assign(rubric, parsedRubric as Partial<Rubric>)
  core.info("Rubric merged: " + JSON.stringify(rubric))

  rubric.pointsPossible = 0
  for(let points of Object.values(rubric.tests)) {
    rubric.pointsPossible += points
  }

  return rubric
}
