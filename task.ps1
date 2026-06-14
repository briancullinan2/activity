# ====================================================================
# CONFIGURATION
# ====================================================================
$projectPath = "C:\Users\megam\activity"
$bucketName  = "brians-site"
$taskName    = "Activity-AutoUpdate"
$taskDescription = "Generates the index, runs the git auto-update chain from package.json, and uploads index.html to GCS every hour."

# By setting an environment variable ($env:TARGET), we completely remove 
# the inner quotes from the node execution string, eliminating parser bugs.
$actionArguments = "-NoProfile -WindowStyle Hidden -Command ""Set-Location '$projectPath'; `$env:TARGET='./index.js'; node -e 'require(process.env.TARGET).renderIndex()'; git add -A; git commit -m 'auto-update'; git push; gsutil cp docs/index.html gs://$bucketName/"""
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $actionArguments

# Define the trigger: Start now and repeat every 1 hour indefinitely
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1)

# Define settings: Allow running on battery power, stop if it hangs for more than 2 hours
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2)

# Register the task under the current user context
Register-ScheduledTask -TaskName $taskName -Description $taskDescription -Action $action -Trigger $trigger -Settings $settings -Force

Write-Host "Task '$taskName' has been successfully created and will run every hour." -ForegroundColor Green