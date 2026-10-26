# Smart Bus Tracking - High-Performance Real-Time Backend Server
param(
    [int]$Port = 3000
)

$ErrorActionPreference = "Continue"
$WorkspaceRoot = $PSScriptRoot
$PublicDir = Join-Path $WorkspaceRoot "public"
$DataFile = Join-Path $WorkspaceRoot "data.json"

# MIME Types dictionary
$MimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".woff" = "font/woff"
    ".woff2"= "font/woff2"
    ".ttf"  = "font/ttf"
}

# Initial Seed Data
$InitialData = @'
{
  "routes": [
    {
      "id": "route-1",
      "name": "Route 101 - New Bus Stand to Nellaiappar Town & Pettai",
      "code": "101",
      "color": "#2563EB",
      "stops": [
        { "id": "stop-101-1", "name": "New Bus Stand (Vaeinthaankulam)", "lat": 8.7032, "lng": 77.7285, "sequence": 1 },
        { "id": "stop-101-2", "name": "Palayamkottai Bus Stand", "lat": 8.7180, "lng": 77.7420, "sequence": 2 },
        { "id": "stop-101-3", "name": "VOC Ground / St. Xavier's", "lat": 8.7245, "lng": 77.7340, "sequence": 3 },
        { "id": "stop-101-4", "name": "Nellai Railway Junction", "lat": 8.7290, "lng": 77.7125, "sequence": 4 },
        { "id": "stop-101-5", "name": "Tirunelveli Town Swami Nellaiappar Temple", "lat": 8.7305, "lng": 77.6880, "sequence": 5 },
        { "id": "stop-101-6", "name": "Pettai Industrial Estate", "lat": 8.7450, "lng": 77.6710, "sequence": 6 }
      ]
    },
    {
      "id": "route-2",
      "name": "Route 202 - TVMCH Medical College to Thazhaiyuthu Cements",
      "code": "202",
      "color": "#059669",
      "stops": [
        { "id": "stop-202-1", "name": "TVMCH Medical College Hospital (High Ground)", "lat": 8.7095, "lng": 77.7560, "sequence": 1 },
        { "id": "stop-202-2", "name": "Vannarpettai Bridge Bypass", "lat": 8.7260, "lng": 77.7220, "sequence": 2 },
        { "id": "stop-202-3", "name": "Tirunelveli Collectorate & Court", "lat": 8.7330, "lng": 77.7250, "sequence": 3 },
        { "id": "stop-202-4", "name": "Thachannallur Signal Stand", "lat": 8.7520, "lng": 77.7190, "sequence": 4 },
        { "id": "stop-202-5", "name": "Sankar Nagar / Thazhaiyuthu", "lat": 8.7840, "lng": 77.7290, "sequence": 5 }
      ]
    },
    {
      "id": "route-3",
      "name": "Route 303 - Perumalpuram to New Bus Stand & Anna Stadium",
      "code": "303",
      "color": "#D97706",
      "stops": [
        { "id": "stop-303-1", "name": "Perumalpuram Arch Stand", "lat": 8.6870, "lng": 77.7450, "sequence": 1 },
        { "id": "stop-303-2", "name": "Reddiarpatti Hill Road", "lat": 8.6750, "lng": 77.7550, "sequence": 2 },
        { "id": "stop-303-3", "name": "Anna Stadium & Armed Reserve", "lat": 8.7120, "lng": 77.7380, "sequence": 3 },
        { "id": "stop-303-4", "name": "Sarah Tucker College Corner", "lat": 8.7160, "lng": 77.7460, "sequence": 4 },
        { "id": "stop-303-5", "name": "New Bus Stand (Vaeinthaankulam)", "lat": 8.7032, "lng": 77.7285, "sequence": 5 }
      ]
    }
  ],
  "buses": [
    {
      "id": "BUS-101",
      "busNumber": "101",
      "regNumber": "TN-72-N-1892",
      "routeId": "route-1",
      "BusId": "bus-user-1",
      "BusName": "Muthu Kumar",
      "BusPhone": "+91 94431 12345",
      "status": "Running",
      "lat": 8.7230,
      "lng": 77.7360,
      "speed": 36,
      "bearing": 300,
      "currentStopId": "stop-101-2",
      "currentStopName": "Palayamkottai Bus Stand",
      "nextStopId": "stop-101-3",
      "nextStopName": "VOC Ground / St. Xavier's",
      "distanceToNextKm": 1.2,
      "etaMinutes": 3,
      "routeProgress": 35,
      "reachedStopIds": ["stop-101-1", "stop-101-2"],
      "lastUpdated": null,
      "crowdLevel": "Moderate",
      "isTripActive": true,
      "simulatorIndex": 0.35
    },
    {
      "id": "BUS-102",
      "busNumber": "102",
      "regNumber": "TN-72-N-2045",
      "routeId": "route-1",
      "BusId": "bus-user-2",
      "BusName": "Subbiah Thevar",
      "BusPhone": "+91 94432 23456",
      "status": "Running",
      "lat": 8.7295,
      "lng": 77.7020,
      "speed": 42,
      "bearing": 270,
      "currentStopId": "stop-101-4",
      "currentStopName": "Nellai Railway Junction",
      "nextStopId": "stop-101-5",
      "nextStopName": "Tirunelveli Town Swami Nellaiappar Temple",
      "distanceToNextKm": 1.8,
      "etaMinutes": 4,
      "routeProgress": 65,
      "reachedStopIds": ["stop-101-1", "stop-101-2", "stop-101-3", "stop-101-4"],
      "lastUpdated": null,
      "crowdLevel": "Light",
      "isTripActive": true,
      "simulatorIndex": 0.65
    },
    {
      "id": "BUS-103",
      "busNumber": "103",
      "regNumber": "TN-72-N-3110",
      "routeId": "route-1",
      "BusId": "bus-user-3",
      "BusName": "Antony Raj",
      "BusPhone": "+91 94433 34567",
      "status": "Running",
      "lat": 8.7050,
      "lng": 77.7300,
      "speed": 24,
      "bearing": 45,
      "currentStopId": "stop-101-1",
      "currentStopName": "New Bus Stand (Vaeinthaankulam)",
      "nextStopId": "stop-101-2",
      "nextStopName": "Palayamkottai Bus Stand",
      "distanceToNextKm": 2.2,
      "etaMinutes": 7,
      "routeProgress": 10,
      "reachedStopIds": ["stop-101-1"],
      "lastUpdated": null,
      "crowdLevel": "Full",
      "isTripActive": true,
      "simulatorIndex": 0.10
    },
    {
      "id": "BUS-201",
      "busNumber": "201",
      "regNumber": "TN-72-N-4420",
      "routeId": "route-2",
      "BusId": "bus-user-4",
      "BusName": "Kandasamy P.",
      "BusPhone": "+91 94434 45678",
      "status": "Running",
      "lat": 8.7300,
      "lng": 77.7240,
      "speed": 38,
      "bearing": 350,
      "currentStopId": "stop-202-2",
      "currentStopName": "Vannarpettai Bridge Bypass",
      "nextStopId": "stop-202-3",
      "nextStopName": "Tirunelveli Collectorate & Court",
      "distanceToNextKm": 1.1,
      "etaMinutes": 2,
      "routeProgress": 40,
      "reachedStopIds": ["stop-202-1", "stop-202-2"],
      "lastUpdated": null,
      "crowdLevel": "Moderate",
      "isTripActive": true,
      "simulatorIndex": 0.40
    },
    {
      "id": "BUS-202",
      "busNumber": "202",
      "regNumber": "TN-72-N-5120",
      "routeId": "route-2",
      "BusId": "bus-user-5",
      "BusName": "Perumal Swamy",
      "BusPhone": "+91 94435 56789",
      "status": "Stopped",
      "lat": 8.7095,
      "lng": 77.7560,
      "speed": 0,
      "bearing": 0,
      "currentStopId": "stop-202-1",
      "currentStopName": "TVMCH Medical College Hospital (High Ground)",
      "nextStopId": "stop-202-2",
      "nextStopName": "Vannarpettai Bridge Bypass",
      "distanceToNextKm": 2.5,
      "etaMinutes": 6,
      "routeProgress": 0,
      "reachedStopIds": ["stop-202-1"],
      "lastUpdated": null,
      "crowdLevel": "Light",
      "isTripActive": false,
      "simulatorIndex": 0.0
    },
    {
      "id": "BUS-301",
      "busNumber": "301",
      "regNumber": "TN-72-N-6330",
      "routeId": "route-3",
      "BusId": "bus-user-6",
      "BusName": "Thangaraj M.",
      "BusPhone": "+91 94436 67890",
      "status": "Running",
      "lat": 8.7000,
      "lng": 77.7420,
      "speed": 40,
      "bearing": 10,
      "currentStopId": "stop-303-2",
      "currentStopName": "Reddiarpatti Hill Road",
      "nextStopId": "stop-303-3",
      "nextStopName": "Anna Stadium & Armed Reserve",
      "distanceToNextKm": 1.6,
      "etaMinutes": 3,
      "routeProgress": 30,
      "reachedStopIds": ["stop-303-1", "stop-303-2"],
      "lastUpdated": null,
      "crowdLevel": "Moderate",
      "isTripActive": true,
      "simulatorIndex": 0.30
    }
  ],
  "users": [
    {
      "id": "user-admin",
      "email": "admin@123",
      "password": "admin@123",
      "name": "Nellai Transit Control Officer",
      "role": "admin"
    },
    {
      "id": "bus-user-1",
      "email": "Bus1@citybus.com",
      "password": "pass123",
      "name": "Muthu Kumar",
      "role": "Bus",
      "busId": "BUS-101"
    },
    {
      "id": "bus-user-2",
      "email": "Bus2@citybus.com",
      "password": "pass123",
      "name": "Suresh Mani",
      "role": "Bus",
      "busId": "BUS-102"
    },
    {
      "id": "bus-user-3",
      "email": "Bus3@citybus.com",
      "password": "pass123",
      "name": "David Paul",
      "role": "Bus",
      "busId": "BUS-103"
    },
    {
      "id": "user-pass-1",
      "email": "passenger@citybus.com",
      "password": "pass123",
      "name": "Priya Sharma",
      "role": "passenger"
    }
  ]
}
'@

