# ==========================================
#   RajanPay - backend.ps1
#   Pure PowerShell REST API Backend
#   Port: 3001  |  No npm/Node required
#   Usage: .\backend.ps1
# ==========================================

$PORT = 3001
$LISTEN_URL = "http://localhost:$PORT/"
$JWT_SECRET = "rajanpay_secret_2026"

# Data store file
$DATA_DIR  = Join-Path $PSScriptRoot "backend\data"
$DATA_FILE = Join-Path $DATA_DIR "store.json"
if (-not (Test-Path $DATA_DIR)) {
    New-Item -ItemType Directory -Path $DATA_DIR -Force | Out-Null
}

# â”€â”€ Load / Save store â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Convert a PSCustomObject (from ConvertFrom-Json on PS5) to a nested hashtable
function ConvertTo-HashDeep($obj) {
    if ($obj -is [System.Management.Automation.PSCustomObject]) {
        $ht = @{}
        foreach ($prop in $obj.PSObject.Properties) {
            $ht[$prop.Name] = ConvertTo-HashDeep $prop.Value
        }
        return $ht
    } elseif ($obj -is [System.Collections.IEnumerable] -and $obj -isnot [string]) {
        return @($obj | ForEach-Object { ConvertTo-HashDeep $_ })
    }
    return $obj
}

function Load-Store {
    if (Test-Path $DATA_FILE) {
        try {
            $raw = Get-Content $DATA_FILE -Raw -Encoding UTF8
            $parsed = $raw | ConvertFrom-Json
            return ConvertTo-HashDeep $parsed
        } catch {}
    }
    return @{ users = @{}; transactions = @{}; notifications = @{}; kyc = @{}; payroll = @{} }
}
function Save-Store($s) {
    $s | ConvertTo-Json -Depth 10 -Compress | Set-Content $DATA_FILE -Encoding UTF8
}

$store = Load-Store

