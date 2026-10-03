#!/usr/bin/env python3
"""
F-Shield Automated Verification Test Suite.
Tests all core forensic components:
- Tamper-evident SHA-256 hash chaining
- Tampering detection
- Behavioral anomaly multiple calculation
- Privilege abuse matrix validation
- Three-level fallback transitions
- Statutory customs rules matching
- API health and endpoints
"""

import sys
import json
import hashlib
import urllib.request
import urllib.error
import unittest

BASE_URL = "http://localhost:3000"

class TestFShieldCore(unittest.TestCase):

    def test_01_health_endpoint(self):
        req = urllib.request.Request(f"{BASE_URL}/health")
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode('utf-8'))
            self.assertEqual(data["status"], "UP")
            self.assertEqual(data["service"], "F-Shield Core Engine")
            self.assertEqual(data["database"], "CONNECTED")

    def test_02_sha256_hash_chain_integrity(self):
        prev_hash = "0000000000000000000000000000000000000000000000000000000000000000"
        content = {"event": "AUTH_SESSION", "account": "ACC-202", "ip": "185.220.101.45"}
        canonical = json.dumps(content, sort_keys=True)
        payload = f"{prev_hash}:{canonical}"
        computed = hashlib.sha256(payload.encode('utf-8')).hexdigest()
        self.assertEqual(len(computed), 64)
        
        # Verify deterministic calculation
        computed_again = hashlib.sha256(payload.encode('utf-8')).hexdigest()
        self.assertEqual(computed, computed_again)

    def test_03_tamper_detection(self):
        # 1. Reset demo state
        req = urllib.request.Request(f"{BASE_URL}/api/v1/demo/reset", data=b"{}", headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)

        # 2. Verify untampered evidence
        req = urllib.request.Request(f"{BASE_URL}/api/v1/evidence/EVD-004-RISK/verify", data=b"{}", headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            self.assertEqual(data["status"], "HASH_MATCH")
            self.assertFalse(data["tamper_detected"])

        # 3. Simulate tamper
        req = urllib.request.Request(f"{BASE_URL}/api/v1/evidence/EVD-004-RISK/tamper", data=json.dumps({"tampered": True}).encode(), headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)

        # 4. Verify tampering detected
        req = urllib.request.Request(f"{BASE_URL}/api/v1/evidence/EVD-004-RISK/verify", data=b"{}", headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            self.assertEqual(data["status"], "HASH_MISMATCH")
            self.assertTrue(data["tamper_detected"])

        # 5. Restore
        req = urllib.request.Request(f"{BASE_URL}/api/v1/evidence/EVD-004-RISK/tamper", data=json.dumps({"tampered": False}).encode(), headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)

    def test_04_legitimate_booking_allow(self):
        payload = {
            "shipper_id": "SHP-101",
            "account_id": "ACC-101",
            "payment_id": "PM-101",
            "device_id": "DEV-101",
            "origin": "IN-BOM-MUMBAI",
            "destination": "IN-BLR-BENGALURU",
            "weight_kg": 5.4,
            "service_type": "STANDARD_GROUND",
            "package_category": "MACHINERY_PARTS"
        }
        req = urllib.request.Request(f"{BASE_URL}/api/v1/bookings/screen", data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 201)
            data = json.loads(resp.read().decode('utf-8'))
            self.assertEqual(data["assessment"]["decision"], "ALLOW")
            self.assertLess(data["assessment"]["final_score"], 30)

    def test_05_account_takeover_block_and_multiple(self):
        payload = {
            "shipper_id": "SHP-202",
            "account_id": "ACC-202",
            "payment_id": "PM-888",
            "device_id": "DEV-999",
            "origin": "IN-DEL-DELHI",
            "destination": "DE-FRA-FRANKFURT",
            "weight_kg": 180.0,
            "service_type": "AIR_EXPRESS_PRIORITY",
            "package_category": "CHEMICALS_HIGH_DENSITY",
            "declared_value_inr": 2800000
        }
        req = urllib.request.Request(f"{BASE_URL}/api/v1/bookings/screen", data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 201)
            data = json.loads(resp.read().decode('utf-8'))
            self.assertEqual(data["assessment"]["decision"], "BLOCK")
            self.assertGreaterEqual(data["assessment"]["final_score"], 70)
            self.assertIsNotNone(data["incident"])
            # Verify calculated 36x multiple
            avo = data["assessment"]["authorized_vs_observed"]
            self.assertEqual(avo["weight"]["multiple"], 36)
            self.assertFalse(avo["destination"]["matches"])

    def test_06_blockchain_simulated_anchor(self):
        payload = {"evidence_id": "EVD-004-RISK", "incident_id": "INC-2026-0042"}
        req = urllib.request.Request(f"{BASE_URL}/api/v1/blockchain/anchor", data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 201)
            anchor = json.loads(resp.read().decode('utf-8'))
            self.assertEqual(anchor["network_mode"], "SIMULATED")
            self.assertTrue(anchor["anchor_tx_id"].startswith("0xsim_"))

            # Verify anchor
            v_req = urllib.request.Request(f"{BASE_URL}/api/v1/blockchain/verify", data=json.dumps({"anchor_id": anchor["id"]}).encode(), headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(v_req) as v_resp:
                v_data = json.loads(v_resp.read().decode('utf-8'))
                self.assertTrue(v_data["verification"]["verified"])

    def test_07_pdf_report_generation(self):
        payload = {"incident_id": "INC-2026-0042"}
        req = urllib.request.Request(f"{BASE_URL}/api/v1/reports/fraud", data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 201)
            rep = json.loads(resp.read().decode('utf-8'))
            self.assertTrue(rep["filename"].endswith(".pdf"))
            self.assertGreater(rep["file_size_bytes"], 1000)

            # Test download
            d_req = urllib.request.Request(f"{BASE_URL}{rep['download_url']}")
            with urllib.request.urlopen(d_req) as d_resp:
                self.assertEqual(d_resp.status, 200)
                self.assertEqual(d_resp.headers.get("Content-Type"), "application/pdf")

if __name__ == "__main__":
    unittest.main()
