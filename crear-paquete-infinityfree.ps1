$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendRoot = Join-Path $projectRoot 'frontend'
$distRoot = Join-Path $frontendRoot 'dist'
$backendRoot = Join-Path $projectRoot 'backend'
$zipPath = Join-Path (Split-Path -Parent $projectRoot) 'sistema-facturas-infinityfree.zip'
$stageRoot = Join-Path $env:TEMP ('sistema-facturas-release-' + [guid]::NewGuid().ToString('N'))

foreach ($requiredPath in @(
    (Join-Path $projectRoot '.htaccess'),
    (Join-Path $projectRoot 'index.php'),
    (Join-Path $projectRoot 'facturas.php'),
    (Join-Path $backendRoot 'api.php'),
    (Join-Path $distRoot 'index.html')
)) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
        throw "Falta un archivo necesario para el paquete: $requiredPath"
    }
}

$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) {
    throw 'No se encontró npm. Instala Node.js o compila frontend/dist antes de generar el ZIP.'
}

Push-Location $frontendRoot
try {
    & $npm.Source run build
    if ($LASTEXITCODE -ne 0) {
        throw "Falló la compilación del frontend (código $LASTEXITCODE)."
    }
} finally {
    Pop-Location
}

try {
    New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null
    foreach ($fileName in @('.htaccess', 'index.php', 'facturas.php')) {
        Copy-Item -LiteralPath (Join-Path $projectRoot $fileName) -Destination $stageRoot
    }

    $stageBackend = Join-Path $stageRoot 'backend'
    New-Item -ItemType Directory -Path $stageBackend -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $backendRoot 'api.php') -Destination $stageBackend
    foreach ($directoryName in @('config', 'controllers', 'core')) {
        Copy-Item -LiteralPath (Join-Path $backendRoot $directoryName) -Destination $stageBackend -Recurse
    }

    $stageUploads = Join-Path $stageBackend 'uploads'
    New-Item -ItemType Directory -Path $stageUploads -Force | Out-Null
    $uploadsRules = Join-Path (Join-Path $backendRoot 'uploads') '.htaccess'
    if (Test-Path -LiteralPath $uploadsRules -PathType Leaf) {
        Copy-Item -LiteralPath $uploadsRules -Destination $stageUploads
    }

    $stageFrontend = Join-Path $stageRoot 'frontend'
    New-Item -ItemType Directory -Path $stageFrontend -Force | Out-Null
    Copy-Item -LiteralPath $distRoot -Destination $stageFrontend -Recurse

    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    if (Test-Path -LiteralPath $zipPath) {
        Remove-Item -LiteralPath $zipPath -Force
    }
    $fileStream = [System.IO.File]::Open(
        $zipPath,
        [System.IO.FileMode]::CreateNew,
        [System.IO.FileAccess]::ReadWrite
    )
    $archive = [System.IO.Compression.ZipArchive]::new(
        $fileStream,
        [System.IO.Compression.ZipArchiveMode]::Create,
        $false
    )
    try {
        Get-ChildItem -LiteralPath $stageRoot -Recurse -File | ForEach-Object {
            $relativePath = $_.FullName.Substring($stageRoot.Length).
                TrimStart([char[]]@([char]92, [char]47)).
                Replace([char]92, [char]47)
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $archive,
                $_.FullName,
                $relativePath,
                [System.IO.Compression.CompressionLevel]::Optimal
            ) | Out-Null
        }
    } finally {
        $archive.Dispose()
    }

    $archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
    try {
        $entries = @($archive.Entries)
        $forbiddenEntries = @($entries | Where-Object {
            $_.FullName -match '(^|/)(node_modules|\.git|FacturasPortable_Entrega|portable)(/|$)' -or
            $_.FullName -match '(^|/)uploads/(?!\.htaccess$)[^/]+$' -or
            $_.FullName -match '\.(sql|zip|pdf|pem|key)$' -or
            $_.FullName -match '(^|/)\.env(\.|$)'
        })
        if ($forbiddenEntries.Count -gt 0) {
            throw "El paquete contiene archivos que no deben publicarse: $($forbiddenEntries.FullName -join ', ')"
        }
        if (-not ($entries | Where-Object { $_.FullName -eq '.htaccess' })) {
            throw 'El ZIP no contiene .htaccess; se canceló para no publicar sin sus reglas.'
        }
    } finally {
        $archive.Dispose()
    }

    $zipInfo = Get-Item -LiteralPath $zipPath
    Write-Output "Paquete generado: $zipPath"
    Write-Output ("Tamaño: {0:N2} MB" -f ($zipInfo.Length / 1MB))
    Write-Output "Archivos incluidos: $($entries.Count)"
    Write-Output 'Se excluyeron dependencias, bases SQL, respaldos, ZIP anteriores, PDFs cargados y carpetas portables.'
} finally {
    if (Test-Path -LiteralPath $stageRoot) {
        Remove-Item -LiteralPath $stageRoot -Recurse -Force
    }
}
