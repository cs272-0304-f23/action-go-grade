import * as core from "@actions/core";

import * as luxon from "luxon"
const zone = 'America/Los_Angeles';
const eod = 'T23:59:59';
luxon.Settings.defaultZone = zone;

class Runner {
  dueDate: luxon.DateTime

  constructor() {
    // Parse due date from GitHub Actions environment
    const dueDateStr = core.getInput('due_date', { required: true })
    this.dueDate = luxon.DateTime.fromISO(dueDateStr + eod, { zone })
  }

  /**
   * Runs the action. 
   * For now, we just print out the inputs to ensure that the action is working.
   */
  async run() {
    console.log('Go Grade Action is running...')
  }
}

export default Runner
