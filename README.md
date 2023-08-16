# Smartcat Translation

This GitHub Action provides a way to import and export translation files using Smartcat API. It supports various options and allows you to control the behavior of the import and export processes.


## Usage

Here's an example of how you can use this action in your workflow:

```yaml
steps:
  - uses: actions/checkout@v3
  - name: Install Dependencies
    run: npm install
  - name: Import/Export Translations
    uses: elreco/smartcat@1
    with:
      actionType: 'export'
      apiServer: 'https://smartcat.com'
      apiToken: ${{ secrets.SMARTCAT_API_TOKEN }}
      accountID: 'c5a662fe-66ae-4793-ae1a-9e386d03a7a0'
      projectID: '85381a5c-a1ce-4301-a4e0-548a8869ac64'
      outputPath: './src/translations'
      # Other options as needed
    env:
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

Here's a description of all the inputs that you can use as part of this action.

### Required Inputs

- actionType: Action to perform (import/export).
- apiServer: API Server URL.
- apiToken: API Token.
- accountID: Account ID.
- projectID: Project ID.

### Optional Inputs

- outputPath: Output path for file export (handle appropriately in the code).
- languages: Languages for export.
- format: File format for export.
- pathSeparator: Path separator for export.
- completionState: Completion state for export.
- exportIncompleteAsBlank: Export incomplete as blank option.
- skipIncompleteKeys: Skip incomplete keys option.
- outputFilePathTemplate: Output file path template for export.
- includeDefaultLanguage: Include default language option.
- collections: Collections for export.
- fallbackToDefaultLanguage: Fallback to default language option.
- labels: Labels for import.
- skipConflictingValues: Skip conflicting values option for import.
- collection: Collection for import.
- overwriteConflictingValues: Overwrite conflicting values option for import.
- autoFileLabels: Auto file labels option for import.
- files: Files for import (handle appropriately in the code).
- githubToken: GitHub token for authentication.

## Secrets

Make sure to store any sensitive information, such as the Smartcat API token, in the GitHub Secrets and reference them in the workflow file as shown in the example.

## Running Locally

To run this action locally, you'll need Node.js 16. Follow the instructions in the repository for setting up and running the action on your local machine.

## Support

If you encounter any problems or have suggestions, please open an issue in this repository.

## License

Include information about the license, if applicable.
