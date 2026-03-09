/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MousePointer2, 
  Zap, 
  Settings2, 
  History, 
  Play, 
  Square, 
  Terminal,
  Activity,
  Cpu,
  Trophy,
  Wallet,
  AlertCircle,
  CheckCircle2,
  Volume2,
  VolumeX,
  Crosshair
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ethers } from 'ethers';

declare global {
  interface Window {
    ethereum?: any;
  }
}

// Subtle sound effects
const SOUNDS = {
  click: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3', // Subtle blip
  start: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3', // Power up
  stop: 'https://assets.mixkit.co/active_storage/sfx/2567/2567-preview.mp3',  // Power down
};

export default function App() {
  const [clicks, setClicks] = useState(0);
  const [isAutoClicking, setIsAutoClicking] = useState(false);
  const [intervalMs, setIntervalMs] = useState(100);
  const [cps, setCps] = useState(0);
  const [maxCps, setMaxCps] = useState(0);
  const [activeTab, setActiveTab] = useState<'tool' | 'script'>('tool');
  const [account, setAccount] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [clickPosition, setClickPosition] = useState<'cursor' | 'fixed'>('cursor');
  const [coordinates, setCoordinates] = useState({ x: 0, y: 0 });
  const [recentStats, setRecentStats] = useState<any[]>([]);
  const [isPicking, setIsPicking] = useState(false);
  const [pickerCountdown, setPickerCountdown] = useState<number | null>(null);
  
  const clickTimes = useRef<number[]>([]);
  const autoClickTimer = useRef<NodeJS.Timeout | null>(null);

  // Sound Player
  const playSound = useCallback((type: keyof typeof SOUNDS) => {
    if (!isSoundEnabled) return;
    const audio = new Audio(SOUNDS[type]);
    audio.volume = 0.2;
    audio.play().catch(() => {}); // Ignore errors if sound fails
  }, [isSoundEnabled]);

  // Fetch stats from server
  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      setRecentStats(data);
    } catch (err) {
      console.error("Failed to fetch stats", err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Save stats to server
  const saveStats = async () => {
    if (clicks === 0) return;
    try {
      await fetch('/api/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: account,
          total_clicks: clicks,
          peak_cps: maxCps
        })
      });
      fetchStats();
    } catch (err) {
      console.error("Failed to save stats", err);
    }
  };

  // MetaMask Connection Logic
  const connectWallet = async () => {
    setIsConnecting(true);
    setError(null);
    
    if (typeof window.ethereum !== 'undefined') {
      try {
        // Request account access
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        setAccount(accounts[0]);
      } catch (err: any) {
        console.error(err);
        if (err.code === 4001) {
          setError("Connection rejected by user.");
        } else {
          setError("Failed to connect to MetaMask. Please check your extension.");
        }
      } finally {
        setIsConnecting(false);
      }
    } else {
      setError("MetaMask not detected. Please install the extension.");
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setError(null);
  };

  // Position Picker Logic
  const startPositionPicker = () => {
    setIsPicking(true);
    setPickerCountdown(3);
    playSound('start');
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPicking && pickerCountdown !== null && pickerCountdown > 0) {
      timer = setTimeout(() => {
        setPickerCountdown(pickerCountdown - 1);
        playSound('click');
      }, 1000);
    } else if (isPicking && pickerCountdown === 0) {
      // Capture position on next move/click or just capture current?
      // Usually, you move the mouse and it captures where it is when the timer ends.
      const handleCapture = (e: MouseEvent) => {
        setCoordinates({ x: e.screenX, y: e.screenY });
        setIsPicking(false);
        setPickerCountdown(null);
        playSound('stop');
        window.removeEventListener('click', handleCapture);
      };
      
      // For better UX, we'll wait for the next click to confirm
      window.addEventListener('click', handleCapture, { once: true });
    }
    return () => clearTimeout(timer);
  }, [isPicking, pickerCountdown, playSound]);

  // Handle manual click
  const handleManualClick = useCallback(() => {
    setClicks(prev => prev + 1);
    const now = Date.now();
    clickTimes.current.push(now);
    playSound('click');
  }, [playSound]);

  // Auto-clicker logic
  useEffect(() => {
    if (isAutoClicking) {
      playSound('start');
      autoClickTimer.current = setInterval(() => {
        handleManualClick();
      }, intervalMs);
    } else {
      if (autoClickTimer.current) {
        playSound('stop');
        clearInterval(autoClickTimer.current);
        saveStats(); // Save stats when stopping
      }
    }
    return () => {
      if (autoClickTimer.current) clearInterval(autoClickTimer.current);
    };
  }, [isAutoClicking, intervalMs, handleManualClick, playSound]);

  // CPS Calculation
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      // Filter clicks in the last 1 second
      clickTimes.current = clickTimes.current.filter(t => now - t < 1000);
      const currentCps = clickTimes.current.length;
      setCps(currentCps);
      if (currentCps > maxCps) setMaxCps(currentCps);
    }, 100);
    return () => clearInterval(interval);
  }, [maxCps]);

  const toggleAutoClick = () => setIsAutoClicking(!isAutoClicking);

  const pythonScript = `import pyautogui
import time
import threading
from pynput.mouse import Button, Controller
from pynput.keyboard import Listener, KeyCode

# Settings
delay = ${intervalMs / 1000}
button = Button.left
start_stop_key = KeyCode(char='s')
exit_key = KeyCode(char='e')
click_mode = '${clickPosition}' # 'cursor' or 'fixed'
fixed_pos = (${coordinates.x}, ${coordinates.y})

class ClickMouse(threading.Thread):
    def __init__(self, delay, button):
        super(ClickMouse, self).__init__()
        self.delay = delay
        self.button = button
        self.running = False
        self.program_running = True

    def start_clicking(self):
        self.running = True

    def stop_clicking(self):
        self.running = False

    def exit(self):
        self.stop_clicking()
        self.program_running = False

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

with Listener(on_press=on_press) as listener:
    listener.join()`;

  return (
    <div className="min-h-screen bg-[#0F1115] text-white p-4 md:p-8 font-sans selection:bg-[#00F0FF]/30">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-[#00F0FF] animate-pulse" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#8E9299] font-mono">System Active // v2.4.0</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
              CLICK<span className="text-[#00F0FF]">PRO</span>
              <Cpu className="w-6 h-6 text-[#00F0FF]/50" />
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            {error && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-mono uppercase"
              >
                <AlertCircle className="w-3 h-3" />
                {error}
              </motion.div>
            )}
            
            {account ? (
              <div className="flex items-center gap-2 bg-[#1A1D23] p-1 rounded-lg hardware-border">
                <div className="px-3 py-1.5 flex items-center gap-2 text-[10px] font-mono text-[#00F0FF]">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  {account.slice(0, 6)}...{account.slice(-4)}
                </div>
                <button 
                  onClick={disconnectWallet}
                  className="px-3 py-1.5 rounded-md text-[10px] font-bold text-[#8E9299] hover:text-white transition-colors uppercase"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button 
                onClick={connectWallet}
                disabled={isConnecting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-[#00F0FF] text-xs font-bold hover:bg-[#00F0FF]/20 transition-all disabled:opacity-50"
              >
                <Wallet className="w-4 h-4" />
                {isConnecting ? 'CONNECTING...' : 'CONNECT METAMASK'}
              </button>
            )}

            <nav className="flex gap-1 bg-[#1A1D23] p-1 rounded-lg hardware-border">
              <button 
                onClick={() => setActiveTab('tool')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'tool' ? 'bg-[#00F0FF] text-[#0F1115]' : 'text-[#8E9299] hover:text-white'}`}
              >
                <Zap className="w-4 h-4" /> Utility Tool
              </button>
              <button 
                onClick={() => setActiveTab('script')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'script' ? 'bg-[#00F0FF] text-[#0F1115]' : 'text-[#8E9299] hover:text-white'}`}
              >
                <Terminal className="w-4 h-4" /> Script Generator
              </button>
            </nav>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {activeTab === 'tool' ? (
            <>
              {/* Left Column: Controls & Stats */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Stats Panel */}
                <section className="bg-[#1A1D23] rounded-2xl p-6 hardware-border space-y-6">
                  <div className="flex items-center gap-2 text-[#8E9299] mb-4">
                    <Activity className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-widest font-semibold">Real-time Telemetry</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="lcd-display p-4 rounded-xl">
                      <div className="text-[10px] text-[#00F0FF]/50 uppercase mb-1 font-mono">Current CPS</div>
                      <div className="text-3xl font-mono font-bold text-[#00F0FF] glow-text leading-none">
                        {cps.toString().padStart(2, '0')}
                      </div>
                    </div>
                    <div className="lcd-display p-4 rounded-xl">
                      <div className="text-[10px] text-amber-500/50 uppercase mb-1 font-mono">Peak CPS</div>
                      <div className="text-3xl font-mono font-bold text-amber-500 leading-none">
                        {maxCps.toString().padStart(2, '0')}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[#8E9299]">Total Clicks</span>
                      <span className="font-mono text-lg">{clicks.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[#8E9299]">Session Time</span>
                      <span className="font-mono text-lg">00:42:15</span>
                    </div>
                  </div>
                </section>

                {/* Configuration Panel */}
                <section className="bg-[#1A1D23] rounded-2xl p-6 hardware-border">
                  <div className="flex items-center gap-2 text-[#8E9299] mb-6">
                    <Settings2 className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-widest font-semibold">Engine Config</span>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium flex items-center gap-2">
                        {isSoundEnabled ? <Volume2 className="w-4 h-4 text-[#00F0FF]" /> : <VolumeX className="w-4 h-4 text-red-500" />}
                        Audio Feedback
                      </label>
                      <button 
                        onClick={() => setIsSoundEnabled(!isSoundEnabled)}
                        className={`w-10 h-5 rounded-full transition-colors relative ${isSoundEnabled ? 'bg-[#00F0FF]' : 'bg-[#0F1115]'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isSoundEnabled ? 'left-6' : 'left-1'}`} />
                      </button>
                    </div>

                    <div>
                      <div className="flex justify-between mb-4">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <Crosshair className="w-4 h-4 text-[#00F0FF]" />
                          Target Position
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2 p-1 bg-[#0F1115] rounded-lg hardware-border mb-4">
                        <button 
                          onClick={() => setClickPosition('cursor')}
                          className={`py-1.5 rounded-md text-[10px] font-bold transition-all ${clickPosition === 'cursor' ? 'bg-[#1A1D23] text-[#00F0FF]' : 'text-[#8E9299]'}`}
                        >
                          CURSOR
                        </button>
                        <button 
                          onClick={() => setClickPosition('fixed')}
                          className={`py-1.5 rounded-md text-[10px] font-bold transition-all ${clickPosition === 'fixed' ? 'bg-[#1A1D23] text-[#00F0FF]' : 'text-[#8E9299]'}`}
                        >
                          FIXED
                        </button>
                      </div>

                      {clickPosition === 'fixed' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] text-[#8E9299] font-mono">X COORD</label>
                              <input 
                                type="number" 
                                value={coordinates.x}
                                onChange={(e) => setCoordinates(prev => ({ ...prev, x: Number(e.target.value) }))}
                                className="w-full bg-[#0F1115] hardware-border rounded-lg p-2 font-mono text-xs text-[#00F0FF] focus:outline-none focus:border-[#00F0FF]/50"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-[#8E9299] font-mono">Y COORD</label>
                              <input 
                                type="number" 
                                value={coordinates.y}
                                onChange={(e) => setCoordinates(prev => ({ ...prev, y: Number(e.target.value) }))}
                                className="w-full bg-[#0F1115] hardware-border rounded-lg p-2 font-mono text-xs text-[#00F0FF] focus:outline-none focus:border-[#00F0FF]/50"
                              />
                            </div>
                          </div>
                          
                          <button 
                            onClick={startPositionPicker}
                            disabled={isPicking}
                            className={`w-full py-2 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-2 ${
                              isPicking 
                              ? 'bg-amber-500/10 border-amber-500/50 text-amber-500' 
                              : 'bg-[#1A1D23] border-white/10 text-[#8E9299] hover:text-[#00F0FF] hover:border-[#00F0FF]/50'
                            }`}
                          >
                            {isPicking ? (
                              <>
                                <span className="animate-pulse">CAPTURING IN {pickerCountdown}s...</span>
                              </>
                            ) : (
                              <>
                                <Crosshair className="w-3 h-3" /> PICK POSITION (SCREEN)
                              </>
                            )}
                          </button>
                          <p className="text-[9px] text-[#8E9299]/60 text-center italic">
                            * Click button, then click anywhere to capture screen coordinates
                          </p>
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex justify-between mb-2">
                        <label className="text-sm font-medium">Click Interval</label>
                        <span className="text-[#00F0FF] font-mono text-sm">{intervalMs}ms</span>
                      </div>
                      <input 
                        type="range" 
                        min="10" 
                        max="1000" 
                        step="10"
                        value={intervalMs}
                        onChange={(e) => setIntervalMs(Number(e.target.value))}
                        className="w-full h-1.5 bg-[#0F1115] rounded-lg appearance-none cursor-pointer accent-[#00F0FF]"
                      />
                      <div className="flex justify-between mt-2 text-[10px] text-[#8E9299] font-mono">
                        <span>FAST (10ms)</span>
                        <span>SLOW (1s)</span>
                      </div>
                    </div>

                    <button 
                      onClick={toggleAutoClick}
                      className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all transform active:scale-95 ${
                        isAutoClicking 
                        ? 'bg-red-500/10 text-red-500 border border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]' 
                        : 'bg-[#00F0FF] text-[#0F1115] hover:shadow-[0_0_30px_rgba(0,240,255,0.4)]'
                      }`}
                    >
                      {isAutoClicking ? (
                        <><Square className="w-5 h-5 fill-current" /> STOP ENGINE</>
                      ) : (
                        <><Play className="w-5 h-5 fill-current" /> START AUTO-CLICK</>
                      )}
                    </button>
                  </div>
                </section>
              </div>

              {/* Right Column: Interaction Area */}
              <div className="lg:col-span-8 space-y-6">
                <section className="bg-[#1A1D23] rounded-2xl p-8 hardware-border min-h-[500px] flex flex-col items-center justify-center relative overflow-hidden">
                  {/* Background Grid */}
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                    style={{ backgroundImage: 'radial-gradient(#00F0FF 1px, transparent 1px)', backgroundSize: '32px 32px' }} 
                  />
                  
                  <div className="text-center mb-12 relative z-10">
                    <h2 className="text-[#8E9299] text-sm uppercase tracking-[0.3em] font-bold mb-2">Primary Target</h2>
                    <p className="text-xs text-[#8E9299]/60 max-w-xs mx-auto">Manual input or automated pulse detection active</p>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleManualClick}
                    className="relative w-64 h-64 rounded-full flex items-center justify-center group z-10"
                  >
                    {/* Outer Rings */}
                    <div className="absolute inset-0 rounded-full border border-[#00F0FF]/20 group-hover:border-[#00F0FF]/40 transition-colors" />
                    <div className="absolute inset-4 rounded-full border border-[#00F0FF]/10 group-hover:border-[#00F0FF]/30 transition-colors" />
                    
                    {/* Main Button */}
                    <div className="w-48 h-48 rounded-full bg-gradient-to-br from-[#1A1D23] to-[#0F1115] hardware-border flex flex-col items-center justify-center shadow-2xl group-active:shadow-inner transition-all">
                      <MousePointer2 className={`w-12 h-12 mb-2 transition-colors ${isAutoClicking ? 'text-[#00F0FF] animate-bounce' : 'text-[#8E9299] group-hover:text-white'}`} />
                      <span className="text-[10px] font-mono text-[#8E9299] tracking-widest uppercase">Input Trigger</span>
                    </div>

                    {/* Ripple Effect on Click */}
                    <AnimatePresence>
                      {clicks > 0 && (
                        <motion.div
                          key={clicks}
                          initial={{ scale: 0.8, opacity: 0.5 }}
                          animate={{ scale: 1.5, opacity: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.4 }}
                          className="absolute inset-0 rounded-full border-2 border-[#00F0FF] pointer-events-none"
                        />
                      )}
                    </AnimatePresence>
                  </motion.button>

                  <div className="mt-12 grid grid-cols-3 gap-8 w-full max-w-md relative z-10">
                    <div className="text-center">
                      <div className="text-[10px] text-[#8E9299] uppercase mb-1 font-mono">Latency</div>
                      <div className="text-sm font-mono text-emerald-500">1.2ms</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-[#8E9299] uppercase mb-1 font-mono">Jitter</div>
                      <div className="text-sm font-mono text-amber-500">0.04ms</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-[#8E9299] uppercase mb-1 font-mono">Stability</div>
                      <div className="text-sm font-mono text-emerald-500">99.8%</div>
                    </div>
                  </div>
                </section>

                {/* History / Log */}
                <section className="bg-[#1A1D23] rounded-2xl p-6 hardware-border">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-[#8E9299]">
                      <History className="w-4 h-4" />
                      <span className="text-xs uppercase tracking-widest font-semibold">Event Log</span>
                    </div>
                    <button 
                      onClick={() => setClicks(0)}
                      className="text-[10px] text-[#8E9299] hover:text-white uppercase tracking-tighter"
                    >
                      Clear Memory
                    </button>
                  </div>
                  <div className="h-32 overflow-y-auto font-mono text-[11px] space-y-1 custom-scrollbar pr-2">
                    <div className="text-[#00F0FF]/40">[SYSTEM] Kernel initialized...</div>
                    <div className="text-[#00F0FF]/40">[SYSTEM] ClickPro Engine v2.4.0 online</div>
                    <div className="text-[#00F0FF]/40">[SERVER] Connected to SQLite database</div>
                    {recentStats.length > 0 && (
                      <div className="text-emerald-500/60">[STATS] Last session: {recentStats[0].total_clicks} clicks @ {recentStats[0].peak_cps} peak CPS</div>
                    )}
                    <div className="text-white/60">[USER] Manual trigger detected at {new Date().toLocaleTimeString()}</div>
                    {isAutoClicking && (
                      <div className="text-amber-500/60 animate-pulse">[ENGINE] Automated pulse sequence active @ {1000/intervalMs}Hz</div>
                    )}
                    <div className="text-white/20">... awaiting further input</div>
                  </div>
                </section>
              </div>
            </>
          ) : (
            /* Script Generator Tab */
            <div className="lg:col-span-12 space-y-6">
              <section className="bg-[#1A1D23] rounded-2xl p-8 hardware-border">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[#00F0FF]">
                      <Terminal className="w-5 h-5" />
                      <h2 className="text-xl font-bold">Local Machine Integration</h2>
                    </div>
                    <p className="text-[#8E9299] text-sm max-w-2xl">
                      Web browsers are sandboxed for security and cannot control your OS mouse directly. 
                      I have included <code className="text-[#00F0FF] bg-black/30 px-1 rounded">autoclicker.py</code> in the root of this project for you. 
                      It uses the <code className="text-[#00F0FF] bg-black/30 px-1 rounded">pyautogui</code> and <code className="text-[#00F0FF] bg-black/30 px-1 rounded">pynput</code> libraries.
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <div className="bg-[#0F1115] p-4 rounded-xl hardware-border text-center min-w-[120px]">
                      <div className="text-[10px] text-[#8E9299] uppercase mb-1">Hotkey</div>
                      <div className="text-lg font-mono font-bold text-[#00F0FF]">S</div>
                      <div className="text-[9px] text-[#8E9299]">Start/Stop</div>
                    </div>
                    <div className="bg-[#0F1115] p-4 rounded-xl hardware-border text-center min-w-[120px]">
                      <div className="text-[10px] text-[#8E9299] uppercase mb-1">Exit</div>
                      <div className="text-lg font-mono font-bold text-red-500">E</div>
                      <div className="text-[9px] text-[#8E9299]">Kill Process</div>
                    </div>
                  </div>
                </div>

                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-[#00F0FF]/20 to-transparent rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                  <div className="relative bg-[#050505] rounded-xl p-6 font-mono text-sm overflow-x-auto border border-white/10">
                    <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/5">
                      <span className="text-[#8E9299] text-xs">autoclicker.py</span>
                      <button 
                        onClick={() => navigator.clipboard.writeText(pythonScript)}
                        className="text-[10px] bg-[#1A1D23] px-3 py-1 rounded border border-white/10 hover:border-[#00F0FF]/50 transition-colors"
                      >
                        COPY CODE
                      </button>
                    </div>
                    <pre className="text-emerald-400/90 leading-relaxed">
                      {pythonScript}
                    </pre>
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-2 mb-2 text-white font-semibold">
                      <div className="w-5 h-5 rounded bg-[#00F0FF]/20 flex items-center justify-center text-[#00F0FF] text-xs">1</div>
                      Install Python
                    </div>
                    <p className="text-xs text-[#8E9299]">Download and install Python from python.org if you haven't already.</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-2 mb-2 text-white font-semibold">
                      <div className="w-5 h-5 rounded bg-[#00F0FF]/20 flex items-center justify-center text-[#00F0FF] text-xs">2</div>
                      Install Libraries
                    </div>
                    <p className="text-xs text-[#8E9299]">Run <code className="text-[#00F0FF]">pip install pyautogui pynput</code> in your terminal.</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-2 mb-2 text-white font-semibold">
                      <div className="w-5 h-5 rounded bg-[#00F0FF]/20 flex items-center justify-center text-[#00F0FF] text-xs">3</div>
                      Run Script
                    </div>
                    <p className="text-xs text-[#8E9299]">Save the code as <code className="text-[#00F0FF]">clicker.py</code> and run it with <code className="text-[#00F0FF]">python clicker.py</code>.</p>
                  </div>
                </div>
              </section>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="pt-12 pb-8 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-white/5">
          <div className="flex items-center gap-6 text-[10px] text-[#8E9299] font-mono uppercase tracking-widest">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Engine Stable
            </div>
            <div>Uptime: 99.99%</div>
            <div>Build: 0x7F2A</div>
          </div>
          <div className="flex items-center gap-4">
            <Trophy className="w-4 h-4 text-amber-500/50" />
            <span className="text-[10px] text-[#8E9299] font-mono">Global Rank: #142</span>
          </div>
        </footer>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 240, 255, 0.3);
        }
      `}</style>
    </div>
  );
}
