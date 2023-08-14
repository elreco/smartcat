const core = require("@actions/core");
const fs = require("fs");
const fsPromises = fs.promises;
const path = require("path");
const unzipper = require("unzipper");
const axios = require("axios");
const { context: githubContext } = require("@actions/github");
const { Octokit } = require("@octokit/rest");
const fetch = require("node-fetch");

async function run() {
  const actionType = core.getInput("actionType");
  const accountID = core.getInput("accountID");
  const apiToken = core.getInput("apiToken");
  const projectID = core.getInput("projectID");
  const apiServer = core.getInput("apiServer");
  const githubToken = core.getInput("githubToken");

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
    const zip = true;
    const outputPath = core.getInput("outputPath");

    if (!outputPath) {
      throw new Error(
        'Missing required parameter "outputPath" for export action.'
      );
    }

    let url = `${apiServer}/api/integration/v2/project/${projectID}/export`;

    const data = {
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
    };

    const filteredData = Object.fromEntries(
      Object.entries(data).filter(
        ([key, value]) => value !== undefined && value !== null && value !== ""
      )
    );

    const options = {
      auth: auth,
      method: "POST",
      params: filteredData,
    };

    result = await axios(url, options);

    url = `${apiServer}/api/integration/v1/document/export/${result.data}`;
    const MAX_RETRIES = 10;
    const RETRY_DELAY = 1000;

    let response;
    let retryCount = 0;
    do {
      response = await axios({
        url: url,
        method: "GET",
        responseType: "stream",
        auth: auth,
      });

      if (response.status === 204) {
        core.debug(
          `Received 204, retrying (${retryCount + 1}/${MAX_RETRIES})...`
        );
        if (retryCount < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
        }
      } else {
        break;
      }

      retryCount++;
    } while (retryCount < MAX_RETRIES);

    if (response.status === 204) {
      core.error("Maximum retries reached. Unable to fetch the data.");
      return;
    }
    if (!fs.existsSync(outputPath)) {
      try {
        await fs.promises.mkdir(outputPath, { recursive: true });
        core.info(`Dossier créé: ${outputPath}`);
      } catch (error) {
        core.error(`Erreur lors de la création du dossier: ${error}`);
      }
    } else {
      core.info(`Dossier existe déjà: ${outputPath}`);
    }

    const zipPath = path.join(outputPath, "export.zip");

    const writeStream = fs.createWriteStream(zipPath);
    response.data.pipe(writeStream);

    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    if (zipPath.endsWith(".zip")) {
      await new Promise((resolve, reject) => {
        const stream = fs
          .createReadStream(zipPath)
          .pipe(unzipper.Extract({ path: outputPath }));
        stream.on("error", reject);
        stream.on("finish", resolve);
      });
    }

    await fs.promises.unlink(zipPath);

    const currentBranch = githubContext.ref.replace("refs/heads/", "");
    let newBranch = currentBranch + "-export-update";
    const token = githubToken || process.env.GITHUB_TOKEN;
    const octokit = new Octokit({
      auth: token,
      request: {
        fetch: fetch,
      },
    });
    const { repo, owner } = githubContext.repo;

    let suffix = 0;
    let branchExists = true;
    while (branchExists) {
      try {
        await octokit.git.getRef({
          owner,
          repo,
          ref: `heads/${newBranch}`,
        });
        suffix += 1;
        newBranch = currentBranch + "-export-update-" + suffix;
      } catch (error) {
        branchExists = false;
      }
    }

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
    });
    const files = await fsPromises.readdir(outputPath);
    for (const file of files) {
      const filePath = path.join(outputPath, file);
      const stats = await fsPromises.stat(filePath);

      if (stats.isFile()) {
        const content = await fsPromises.readFile(filePath, "base64");
        let sha;
        try {
          const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: filePath,
            ref: newBranch,
          });
          sha = data.sha;
        } catch (error) {}
        await octokit.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: filePath,
          message: "Add export data",
          content,
          branch: newBranch,
          sha,
        });
      }
    }

    await octokit.pulls.create({
      owner,
      repo,
      title: "New export data",
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
    const params = {
      format,
      labels,
      "path-separator": pathSeparator,
      "skip-conflicting-values": skipConflictingValues,
      collection,
      "overwrite-conflicting-values": overwriteConflictingValues,
      "auto-file-labels": autoFileLabels,
    };

    const filteredParams = Object.fromEntries(
      Object.entries(params).filter(
        ([key, value]) => value !== undefined && value !== null && value !== ""
      )
    );

    const options = {
      auth: auth,
      method: "POST",
      params: filteredParams,
      data: {
        files,
      },
    };

    result = await axios(url, options);
  } else {
    throw new Error('Invalid actionType. Must be either "import" or "export".');
  }
  core.setOutput("result", result.data);
}

run();
