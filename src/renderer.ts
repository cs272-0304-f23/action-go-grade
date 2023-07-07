import * as core from "@actions/core";
import { type GradeResults } from "./deadline";
import { TestEventAction, TestEventActionConclusion } from "./events";
import PackageResult, { constructPackageResults } from "./packageResults";
import { SummaryTableCell, SummaryTableRow } from "@actions/core/lib/summary";
import { TestResult } from "./grader";

class Renderer {
  private gradeResults: GradeResults
  private packageResults: PackageResult[]
  private testsNotRan: string[]
  private buildError: boolean
  private stderr: string
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

  constructor(gradeResults: GradeResults, testResults: TestResult[], testsNotRan: string[], stderr: string, buildError: boolean) {
    this.stderr = stderr
    this.buildError = buildError
    this.testsNotRan = testsNotRan
    this.gradeResults = gradeResults
    this.packageResults = constructPackageResults(testResults)
    for(let result of testResults) {
      if(result.isConclusive) {
        this.totalConclusions[result.action as TestEventActionConclusion]++
      }
    }
  }

  /**
   * Writes a summary of the test results to the GitHub Actions summary
   */
  writeSummary() {
    core.info('writing summary...')

    let summary = core.summary
      .addRaw('<div align="center">') // center alignment hack
      .addHeading('📝 Autograder results', 2)
      .addRaw(this.renderSummaryText())

    if(this.buildError) {
      summary = summary
      .addHeading('🚨 Oh no! Your project did not compile', 2)
    } else {
      summary = summary
      .addHeading('🧪 Test Results', 2)
      .addTable(this.renderSummaryTable())
    }


    summary
      .addRaw(this.renderStderr())
      .addRaw('</div>')
      .write()
  }

  /**
   * Renders out results text (ie: "4 tests (2 passed, 1 failed, 1 skipped)")
   * @returns results summary test
   */
  private renderSummaryText(): string {
    let totalTests = this.totalConclusions.pass + this.totalConclusions.fail + this.totalConclusions.skip
    let summarized = `${totalTests} test${totalTests == 1 ? '' : 's'}`

    const conclusionText = Object.entries(this.totalConclusions)
      .filter(([_, count]) => count > 0)
      .map(([conclusion, count]) => `${count} ${conclusion === 'skip' ? 'skipp' : conclusion}ed`)
      .join(', ')

    if (conclusionText.length !== 0) {
      summarized += ` (${conclusionText})`
    }

    // if some tests were not run, notify the user to include them in their submission
    if(this.testsNotRan.length > 0) {
      summarized += `<p>⚠️ Some tests were not found. Ensure that your test file(s) include these tests: <code>${this.testsNotRan.join(', ')}</code>.</p>`
    }

    // add some flair for perfect scores
    if(this.gradeResults.grade === this.gradeResults.possiblePoints) {
      summarized += `🎉💯🎉💯🎉`
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
   * Renders out results table
   * @returns results table
   */
  private renderSummaryTable(): SummaryTableRow[] {
    // helper function to get points text
    const getPointsText = (pointsAwarded: number, pointsPossible: number) => {
      return pointsPossible ? `<b>${pointsAwarded}/${pointsPossible}</b>`: '<b>-</b>'
    }

    // construct the table
    const rows = [this.headers]

    // sort package results by points possible (descending)
    this.packageResults.sort((a, b) => b.pointsPossible - a.pointsPossible)
    for(const packageResult of this.packageResults) {
      // sort package results by points possible (descending)
      packageResult.events.sort((a, b) => b.pointsPossible - a.pointsPossible)

      // add a row for the package name
      rows.push([
        { data: `<b><u>${packageResult.packageEvent.package}</u></b>`, colspan: '2' } as SummaryTableCell,
        getPointsText(packageResult.pointsAwarded, packageResult.pointsPossible)
      ])

      for(const test of packageResult.events) {
        rows.push([
          `${this.emojiFor(test.action)} ${test.action == 'skip' ? 'skipp' : test.action}ed`,
          `<code>${test.test}</code>`,
          getPointsText(test.pointsAwarded, test.pointsPossible)
        ])
      }
      rows.push([
        { data: `<details><summary>🖨️ Output</summary><pre><code>${packageResult.output}</code></pre></details>`, colspan: '3' } as SummaryTableCell
      ])
    }

    return rows
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

  private renderStderr(): string {
    return this.stderr
      ? `<details>
<summary>🚨 Standard Error Output</summary>

\`\`\`
${this.stderr}
\`\`\`

</details>`
      : ''
  }
}

export default Renderer
