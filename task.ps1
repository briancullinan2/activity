# ====================================================================
# CONFIGURATION
# ====================================================================
$projectPath = "C:\Users\megam\activity"
$bucketName  = "brians-site"
$taskName    = "Activity-AutoUpdate"
$taskDescription = "Generates the index, runs the git auto-update chain from package.json, and uploads index.html to GCS every hour."

# Converted 'gsutil cp' to 'gcloud storage cp'
$actionArguments = "-NoProfile -WindowStyle Hidden -Command ""Set-Location '$projectPath'; `$env:TARGET='./index.js'; node -e 'require(process.env.TARGET).renderIndex()'; git add -A; git commit -m 'auto-update'; git push; gcloud storage cp docs/index.html gs://$bucketName/"""
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $actionArguments

# Define the trigger: Start now and repeat every 1 hour indefinitely
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1)

# Define settings: Allow running on battery power, stop if it hangs for more than 2 hours
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2)

# Register the task under the current user context
Register-ScheduledTask -TaskName $taskName -Description $taskDescription -Action $action -Trigger $trigger -Settings $settings -Force

Write-Host "Task '$taskName' has been updated with gcloud storage and will stay open when run." -ForegroundColor Green