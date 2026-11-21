param(
    [Parameter(Mandatory = $true)]
    [string]$Server,

    [string]$Python = "python"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($env:FLOW_PUBLISH_TOKEN)) {
    throw "Set FLOW_PUBLISH_TOKEN before publishing; it must match the server value."
}

$publisherRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$scriptPath = Join-Path $publisherRoot "preprocess_flowfield.py"
$packagePath = Join-Path $publisherRoot "sample-package"

& $Python $scriptPath validate --package $packagePath
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

& $Python $scriptPath publish --package $packagePath --server $Server --workers 4 --retries 5
exit $LASTEXITCODE
