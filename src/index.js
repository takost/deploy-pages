require('regenerator-runtime/runtime')

// This package assumes a site has already been built and the files exist in the current workspace
// If there's an artifact named `artifact.tar`, it can upload that to actions on its own,
// without the user having to do the tar process themselves.

const core = require('@actions/core')
// const github = require('@actions/github'); // TODO: Not used until we publish API endpoint to the @action/github package
const axios = require('axios')

const {Deployment} = require('./deployment')
const deployment = new Deployment()

// TODO: If the artifact hasn't been created, we can create it and upload to artifact storage ourselves
// const tar = require('tar')

async function cancelHandler(evtOrExitCodeOrError) {
  try {
    if (deployment.requestedDeployment) {
      const pagesCancelDeployEndpoint = `${deployment.githubApiUrl}/repos/${process.env.GITHUB_REPOSITORY}/pages/deployment/cancel/${process.env.GITHUB_SHA}`
      await axios.put(
        pagesCancelDeployEndpoint,
        {},
        {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `Bearer ${deployment.githubToken}`,
            'Content-type': 'application/json'
          }
        }
      )
      core.info(`Deployment cancelled with ${pagesCancelDeployEndpoint}`)
    }
  } catch (e) {
    console.log('Deployment cancellation failed', e)
  }
  process.exit(isNaN(+evtOrExitCodeOrError) ? 1 : +evtOrExitCodeOrError)
}

async function main() {
  let idToken = ""
  try {
    idToken = await core.getIDToken()
  } catch (error) {
    console.log(error)
    core.setFailed(`Ensure GITHUB_TOKEN has permission "idToken: write".`)
    return
  }
  try {
    await deployment.create(idToken)
    await deployment.check()
  } catch (error) {
    core.setFailed(error)
  }
}

// Register signal handlers for workflow cancellation
process.on('SIGINT', cancelHandler)
process.on('SIGTERM', cancelHandler)

// Main
const emitTelemetry = core.getInput("emit_telemetry")
if (emitTelemetry === "true") {
  require('./pre')
} else {
  main()
}
