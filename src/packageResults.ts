import * as core from '@actions/core'

import { TestResult } from "./grader"
import { TestEventActionConclusion } from "./events"

/**
 * PackageResult is a class that holds the results of a package's tests. Typically, packages contain multiple 
 * tests and it is useful to have a single object that holds the results of all of them.
 */
export default class PackageResult {
  packageEvent: TestResult
  events: TestResult[]
  pointsPossible: number = 0
  pointsAwarded: number = 0
  conclusions: {[key in TestEventActionConclusion]: number} = {
    pass: 0,
    fail: 0,
    skip: 0,
  }
  output: string = ""

  constructor(packageEvent: TestResult, events: TestResult[]) {
    this.packageEvent = packageEvent
    this.events = []
    for(const event of events) {
      this.addEvent(event)
    }
  }

  /**
   * addEvent adds a test event to the package result. It updates the points possible, points awarded, and
   * conclusion counts. It also appends the output of the event to the output of the package result.
   */
  addEvent(event: TestResult) {
    if(event.isConclusive) {
      this.events.push(event)
      this.pointsPossible += event.pointsPossible
      this.pointsAwarded += event.pointsAwarded
      this.conclusions[event.action as TestEventActionConclusion] += 1
    } else if(event.action === 'output') {
      this.output += event.output
    }
  }
}

/**
 * constructPackageResults takes a list of test events and constructs a list of package results. This allows us
 * to easily group test events by package and compute the total points possible, points awarded, and
 * conclusion counts for each package.
 */
export function constructPackageResults(results: TestResult[]): PackageResult[] {
  core.info(`constructing package results from ${results.length} test events`)
  const resultByPackage = new Map<string, PackageResult>()

  // First, we need to find all the package events. These are the events that have a test property of undefined.
  for(const result of results) {
    if(result.test === undefined) {
      core.info(`found package event for package=${result.package}`)
      resultByPackage.set(result.package, new PackageResult(result, []))
    }
  }

  // Next, we need to update the package results with the test events.
  for(const result of results) {
    // if the result is a test and the package is in the map (this should always be true)
    if(result.test !== undefined && resultByPackage.has(result.package)) {
      core.info(`adding test=${result.test} for package=${result.package}`)
      const packageResult = resultByPackage.get(result.package)! // safe to !: we only get here if the package is in the map
      packageResult.addEvent(result)
    }
  }

  return Array.from(resultByPackage.values())
}
