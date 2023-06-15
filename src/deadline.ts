import * as fs from "fs";
import * as core from "@actions/core";
import * as github from "@actions/github";
import * as artifact from "@actions/artifact";

import * as luxon from "luxon"

const LATE_PENALTY = 0.02 // 2% per day late
const MAX_PENALTY = 0.26  // 26% max late penalty

// GradeResults is an object that shows the results of the grade calculation
type GradeResults = {
  startingPoints: number
  possiblePoints: number

  latePenalty: number
  maxPenalty: number

  daysLate: number
  pointsDeducted: number
  grade: number
}

class Deadline {
  dueDate: luxon.DateTime
  startingPoints: number  // the points earned before any late penalty  
  possiblePoints: number  // the points possible for this assignment

  constructor(dueDate: luxon.DateTime, startingPoints: number, possiblePoints: number) {
    this.dueDate = dueDate
    this.startingPoints = startingPoints
    this.possiblePoints = possiblePoints
  }

  /**
   * Runs the action. 
   * For now, we just print out the inputs to ensure that the action is working.
   */
  async checkDeadline() {
    const submissionDate = this.parseSubmissionDate()
    const daysLate = this.checkSubmissionDate(submissionDate)
    const grade = this.calculateGrade(daysLate)
    this.createArtifact(grade)
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
  private calculateGrade(daysLate: number): GradeResults {
    core.info(`Starting: ${this.startingPoints} Points`)
    core.info(`Possible: ${this.possiblePoints} Points\n`)

    const pointPenalty = this.possiblePoints * LATE_PENALTY
    const maxPoints = this.possiblePoints * MAX_PENALTY

    let pointDeduction = 0
    if(daysLate > 0) {
      pointDeduction = Math.min(pointPenalty * daysLate, maxPoints)
      console.log(`Late Penalty: -${pointDeduction} Points`)
    }

    const grade = Math.max(this.startingPoints - pointDeduction, 0) // don't go below 0 points (eg. student only gets 10pts on a 100pt assignment and is late 2 months...)
    const percent = (grade / this.possiblePoints * 100).toFixed(1);
    console.log(`\nGrade: ${grade} Points (${percent}%)`)

    // create the GradeResults object
    return {
      startingPoints: this.startingPoints,
      possiblePoints: this.possiblePoints,
      latePenalty: LATE_PENALTY,
      maxPenalty: MAX_PENALTY,
      daysLate: daysLate,
      pointsDeducted: pointDeduction,
      grade: grade
    }
  }

  private async createArtifact(gradeResults: GradeResults) {
    core.startGroup('Uploading artifact...');
    const filename = 'grade-results.json';
    fs.writeFileSync(filename, JSON.stringify(gradeResults));

    const client = artifact.create();
    const response = await client.uploadArtifact('grade-results', [filename], '.');
    console.log(`Uploaded: ${JSON.stringify(response)}`);
    core.endGroup();

    core.summary
      .addHeading('Grade Deadline Results')
      .addRaw('<div>')
      .addHeading('Late Penalty', 3)
      .addQuote(`note: The late penalty is ${gradeResults.latePenalty * 100}% of the possible points per day late with a maximum late penalty of ${gradeResults.maxPenalty * 100}% of the possible points.`)
      .addRaw(`<p>Days Late: ${gradeResults.daysLate}<br>Points Deducted: -${gradeResults.pointsDeducted} Points</p>`)
      .addHeading('Grade', 3)
      .addRaw(`<p>Autograder Results: ${gradeResults.startingPoints}<br>Grade: <code>${gradeResults.grade}/${gradeResults.possiblePoints}</code> (${(gradeResults.grade / gradeResults.possiblePoints * 100).toFixed(1)}%)</p>`)
      .addRaw('</div>')
      .write()
  }
}

export default Deadline
