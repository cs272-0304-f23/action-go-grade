import * as core from "@actions/core";
import { type GradeResults } from "./deadline";
import { TestEventActionConclusion } from "./events";

class Renderer {
  private gradeResults: GradeResults

  constructor(gradeResults: GradeResults) {
    this.gradeResults = gradeResults
  }

  writeSummary() {
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

    const totalConclusions = {
      pass: 0,
      fail: 0,
      skip: 0
    }

    const conclusionText = this.gradeResults.testResults
      .filter(c => totalConclusions[c.test as TestEventActionConclusion])
      .map(c => `${totalConclusions[c.test as TestEventActionConclusion]} ${c.test === 'skip' ? 'skipp' : c}ed`)
      .join(', ')

    if (conclusionText.length !== 0) {
      summarized += ` (${conclusionText})`
    }
    summarized += `<p>Score: (<code id=\"grade\">${this.gradeResults.grade}/${this.gradeResults.possiblePoints}</code>)</p>`
    if(this.gradeResults.grade === this.gradeResults.possiblePoints) {
      summarized += `<p>🎉💯🎉💯🎉</p>`
    }

    // add a note for late submissions
    if(this.gradeResults.daysLate > 0) {
      summarized += `<p>Submission was ${this.gradeResults.daysLate} days late. (Due on ${this.gradeResults.dueDate}, submitted on ${this.gradeResults.submissionDate})</p>`
    }

    return summarized
  }
}

export default Renderer
