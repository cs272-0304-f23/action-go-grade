import * as core from "@actions/core";
import { type GradeResults } from "./deadline";

class Renderer {
  constructor() {
  }

  writeSummary(gradeResults: GradeResults) {
    core.summary
      .addHeading('📝 Test results', 2)
      .addRaw('<div align="center">') // center alignment hack
      .addRaw(JSON.stringify(gradeResults, null, 2))
      .addRaw('</div>')
      .write()
  }
}

export default Renderer