# â”€â”€ Seed demo user â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Ensure-Seed {
    if ($store.users.ContainsKey("9876543210")) { return }

    $today      = Get-Date
    $daysWorked = [Math]::Min($today.Day, 26)
    $net        = 45000
    $earned     = [Math]::Round(($net / 26) * $daysWorked)
    $withdrawn  = 13500
    $available  = [Math]::Max(0, $earned - $withdrawn)
    $months     = @("Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec")

    $store.users["9876543210"] = @{
        id="1"; phone="9876543210"; password="demo1234"
        email="rajan@example.com"; first_name="Rajan"; last_name="Kumar"
        dob="1995-08-15"; gender="Male"; address="Flat 12B, Andheri West"
        city="Mumbai"; state="Maharashtra"; pincode="400058"
        company="Tata Consultancy Services"; employee_id="TCS-EMP-001234"
        designation="Software Engineer"; department="Information Technology"
        date_joining="2021-04-01"; emp_type="Full-Time (Permanent)"
        gross_salary=55000; net_salary=$net; pay_date="28"; hr_email="hr@tcs.com"
        bank_name="State Bank of India"; acc_number="123456784321"
        ifsc="SBIN0001234"; acc_type="Salary Account"; upi_id=""
        total_earned=$earned; available=$available; withdrawn=$withdrawn
        days_worked=$daysWorked; total_days=26; kyc_status="verified"; credit_score=782
    }

    # Helper to build a transaction entry
    function New-Txn($type, $title, $sub, $amount, $daysAgo, $hh, $mm, $sign, $color) {
        $d   = $today.AddDays(-$daysAgo)
        $d   = [DateTime]::new($d.Year, $d.Month, $d.Day, $hh, $mm, 0)
        $grp = if ($daysAgo -eq 0) { "Today" } elseif ($daysAgo -eq 1) { "Yesterday" } else { "$($months[$d.Month-1]) $($d.Day)" }
        $id  = "RF$([System.Guid]::NewGuid().ToString('N').Substring(0,12))"
        return @{
            id=$id; user_id="1"; type=$type; title=$title; sub=$sub
            amount=$amount; sign=$sign; colorClass=$color
            date="$($months[$d.Month-1]) $($d.Day), $($d.ToString('hh:mm tt'))"
            dateGroup=$grp; createdAt=$d.ToString("o")
        }
    }

    $store.transactions["1"] = @(
        (New-Txn "withdrawal" "Wage Advance"   "Credited to SBI 4321"            5000  0  14 30 "+" "credit")
        (New-Txn "repayment"  "Auto Repayment" "Deducted from May salary"         3000  0  10  0 "-" "debit")
        (New-Txn "withdrawal" "Wage Advance"   "Credited to SBI 4321"            8500  9  16 15 "+" "credit")
        (New-Txn "salary"     "Salary Credit"  "May 2026 - TCS Payroll"         45000 15   9  0 "+" "neutral")
        (New-Txn "repayment"  "Auto Repayment" "Deducted from May salary"        15000 15   9  1 "-" "debit")
        (New-Txn "withdrawal" "Wage Advance"   "Credited to SBI 4321"            5000 23  18 30 "+" "credit")
        (New-Txn "withdrawal" "Wage Advance"   "Credited to SBI 4321"           10000 33  12  0 "+" "credit")
        (New-Txn "salary"     "Salary Credit"  "April 2026 - TCS Payroll"       45000 45   9  0 "+" "neutral")
        (New-Txn "repayment"  "Auto Repayment" "Deducted from April salary"       8000 45   9  1 "-" "debit")
    )

    $store.notifications["1"] = @(
        @{ id=1; title="Withdrawal Successful"; message="Rs 5,000 credited to SBI 4321"; icon="success"; is_read=0; created_at=$today.ToString("o") }
        @{ id=2; title="Payroll Connected";     message="TCS payroll integration successful"; icon="info"; is_read=0; created_at=$today.AddHours(-3).ToString("o") }
        @{ id=3; title="Salary Updated";        message="This month's earned wages have been updated"; icon="info"; is_read=1; created_at=$today.AddDays(-1).ToString("o") }
        @{ id=4; title="KYC Verified";          message="Your Aadhaar and PAN have been verified"; icon="success"; is_read=1; created_at=$today.AddDays(-2).ToString("o") }
        @{ id=5; title="Welcome to RajanPay";   message="Your account is active. Access your earned wages anytime."; icon="success"; is_read=1; created_at=$today.AddDays(-3).ToString("o") }
    )

    $store.kyc["1"] = @{
        aadhaar     = @{ status="verified"; uploadedAt=$today.ToString("o") }
        pan         = @{ status="verified"; uploadedAt=$today.ToString("o") }
        selfie      = @{ status="verified"; uploadedAt=$today.ToString("o") }
        salary_slip = @{ status="verified"; uploadedAt=$today.ToString("o") }
    }

    $store.payroll["1"] = @{
        company_name="Tata Consultancy Services"
        status="active"
        last_synced=$today.ToString("o")
    }

    Save-Store $store
    Write-Host "[Seed] Demo user created - Phone: 9876543210 | Password: demo1234" -ForegroundColor Green
}
Ensure-Seed

# â”€â”€ Session tokens (in-memory map) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
$sessions = @{}

function New-Token($userId) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes("$userId|$(Get-Date -Format 'o')")
    $token = [Convert]::ToBase64String($bytes) -replace "=",""
    $sessions[$token] = $userId
    return $token
}

function Get-UserFromToken($token) {
    if (-not $sessions.ContainsKey($token)) { return $null }
    $uid = $sessions[$token]
    foreach ($u in $store.users.Values) {
        if ($u.id -eq $uid) { return $u }
    }
    return $null
}

function Get-AuthUser($hdrs) {
    $auth = $hdrs["authorization"]
    if (-not $auth) { $auth = $hdrs["Authorization"] }
    if (-not $auth) { return $null }
    if (-not $auth.StartsWith("Bearer ")) { return $null }
    $tok = $auth.Substring(7).Trim()
    return Get-UserFromToken $tok
}

# â”€â”€ HTTP response helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Send-Json($resp, $obj, $code = 200) {
    $json  = $obj | ConvertTo-Json -Depth 10 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $resp.StatusCode      = $code
    $resp.ContentType     = "application/json; charset=utf-8"
    $resp.ContentLength64 = $bytes.Length
    $resp.Headers.Add("Access-Control-Allow-Origin", "*")
    $resp.Headers.Add("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
    $resp.Headers.Add("Access-Control-Allow-Headers", "Content-Type,Authorization")
    $resp.OutputStream.Write($bytes, 0, $bytes.Length)
    $resp.OutputStream.Close()
}

