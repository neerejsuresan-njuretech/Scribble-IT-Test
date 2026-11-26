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
$ProductName = [string]$TauriConf.productName
$MainBinaryName = if ($TauriConf.PSObject.Properties['mainBinaryName'] -and $TauriConf.mainBinaryName) {
  [string]$TauriConf.mainBinaryName
} else {
  $ProductName
}
$ExpectedExeName = "$MainBinaryName.exe"
$Publisher = [string]$TauriConf.bundle.publisher
$AppVersion = [string]$TauriConf.version
$AppId = [string]$TauriConf.identifier

Write-Host "=== SCRIBBLE-IT Windows Production Build ($ProductName v$AppVersion / $AppId) ==="

function Get-ScribbleUninstallEntries {
  $roots = @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'
  )
  $matches = @()
  foreach ($root in $roots) {
    if (-not (Test-Path $root)) { continue }
    foreach ($key in (Get-ChildItem -Path $root -ErrorAction SilentlyContinue)) {
      $props = Get-ItemProperty -Path $key.PSPath -ErrorAction SilentlyContinue
      if (-not $props) { continue }
      $displayName = if ($props.PSObject.Properties['DisplayName']) { [string]$props.DisplayName } else { '' }
      $pub = if ($props.PSObject.Properties['Publisher']) { [string]$props.Publisher } else { '' }
      $isMatch = ($displayName -like "*$ProductName*") -or
                 ($displayName -like "*Scribble-IT*") -or
                 (($pub -eq $Publisher) -and ($displayName -like "*Scribble*"))
      if ($isMatch) {
        $matches += [PSCustomObject]@{
          RegistryPath         = $key.PSPath
          Hive                 = ($root -split ':')[0]
          KeyName              = $key.PSChildName
          DisplayName          = $displayName
          DisplayVersion       = if ($props.PSObject.Properties['DisplayVersion']) { [string]$props.DisplayVersion } else { '' }
          Publisher            = $pub
          InstallLocation      = if ($props.PSObject.Properties['InstallLocation']) { [string]$props.InstallLocation } else { '' }
          DisplayIcon          = if ($props.PSObject.Properties['DisplayIcon']) { [string]$props.DisplayIcon } else { '' }
          UninstallString      = if ($props.PSObject.Properties['UninstallString']) { [string]$props.UninstallString } else { '' }
          QuietUninstallString = if ($props.PSObject.Properties['QuietUninstallString']) { [string]$props.QuietUninstallString } else { '' }
        }
      }
    }
  }
  return $matches
}

function Resolve-ExePathFromCommandString {
  param([string]$RawValue)
  if ([string]::IsNullOrWhiteSpace($RawValue)) { return $null }
  $trimmed = $RawValue.Trim()
  if ($trimmed -match '^"([^"]+?\.exe)"') {
    return $Matches[1]
  }
  $beforeComma = ($trimmed -split ',')[0].Trim()
  if ($beforeComma -match '^([^\s"]+?\.exe)\b') {
    return $Matches[1]
  }
  if ($beforeComma -match '\.exe$' -and (Test-Path $beforeComma)) {
    return $beforeComma
  }
  return $null
}

