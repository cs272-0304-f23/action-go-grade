import * as core from "@actions/core";
import { type GradeResults } from "./deadline";
import { TestEventAction, TestEventActionConclusion } from "./events";
import { TestResult } from "./grader";
import { SummaryTableCell, SummaryTableRow } from "@actions/core/lib/summary";

class Renderer {
  private gradeResults: GradeResults
  private totalConclusions: {[key in TestEventActionConclusion]: number} = {
    pass: 0,
    fail: 0,
    skip: 0,
  }
  private headers: SummaryTableRow = [
    { data: '❓ Result', header: true },
    { data: '🧪 Test', header: true },
    { data: '💯 Points', header: true },
  ]

  constructor(gradeResults: GradeResults) {
    this.gradeResults = gradeResults
    for(let result of this.gradeResults.testResults) {
      this.totalConclusions[result.action as TestEventActionConclusion]++
    }
  }

  writeSummary(stdout: string) {
    core.info('writing summary...')

    // group results by package
    const groups: {[key: string]: TestResult[]} = {}
    for(const result of this.gradeResults.testResults) {
      if(!groups[result.package]) {
        groups[result.package] = []
      }
      groups[result.package].push(result)
    }

    // sort packages by name
    const packageNames = Object.keys(groups).sort()

    // construct the table
    const rows = [this.headers]
    for(const packageName of packageNames) {
      // sort package results by points possible (descending)
      const sortedPackageResults = groups[packageName].sort((a, b) => b.pointsPossible - a.pointsPossible)
      // add a row for the package name
      rows.push([{ data: `<b><u>${packageName}</u></b>`, colspan: '3' } as SummaryTableCell])
      for(const test of sortedPackageResults) {
        rows.push([
          `${this.emojiFor(test.action)} ${test.action == 'skip' ? 'skipp' : test.action}ed`,
          `<code>${test.test}</code>`,
          test.pointsPossible ? `<b>${test.pointsAwarded}/${test.pointsPossible}</b>`: '<b>-</b>'
        ])
      }
    }
    rows.push([{ data: `<details><summary>🖨️ Output</summary><pre><code>${stdout}</code></pre></details>`, colspan: '3' } as SummaryTableCell])

    core.summary
      .addRaw('<div align="center">') // center alignment hack
      .addHeading('📝 Autograder results', 2)
      .addRaw(this.renderSummaryText())
      .addHeading('🧪 Test Results', 2)
      .addTable(rows)
      .addRaw('</div>')
      .write()
  }

  /**
   * Renders out results text (ie: "4 tests (2 passed, 1 failed, 1 skipped)")
   * @returns results summary test
   */
  private renderSummaryText(): string {
    let summarized = `${this.gradeResults.testResults.length} test${this.gradeResults.testResults.length === 1 ? '' : 's'}`

    const conclusionText = Object.entries(this.totalConclusions)
      .filter(([_, count]) => count > 0)
      .map(([conclusion, count]) => `${count} ${conclusion === 'skip' ? 'skipp' : conclusion}ed`)
      .join(', ')

    if (conclusionText.length !== 0) {
      summarized += ` (${conclusionText})`
    }

    // add some flair for perfect scores
    if(this.gradeResults.grade === this.gradeResults.possiblePoints) {
      summarized += `<p>🎉💯🎉💯🎉</p>`
    }

    // add the grade
    const lateText = this.gradeResults.daysLate ? ` (${this.gradeResults.startingPoints} - ${this.gradeResults.pointsDeducted})` : ""
    summarized += `<p>Score: <code>${this.gradeResults.grade}/${this.gradeResults.possiblePoints}</code>${lateText}</p>`

    // add a note for late submissions
    if(this.gradeResults.daysLate > 0) {
      summarized += `<p>Submission was ${this.gradeResults.daysLate} days late.<br>(Due on ${this.gradeResults.dueDate}, submitted on ${this.gradeResults.submissionDate})</p>`
    }

    return summarized
  }

  /**
   * Displayed emoji for a specific test event
   * @param action test event action
   * @returns an emoji
   */
  private emojiFor(action: TestEventAction): string {
    switch (action) {
      case 'pass':
        return '🟢'
      case 'fail':
        return '🔴'
      case 'skip':
        return '🟡'
      default:
        return '❓'
    }
  }
}

export default Renderer