if (-not (Test-Path $DataFile)) {
    $InitialData | Out-File -FilePath $DataFile -Encoding utf8
}

function Load-Data {
    if (Test-Path $DataFile) {
        $content = Get-Content -Path $DataFile -Raw -Encoding utf8
        return $content | ConvertFrom-Json
    }
    return $InitialData | ConvertFrom-Json
}

function Save-Data($data) {
    $json = $data | ConvertTo-Json -Depth 10
    $json | Out-File -FilePath $DataFile -Encoding utf8
}

# Start HttpListener
$Listener = New-Object System.Net.HttpListener
$Prefix = "http://*:$Port/"
try {
    $Listener.Prefixes.Add($Prefix)
    $Listener.Start()
    Write-Host "Smart Bus Tracking Server listening at http://localhost:$Port/" -ForegroundColor Green
} catch {
    # Fallback to localhost prefix if wildcard requires elevated rights
    $Listener = New-Object System.Net.HttpListener
    $Prefix = "http://localhost:$Port/"
    $Listener.Prefixes.Add($Prefix)
    $Listener.Start()
    Write-Host "Smart Bus Tracking Server listening at http://localhost:$Port/" -ForegroundColor Green
}

# Helper to send JSON Response
function Send-JsonResponse($response, $data, [int]$statusCode = 200) {
    $response.StatusCode = $statusCode
    $response.ContentType = "application/json; charset=utf-8"
    $response.Headers.Add("Access-Control-Allow-Origin", "*")
    $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization")
    
    $json = if ($data -is [string]) { $data } else { $data | ConvertTo-Json -Depth 10 }
    $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
    $response.ContentLength64 = $buffer.Length
    $response.OutputStream.Write($buffer, 0, $buffer.Length)
    $response.OutputStream.Close()
}

