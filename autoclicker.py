import pyautogui
import time
import threading
from pynput.mouse import Button, Controller
from pynput.keyboard import Listener, KeyCode

# ==========================================
# ClickPro: Precision Auto-Clicker Core
# ==========================================

# Settings
# Change delay to adjust click speed (seconds)
# 0.1 = 10 clicks per second
# 0.01 = 100 clicks per second
delay = 0.1
button = Button.left
start_stop_key = KeyCode(char='s')
exit_key = KeyCode(char='e')
click_mode = 'cursor' # Options: 'cursor' or 'fixed'
fixed_pos = (500, 500) # (X, Y) coordinates used if click_mode is 'fixed'

class ClickMouse(threading.Thread):
    def __init__(self, delay, button):
        super(ClickMouse, self).__init__()
        self.delay = delay
        self.button = button
        self.running = False
        self.program_running = True

    def start_clicking(self):
        self.running = True
        print(f"[ENGINE] Automated pulse sequence STARTED (Mode: {click_mode})")

    def stop_clicking(self):
        self.running = False
        print("[ENGINE] Automated pulse sequence STOPPED")

    def exit(self):
        self.stop_clicking()
        self.program_running = False
        print("[SYSTEM] Shutting down...")

    def run(self):
        while self.program_running:
            while self.running:
                if click_mode == 'fixed':
                    pyautogui.click(fixed_pos[0], fixed_pos[1])
                else:
                    mouse.click(self.button)
                time.sleep(self.delay)
            time.sleep(0.1)

mouse = Controller()
click_thread = ClickMouse(delay, button)
click_thread.start()

def on_press(key):
    if key == start_stop_key:
        if click_thread.running:
            click_thread.stop_clicking()
        else:
            click_thread.start_clicking()
    elif key == exit_key:
        click_thread.exit()
        listener.stop()

print("--- ClickPro Engine v2.4.0 ---")
print(f"Controls:")
print(f"  [{start_stop_key}] : Start / Stop clicking")
print(f"  [{exit_key}] : Exit program")
print(f"Current Delay: {delay}s")
print("------------------------------")

with Listener(on_press=on_press) as listener:
    listener.join()
