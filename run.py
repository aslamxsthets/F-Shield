#!/usr/bin/env python3
"""
FraudShield One-Command Runner
Starts the complete FraudShield Full-Stack Application.
"""
import subprocess
import sys
import os

def main():
    print("=" * 60)
    print("  FRAUDSHIELD — FRAUD DETECTION & FORENSIC PLATFORM")
    print("  Pre-Shipment Interception & Forensic Intelligence")
    print("=" * 60)
    print("Starting FraudShield Full-Stack Platform on port 3000...")

    # Run npm start / dev server
    try:
        subprocess.run(["npm", "run", "dev"], check=True)
    except KeyboardInterrupt:
        print("\nFraudShield shutdown requested. Exiting cleanly.")
    except Exception as e:
        print(f"Error starting platform: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
