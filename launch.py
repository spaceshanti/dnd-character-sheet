"""Launch the character sheet for testing (live reload).

Double-click this file, or run:  python launch.py
Starts the Vite dev server, waits until it answers, then opens the Electron window.
Edits in src/ show up when you save. Close the window to stop everything.
"""
import os
import subprocess
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
HOST, PORT = "127.0.0.1", 5173
URL = f"http://{HOST}:{PORT}"
VITE = os.path.join(HERE, "node_modules", "vite", "bin", "vite.js")
ELECTRON = os.path.join(HERE, "node_modules", "electron", "dist", "electron.exe" if os.name == "nt" else "electron")


def fail(msg):
    print(f"\n[launch] {msg}")
    if os.name == "nt":
        input("Press Enter to close...")
    sys.exit(1)


def server_up():
    try:
        with urllib.request.urlopen(URL, timeout=1) as r:
            return r.status == 200
    except Exception:
        return False


def main():
    os.chdir(HERE)

    if not os.path.exists(VITE) or not os.path.exists(ELECTRON):
        print("[launch] Installing dependencies (first run only)...")
        if subprocess.call("npm install", shell=True) != 0:
            fail("npm install failed. Is Node.js installed?")

    vite = None
    if server_up():
        print(f"[launch] Reusing dev server already running at {URL}")
    else:
        print("[launch] Starting dev server...")
        vite = subprocess.Popen(["node", VITE, "--host", HOST, "--port", str(PORT), "--strictPort"])
        for _ in range(120):  # up to 30 s
            if vite.poll() is not None:
                fail(f"Dev server exited (code {vite.returncode}). If it says the port is in use, close the other copy first.")
            if server_up():
                break
            time.sleep(0.25)
        else:
            vite.terminate()
            fail(f"Dev server did not answer at {URL} within 30 seconds.")

    print("[launch] Opening app window...")
    env = dict(os.environ, SHEET_DEV_URL=URL)
    try:
        subprocess.call([ELECTRON, "."], env=env)
    except KeyboardInterrupt:
        pass
    finally:
        if vite and vite.poll() is None:
            vite.terminate()
            try:
                vite.wait(5)
            except subprocess.TimeoutExpired:
                vite.kill()
    print("[launch] Stopped.")


if __name__ == "__main__":
    main()
