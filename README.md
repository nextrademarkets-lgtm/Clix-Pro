# ClickPro: Precision Auto-Clicker Utility

ClickPro is a professional-grade click speed tester and auto-clicker simulator with high-precision tracking and script generation tools.

## Features

- **Web Utility**: Real-time CPS (Clicks Per Second) tracking, peak CPS monitoring, and visual pulse feedback.
- **MetaMask Integration**: Connect your wallet to verify your identity and potentially save your high scores on-chain.
- **Python Engine**: A standalone high-performance auto-clicker script for local machine use.

## Getting Started

### Web Application
The web frontend is built with React, Tailwind CSS, and Framer Motion.
1. Install dependencies: `npm install`
2. Run development server: `npm run dev`
3. Open `http://localhost:3000` in your browser.

### Python Auto-Clicker
To run the auto-clicker on your computer:

1. **Prerequisites**:
   - Python 3.x installed.
   - Install required libraries:
     ```bash
     pip install pyautogui pynput
     ```

2. **Usage**:
   - Run the script:
     ```bash
     python autoclicker.py
     ```
   - **Controls**:
     - Press **'S'** to Start or Stop the clicking engine.
     - Press **'E'** to Exit the program entirely.

## Configuration
You can adjust the clicking speed by editing the `delay` variable in `autoclicker.py`.
- `delay = 0.1` (10 CPS)
- `delay = 0.01` (100 CPS)

## Security Note
Web browsers are sandboxed and cannot control your OS mouse directly. This is why the Python script is provided for local use. Always use auto-clickers responsibly and in compliance with the terms of service of any software or games you use them with.
