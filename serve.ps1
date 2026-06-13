# serve.ps1 - Simple PowerShell Static Web Server
$port = 8080
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

Write-Host "Starting server on http://localhost:$port/ ..."
try {
    $listener.Start()
    Write-Host "Server successfully started. Press Ctrl+C to stop."
    
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $urlPath = $request.Url.LocalPath
        if ($urlPath -eq "/") {
            $urlPath = "/index.html"
        }

        # Unescape URL path to handle characters correctly
        $urlPath = [System.Uri]::UnescapeDataString($urlPath)
        
        # Get path absolute to the script directory
        $baseDir = $PSScriptRoot
        if (-not $baseDir) {
            $baseDir = Get-Location
        }
        $filePath = Join-Path $baseDir $urlPath.Substring(1)

        # Basic path traversal protection
        $realPath = [System.IO.Path]::GetFullPath($filePath)
        $realBaseDir = [System.IO.Path]::GetFullPath($baseDir)
        
        if (-not $realPath.StartsWith($realBaseDir)) {
            $response.StatusCode = 403
            $bytes = [System.Text.Encoding]::UTF8.GetBytes("403 Forbidden")
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.OutputStream.Close()
            continue
        }

        if (Test-Path $realPath -PathType Leaf) {
            $extension = [System.IO.Path]::GetExtension($realPath).ToLower()
            $contentType = switch ($extension) {
                ".html" { "text/html; charset=utf-8" }
                ".css"  { "text/css; charset=utf-8" }
                ".js"   { "application/javascript; charset=utf-8" }
                ".json" { "application/json; charset=utf-8" }
                ".png"  { "image/png" }
                ".jpg"  { "image/jpeg" }
                ".jpeg" { "image/jpeg" }
                ".gif"  { "image/gif" }
                ".svg"  { "image/svg+xml" }
                ".ico"  { "image/x-icon" }
                default { "application/octet-stream" }
            }

            $response.ContentType = $contentType
            $bytes = [System.IO.File]::ReadAllBytes($realPath)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $bytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        }
        $response.OutputStream.Close()
    }
} catch {
    Write-Error $_
} finally {
    if ($listener) {
        try {
            if ($listener.IsListening) {
                $listener.Stop()
            }
        } catch {}
        try {
            $listener.Close()
        } catch {}
    }
}
