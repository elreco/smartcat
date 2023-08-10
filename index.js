const axios = require("axios");
const core = require("@actions/core");
const fs = require("fs");
const path = require("path");
const unzipper = require("unzipper");
const { execSync } = require('child_process');
const github = require('@actions/github');

async function run() {
  try {
    const actionType = core.getInput("actionType");
    const accountID = core.getInput("accountID");
    const apiToken = core.getInput("apiToken");
    const projectID = core.getInput("projectID");
    const apiServer = core.getInput("apiServer");

    const auth = {
      username: accountID,
      password: apiToken,
    };

    let result;

    if (actionType === "export") {
      const languages = core.getInput("languages");
      const format = core.getInput("format");
      const pathSeparator = core.getInput("pathSeparator");
      const completionState = core.getInput("completionState");
      const exportIncompleteAsBlank = core.getInput("exportIncompleteAsBlank");
      const skipIncompleteKeys = core.getInput("skipIncompleteKeys");
      const outputFilePathTemplate = core.getInput("outputFilePathTemplate");
      const includeDefaultLanguage = core.getInput("includeDefaultLanguage");
      const collections = core.getInput("collections");
      const fallbackToDefaultLanguage = core.getInput(
        "fallbackToDefaultLanguage"
      );
      const zip = core.getInput("zip");
      const outputPath = core.getInput("outputPath");

      if (!outputPath) {
        throw new Error('Missing required parameter "outputPath" for export action.');
      }

      const url = `${apiServer}/api/integration/v2/project/${projectID}/export`;

      const options = {
        auth: auth,
        method: "POST",
        params: {
          languages,
          format,
          "path-separator": pathSeparator,
          "completion-state": completionState,
          "export-incomplete-as-blank": exportIncompleteAsBlank,
          "skip-incomplete-keys": skipIncompleteKeys,
          "output-file-path-template": outputFilePathTemplate,
          "include-default-language": includeDefaultLanguage,
          collections,
          "fallback-to-default-language": fallbackToDefaultLanguage,
          zip,
        },
      };

      result = await axios(url, options);

      url = `${apiServer}/api/integration/v1/document/export/${result.data}`;
      const response = await axios(url, { auth: auth, responseType: "arraybuffer" });
      const zipPath = path.join(outputPath, "export.zip");
      fs.writeFileSync(zipPath, response.data);

      if (zipPath.endsWith(".zip")) {
        await fs.createReadStream(zipPath).pipe(unzipper.Extract({ path: outputPath }));
      }

      const currentBranch = github.context.ref.replace('refs/heads/', '');

      const newBranch = currentBranch + '-export-update';

      execSync(`git config user.name "Your Name"`);
      execSync(`git config user.email "your.email@example.com"`);
      execSync(`git checkout -b ${newBranch}`);
      execSync(`cp -r ${outputPath}/* .`);
      execSync(`git add .`);
      execSync(`git commit -m "Add export data"`);
      execSync(`git push origin ${newBranch}`);

      const token = process.env.GITHUB_TOKEN;
      const octokit = github.getOctokit(token);
      const { repo, owner } = github.context.repo;

      await octokit.pulls.create({
        owner,
        repo,
        title: 'New export data',
        head: newBranch,
        base: currentBranch,
      });

    } else if (actionType === "import") {
      const format = core.getInput("format");
      const labels = core.getInput("labels");
      const pathSeparator = core.getInput("pathSeparator");
      const skipConflictingValues = core.getInput("skipConflictingValues");
      const collection = core.getInput("collection");
      const overwriteConflictingValues = core.getInput(
        "overwriteConflictingValues"
      );
      const autoFileLabels = core.getInput("autoFileLabels");
      const files = core.getInput("files");

      const url = `${apiServer}/api/integration/v2/project/${projectID}/import`;

      const options = {
        auth: auth,
        method: "POST",
        params: {
          format,
          labels,
          "path-separator": pathSeparator,
          "skip-conflicting-values": skipConflictingValues,
          collection,
          "overwrite-conflicting-values": overwriteConflictingValues,
          "auto-file-labels": autoFileLabels,
        },
        data: {
          files,
        },
      };

      result = await axios(url, options);
    } else {
      throw new Error(
        'Invalid actionType. Must be either "import" or "export".'
      );
    }
    core.setOutput("result", result.data);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