function Read-Body($req) {
    if ($req.HasEntityBody) {
        $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
        $text   = $reader.ReadToEnd()
        $reader.Close()
        if ($text -and $text.Trim()) {
            try {
                $parsed = $text | ConvertFrom-Json
                return ConvertTo-HashDeep $parsed
            } catch {}
        }
    }
    return @{}
}

function Get-PayDateStr($user) {
    $today   = Get-Date
    $payDay  = [int]($user.pay_date)
    $next    = [DateTime]::new($today.Year, $today.Month, $payDay)
    if ($next -le $today) { $next = $next.AddMonths(1) }
    $mths    = @("Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec")
    return "$($mths[$next.Month-1]) $($next.Day)", [Math]::Ceiling(($next - $today).TotalDays)
}

# â”€â”€ Start listener â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($LISTEN_URL)
$listener.Start()

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  RajanPay API  -  PowerShell Backend       " -ForegroundColor Cyan
Write-Host "  http://localhost:$PORT                     " -ForegroundColor Cyan
Write-Host "  Rajan Finance Pvt. Ltd.                   " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  POST /api/auth/login" -ForegroundColor Yellow
Write-Host "  POST /api/auth/register"
Write-Host "  GET  /api/user/dashboard"
Write-Host "  POST /api/withdrawals/request"
Write-Host "  GET  /api/transactions"
Write-Host "  GET  /api/kyc/status"
Write-Host "  GET  /api/notifications"
Write-Host "  GET  /api/payroll/status"
Write-Host "  GET  /api/health"
Write-Host ""
Write-Host "  Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

