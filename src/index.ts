import * as core from "@actions/core"
import Runner from "./runner"

Runner.create().then(runner => {
  runner.run()
}).catch(err => {
  core.error(err)
  core.setFailed(err.message)
})