# Helper to send Static Files
function Send-FileResponse($response, [string]$filePath) {
    if (-not (Test-Path $filePath)) {
        $response.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
        $response.ContentLength64 = $msg.Length
        $response.OutputStream.Write($msg, 0, $msg.Length)
        $response.OutputStream.Close()
        return
    }

    $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
    $mime = if ($MimeTypes.ContainsKey($ext)) { $MimeTypes[$ext] } else { "application/octet-stream" }
    
    $response.StatusCode = 200
    $response.ContentType = $mime
    $response.Headers.Add("Access-Control-Allow-Origin", "*")
    $response.Headers.Add("Cache-Control", "no-cache")

    $bytes = [System.IO.File]::ReadAllBytes($filePath)
    $response.ContentLength64 = $bytes.Length
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
    $response.OutputStream.Close()
}

# Haversine distance in meters
function Get-HaversineDistance([double]$lat1, [double]$lon1, [double]$lat2, [double]$lon2) {
    $R = 6371000 # Earth radius in meters
    $dLat = ($lat2 - $lat1) * [Math]::PI / 180.0
    $dLon = ($lon2 - $lon1) * [Math]::PI / 180.0
    $a = [Math]::Sin($dLat / 2) * [Math]::Sin($dLat / 2) +
         [Math]::Cos($lat1 * [Math]::PI / 180.0) * [Math]::Cos($lat2 * [Math]::PI / 180.0) *
         [Math]::Sin($dLon / 2) * [Math]::Sin($dLon / 2)
    $c = 2 * [Math]::Atan2([Math]::Sqrt($a), [Math]::Sqrt(1 - $a))
    return $R * $c
}

