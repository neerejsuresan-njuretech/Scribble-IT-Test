param(
  [switch]$VerifyInstall = $false,
  [switch]$IncludeMsi = $true
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ReleaseDir = Join-Path $RepoRoot 'release\windows'
$LogsDir = Join-Path $ReleaseDir 'logs'
New-Item -ItemType Directory -Force -Path $ReleaseDir | Out-Null
New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null

$TauriConf = Get-Content (Join-Path $RepoRoot 'src-tauri\tauri.conf.json') -Raw | ConvertFrom-Json
$ProductName = $TauriConf.productName
$AppVersion = $TauriConf.version
$AppId = $TauriConf.identifier

Write-Host "=== SCRIBBLE-IT Windows Production Build ($ProductName v$AppVersion / $AppId) ==="

# 1. Verify Windows build toolchain
foreach ($tool in @('node', 'npm', 'rustc', 'cargo')) {
  $cmd = Get-Command $tool -ErrorAction SilentlyContinue
  if (-not $cmd) {
    throw "Required toolchain command '$tool' was not found on PATH."
  }
}

$EnvSummary = @(
  "Product: $ProductName"
  "App ID: $AppId"
  "Version: $AppVersion"
  "Build Date (UTC): $((Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))"
  "OS: $([System.Environment]::OSVersion.VersionString)"
  "Node.js: $(node --version)"
  "npm: $(npm --version)"
  "rustc: $(rustc --version)"
  "cargo: $(cargo --version)"
  "Signing Status: Unsigned (certificateThumbprint is null)"
)
$EnvSummary | Out-File -FilePath (Join-Path $LogsDir 'environment.log') -Encoding utf8

# 2. Run workspace typechecks, lint, unit tests, and brand checks
Push-Location $RepoRoot
try {
  Write-Host "[1/5] Running TypeScript & brand verification..."
  npm run typecheck:packages 2>&1 | Tee-Object -FilePath (Join-Path $LogsDir 'typecheck-packages.log')
  if ($LASTEXITCODE -ne 0) { throw "typecheck:packages failed." }

  npm run lint 2>&1 | Tee-Object -FilePath (Join-Path $LogsDir 'frontend-lint.log')
  if ($LASTEXITCODE -ne 0) { throw "npm run lint failed." }

  npm run test:frontend 2>&1 | Tee-Object -FilePath (Join-Path $LogsDir 'frontend-tests.log')
  if ($LASTEXITCODE -ne 0) { throw "npm run test:frontend failed." }

  npm run verify:brand 2>&1 | Tee-Object -FilePath (Join-Path $LogsDir 'brand-verify.log')
  if ($LASTEXITCODE -ne 0) { throw "npm run verify:brand failed." }

  Write-Host "[2/5] Running Rust unit tests..."
  cargo test --manifest-path src-tauri/Cargo.toml 2>&1 | Tee-Object -FilePath (Join-Path $LogsDir 'cargo-test.log')
  if ($LASTEXITCODE -ne 0) { throw "cargo test failed." }

  Write-Host "[3/5] Building production frontend & Tauri Windows installer..."
  if (-not $env:VITE_BASE_PATH) { $env:VITE_BASE_PATH = './' }

  if ($IncludeMsi) {
    npm run tauri:build:windows 2>&1 | Tee-Object -FilePath (Join-Path $LogsDir 'tauri-build.log')
  } else {
    npx tauri build --bundles nsis 2>&1 | Tee-Object -FilePath (Join-Path $LogsDir 'tauri-build.log')
  }
  if ($LASTEXITCODE -ne 0) { throw "Tauri Windows build failed." }

  Write-Host "[4/5] Validating and staging Windows release outputs..."
  $BundleRoot = Join-Path $RepoRoot 'src-tauri\target\release\bundle'
  $ExeArtifacts = @(Get-ChildItem -Path (Join-Path $BundleRoot 'nsis') -Filter '*.exe' -File -ErrorAction SilentlyContinue)
  if (-not $ExeArtifacts -or $ExeArtifacts.Count -eq 0) {
    throw "NSIS .exe installer was NOT generated under $BundleRoot\nsis"
  }

  $PrimaryExe = $ExeArtifacts[0]
  if ($PrimaryExe.Length -le 0) {
    throw "Generated NSIS installer '$($PrimaryExe.Name)' is empty (0 bytes)."
  }

  $StagedExe = Join-Path $ReleaseDir $PrimaryExe.Name
  Copy-Item -Path $PrimaryExe.FullName -Destination $StagedExe -Force

  $StagedFiles = @($StagedExe)
  if ($IncludeMsi) {
    $MsiArtifacts = @(Get-ChildItem -Path (Join-Path $BundleRoot 'msi') -Filter '*.msi' -File -ErrorAction SilentlyContinue)
    foreach ($msi in $MsiArtifacts) {
      if ($msi.Length -gt 0) {
        $StagedMsi = Join-Path $ReleaseDir $msi.Name
        Copy-Item -Path $msi.FullName -Destination $StagedMsi -Force
        $StagedFiles += $StagedMsi
      }
    }
  }

  $ShaLines = @()
  foreach ($filePath in $StagedFiles) {
    $item = Get-Item $filePath
    $hash = (Get-FileHash -Path $item.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    $line = "$hash  $($item.Name)"
    $ShaLines += $line
    $line | Out-File -FilePath "$($item.FullName).sha256" -Encoding utf8
  }
  $ShaLines | Out-File -FilePath (Join-Path $ReleaseDir 'SHA256SUMS.txt') -Encoding utf8

  Copy-Item -Path (Join-Path $RepoRoot 'docs\releases\windows-v1.0.0-release-notes.md') -Destination (Join-Path $ReleaseDir 'windows-v1.0.0-release-notes.md') -Force
  Copy-Item -Path (Join-Path $RepoRoot 'docs\desktop\windows-installation-guide.md') -Destination (Join-Path $ReleaseDir 'windows-installation-guide.md') -Force

  $PrimarySha = (Get-FileHash -Path $StagedExe -Algorithm SHA256).Hash.ToLowerInvariant()
  $BuildInfo = $EnvSummary + @(
    "Primary Installer: $($PrimaryExe.Name)"
    "Installer Size (bytes): $((Get-Item $StagedExe).Length)"
    "Primary SHA-256: $PrimarySha"
  )
  $BuildInfo | Out-File -FilePath (Join-Path $ReleaseDir 'BUILD_INFO.txt') -Encoding utf8

  if ($VerifyInstall) {
    Write-Host "[5/5] Running automated Windows installer & uninstall verification..."
    $VerifyReport = @()
    $VerifyReport += "Automated Windows Installer Verification ($(Get-Date -Format 'u'))"
    $VerifyReport += "Installer Tested: $($PrimaryExe.Name) ($((Get-Item $StagedExe).Length) bytes)"

    $Wv2Reg = Get-ItemProperty -Path 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}' -ErrorAction SilentlyContinue
    if ($Wv2Reg -and $Wv2Reg.pv) {
      $VerifyReport += "[PASS] WebView2 Runtime detected: $($Wv2Reg.pv)"
    } else {
      $VerifyReport += "[INFO] WebView2 registry key not pre-detected under HKLM WOW6432Node."
    }

    $InstallProc = Start-Process -FilePath $StagedExe -ArgumentList '/S' -Wait -PassThru
    if ($InstallProc.ExitCode -ne 0) {
      throw "Silent NSIS installer failed with exit code $($InstallProc.ExitCode)"
    }
    $VerifyReport += "[PASS] Silent NSIS install (/S) completed with exit code 0."

    $InstallDir = Join-Path $env:LOCALAPPDATA $ProductName
    $AppBinary = Join-Path $InstallDir "$ProductName.exe"
    $Uninstaller = Join-Path $InstallDir 'uninstall.exe'

    if (-not (Test-Path $AppBinary)) {
      throw "Installed application binary missing at $AppBinary"
    }
    $VerifyReport += "[PASS] Installed binary verified: $AppBinary ($((Get-Item $AppBinary).Length) bytes)"

    $UninstallEntry = Get-ChildItem -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall' -ErrorAction SilentlyContinue |
      Get-ItemProperty |
      Where-Object { $_.DisplayName -like "*$ProductName*" }
    if ($UninstallEntry) {
      $VerifyReport += "[PASS] Registered in Installed Apps (HKCU Uninstall): $($UninstallEntry.DisplayName) v$($UninstallEntry.DisplayVersion)"
    } else {
      throw "Application did not register in HKCU Uninstall registry."
    }

    $StartMenuLnk = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\$ProductName.lnk"
    if (Test-Path $StartMenuLnk) {
      $VerifyReport += "[PASS] Start Menu shortcut verified: $StartMenuLnk"
    } else {
      $VerifyReport += "[WARN] Start Menu shortcut not found at default path $StartMenuLnk"
    }

    $Launched = Start-Process -FilePath $AppBinary -PassThru
    Start-Sleep -Seconds 4
    if (-not $Launched.HasExited) {
      $VerifyReport += "[PASS] Application launched and remained running cleanly (PID $($Launched.Id))."
      Stop-Process -Id $Launched.Id -Force
    } elseif ($Launched.ExitCode -eq 0) {
      $VerifyReport += "[INFO] Application exited cleanly with code 0 during headless launch."
    } else {
      throw "Installed binary exited unexpectedly with code $($Launched.ExitCode)"
    }

    if (Test-Path $Uninstaller) {
      $UninstProc = Start-Process -FilePath $Uninstaller -ArgumentList '/S' -Wait -PassThru
      Start-Sleep -Seconds 2
      if ($UninstProc.ExitCode -ne 0) {
        throw "Silent uninstallation failed with exit code $($UninstProc.ExitCode)"
      }
      if (Test-Path $AppBinary) {
        throw "Application binary still present after uninstall: $AppBinary"
      }
      $VerifyReport += "[PASS] Silent uninstallation (/S) removed application cleanly."
    } else {
      throw "Uninstaller not found at $Uninstaller"
    }

    $VerifyReport += "[NOT EXECUTED IN HEADLESS CI] Interactive login/logout, Windows Credential Manager manual inspection, desktop toast visual render, and file dialog UI checks require an interactive Windows desktop session."
    $VerifyReport | Out-File -FilePath (Join-Path $ReleaseDir 'installation-verification.txt') -Encoding utf8
  } else {
    Write-Host "[5/5] Skipping -VerifyInstall (pass -VerifyInstall to test NSIS install/launch/uninstall)."
  }

  Write-Host "Build and staging completed cleanly in $ReleaseDir"
} finally {
  Pop-Location
}
