@echo off
:: Check for administrative permissions
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Administrative permissions confirmed.
) else (
    echo ERROR: Please right-click this file and select "Run as administrator".
    echo.
    pause
    exit /b 1
)

set "config64=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\Config\machine.config"
set "default64=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\Config\machine.config.default"

set "config32=C:\Windows\Microsoft.NET\Framework\v4.0.30319\Config\machine.config"
set "default32=C:\Windows\Microsoft.NET\Framework\v4.0.30319\Config\machine.config.default"

echo Checking 64-bit .NET configuration...
if not exist "%config64%" (
    echo [WARNING] 64-bit machine.config does not exist!
) else (
    for %%A in ("%config64%") do set "size64=%%~zA"
    echo Current size of 64-bit machine.config: %size64% bytes
    if "%size64%"=="0" (
        echo [ERROR] 64-bit machine.config is empty (0 bytes)! Attempting to restore from default...
        copy /y "%config64%" "%config64%.bak"
        copy /y "%default64%" "%config64%"
        echo Restored 64-bit machine.config from default.
    ) else (
        echo 64-bit machine.config appears intact.
    )
)

echo.
echo Checking 32-bit .NET configuration...
if not exist "%config32%" (
    echo [WARNING] 32-bit machine.config does not exist!
) else (
    for %%A in ("%config32%") do set "size32=%%~zA"
    echo Current size of 32-bit machine.config: %size32% bytes
    if "%size32%"=="0" (
        echo [ERROR] 32-bit machine.config is empty (0 bytes)! Attempting to restore from default...
        copy /y "%config32%" "%config32%.bak"
        copy /y "%default32%" "%config32%"
        echo Restored 32-bit machine.config from default.
    ) else (
        echo 32-bit machine.config appears intact.
    )
)

echo.
echo Check completed. Trying to launch a PowerShell command as a test...
powershell -Command "Write-Output 'PowerShell successfully initialized!'"
if %errorLevel% == 0 (
    echo SUCCESS: PowerShell is working again!
) else (
    echo.
    echo If PowerShell still fails, you may need to:
    echo 1. Reinstall/repair .NET Framework 4.8.
    echo 2. Run the Microsoft .NET Framework Repair Tool.
)
pause
