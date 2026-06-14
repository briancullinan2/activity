# ====================================================================
# CONFIGURATION
# ====================================================================
$projectPath = "C:\Users\megam\activity"
$bucketName  = "brians-site"
$taskName    = "Activity-AutoUpdate"
$taskDescription = "Generates the index, runs the git auto-update chain from package.json, and uploads index.html to GCS every hour."

# 1. Swapped -Command to -NoExit so the window stays open
# 2. Dropped -WindowStyle Hidden so you can see it run
# 3. Fixed the trailing escape sequence so PowerShell stops complaining
$actionArguments = "-NoProfile -NoExit -Command ""Set-Location '$projectPath'; `$env:TARGET='./index.js'; node -e 'require(process.env.TARGET).renderIndex()'; git add -A; git commit -m 'auto-update'; git push; gsutil cp docs/index.html gs://$bucketName/"""
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $actionArguments

# Define the trigger: Start now and repeat every 1 hour indefinitely
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1)

# Define settings: Allow running on battery power, stop if it hangs for more than 2 hours
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2)

# Register the task under the current user context
Register-ScheduledTask -TaskName $taskName -Description $taskDescription -Action $action -Trigger $trigger -Settings $settings -Force

Write-Host "Task '$taskName' has been successfully created and will stay open when run." -ForegroundColor Green