try {
    while ($listener.IsListening) {
        $ctx  = $listener.GetContext()
        $req  = $ctx.Request
        $resp = $ctx.Response
        $meth = $req.HttpMethod.ToUpper()
        $path = $req.Url.AbsolutePath.TrimEnd("/")
        $qs   = $req.QueryString
        Write-Host "[$([DateTime]::Now.ToString('HH:mm:ss'))] $meth $path" -ForegroundColor DarkCyan

        # CORS preflight
        if ($meth -eq "OPTIONS") {
            $resp.StatusCode = 204
            $resp.Headers.Add("Access-Control-Allow-Origin", "*")
            $resp.Headers.Add("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
            $resp.Headers.Add("Access-Control-Allow-Headers", "Content-Type,Authorization")
            $resp.OutputStream.Close()
            continue
        }

        $body = Read-Body $req

        # â”€â”€ ROUTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

        # Health
        if ($path -eq "/api/health") {
            Send-Json $resp @{ success=$true; service="RajanPay API"; status="running"; version="1.0.0" }

        # Auth: Login
        } elseif ($path -eq "/api/auth/login" -and $meth -eq "POST") {
            $rawPhone = "$($body["phone"])" -replace "\D",""
            $phone    = if ($rawPhone.Length -gt 10) { $rawPhone.Substring($rawPhone.Length-10) } else { $rawPhone }
            $pass     = "$($body["password"])"
            if (-not $phone -or -not $pass) {
                Send-Json $resp @{ success=$false; message="Phone and password required." } 400
            } else {
                $u = $store.users[$phone]
                if (-not $u) { Send-Json $resp @{ success=$false; message="No account found with this phone." } 401 }
                elseif ($u.password -ne $pass) { Send-Json $resp @{ success=$false; message="Incorrect password." } 401 }
                else {
                    $tok  = New-Token $u.id
                    $safe = @{}; foreach ($k in $u.Keys) { if ($k -ne "password") { $safe[$k] = $u[$k] } }
                    Send-Json $resp @{ success=$true; message="Login successful!"; token=$tok; user=$safe }
                }
            }

        # Auth: Register
        } elseif ($path -eq "/api/auth/register" -and $meth -eq "POST") {
            $rawP = "$($body["phone"])" -replace "\D",""
            $ph   = if ($rawP.Length -gt 10) { $rawP.Substring($rawP.Length-10) } else { $rawP }
            $pw   = "$($body["password"])"
            if (-not $ph -or -not $pw) {
                Send-Json $resp @{ success=$false; message="Phone and password required." } 400
            } elseif ($store.users.ContainsKey($ph)) {
                Send-Json $resp @{ success=$false; message="Account already exists." } 409
            } else {
                $net2   = [int](if ($body["netSalary"]) { $body["netSalary"] } else { 45000 })
                $today2 = Get-Date
                $dw2    = [Math]::Min($today2.Day, 26)
                $e2     = [Math]::Round(($net2/26)*$dw2)
                $uid2   = [string]($store.users.Count + 1)
                $nu = @{
                    id=$uid2; phone=$ph; password=$pw
                    email=("$($body["email"])"); first_name=("$($body["firstName"])"); last_name=("$($body["lastName"])")
                    dob=("$($body["dob"])"); gender=("$($body["gender"])"); address=("$($body["address"])")
                    city=("$($body["city"])"); state=("$($body["state"])"); pincode=("$($body["pincode"])")
                    company=("$($body["company"])"); employee_id=("$($body["employeeId"])")
                    designation=("$($body["designation"])"); department=("$($body["department"])")
                    date_joining=("$($body["dateJoining"])"); emp_type=("$($body["empType"])")
                    gross_salary=[int](if ($body["grossSalary"]) { $body["grossSalary"] } else { 0 }); net_salary=$net2
                    pay_date=("$(if ($body["payDate"]) { $body["payDate"] } else { "28" })"); hr_email=("$($body["hrEmail"])")
                    bank_name=("$($body["bankName"])"); acc_number=("$($body["accNumber"])")
                    ifsc=("$($body["ifsc"])"); acc_type=("$($body["accType"])"); upi_id=("$($body["upiId"])")
                    total_earned=$e2; available=[Math]::Round($e2*0.5); withdrawn=0
                    days_worked=$dw2; total_days=26; kyc_status="pending"; credit_score=750
                }
                $store.users[$ph]           = $nu
                $store.transactions[$uid2]  = @()
                $store.notifications[$uid2] = @(@{ id=1; title="Welcome to RajanPay"; message="Account under review."; icon="success"; is_read=0; created_at=$today2.ToString("o") })
                $store.kyc[$uid2]           = @{ aadhaar=@{status="pending"}; pan=@{status="pending"}; selfie=@{status="pending"}; salary_slip=@{status="pending"} }
                $store.payroll[$uid2]       = @{ company_name=("$($body["company"])"); status="active"; last_synced=$today2.ToString("o") }
                Save-Store $store
                $tok2 = New-Token $uid2
                $safe2 = @{}; foreach ($k in $nu.Keys) { if ($k -ne "password") { $safe2[$k] = $nu[$k] } }
                Send-Json $resp @{ success=$true; message="Account created!"; token=$tok2; user=$safe2 } 201
            }

        # Auth: OTP Send
        } elseif ($path -eq "/api/auth/otp/send" -and $meth -eq "POST") {
            Write-Host "  [OTP] Mock OTP 123456 sent to $($body["phone"])" -ForegroundColor DarkGray
            Send-Json $resp @{ success=$true; message="OTP sent!"; otp="123456" }

        # Auth: OTP Verify
        } elseif ($path -eq "/api/auth/otp/verify" -and $meth -eq "POST") {
            $ok = ("$($body["otp"])" -eq "123456")
            Send-Json $resp @{ success=$ok; message=if($ok){"OTP verified!"}else{"Invalid OTP."} } (if($ok){200}else{400})

        # Auth: Me
        } elseif ($path -eq "/api/auth/me") {
            $u = Get-AuthUser $req.Headers
            if (-not $u) { Send-Json $resp @{ success=$false; message="Unauthorized." } 401 }
            else {
                $safe = @{}; foreach ($k in $u.Keys) { if ($k -ne "password") { $safe[$k] = $u[$k] } }
                Send-Json $resp @{ success=$true; user=$safe }
            }

        # User: Dashboard
        } elseif ($path -eq "/api/user/dashboard") {
            $u = Get-AuthUser $req.Headers
            if (-not $u) { Send-Json $resp @{ success=$false; message="Unauthorized." } 401 }
            else {
                $today3  = Get-Date
                $dw3     = [Math]::Min($today3.Day, 26)
                $daily3  = [Math]::Round($u.net_salary / 26)
                $e3      = $daily3 * $dw3
                $a3      = [Math]::Max(0, $e3 - $u.withdrawn)
                $u.total_earned = $e3; $u.available = $a3; $u.days_worked = $dw3
                $payStr, $daysLeft = Get-PayDateStr $u
                $bl4 = if ($u.acc_number.Length -ge 4) { $u.acc_number.Substring($u.acc_number.Length-4) } else { "0000" }
                Save-Store $store
                Send-Json $resp @{
                    success=$true
                    dashboard=@{
                        totalEarned=$e3; todayEarned=$daily3; available=$a3; withdrawn=$u.withdrawn
                        daysWorked=$dw3; totalDays=26; daysToPayday=$daysLeft; payDateStr=$payStr
                        grossSalary=$u.gross_salary; netSalary=$u.net_salary
                        company=$u.company; designation=$u.designation
                        creditScore=$u.credit_score
                        userName="$($u.first_name) $($u.last_name)".Trim()
                        firstName=$u.first_name; bankLast4=$bl4; bankName=$u.bank_name
                    }
                }
            }

        # User: Me
        } elseif ($path -eq "/api/user/me") {
            $u = Get-AuthUser $req.Headers
            if (-not $u) { Send-Json $resp @{ success=$false; message="Unauthorized." } 401 }
            else {
                $safe = @{}; foreach ($k in $u.Keys) { if ($k -ne "password") { $safe[$k] = $u[$k] } }
                Send-Json $resp @{ success=$true; user=$safe }
            }

        # User: Update Profile
        } elseif ($path -eq "/api/user/profile" -and $meth -eq "PUT") {
            $u = Get-AuthUser $req.Headers
            if (-not $u) { Send-Json $resp @{ success=$false; message="Unauthorized." } 401 }
            else {
                if ($body["firstName"]) { $u.first_name = $body["firstName"] }
                if ($body["lastName"])  { $u.last_name  = $body["lastName"] }
                if ($body["email"])     { $u.email      = $body["email"] }
                if ($body["city"])      { $u.city       = $body["city"] }
                if ($body["address"])   { $u.address    = $body["address"] }
                Save-Store $store
                Send-Json $resp @{ success=$true; message="Profile updated." }
            }

        # Withdrawals: Request
        } elseif ($path -eq "/api/withdrawals/request" -and $meth -eq "POST") {
            $u = Get-AuthUser $req.Headers
            if (-not $u) { Send-Json $resp @{ success=$false; message="Unauthorized." } 401 }
            else {
                $amt = [int](if ($body["amount"]) { $body["amount"] } else { 0 })
                if ($amt -le 0) { Send-Json $resp @{ success=$false; message="Enter a valid amount." } 400 }
                else {
                    $avW = [Math]::Max(0, $u.total_earned - $u.withdrawn)
                    if ($amt -gt $avW) {
                        Send-Json $resp @{ success=$false; message="Amount exceeds available limit of Rs $avW." } 400
                    } else {
                        $bl4w   = if ($u.acc_number.Length -ge 4) { $u.acc_number.Substring($u.acc_number.Length-4) } else { "0000" }
                        $bDisp  = "$($u.bank_name) $bl4w"
                        $nowW   = Get-Date
                        $mW     = @("Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec")
                        $dLbl   = "$($mW[$nowW.Month-1]) $($nowW.Day), $($nowW.ToString('hh:mm tt'))"
                        $txId   = "RF$([System.Guid]::NewGuid().ToString('N').Substring(0,12))"
                        $newT   = @{
                            id=$txId; user_id=$u.id; type="withdrawal"; title="Wage Advance"
                            sub="Credited to $bDisp"; amount=$amt; sign="+"; colorClass="credit"
                            date=$dLbl; dateGroup="Today"; createdAt=$nowW.ToString("o")
                        }
                        if (-not $store.transactions.ContainsKey($u.id)) { $store.transactions[$u.id] = @() }
                        $store.transactions[$u.id] = @($newT) + $store.transactions[$u.id]
                        $u.withdrawn += $amt
                        $newAv = [Math]::Max(0, $u.total_earned - $u.withdrawn)
                        $u.available = $newAv
                        if (-not $store.notifications.ContainsKey($u.id)) { $store.notifications[$u.id] = @() }
                        $nid = [int]($store.notifications[$u.id].Count) + 1
                        $store.notifications[$u.id] = @(@{ id=$nid; title="Withdrawal Successful"; message="Rs $amt credited to $bDisp"; icon="success"; is_read=0; created_at=$nowW.ToString("o") }) + $store.notifications[$u.id]
                        Save-Store $store
                        Send-Json $resp @{ success=$true; message="Rs $amt credited!"; txnId=$txId; newAvailable=$newAv; transaction=$newT }
                    }
                }
            }

        # Withdrawals: List
        } elseif ($path -eq "/api/withdrawals") {
            $u = Get-AuthUser $req.Headers
            if (-not $u) { Send-Json $resp @{ success=$false; message="Unauthorized." } 401 }
            else {
                $all = if ($store.transactions.ContainsKey($u.id)) { $store.transactions[$u.id] } else { @() }
                Send-Json $resp @{ success=$true; withdrawals=@($all | Where-Object { $_.type -eq "withdrawal" }) }
            }

        # Transactions: List
        } elseif ($path -eq "/api/transactions") {
            $u = Get-AuthUser $req.Headers
            if (-not $u) { Send-Json $resp @{ success=$false; message="Unauthorized." } 401 }
            else {
                $tf  = $qs["type"]
                $all = if ($store.transactions.ContainsKey($u.id)) { @($store.transactions[$u.id]) } else { @() }
                if ($tf -and $tf -ne "all") { $all = @($all | Where-Object { $_.type -eq $tf }) }
                Send-Json $resp @{ success=$true; transactions=$all; count=$all.Count }
            }

        # Transactions: Summary
        } elseif ($path -eq "/api/transactions/summary") {
            $u = Get-AuthUser $req.Headers
            if (-not $u) { Send-Json $resp @{ success=$false; message="Unauthorized." } 401 }
            else {
                $all = if ($store.transactions.ContainsKey($u.id)) { @($store.transactions[$u.id]) } else { @() }
                $totW2 = ($all | Where-Object { $_.type -eq "withdrawal" } | Measure-Object -Property amount -Sum).Sum
                $totR2 = ($all | Where-Object { $_.type -eq "repayment"  } | Measure-Object -Property amount -Sum).Sum
                if ($null -eq $totW2) { $totW2 = 0 }
                if ($null -eq $totR2) { $totR2 = 0 }
                Send-Json $resp @{ success=$true; summary=@{ totalWithdrawn=$totW2; totalRepaid=$totR2; txnCount=$all.Count; outstanding=[Math]::Max(0,$totW2-$totR2) } }
            }

        # Transactions: Export CSV
        } elseif ($path -eq "/api/transactions/export") {
            $qTok = $qs["token"]
            $u    = Get-AuthUser $req.Headers
            if (-not $u -and $qTok) { $u = Get-UserFromToken $qTok }
            if (-not $u) { Send-Json $resp @{ success=$false; message="Unauthorized." } 401 }
            else {
                $all   = if ($store.transactions.ContainsKey($u.id)) { @($store.transactions[$u.id]) } else { @() }
                $lines = @("TXN ID,Type,Title,Amount,Date")
                foreach ($t in $all) { $lines += "$($t.id),$($t.type),`"$($t.title)`",$($t.amount),`"$($t.date)`"" }
                $csv   = $lines -join "`n"
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($csv)
                $resp.StatusCode = 200; $resp.ContentType = "text/csv"
                $resp.Headers.Add("Content-Disposition","attachment; filename=rajanpay_statement.csv")
                $resp.Headers.Add("Access-Control-Allow-Origin","*")
                $resp.Headers.Add("Access-Control-Allow-Headers","Content-Type,Authorization")
                $resp.ContentLength64 = $bytes.Length
                $resp.OutputStream.Write($bytes,0,$bytes.Length)
                $resp.OutputStream.Close()
            }

        # KYC: Status
        } elseif ($path -eq "/api/kyc/status") {
            $u = Get-AuthUser $req.Headers
            if (-not $u) { Send-Json $resp @{ success=$false; message="Unauthorized." } 401 }
            else {
                $kyc = if ($store.kyc.ContainsKey($u.id)) { $store.kyc[$u.id] } else { @{} }
                $cnt = @("aadhaar","pan","selfie","salary_slip") | Where-Object { $kyc[$_].status -eq "verified" } | Measure-Object | Select-Object -ExpandProperty Count
                Send-Json $resp @{ success=$true; kyc=$kyc; overallStatus=if($cnt -ge 3){"verified"}else{"pending"} }
            }

        # KYC: Selfie
        } elseif ($path -eq "/api/kyc/selfie" -and $meth -eq "POST") {
            $u = Get-AuthUser $req.Headers
            if (-not $u) { Send-Json $resp @{ success=$false; message="Unauthorized." } 401 }
            else {
                if (-not $store.kyc.ContainsKey($u.id)) { $store.kyc[$u.id] = @{} }
                $store.kyc[$u.id]["selfie"] = @{ status="verified"; uploadedAt=(Get-Date).ToString("o") }
                Save-Store $store
                Send-Json $resp @{ success=$true; message="Selfie verified!" }
            }

        # Notifications: List
        } elseif ($path -eq "/api/notifications") {
            $u = Get-AuthUser $req.Headers
            if (-not $u) { Send-Json $resp @{ success=$false; message="Unauthorized." } 401 }
            else {
                $notifs = if ($store.notifications.ContainsKey($u.id)) { @($store.notifications[$u.id]) } else { @() }
                $unread = ($notifs | Where-Object { $_.is_read -eq 0 } | Measure-Object).Count
                Send-Json $resp @{ success=$true; notifications=$notifs; unreadCount=$unread }
            }

        # Notifications: Read All
        } elseif ($path -eq "/api/notifications/read-all" -and $meth -eq "PUT") {
            $u = Get-AuthUser $req.Headers
            if (-not $u) { Send-Json $resp @{ success=$false; message="Unauthorized." } 401 }
            else {
                if ($store.notifications.ContainsKey($u.id)) {
                    foreach ($n in $store.notifications[$u.id]) { $n.is_read = 1 }
                    Save-Store $store
                }
                Send-Json $resp @{ success=$true; message="All marked read." }
            }

        # Payroll: Status
        } elseif ($path -eq "/api/payroll/status") {
            $u = Get-AuthUser $req.Headers
            if (-not $u) { Send-Json $resp @{ success=$false; message="Unauthorized." } 401 }
            else {
                $pay = if ($store.payroll.ContainsKey($u.id)) { $store.payroll[$u.id] } else { @{ status="inactive"; last_synced=(Get-Date).ToString("o") } }
                Send-Json $resp @{
                    success=$true
                    payroll=@{
                        isConnected=($pay.status -eq "active")
                        companyName=$u.company; designation=$u.designation
                        grossSalary=$u.gross_salary; netSalary=$u.net_salary
                        payDate=$u.pay_date; lastSynced=$pay.last_synced; status=$pay.status
                    }
                }
            }

        # Payroll: Sync
        } elseif ($path -eq "/api/payroll/sync" -and $meth -eq "POST") {
            $u = Get-AuthUser $req.Headers
            if (-not $u) { Send-Json $resp @{ success=$false; message="Unauthorized." } 401 }
            else {
                $today5 = Get-Date
                $dw5    = [Math]::Min($today5.Day, 26)
                $e5     = [Math]::Round(($u.net_salary / 26) * $dw5)
                $a5     = [Math]::Max(0, $e5 - $u.withdrawn)
                $u.total_earned = $e5; $u.available = $a5; $u.days_worked = $dw5
                if (-not $store.payroll.ContainsKey($u.id)) { $store.payroll[$u.id] = @{ status="active" } }
                $store.payroll[$u.id]["last_synced"] = $today5.ToString("o")
                Save-Store $store
                Send-Json $resp @{ success=$true; message="Payroll synced!"; totalEarned=$e5; daysWorked=$dw5; lastSynced=$today5.ToString("o") }
            }

        # 404
        } else {
            Send-Json $resp @{ success=$false; message="Route $meth $path not found." } 404
        }
    }
} catch {
    Write-Error "Server error: $_"
} finally {
    if ($listener -and $listener.IsListening) {
        $listener.Stop(); $listener.Close()
    }
    Write-Host "[RajanPay API] Server stopped." -ForegroundColor DarkGray
}

