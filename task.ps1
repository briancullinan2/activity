# ====================================================================
# CONFIGURATION
# ====================================================================
$projectPath = "C:\Users\megam\activity"
$bucketName  = "brians-site"
$taskName    = "Activity-AutoUpdate"
$taskDescription = "Runs git auto-update chain from package.json and uploads index.html to GCS every hour."

# Define the action: Navigate to folder, run Git sequence, then copy file to GCS
# Using ';' ensures the gsutil command executes after the git push attempt completes.
$actionArguments = "-NoProfile -WindowStyle Hidden -Command ""Set-Location '$projectPath'; git add -A; git commit -m 'auto-update'; git push; gsutil cp docs/index.html gs://$bucketName/"""
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $actionArguments

# Define the trigger: Start now and repeat every 1 hour indefinitely
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1)

# Define settings: Allow running on battery power, stop if it hangs for more than 2 hours
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2)

# Register the task under the current user context so it has access to your Git credentials and Google Cloud credentials
Register-ScheduledTask -TaskName $taskName -Description $taskDescription -Action $action -Trigger $trigger -Settings $settings -Force

Write-Host "Task '$taskName' has been successfully created and will run every hour." -ForegroundColor Green

