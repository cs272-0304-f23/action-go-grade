import * as core from "@actions/core"
import Runner from "./runner"

new Runner().run().catch(err => {
  core.error(err)
  core.setFailed(err.message)
})
