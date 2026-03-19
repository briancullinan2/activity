#include <windows.h>
#include <iostream>
#include <string>
#include <vector>

// Callback function to handle each window found
BOOL CALLBACK EnumWindowsProc(HWND hwnd, LPARAM lParam) {
    // Only care about visible windows
    if (!IsWindowVisible(hwnd)) return TRUE;

    // Get the window title
    char title[256];
    GetWindowTextA(hwnd, title, sizeof(title));

    // Get the process/owner name (simplest way is checking if title exists)
    if (strlen(title) == 0) return TRUE;

    // Windows doesn't have a direct "Layer" equivalent like macOS, 
    // but we can use the Z-Order or Style. For your script, 
    // we'll put '0' as a placeholder for the layer.
    std::cout << "0: " << title << std::endl;

    return TRUE;
}

int main() {
    EnumWindows(EnumWindowsProc, 0);
    return 0;
}