Write-Host "Real-Time Bus Tracking Engine Ready. Waiting for requests..." -ForegroundColor Cyan

# Main Event Loop
while ($Listener.IsListening) {
    try {
        $context = $Listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        $rawUrl = $request.RawUrl
        $httpMethod = $request.HttpMethod

        # CORS Preflight
        if ($httpMethod -eq "OPTIONS") {
            $response.StatusCode = 204
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
            $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization")
            $response.OutputStream.Close()
            continue
        }

        # API Endpoints
        if ($rawUrl.StartsWith("/api/")) {
            $db = Load-Data

            # 0. User Login Authentication
            if ($rawUrl -eq "/api/auth/login" -and $httpMethod -eq "POST") {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd() | ConvertFrom-Json
                $matchedUser = $db.users | Where-Object { 
                    ($_.email -eq $body.email -or $_.id -eq $body.email -or $_.busId -eq $body.email) -and $_.password -eq $body.password 
                }
                if ($matchedUser) {
                    if ($body.expectedRole -and $matchedUser.role -ne $body.expectedRole) {
                        $expectedRoleName = $body.expectedRole.Substring(0,1).ToUpper() + $body.expectedRole.Substring(1).ToLower()
                        $actualRoleName = $matchedUser.role.Substring(0,1).ToUpper() + $matchedUser.role.Substring(1).ToLower()
                        Send-JsonResponse $response @{ 
                            success = $false
                            error = "Access Denied: This account is a $actualRoleName account. Please select the $actualRoleName tab to sign in." 
                        } 403
                        continue
                    }
                    Send-JsonResponse $response @{ success = $true; user = $matchedUser }
                } else {
                    Send-JsonResponse $response @{ success = $false; error = "Invalid email or password." } 401
                }
                continue
            }

            # 0b. Passenger Registration
            if ($rawUrl -eq "/api/auth/register" -and $httpMethod -eq "POST") {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd() | ConvertFrom-Json

                if (-not $body.email -or -not $body.password -or -not $body.name) {
                    Send-JsonResponse $response @{ success = $false; error = "Name, email, and password are required." } 400
                    continue
                }

                $existing = $db.users | Where-Object { $_.email -eq $body.email }
                if ($existing) {
                    Send-JsonResponse $response @{ success = $false; error = "An account with this email already exists." } 409
                    continue
                }

                $newUser = [PSCustomObject]@{
                    id = "user-pass-" + (Get-Random -Minimum 100 -Maximum 9999)
                    email = [string]$body.email
                    password = [string]$body.password
                    name = [string]$body.name
                    phone = if ($body.phone) { [string]$body.phone } else { "" }
                    role = "passenger"
                }

                $usersList = [System.Collections.ArrayList]@($db.users)
                $usersList.Add($newUser) | Out-Null
                $db.users = $usersList
                Save-Data $db

                Send-JsonResponse $response @{ success = $true; user = $newUser }
                continue
            }

            # 1. State / Full Snapshot
            if ($rawUrl -eq "/api/state" -and $httpMethod -eq "GET") {
                Send-JsonResponse $response $db
                continue
            }

            # 2. Routes
            if ($rawUrl -eq "/api/routes" -and $httpMethod -eq "GET") {
                Send-JsonResponse $response $db.routes
                continue
            }

            # 3. Buses
            if ($rawUrl -eq "/api/buses" -and $httpMethod -eq "GET") {
                Send-JsonResponse $response $db.buses
                continue
            }

            # 4. Bus details
            if ($rawUrl -match "^/api/buses/([^/]+)$" -and $httpMethod -eq "GET") {
                $busId = $Matches[1]
                $bus = $db.buses | Where-Object { $_.id -eq $busId }
                if ($bus) {
                    Send-JsonResponse $response $bus
                } else {
                    Send-JsonResponse $response @{ error = "Bus not found" } 404
                }
                continue
            }

            # 5. GPS Update / Location Broadcast (Bus or Simulator)
            if ($rawUrl -match "^/api/buses/([^/]+)/location$" -and $httpMethod -eq "POST") {
                $busId = $Matches[1]
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd() | ConvertFrom-Json
                
                $bus = $db.buses | Where-Object { $_.id -eq $busId }
                if ($bus) {
                    if ($body.lat) { $bus.lat = [double]$body.lat }
                    if ($body.lng) { $bus.lng = [double]$body.lng }
                    if ($body.speed -ne $null) { $bus.speed = [double]$body.speed }
                    if ($body.bearing -ne $null) { $bus.bearing = [double]$body.bearing }
                    if ($body.status) { $bus.status = [string]$body.status }
                    if ($body.routeProgress -ne $null) { $bus.routeProgress = [double]$body.routeProgress }
                    if ($body.currentStopId) { $bus.currentStopId = [string]$body.currentStopId }
                    if ($body.currentStopName) { $bus.currentStopName = [string]$body.currentStopName }
                    if ($body.nextStopId) { $bus.nextStopId = [string]$body.nextStopId }
                    if ($body.nextStopName) { $bus.nextStopName = [string]$body.nextStopName }
                    if ($body.distanceToNextKm -ne $null) { $bus.distanceToNextKm = [double]$body.distanceToNextKm }
                    if ($body.etaMinutes -ne $null) { $bus.etaMinutes = [double]$body.etaMinutes }
                    if ($body.reachedStopIds) { $bus.reachedStopIds = $body.reachedStopIds }
                    if ($body.isTripActive -ne $null) { $bus.isTripActive = [bool]$body.isTripActive }
                    if ($body.simulatorIndex -ne $null) { $bus.simulatorIndex = [double]$body.simulatorIndex }
                    if ($body.crowdLevel) { $bus.crowdLevel = [string]$body.crowdLevel }
                    
                    $bus.lastUpdated = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                    
                    Save-Data $db
                    Send-JsonResponse $response @{ success = $true; bus = $bus }
                } else {
                    Send-JsonResponse $response @{ error = "Bus not found" } 404
                }
                continue
            }

            # 5b. Dedicated Crowd Level Broadcast
            if ($rawUrl -match "^/api/buses/([^/]+)/crowd$" -and $httpMethod -eq "POST") {
                $busId = $Matches[1]
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd() | ConvertFrom-Json
                
                $bus = $db.buses | Where-Object { $_.id -eq $busId }
                if ($bus) {
                    if ($body.crowdLevel) { $bus.crowdLevel = [string]$body.crowdLevel }
                    $bus.lastUpdated = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                    Save-Data $db
                    Send-JsonResponse $response @{ success = $true; bus = $bus }
                } else {
                    Send-JsonResponse $response @{ error = "Bus not found" } 404
                }
                continue
            }

            # 6. Trip Control (Start / End Trip)
            if ($rawUrl -match "^/api/buses/([^/]+)/trip$" -and $httpMethod -eq "POST") {
                $busId = $Matches[1]
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd() | ConvertFrom-Json

                $bus = $db.buses | Where-Object { $_.id -eq $busId }
                if ($bus) {
                    $bus.isTripActive = [bool]$body.isActive
                    $bus.status = if ($body.isActive) { "Running" } else { "Offline" }
                    if (-not $body.isActive) {
                        $bus.speed = 0
                    }
                    $bus.lastUpdated = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                    Save-Data $db
                    Send-JsonResponse $response @{ success = $true; bus = $bus }
                } else {
                    Send-JsonResponse $response @{ error = "Bus not found" } 404
                }
                continue
            }

            # 7. Admin CRUD - Create/Update Bus
            if ($rawUrl -eq "/api/buses" -and $httpMethod -eq "POST") {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $newBus = $reader.ReadToEnd() | ConvertFrom-Json
                
                if (-not $newBus.id) {
                    $newBus | Add-Member -MemberType NoteProperty -Name "id" -Value ("BUS-" + (Get-Random -Minimum 100 -Maximum 999))
                }
                $newBus | Add-Member -MemberType NoteProperty -Name "lastUpdated" -Value ((Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")) -Force
                
                $busesList = [System.Collections.ArrayList]@($db.buses)
                $existingIdx = -1
                for ($i = 0; $i -lt $busesList.Count; $i++) {
                    if ($busesList[$i].id -eq $newBus.id) { $existingIdx = $i; break }
                }

                # Upsert bus login if provided
                if ($newBus.loginEmail) {
                    $usersList = [System.Collections.ArrayList]@($db.users)
                    $userIdx = -1
                    for ($u = 0; $u -lt $usersList.Count; $u++) {
                        if ($usersList[$u].busId -eq $newBus.id -or $usersList[$u].email -eq $newBus.loginEmail) {
                            $userIdx = $u; break
                        }
                    }
                    
                    $existingPassword = if ($userIdx -ge 0) { $usersList[$userIdx].password } else { "pass123" }
                    $passwordToSet = if ($newBus.loginPassword) { [string]$newBus.loginPassword } else { $existingPassword }

                    $busUser = [PSCustomObject]@{
                        id = if ($userIdx -ge 0) { $usersList[$userIdx].id } else { "bus-user-" + (Get-Random -Minimum 100 -Maximum 999) }
                        email = [string]$newBus.loginEmail
                        password = $passwordToSet
                        name = if ($newBus.BusName) { [string]$newBus.BusName } else { "Bus Driver" }
                        role = "Bus"
                        busId = $newBus.id
                    }
                    if ($userIdx -ge 0) {
                        $usersList[$userIdx] = $busUser
                    } else {
                        $usersList.Add($busUser) | Out-Null
                    }
                    $db.users = $usersList
                }
                
                # Remove sensitive login info from bus payload before saving
                $newBus.loginPassword = ""
                if ($null -ne $newBus.isVetriPayanam) {
                    $newBus.isVetriPayanam = [bool]$newBus.isVetriPayanam
                }

                if ($existingIdx -ge 0) {
                    $busesList[$existingIdx] = $newBus
                } else {
                    $busesList.Add($newBus) | Out-Null
                }
                $db.buses = $busesList
                Save-Data $db
                Send-JsonResponse $response @{ success = $true; bus = $newBus }
                continue
            }

            # 8. Admin Delete Bus
            if ($rawUrl -match "^/api/buses/([^/]+)$" -and $httpMethod -eq "DELETE") {
                $busId = $Matches[1]
                $busesList = [System.Collections.ArrayList]@($db.buses)
                $filtered = $busesList | Where-Object { $_.id -ne $busId }
                $db.buses = @($filtered)
                Save-Data $db
                Send-JsonResponse $response @{ success = $true; message = "Bus removed" }
                continue
            }

            # 9. Admin Create/Update Route
            if ($rawUrl -eq "/api/routes" -and $httpMethod -eq "POST") {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $newRoute = $reader.ReadToEnd() | ConvertFrom-Json
                
                if (-not $newRoute.id) {
                    $newRoute | Add-Member -MemberType NoteProperty -Name "id" -Value ("route-" + (Get-Random -Minimum 10 -Maximum 99))
                }
                $routesList = [System.Collections.ArrayList]@($db.routes)
                $existingIdx = -1
                for ($i = 0; $i -lt $routesList.Count; $i++) {
                    if ($routesList[$i].id -eq $newRoute.id) { $existingIdx = $i; break }
                }

                if ($existingIdx -ge 0) {
                    $routesList[$existingIdx] = $newRoute
                } else {
                    $routesList.Add($newRoute) | Out-Null
                }
                $db.routes = $routesList
                Save-Data $db
                Send-JsonResponse $response @{ success = $true; route = $newRoute }
                continue
            }

            # 9b. Admin Delete Route
            if ($rawUrl -match "^/api/routes/([^/]+)$" -and $httpMethod -eq "DELETE") {
                $routeId = $Matches[1]
                $routesList = [System.Collections.ArrayList]@($db.routes)
                $filtered = $routesList | Where-Object { $_.id -ne $routeId }
                $db.routes = @($filtered)
                Save-Data $db
                Send-JsonResponse $response @{ success = $true; message = "Route deleted" }
                continue
            }

            # 9c. Admin Add Stop to Route
            if ($rawUrl -match "^/api/routes/([^/]+)/stops$" -and $httpMethod -eq "POST") {
                $routeId = $Matches[1]
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $stopData = $reader.ReadToEnd() | ConvertFrom-Json
                $route = $db.routes | Where-Object { $_.id -eq $routeId }
                if ($route) {
                    if (-not $stopData.id) {
                        $stopData | Add-Member -MemberType NoteProperty -Name "id" -Value ("stop-" + $routeId + "-" + (Get-Random -Minimum 10 -Maximum 999)) -Force
                    }
                    $stopsList = [System.Collections.ArrayList]@($route.stops)
                    $stopsList.Add($stopData) | Out-Null
                    $route.stops = $stopsList
                    Save-Data $db
                    Send-JsonResponse $response @{ success = $true; stop = $stopData }
                } else {
                    Send-JsonResponse $response @{ error = "Route not found" } 404
                }
                continue
            }

            # 9d. Admin Delete Stop from Route
            if ($rawUrl -match "^/api/routes/([^/]+)/stops/([^/]+)$" -and $httpMethod -eq "DELETE") {
                $routeId = $Matches[1]
                $stopId = $Matches[2]
                $route = $db.routes | Where-Object { $_.id -eq $routeId }
                if ($route) {
                    $filtered = $route.stops | Where-Object { $_.id -ne $stopId }
                    $route.stops = @($filtered)
                    Save-Data $db
                    Send-JsonResponse $response @{ success = $true; message = "Stop removed" }
                } else {
                    Send-JsonResponse $response @{ error = "Route not found" } 404
                }
                continue
            }


            # 10. Auth Login
            if ($rawUrl -eq "/api/auth/login" -and $httpMethod -eq "POST") {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $cred = $reader.ReadToEnd() | ConvertFrom-Json
                $user = $db.users | Where-Object { 
                    ($_.email -eq $cred.email -or $_.id -eq $cred.email) -and $_.password -eq $cred.password 
                }

                if ($user) {
                    Send-JsonResponse $response @{
                        success = $true
                        user = @{
                            id = $user.id
                            name = $user.name
                            email = $user.email
                            role = $user.role
                            busId = $user.busId
                        }
                    }
                } else {
                    Send-JsonResponse $response @{ success = $false; error = "Invalid credentials. Please verify your email/ID and password." } 401
                }
                continue
            }

            # Fallback API 404
            Send-JsonResponse $response @{ error = "API Endpoint Not Found" } 404
            continue
        }

        # Static File Serving
        $localPath = $rawUrl.Split('?')[0]
        if ($localPath -eq "/" -or [string]::IsNullOrWhiteSpace($localPath)) {
            $localPath = "/index.html"
        }
        
        $filePath = Join-Path $PublicDir $localPath.TrimStart('/')
        Send-FileResponse $response $filePath

    } catch {
        Write-Host "Request error: $_" -ForegroundColor Red
        try {
            $response.StatusCode = 500
            $err = [System.Text.Encoding]::UTF8.GetBytes("500 Internal Server Error")
            $response.OutputStream.Write($err, 0, $err.Length)
            $response.OutputStream.Close()
        } catch {}
    }
}
