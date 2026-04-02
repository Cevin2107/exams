$ErrorActionPreference = "Stop"

$envMap = @{}
if (Test-Path ".env.local") {
  Get-Content ".env.local" | ForEach-Object {
    if ($_ -match "^\s*#" -or $_ -match "^\s*$") { return }
    $idx = $_.IndexOf("=")
    if ($idx -gt 0) {
      $k = $_.Substring(0, $idx).Trim()
      $v = $_.Substring($idx + 1).Trim()
      if ($v.StartsWith('"') -and $v.EndsWith('"')) {
        $v = $v.Substring(1, $v.Length - 2)
      }
      $envMap[$k] = $v
    }
  }
}

function Invoke-AiTest {
  param(
    [string]$Name,
    [string]$Url,
    [string]$ApiKey,
    [hashtable]$Payload,
    [int]$TimeoutSec
  )

  if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    return [PSCustomObject]@{
      Name       = $Name
      Status     = "SKIP"
      HttpStatus = "-"
      DurationMs = 0
      Detail     = "missing key"
    }
  }

  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $body = $Payload | ConvertTo-Json -Depth 20
    $resp = Invoke-WebRequest -UseBasicParsing -Uri $Url -Method Post -Headers @{ Authorization = "Bearer $ApiKey" } -ContentType "application/json" -Body $body -TimeoutSec $TimeoutSec
    $sw.Stop()

    return [PSCustomObject]@{
      Name       = $Name
      Status     = "OK"
      HttpStatus = $resp.StatusCode
      DurationMs = $sw.ElapsedMilliseconds
      Detail     = "success"
    }
  }
  catch {
    $sw.Stop()
    $code = "-1"
    if ($_.Exception.Response) {
      try { $code = [int]$_.Exception.Response.StatusCode } catch {}
    }

    $detail = $_.Exception.Message
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
      $detail = $_.ErrorDetails.Message
    }
    if ($detail.Length -gt 240) {
      $detail = $detail.Substring(0, 240)
    }

    return [PSCustomObject]@{
      Name       = $Name
      Status     = "FAIL"
      HttpStatus = $code
      DurationMs = $sw.ElapsedMilliseconds
      Detail     = $detail
    }
  }
}

$extractPrompt = "Trich xuat cau hoi trac nghiem. Chi tra JSON array. Van ban: Cau 1. 2+2=? A.1 B.2 C.3 D.4"
$solvePrompt = "Giai va tra ve JSON index/correct_answer cho 10 cau hoi: " + ((1..10 | ForEach-Object { "Q$($_): 2+2=? A.1 B.2 C.3 D.4" }) -join " ")

$results = @()

$results += Invoke-AiTest -Name "PUTER_ARCEE_EXTRACT" -Url "https://api.puter.com/puterai/openai/v1/chat/completions" -ApiKey $envMap["PUTER_AUTH_TOKEN"] -TimeoutSec 105 -Payload @{
  model = "arcee-ai/trinity-large-preview:free"
  temperature = 0
  max_tokens = 700
  messages = @(
    @{ role = "system"; content = "Chi tra JSON hop le." },
    @{ role = "user"; content = $extractPrompt }
  )
}

$results += Invoke-AiTest -Name "PUTER_QWEN_SOLVE" -Url "https://api.puter.com/puterai/openai/v1/chat/completions" -ApiKey $envMap["PUTER_AUTH_TOKEN"] -TimeoutSec 105 -Payload @{
  model = "qwen/qwen3.6-plus-preview:free"
  temperature = 0
  max_tokens = 700
  messages = @(
    @{ role = "system"; content = "Chi tra JSON hop le." },
    @{ role = "user"; content = $solvePrompt }
  )
}

$results += Invoke-AiTest -Name "OPENROUTER_STEPFUN_EXTRACT" -Url "https://openrouter.ai/api/v1/chat/completions" -ApiKey $envMap["OPENROUTER_API_KEY"] -TimeoutSec 60 -Payload @{
  model = "stepfun/step-3.5-flash:free"
  temperature = 0
  max_tokens = 700
  messages = @(
    @{ role = "system"; content = "Chi tra JSON hop le." },
    @{ role = "user"; content = $extractPrompt }
  )
}

$results += Invoke-AiTest -Name "GROQ_LLAMA_EXTRACT" -Url "https://api.groq.com/openai/v1/chat/completions" -ApiKey $envMap["GROQ_API_KEY"] -TimeoutSec 60 -Payload @{
  model = "llama-3.1-8b-instant"
  temperature = 0
  max_tokens = 700
  messages = @(
    @{ role = "system"; content = "Chi tra JSON hop le." },
    @{ role = "user"; content = $extractPrompt }
  )
}

$results | Format-Table -AutoSize

$failed = $results | Where-Object { $_.Status -eq "FAIL" }
if ($failed.Count -gt 0) {
  exit 2
}
