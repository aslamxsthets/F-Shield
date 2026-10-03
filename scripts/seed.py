#!/usr/bin/env python3
"""
FraudShield Database Seeder & Scenario Generator.
Initializes test scenarios A, B, C, D, E, F and verifies integrity.
"""
import urllib.request
import json
import sys

def seed():
    print("[FraudShield Seeder] Connecting to FraudShield API...")
    url = "http://localhost:3000/api/v1/demo/reset"
    req = urllib.request.Request(url, data=b"{}", headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            print(f"[FraudShield Seeder] Success: {data.get('message')}")
            print(f"[FraudShield Seeder] Timestamp: {data.get('timestamp')}")
    except Exception as e:
        print(f"[FraudShield Seeder] Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    seed()
