$ErrorActionPreference = 'Stop'
$sdkRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $sdkRoot
$sdkUrl = 'http://127.0.0.1:5185/examples/vanilla/'
try {
    $sdkResponse = Invoke-WebRequest -Uri $sdkUrl -UseBasicParsing -TimeoutSec 2
    if ($sdkResponse.StatusCode -eq 200 -and $sdkResponse.Content -like '*SDK*') {
        Start-Process $sdkUrl
        exit 0
    }
} catch {}
if (-not (Test-Path -LiteralPath (Join-Path $sdkRoot 'node_modules/esbuild'))) {
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
}
if (-not (Test-Path -LiteralPath (Join-Path $sdkRoot 'local-assets/data/5min/package.json'))) { throw 'Missing local-assets: see README.md' }
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'SDK build failed' }
$sdkNode = (Get-Command node.exe).Source
$sdkProcess = Start-Process -FilePath $sdkNode -ArgumentList 'scripts/serve-demo.mjs' -WorkingDirectory $sdkRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $sdkRoot 'demo-server.log') -RedirectStandardError (Join-Path $sdkRoot 'demo-server-error.log')
for ($sdkAttempt = 0; $sdkAttempt -lt 30; $sdkAttempt++) {
    if ($sdkProcess.HasExited) { throw 'SDK server exited; see demo-server-error.log' }
    try { $sdkReady = Invoke-WebRequest -Uri $sdkUrl -UseBasicParsing -TimeoutSec 1; if ($sdkReady.StatusCode -eq 200) { Start-Process $sdkUrl; exit 0 } } catch {}
    Start-Sleep -Milliseconds 300
}
throw 'SDK example did not start; see server logs'
