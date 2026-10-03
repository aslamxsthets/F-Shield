#!/usr/bin/env python3
"""
F-Shield One-Command Runner
Starts the complete F-Shield full-stack application.
"""
import subprocess
import sys
import os

def main():
    print("=" * 60)
    print("  F-SHIELD — FRAUD DETECTION & FORENSIC PLATFORM")
    print("  Pre-Shipment Interception & Forensic Intelligence")
    print("=" * 60)
    print("Starting F-Shield full-stack platform on port 3000...")

    # Run npm start / dev server
    try:
        subprocess.run(["npm", "run", "dev"], check=True)
    except KeyboardInterrupt:
        print("\nF-Shield shutdown requested. Exiting cleanly.")
    except Exception as e:
        print(f"Error starting platform: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
