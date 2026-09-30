param(
    [string]$RepoRoot = (Get-Location).Path,
    [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA "AIArticleStudio"),
    [string]$ExpectedGitRef = "origin/main",
    [string]$TermsUrl = $env:NEXT_PUBLIC_AAS_TERMS_URL,
    [string]$PrivacyUrl = $env:NEXT_PUBLIC_AAS_PRIVACY_URL,
    [string]$AiTermsUrl = $env:NEXT_PUBLIC_AAS_AI_TERMS_URL
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Get-JsonPropertyValue {
    param(
        [Parameter(Mandatory = $true)] [object]$Object,
        [Parameter(Mandatory = $true)] [string[]]$Names
    )

    foreach ($name in $Names) {
        $property = $Object.PSObject.Properties[$name]
        if ($null -ne $property) {
            $value = [string]$property.Value
            if (-not [string]::IsNullOrWhiteSpace($value)) {
                return $value
            }
        }
    }
    return $null
}

function Assert-HttpsUrl([string]$Name, [string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "$Name is required"
    }
    $uri = $null
    if (-not [System.Uri]::TryCreate($Value, [System.UriKind]::Absolute, [ref]$uri)) {
        throw "$Name is not a valid absolute URL"
    }
    if ($uri.Scheme -ne "https") {
        throw "$Name must use HTTPS"
    }
}

function Assert-PublicLegalLink([string]$Name, [string]$Value, [string]$PwaRoot) {
    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "$Name is required for production preflight"
    }

    if ($Value.StartsWith("/")) {
        $routes = @{
            "/terms" = "app\terms\page.tsx"
            "/privacy" = "app\privacy\page.tsx"
            "/ai-terms" = "app\ai-terms\page.tsx"
        }
        if (-not $routes.ContainsKey($Value)) {
            throw "$Name uses an unsupported first-party legal route"
        }
        $routeFile = Join-Path $PwaRoot $routes[$Value]
        if (-not (Test-Path -LiteralPath $routeFile -PathType Leaf)) {
            throw "$Name points to a missing first-party legal route"
        }
        return
    }

    Assert-HttpsUrl $Name $Value
}

function Invoke-NpmStep([string]$Label, [string[]]$Arguments) {
    Write-Host "=== $Label ===" -ForegroundColor Yellow
    & npm @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed"
    }
    Write-Host "PASS $Label" -ForegroundColor Green
}

$RepoRoot = [System.IO.Path]::GetFullPath($RepoRoot)
$PwaRoot = Join-Path $RepoRoot "pwa"
$AuthConfig = Join-Path $InstallRoot "config\auth.json"
$ReportPath = Join-Path $env:USERPROFILE "Downloads\AIArticleStudio-PWA-Production-Preflight.json"

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " AAS PWA Production Preflight"
Write-Host "==================================================" -ForegroundColor Cyan

if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot ".git"))) {
    throw "RepoRoot is not a Git repository or worktree"
}
if (-not (Test-Path -LiteralPath $PwaRoot -PathType Container)) {
    throw "pwa directory not found"
}
if (-not (Test-Path -LiteralPath $AuthConfig -PathType Leaf)) {
    throw "Installed auth.json not found"
}

Set-Location $RepoRoot
$status = @(git status --porcelain)
if ($status.Count -ne 0) {
    $status
    throw "Repository worktree is not clean"
}

git fetch origin --prune
if ($LASTEXITCODE -ne 0) { throw "git fetch failed" }
$localHead = (git rev-parse HEAD).Trim()
$expectedHead = (git rev-parse $ExpectedGitRef).Trim()
Write-Host "Local HEAD   = $localHead"
Write-Host "Expected ref = $ExpectedGitRef"
Write-Host "Expected HEAD= $expectedHead"
if ($localHead -ne $expectedHead) {
    throw "Local repository does not match $ExpectedGitRef"
}
Write-Host "PASS source baseline" -ForegroundColor Green

$nodeVersionRaw = (& node --version).Trim().TrimStart('v')
$nodeVersion = [version]$nodeVersionRaw
if ($nodeVersion -lt [version]"22.13.0") {
    throw "Node.js 22.13.0 or newer is required"
}
Write-Host "PASS Node.js $nodeVersionRaw" -ForegroundColor Green

$jsonText = Get-Content -LiteralPath $AuthConfig -Raw -Encoding UTF8
if ($jsonText -match '(?i)service[_-]?role|sb_secret_') {
    throw "Forbidden secret material detected in auth.json"
}
$auth = $jsonText | ConvertFrom-Json

$supabaseUrl = Get-JsonPropertyValue $auth @("supabase_url", "url", "SUPABASE_URL")
$publishableKey = Get-JsonPropertyValue $auth @(
    "supabase_publishable_key",
    "publishable_key",
    "supabase_anon_key",
    "anon_key",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY"
)

if ([string]::IsNullOrWhiteSpace($supabaseUrl)) {
    throw "Public Supabase URL was not found in installed auth.json"
}
if ([string]::IsNullOrWhiteSpace($publishableKey)) {
    throw "Publishable/anon Supabase key was not found in installed auth.json"
}
if ($publishableKey -match '^(?i)sb_secret_' -or $publishableKey -match '(?i)service[_-]?role') {
    throw "Refusing to use a secret/service-role key"
}
Assert-HttpsUrl "Supabase public URL" $supabaseUrl

