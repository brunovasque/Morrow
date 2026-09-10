param(
  [Parameter(Mandatory = $true)]
  [ValidateRange(1, 2147483647)]
  [int]$TargetPid,

  [Parameter(Mandatory = $true)]
  [ValidateSet(0, 1)]
  [int]$EventType
)

$ErrorActionPreference = "Stop"

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class MorrowConsoleControl
{
    public delegate bool HandlerRoutine(uint ctrlType);
    private static readonly HandlerRoutine IgnoreHandler = Ignore;

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool FreeConsole();

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool AttachConsole(uint processId);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool SetConsoleCtrlHandler(HandlerRoutine handler, bool add);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool GenerateConsoleCtrlEvent(uint ctrlEvent, uint processGroupId);

    public static bool InstallIgnoreHandler()
    {
        return SetConsoleCtrlHandler(IgnoreHandler, true);
    }

    private static bool Ignore(uint ctrlType)
    {
        return true;
    }
}
'@

[MorrowConsoleControl]::FreeConsole() | Out-Null
try {
  if (-not [MorrowConsoleControl]::AttachConsole([uint32]$TargetPid)) {
    throw "AttachConsole failed: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())"
  }
  if (-not [MorrowConsoleControl]::InstallIgnoreHandler()) {
    throw "SetConsoleCtrlHandler failed: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())"
  }
  if (-not [MorrowConsoleControl]::GenerateConsoleCtrlEvent([uint32]$EventType, 0)) {
    throw "GenerateConsoleCtrlEvent failed: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())"
  }
  Start-Sleep -Milliseconds 250
} finally {
  [MorrowConsoleControl]::FreeConsole() | Out-Null
}
