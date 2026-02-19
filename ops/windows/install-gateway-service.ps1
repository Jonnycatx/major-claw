$ServiceName = "MajorClawGateway"
$NssmPath = "C:\nssm\nssm.exe"
$WorkspacePath = "C:\MajorClaw\workspace"

& $NssmPath install $ServiceName "C:\Program Files\nodejs\pnpm.cmd" "--filter @majorclaw/gateway start"
& $NssmPath set $ServiceName AppDirectory $WorkspacePath
& $NssmPath set $ServiceName Start SERVICE_AUTO_START
Start-Service $ServiceName