if ([string]::IsNullOrWhiteSpace($TermsUrl)) {
    $TermsUrl = Get-JsonPropertyValue $auth @("terms_url", "TERMS_URL")
}
if ([string]::IsNullOrWhiteSpace($PrivacyUrl)) {
    $PrivacyUrl = Get-JsonPropertyValue $auth @("privacy_url", "PRIVACY_URL")
}
if ([string]::IsNullOrWhiteSpace($AiTermsUrl)) {
    $AiTermsUrl = Get-JsonPropertyValue $auth @("ai_terms_url", "AI_TERMS_URL")
}
if ([string]::IsNullOrWhiteSpace($TermsUrl)) { $TermsUrl = "/terms" }
if ([string]::IsNullOrWhiteSpace($PrivacyUrl)) { $PrivacyUrl = "/privacy" }
if ([string]::IsNullOrWhiteSpace($AiTermsUrl)) { $AiTermsUrl = "/ai-terms" }

Assert-PublicLegalLink "NEXT_PUBLIC_AAS_TERMS_URL" $TermsUrl $PwaRoot
Assert-PublicLegalLink "NEXT_PUBLIC_AAS_PRIVACY_URL" $PrivacyUrl $PwaRoot
Assert-PublicLegalLink "NEXT_PUBLIC_AAS_AI_TERMS_URL" $AiTermsUrl $PwaRoot

$swPath = Join-Path $PwaRoot "public\sw.js"
$manifestPath = Join-Path $PwaRoot "public\manifest.webmanifest"
$icon192 = Join-Path $PwaRoot "public\icon-192.png"
$icon512 = Join-Path $PwaRoot "public\icon-512.png"
foreach ($required in @($swPath, $manifestPath, $icon192, $icon512)) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
        throw "Required PWA asset missing: $required"
    }
}

$sw = Get-Content -LiteralPath $swPath -Raw -Encoding UTF8
foreach ($guard in @('/auth/callback','/api/','access_token','refresh_token')) {
    if (-not $sw.Contains($guard)) {
        throw "Service worker auth/cache guard missing: $guard"
    }
}
if (-not $sw.Contains('aas-pwa-phase56-runtime-v12-axia-generated')) {
    throw "Production service-worker cache generation is not current"
}
foreach ($staleGeneration in @('aas-pwa-phase17-prod-v2','aas-pwa-phase8-v1')) {
    if ($sw.Contains($staleGeneration)) {
        throw "Stale production service-worker cache generation remains: $staleGeneration"
    }
}
Write-Host "PASS PWA manifest/icons/service-worker guards" -ForegroundColor Green

$oldEnv = @{
    NEXT_PUBLIC_AAS_SUPABASE_URL = $env:NEXT_PUBLIC_AAS_SUPABASE_URL
    NEXT_PUBLIC_AAS_SUPABASE_PUBLISHABLE_KEY = $env:NEXT_PUBLIC_AAS_SUPABASE_PUBLISHABLE_KEY
    NEXT_PUBLIC_AAS_TERMS_URL = $env:NEXT_PUBLIC_AAS_TERMS_URL
    NEXT_PUBLIC_AAS_PRIVACY_URL = $env:NEXT_PUBLIC_AAS_PRIVACY_URL
    NEXT_PUBLIC_AAS_AI_TERMS_URL = $env:NEXT_PUBLIC_AAS_AI_TERMS_URL
    NEXT_PUBLIC_AAS_RELEASE_AUDIENCE = $env:NEXT_PUBLIC_AAS_RELEASE_AUDIENCE
}

try {
    $env:NEXT_PUBLIC_AAS_SUPABASE_URL = $supabaseUrl.TrimEnd('/')
    $env:NEXT_PUBLIC_AAS_SUPABASE_PUBLISHABLE_KEY = $publishableKey
    $env:NEXT_PUBLIC_AAS_TERMS_URL = $TermsUrl
    $env:NEXT_PUBLIC_AAS_PRIVACY_URL = $PrivacyUrl
    $env:NEXT_PUBLIC_AAS_AI_TERMS_URL = $AiTermsUrl
    $env:NEXT_PUBLIC_AAS_RELEASE_AUDIENCE = "public"

    Set-Location $PwaRoot
    Invoke-NpmStep "npm ci" @("ci", "--ignore-scripts", "--no-audit", "--no-fund")
    Invoke-NpmStep "typecheck" @("run", "typecheck")
    Invoke-NpmStep "lint" @("run", "lint")
    Invoke-NpmStep "test/build regression" @("test")
    Invoke-NpmStep "npm audit" @("audit", "--audit-level=high")
}
finally {
    foreach ($name in $oldEnv.Keys) {
        [Environment]::SetEnvironmentVariable($name, $oldEnv[$name], "Process")
    }
}

$report = [ordered]@{
    generated_at = [DateTimeOffset]::UtcNow.ToString("o")
    repo_head = $localHead
    expected_git_ref = $ExpectedGitRef
    expected_head = $expectedHead
    node_version = $nodeVersionRaw
    supabase_public_config_present = $true
    secret_key_rejected = $true
    legal_links_valid = $true
    terms_link = $TermsUrl
    privacy_link = $PrivacyUrl
    ai_terms_link = $AiTermsUrl
    pwa_assets_present = $true
    service_worker_auth_guards_present = $true
    service_worker_cache_generation = "phase56-runtime-v12-axia-generated"
    npm_ci = "pass"
    typecheck = "pass"
    lint = "pass"
    regression_build = "pass"
    npm_audit = "pass"
    deploy_performed = $false
    result = "PASS"
}

$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $ReportPath -Encoding UTF8
Write-Host ""
Write-Host "Report = $ReportPath"
Write-Host "No secret values were written to the report."
Write-Host "No deployment was performed."
Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host " PWA PRODUCTION PREFLIGHT: PASS"
Write-Host "==================================================" -ForegroundColor Green
