const core = require("@actions/core");
const fs = require('fs');
const path = require("path");
const unzipper = require("unzipper");
const axios = require('axios');
const { context: githubContext } = require('@actions/github');
const { Octokit } = require("@octokit/rest");
const fetch = require('node-fetch')

async function run() {
    const actionType = core.getInput("actionType");
    const accountID = core.getInput("accountID");
    const apiToken = core.getInput("apiToken");
    const projectID = core.getInput("projectID");
    const apiServer = core.getInput("apiServer");
    const githubToken = core.getInput('githubToken');

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
      const fallbackToDefaultLanguage = core.getInput("fallbackToDefaultLanguage");
      const zip = core.getInput("zip");
      const outputPath = core.getInput("outputPath");

      if (!outputPath) {
        throw new Error('Missing required parameter "outputPath" for export action.');
      }

      let url = `${apiServer}/api/integration/v2/project/${projectID}/export`;

      const options = {
        auth: auth,
        method: "POST",
        data: {
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
      const response = await axios({
        url: url,
        method: 'GET',
        responseType: 'stream',
        auth: auth
      });

      const zipPath = path.join(outputPath, "export.zip");
      const writeStream = fs.createWriteStream(zipPath);
      response.data.pipe(writeStream);

      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      if (zipPath.endsWith(".zip")) {
        await new Promise((resolve, reject) => {
          const stream = fs.createReadStream(zipPath).pipe(unzipper.Extract({ path: outputPath }));
          stream.on('error', reject);
          stream.on('finish', resolve);
        });
      }


      const currentBranch = githubContext.ref.replace('refs/heads/', '');
      const newBranch = currentBranch + '-export-update';
      const token = githubToken || process.env.GITHUB_TOKEN;
      const octokit = new Octokit({ auth: token, request: {
        fetch: fetch,
      }, });
      const { repo, owner } = githubContext.repo;

      const { data: baseBranch } = await octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${currentBranch}`,
      });

      await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${newBranch}`,
        sha: baseBranch.object.sha,
      })

      const files = await fs.readdir(outputPath);
      for (const file of files) {
        const filePath = path.join(outputPath, file);
        const content = await fs.readFile(filePath, "base64");

        await octokit.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: file,
          message: "Add export data",
          content,
          branch: newBranch,
        });
      }

      await octokit.pulls.create({
        owner,
        repo,
        title: 'New export data',
        head: newBranch,
        base: currentBranch,
      });
    }
     else if (actionType === "import") {
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
        data: {
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
}

run();
