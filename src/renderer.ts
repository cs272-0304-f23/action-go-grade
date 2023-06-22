import * as core from "@actions/core";
import { type GradeResults } from "./deadline";
import { TestEventActionConclusion } from "./events";

class Renderer {
  private gradeResults: GradeResults
  private totalConclusions: {[key in TestEventActionConclusion]: number} = {
    pass: 0,
    fail: 0,
    skip: 0,
  }


  constructor(gradeResults: GradeResults) {
    this.gradeResults = gradeResults
    for(let result of this.gradeResults.testResults) {
      this.totalConclusions[result.action as TestEventActionConclusion]++
    }
  }

  writeSummary() {
    core.info('writing summary...')
    core.summary
      .addHeading('📝 Test results', 2)
      .addRaw('<div align="center">') // center alignment hack
      .addRaw(this.renderSummaryText())
      .addRaw('</div>')
      .write()
  }

  /**
   * Renders out results text (ie: "4 tests (2 passed, 1 failed, 1 skipped)")
   * @returns results summary test
   */
  private renderSummaryText(): string {
    let summarized = `${this.gradeResults.testResults.length} test${this.gradeResults.testResults.length === 1 ? '' : 's'}`

    const conclusionText = this.gradeResults.testResults
      .filter(c => this.totalConclusions[c.test as TestEventActionConclusion])
      .map(c => `${this.totalConclusions[c.test as TestEventActionConclusion]} ${c.test === 'skip' ? 'skipp' : c}ed`)
      .join(', ')

    if (conclusionText.length !== 0) {
      summarized += ` (${conclusionText})`
    }

    // add some flair for perfect scores
    if(this.gradeResults.grade === this.gradeResults.possiblePoints) {
      summarized += `<p>🎉💯🎉💯🎉</p>`
    }

    // add the grade
    const lateText = this.gradeResults.daysLate ? ` (${this.gradeResults.startingPoints} - ${this.gradeResults.startingPoints - this.gradeResults.grade})` : ""
    summarized += `<p>Score: <code>${this.gradeResults.grade}/${this.gradeResults.possiblePoints}</code>${lateText}</p>`

    // add a note for late submissions
    if(this.gradeResults.daysLate > 0) {
      summarized += `<p>Submission was ${this.gradeResults.daysLate} days late.<br>(Due on ${this.gradeResults.dueDate}, submitted on ${this.gradeResults.submissionDate})</p>`
    }

    return summarized
  }
}

export default Renderer