function Resolve-InstalledBinary {
  param(
    [object[]]$UninstallEntries,
    [string[]]$CandidateDirs
  )

  $searchDirs = New-Object System.Collections.Generic.List[string]
  foreach ($entry in $UninstallEntries) {
    if (-not [string]::IsNullOrWhiteSpace($entry.InstallLocation)) {
      $cleanDir = $entry.InstallLocation.Trim().Trim('"').TrimEnd('\')
      if ($cleanDir -and -not $searchDirs.Contains($cleanDir)) {
        $searchDirs.Add($cleanDir)
      }
    }
    $iconExe = Resolve-ExePathFromCommandString -RawValue $entry.DisplayIcon
    if ($iconExe) {
      if ((Test-Path $iconExe) -and ([System.IO.Path]::GetFileName($iconExe) -notmatch '^unins')) {
        return [PSCustomObject]@{
          InstallDir = Split-Path -Path $iconExe -Parent
          AppBinary  = $iconExe
        }
      }
      $iconParent = Split-Path -Path $iconExe -Parent
      if ($iconParent -and -not $searchDirs.Contains($iconParent)) {
        $searchDirs.Add($iconParent)
      }
    }
    $uninstExe = Resolve-ExePathFromCommandString -RawValue $entry.UninstallString
    if ($uninstExe) {
      $uninstParent = Split-Path -Path $uninstExe -Parent
      if ($uninstParent -and ($uninstParent -notmatch '\\System32$') -and -not $searchDirs.Contains($uninstParent)) {
        $searchDirs.Add($uninstParent)
      }
    }
  }

  foreach ($dir in $CandidateDirs) {
    if ($dir -and -not $searchDirs.Contains($dir)) {
      $searchDirs.Add($dir)
    }
  }

  $preferredExeNames = @(
    $ExpectedExeName,
    "$ProductName.exe",
    'scribble-it-desktop.exe'
  ) | Select-Object -Unique

  foreach ($dir in $searchDirs) {
    if (-not (Test-Path $dir)) { continue }
    foreach ($exeName in $preferredExeNames) {
      $candidate = Join-Path $dir $exeName
      if (Test-Path $candidate) {
        return [PSCustomObject]@{
          InstallDir = $dir
          AppBinary  = $candidate
        }
      }
    }
    $anyExe = @(Get-ChildItem -Path $dir -Filter '*.exe' -File -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -notmatch '^(unins|uninstall)' })
    if ($anyExe.Count -gt 0) {
      return [PSCustomObject]@{
        InstallDir = $dir
        AppBinary  = $anyExe[0].FullName
      }
    }
  }

  $diag = @("Searched directories: $($searchDirs -join '; ')")
  foreach ($dir in $searchDirs) {
    if (Test-Path $dir) {
      $items = @(Get-ChildItem -Path $dir -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name)
      $diag += "Contents of ${dir}: $($items -join ', ')"
    }
  }
  throw "Installed application binary missing. $($diag -join ' | ')"
}

