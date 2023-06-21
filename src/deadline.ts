import * as fs from "fs";
import * as luxon from "luxon"
import * as core from "@actions/core";
import * as github from "@actions/github";
import * as artifact from "@actions/artifact";

import { Rubric } from "./rubric";

// GradeResults is an object that shows the results of the grade calculation
export type GradeResults = {
  startingPoints: number
  possiblePoints: number

  latePenalty: number
  maxPenalty: number

  daysLate: number
  pointsDeducted: number
  grade: number
}

class TimeKeeper {
  private dueDate: luxon.DateTime
  private latePenalty: number
  private maxPenalty: number

  constructor(rubric: Rubric) {
    this.dueDate = rubric.dueDate
    this.latePenalty = rubric.latePenalty
    this.maxPenalty = rubric.maxPenalty
  }

  /**
   * checks the deadline and calculates the grade
   */
  async checkDeadline(startingPoints: number, possiblePoints: number): Promise<GradeResults> {
    const submissionDate = this.parseSubmissionDate()
    const daysLate = this.checkSubmissionDate(submissionDate)
    return this.calculateGrade(daysLate, startingPoints, possiblePoints)
  }

  /**
   * Parses the submission date from the GitHub Actions environment
   * @returns The submission date
   * @throws An error if the submission date is not in the correct format
   */
  private parseSubmissionDate(): luxon.DateTime {
    let submissionDate: luxon.DateTime | undefined;
    
    console.log('Parsing submission date from GitHub context...')
    switch(github.context.eventName) {
      case 'workflow_dispatch':
      case 'push':
        // pushed_at is a timestamp for this commit
        const pushed = github.context.payload.repository?.pushed_at;
        if(pushed) {
          submissionDate = luxon.DateTime.fromSeconds(parseInt(pushed))
        } else {
          console.log(`\tPayload's repository does not contain pushed_at timestamp. Payload.repository: ${JSON.stringify(github.context.payload.repository)}`)
        }
        break;
      case 'release':
        // created_at is an ISO timestamp for this release
        const created = github.context.payload.release?.created_at;
        if(created) {
          submissionDate = luxon.DateTime.fromISO(created)
        } else {
          console.log(`\tPayload's release does not contain created_at timestamp. Payload.release: ${JSON.stringify(github.context.payload.release)}`)
        }
        break;
    }

    // check that we were able to parse the submission date
    if(!submissionDate) {
      console.log(`Could not parse submission date, using current time as submission date.`)
      submissionDate = luxon.DateTime.now()
    }

    return submissionDate
  }

  /**
   * Checks the given submission date and calculates the late penalty if applicable
   */
  private checkSubmissionDate(submissionDate: luxon.DateTime): number {
    const submittedText = submissionDate.toLocaleString(luxon.DateTime.DATETIME_FULL)
    console.log(`Checking submission date: ${submittedText}`)

    // check if the submission date is after the due date
    // if so, calculate the late penalty
    if(submissionDate < this.dueDate) {
      return 0
    }

    // calculate the number of days late
    let daysLate = submissionDate.diff(this.dueDate, 'days').days // eg. => { 'days': 0.015 }.days => 0.015
    daysLate = Math.ceil(daysLate)

    console.log(`Submission is ${daysLate} days late`)
    return daysLate
  }

  /**
   * Calculates the grade based on the number of days late
   */
  private calculateGrade(daysLate: number, startingPoints: number, possiblePoints: number): GradeResults {
    core.info(`Starting: ${startingPoints} Points`)
    core.info(`Possible: ${possiblePoints} Points\n`)

    const pointPenalty = possiblePoints * this.latePenalty
    const maxPoints = possiblePoints * this.maxPenalty

    let pointDeduction = 0
    if(daysLate > 0) {
      pointDeduction = Math.min(pointPenalty * daysLate, maxPoints)
      console.log(`Late Penalty: -${pointDeduction} Points`)
    }

    const grade = Math.max(startingPoints - pointDeduction, 0) // don't go below 0 points (eg. student only gets 10pts on a 100pt assignment and is late 2 months...)
    const percent = (grade / possiblePoints * 100).toFixed(1);
    console.log(`\nGrade: ${grade} Points (${percent}%)`)

    // create the GradeResults object
    return {
      startingPoints: startingPoints,
      possiblePoints: possiblePoints,
      latePenalty: this.latePenalty,
      maxPenalty: this.maxPenalty,
      daysLate: daysLate,
      pointsDeducted: pointDeduction,
      grade: grade
    }
  }
}

export async function createArtifact(gradeResults: GradeResults) {
  core.startGroup('Uploading artifact...');
  const filename = 'grade-results.json';
  fs.writeFileSync(filename, JSON.stringify(gradeResults));

  const client = artifact.create();
  const response = await client.uploadArtifact('grade-results', [filename], '.');
  console.log(`Uploaded: ${JSON.stringify(response)}`);
  core.endGroup();
}

export default TimeKeeper
