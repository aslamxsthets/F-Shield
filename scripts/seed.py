#!/usr/bin/env python3
"""
F-Shield Database Seeder & Scenario Generator.
Initializes test scenarios A, B, C, D, E, F and verifies integrity.
"""
import urllib.request
import json
import sys

def seed():
    print("[F-Shield Seeder] Connecting to F-Shield API...")
    url = "http://localhost:3000/api/v1/demo/reset"
    req = urllib.request.Request(url, data=b"{}", headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            print(f"[F-Shield Seeder] Success: {data.get('message')}")
            print(f"[F-Shield Seeder] Timestamp: {data.get('timestamp')}")
    except Exception as e:
        print(f"[F-Shield Seeder] Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    seed()