function Find-StartMenuShortcut {
  $roots = @(
    (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'),
    (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs')
  )
  foreach ($root in $roots) {
    if (-not (Test-Path $root)) { continue }
    $found = @(Get-ChildItem -Path $root -Recurse -Filter '*.lnk' -File -ErrorAction SilentlyContinue |
      Where-Object { $_.BaseName -like "*$ProductName*" -or $_.BaseName -like "*Scribble*" })
    if ($found.Count -gt 0) {
      return $found[0].FullName
    }
  }
  return $null
}

function Invoke-AppLaunchSmokeTest {
  param([string]$AppBinary)

  $binaryInfo = Get-Item $AppBinary
  if ($binaryInfo.Length -le 0) {
    throw "Installed binary at $AppBinary is empty (0 bytes)."
  }
  $ver = $binaryInfo.VersionInfo
  $verSummary = "Size=$($binaryInfo.Length) bytes, Product='$($ver.ProductName)', FileVersion='$($ver.FileVersion)'"

  $procName = [System.IO.Path]::GetFileNameWithoutExtension($AppBinary)
  $launched = Start-Process -FilePath $AppBinary -PassThru
  Start-Sleep -Seconds 4
  if (-not $launched.HasExited) {
    Stop-Process -Id $launched.Id -Force -ErrorAction SilentlyContinue
    Get-Process -Name $procName -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    $launched.WaitForExit(5000) | Out-Null
    return "[PASS] Application launched and stayed running cleanly (PID $($launched.Id)); stopped cleanly. ($verSummary)"
  }
  if ($launched.ExitCode -eq 0) {
    return "[INFO] Application exited cleanly with code 0 during headless launch. ($verSummary)"
  }
  throw "Installed binary exited unexpectedly with exit code $($launched.ExitCode). ($verSummary)"
}

function Wait-UntilCondition {
  param(
    [scriptblock]$Condition,
    [int]$TimeoutSeconds = 15
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $result = & $Condition
    if ($result) { return $result }
    Start-Sleep -Milliseconds 500
  }
  return (& $Condition)
}

# 1. Verify Windows build toolchain
foreach ($tool in @('node', 'npm', 'rustc', 'cargo')) {
  $cmd = Get-Command $tool -ErrorAction SilentlyContinue
  if (-not $cmd) {
    throw "Required toolchain command '$tool' was not found on PATH."
  }
}

$Wv2Reg = Get-ItemProperty -Path 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}' -ErrorAction SilentlyContinue
$Wv2Version = if ($Wv2Reg -and $Wv2Reg.pv) { [string]$Wv2Reg.pv } else { 'Not detected under HKLM WOW6432Node' }

$EnvSummary = @(
  "Product: $ProductName"
  "Main Binary: $ExpectedExeName"
  "App ID: $AppId"
  "Version: $AppVersion"
  "Build Date (UTC): $((Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))"
  "OS: $([System.Environment]::OSVersion.VersionString)"
  "Node.js: $(node --version)"
  "npm: $(npm --version)"
  "rustc: $(rustc --version)"
  "cargo: $(cargo --version)"
  "WebView2 Runtime: $Wv2Version"
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

  Write-Host "[3/5] Building production frontend & Tauri Windows installers..."
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
  $StagedMsi = $null
  if ($IncludeMsi) {
    $MsiArtifacts = @(Get-ChildItem -Path (Join-Path $BundleRoot 'msi') -Filter '*.msi' -File -ErrorAction SilentlyContinue)
    if (-not $MsiArtifacts -or $MsiArtifacts.Count -eq 0) {
      throw "WiX .msi installer was NOT generated under $BundleRoot\msi"
    }
    foreach ($msi in $MsiArtifacts) {
      if ($msi.Length -le 0) {
        throw "Generated WiX installer '$($msi.Name)' is empty (0 bytes)."
      }
      $destMsi = Join-Path $ReleaseDir $msi.Name
      Copy-Item -Path $msi.FullName -Destination $destMsi -Force
      $StagedFiles += $destMsi
      if (-not $StagedMsi) { $StagedMsi = $destMsi }
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
    "Primary NSIS Installer: $($PrimaryExe.Name)"
    "NSIS Installer Size (bytes): $((Get-Item $StagedExe).Length)"
    "NSIS SHA-256: $PrimarySha"
  )
  if ($StagedMsi) {
    $MsiSha = (Get-FileHash -Path $StagedMsi -Algorithm SHA256).Hash.ToLowerInvariant()
    $BuildInfo += @(
      "Secondary WiX Installer: $(Split-Path -Leaf $StagedMsi)"
      "MSI Installer Size (bytes): $((Get-Item $StagedMsi).Length)"
      "MSI SHA-256: $MsiSha"
    )
  }
  $BuildInfo | Out-File -FilePath (Join-Path $ReleaseDir 'BUILD_INFO.txt') -Encoding utf8

  if ($VerifyInstall) {
    Write-Host "[5/5] Running automated NSIS (.exe) & WiX (.msi) install/launch/uninstall verification..."
    $VerifyReport = @()
    $VerifyReport += "Automated Windows Installer Verification ($(Get-Date -Format 'u'))"
    $VerifyReport += "NSIS Installer: $($PrimaryExe.Name) ($((Get-Item $StagedExe).Length) bytes)"
    if ($StagedMsi) {
      $VerifyReport += "MSI Installer: $(Split-Path -Leaf $StagedMsi) ($((Get-Item $StagedMsi).Length) bytes)"
    }
    $VerifyReport += "[INFO] WebView2 Runtime: $Wv2Version"

    # --- A. NSIS (.exe) Verification ---
    $NsisEntries = @()
    $NsisResolved = $null
    try {
      $VerifyReport += ""
      $VerifyReport += "--- NSIS (.exe) Verification ---"
      $InstallProc = Start-Process -FilePath $StagedExe -ArgumentList '/S' -Wait -PassThru
      if ($InstallProc.ExitCode -ne 0) {
        throw "Silent NSIS installer failed with exit code $($InstallProc.ExitCode)"
      }
      $VerifyReport += "[PASS] Silent NSIS install (/S) completed with exit code 0."

      $NsisEntries = @(Wait-UntilCondition -TimeoutSeconds 15 -Condition {
        $found = @(Get-ScribbleUninstallEntries)
        if ($found.Count -gt 0) { return $found }
        return $null
      })
      if (-not $NsisEntries -or $NsisEntries.Count -eq 0) {
        throw "Application did not register in Windows Uninstall registry after NSIS install."
      }
      $VerifyReport += "[PASS] Registry Uninstall entry verified ($($NsisEntries[0].Hive)): $($NsisEntries[0].DisplayName) v$($NsisEntries[0].DisplayVersion)"

      $NsisCandidates = @(
        (Join-Path $env:LOCALAPPDATA $ProductName),
        (Join-Path $env:LOCALAPPDATA "Programs\$ProductName"),
        (Join-Path $env:ProgramFiles $ProductName)
      )
      $NsisResolved = Wait-UntilCondition -TimeoutSeconds 15 -Condition {
        try {
          return (Resolve-InstalledBinary -UninstallEntries $NsisEntries -CandidateDirs $NsisCandidates)
        } catch {
          return $null
        }
      }
      if (-not $NsisResolved) {
        $NsisResolved = Resolve-InstalledBinary -UninstallEntries $NsisEntries -CandidateDirs $NsisCandidates
      }
      $VerifyReport += "[PASS] NSIS installed binary discovered: $($NsisResolved.AppBinary) ($((Get-Item $NsisResolved.AppBinary).Length) bytes)"

      $StartMenuLnk = Find-StartMenuShortcut
      if ($StartMenuLnk) {
        $VerifyReport += "[PASS] Start Menu shortcut verified: $StartMenuLnk"
      } else {
        $VerifyReport += "[WARN] Start Menu shortcut not found under user/common Programs folders"
      }

      $VerifyReport += Invoke-AppLaunchSmokeTest -AppBinary $NsisResolved.AppBinary
    } finally {
      $procBase = [System.IO.Path]::GetFileNameWithoutExtension($ExpectedExeName)
      Get-Process -Name $procBase -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
      Get-Process -Name 'scribble-it-desktop' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

      $uninstExe = $null
      if ($NsisResolved -and (Test-Path (Join-Path $NsisResolved.InstallDir 'uninstall.exe'))) {
        $uninstExe = Join-Path $NsisResolved.InstallDir 'uninstall.exe'
      } elseif ($NsisEntries -and $NsisEntries.Count -gt 0) {
        $uninstExe = Resolve-ExePathFromCommandString -RawValue $NsisEntries[0].UninstallString
      }
      if ($uninstExe -and (Test-Path $uninstExe)) {
        $UninstProc = Start-Process -FilePath $uninstExe -ArgumentList '/S' -Wait -PassThru
        if ($UninstProc.ExitCode -ne 0) {
          throw "NSIS silent uninstallation failed with exit code $($UninstProc.ExitCode)"
        }
      }
    }

    $BinaryStillPresent = Wait-UntilCondition -TimeoutSeconds 15 -Condition {
      if ($NsisResolved -and -not (Test-Path $NsisResolved.AppBinary) -and (@(Get-ScribbleUninstallEntries).Count -eq 0)) {
        return $true
      }
      return $false
    }
    if (-not $BinaryStillPresent) {
      throw "NSIS uninstall verification failed: binary or uninstall registry entry remained."
    }
    $VerifyReport += "[PASS] NSIS silent uninstallation (/S) removed binary and Uninstall registry entry cleanly."

    # --- B. WiX (.msi) Verification ---
    if ($StagedMsi) {
      $MsiEntries = @()
      $MsiResolved = $null
      $MsiInstallLog = Join-Path $LogsDir 'msi-install.log'
      $MsiUninstallLog = Join-Path $LogsDir 'msi-uninstall.log'
      try {
        $VerifyReport += ""
        $VerifyReport += "--- WiX (.msi) Verification ---"
        $msiArgs = @('/i', "`"$StagedMsi`"", '/qn', '/norestart', '/l*v', "`"$MsiInstallLog`"")
        $MsiProc = Start-Process -FilePath 'msiexec.exe' -ArgumentList $msiArgs -Wait -PassThru
        if ($MsiProc.ExitCode -notin @(0, 3010)) {
          throw "Silent MSI install failed with exit code $($MsiProc.ExitCode). See $MsiInstallLog"
        }
        $VerifyReport += "[PASS] Silent MSI install (msiexec /i /qn) completed with exit code $($MsiProc.ExitCode)."

        $MsiEntries = @(Wait-UntilCondition -TimeoutSeconds 15 -Condition {
          $found = @(Get-ScribbleUninstallEntries)
          if ($found.Count -gt 0) { return $found }
          return $null
        })
        if (-not $MsiEntries -or $MsiEntries.Count -eq 0) {
          throw "Application did not register in Windows Uninstall registry after MSI install."
        }
        $VerifyReport += "[PASS] MSI Uninstall registry entry verified ($($MsiEntries[0].Hive)): $($MsiEntries[0].DisplayName) v$($MsiEntries[0].DisplayVersion) [$($MsiEntries[0].KeyName)]"

        $MsiCandidates = @(
          (Join-Path $env:ProgramFiles $ProductName),
          (Join-Path ${env:ProgramFiles(x86)} $ProductName),
          (Join-Path $env:LOCALAPPDATA $ProductName)
        )
        $MsiResolved = Wait-UntilCondition -TimeoutSeconds 15 -Condition {
          try {
            return (Resolve-InstalledBinary -UninstallEntries $MsiEntries -CandidateDirs $MsiCandidates)
          } catch {
            return $null
          }
        }
        if (-not $MsiResolved) {
          $MsiResolved = Resolve-InstalledBinary -UninstallEntries $MsiEntries -CandidateDirs $MsiCandidates
        }
        $VerifyReport += "[PASS] MSI installed binary discovered: $($MsiResolved.AppBinary) ($((Get-Item $MsiResolved.AppBinary).Length) bytes)"

        $MsiShortcut = Find-StartMenuShortcut
        if ($MsiShortcut) {
          $VerifyReport += "[PASS] MSI Start Menu shortcut verified: $MsiShortcut"
        } else {
          $VerifyReport += "[WARN] MSI Start Menu shortcut not found under user/common Programs folders"
        }

        $VerifyReport += Invoke-AppLaunchSmokeTest -AppBinary $MsiResolved.AppBinary
      } finally {
        $procBase = [System.IO.Path]::GetFileNameWithoutExtension($ExpectedExeName)
        Get-Process -Name $procBase -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        Get-Process -Name 'scribble-it-desktop' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

        $uninstMsiTarget = if ($MsiEntries -and $MsiEntries.Count -gt 0 -and $MsiEntries[0].KeyName -match '^\{[0-9A-Fa-f-]+\}$') {
          $MsiEntries[0].KeyName
        } else {
          "`"$StagedMsi`""
        }
        $msiUninstArgs = @('/x', $uninstMsiTarget, '/qn', '/norestart', '/l*v', "`"$MsiUninstallLog`"")
        $MsiUninstProc = Start-Process -FilePath 'msiexec.exe' -ArgumentList $msiUninstArgs -Wait -PassThru
        if ($MsiUninstProc.ExitCode -notin @(0, 3010)) {
          throw "MSI silent uninstallation failed with exit code $($MsiUninstProc.ExitCode). See $MsiUninstallLog"
        }
      }

      $MsiRemoved = Wait-UntilCondition -TimeoutSeconds 15 -Condition {
        if ($MsiResolved -and -not (Test-Path $MsiResolved.AppBinary) -and (@(Get-ScribbleUninstallEntries).Count -eq 0)) {
          return $true
        }
        return $false
      }
      if (-not $MsiRemoved) {
        throw "MSI uninstall verification failed: binary or uninstall registry entry remained."
      }
      $VerifyReport += "[PASS] MSI silent uninstallation (msiexec /x /qn) removed binary and Uninstall registry entry cleanly."
    }

    $VerifyReport += ""
    $VerifyReport += "[NOT EXECUTED IN HEADLESS CI] Interactive GUI login/logout, Windows Credential Manager manual inspection, desktop toast visual render, and file dialog UI checks require an interactive Windows desktop session."
    $VerifyReport | Out-File -FilePath (Join-Path $ReleaseDir 'installation-verification.txt') -Encoding utf8
  } else {
    Write-Host "[5/5] Skipping -VerifyInstall (pass -VerifyInstall to test NSIS & MSI install/launch/uninstall)."
  }

  Write-Host "Build and staging completed cleanly in $ReleaseDir"
} finally {
  Pop-Location
}
