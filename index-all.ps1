for ($offset = 0; $offset -lt 64; $offset += 10) {
  $batch = [Math]::Min(10, 64 - $offset)
  Write-Host "Indexing offset $offset, batch size $batch"
  $body = @{ type = "technology"; batchSize = $batch; offset = $offset } | ConvertTo-Json -Compress
  $result = curl.exe -s -X POST "https://cv-assistant-worker.{YOUR_WORKERS_SUBDOMAIN}/index" -H "Content-Type: application/json" -d $body
  Write-Host "Result: $result"
}
