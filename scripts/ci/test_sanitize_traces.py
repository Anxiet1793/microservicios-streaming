"""Artifact safety checks, without starting application services."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location("sanitize_traces", Path(__file__).with_name("sanitize-traces.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class TraceSanitization(unittest.TestCase):
    def test_redacts_credentials_and_preserves_debugging_evidence(self):
        with tempfile.TemporaryDirectory(prefix="nevaro-trace-test-") as folder:
            root = Path(folder)
            password = "QA-" + "a" * 48
            cookie = "b" * 64
            payload = {"method": "fill", "value": password + "-new", "cookie": cookie, "jwt": "eyJ0eXAiOiJKV1QifQ.eyJzdWIiOiJ0ZXN0In0.signature", "error": "Expected 200, received 503"}
            image = b"\x89PNG\r\n\x1a\n\xff"
            archive = root / "trace.zip"
            with zipfile.ZipFile(archive, "w") as z:
                z.writestr("0.trace", json.dumps(payload) + "\n")
                z.writestr("resources/image.png", image)
            self.assertEqual(module.sanitize(root), 1)
            with zipfile.ZipFile(archive) as z:
                data = z.read("0.trace").decode()
                self.assertNotIn(password, data)
                self.assertNotIn(cookie, data)
                self.assertNotIn(payload["jwt"], data)
                self.assertEqual(json.loads(data)["error"], payload["error"])
                self.assertEqual(z.read("resources/image.png"), image)

    def test_corrupt_archive_fails_closed(self):
        with tempfile.TemporaryDirectory(prefix="nevaro-trace-test-") as folder:
            root = Path(folder)
            (root / "trace.zip").write_bytes(b"corrupted")
            with self.assertRaises(zipfile.BadZipFile):
                module.sanitize(root)

    def test_no_traces_is_valid_for_successful_runs(self):
        with tempfile.TemporaryDirectory(prefix="nevaro-trace-test-") as folder:
            self.assertEqual(module.sanitize(Path(folder)), 0)


if __name__ == "__main__":
    unittest.main()
