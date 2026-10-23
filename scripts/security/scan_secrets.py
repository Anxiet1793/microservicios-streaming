"""Scan repository candidates without ever printing secret values (stdlib only).

Default: tracked + untracked, non-ignored working files. --history also inspects
reachable Git blobs; historical findings are reported separately and require
credential rotation, not an automatic history rewrite.
"""
import argparse
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PATTERNS = {
    "private-key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----"),
    "aws-access-key": re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b"),
    "github-token": re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b"),
    "api-key": re.compile(r"\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{40,}\b"),
    "credentialed-database-uri": re.compile(r"(?:mongodb(?:\+srv)?|postgres(?:ql)?|redis)://([^\s\"'`<>]+):([^\s\"'`<>@]+)@"),
    "credential-literal": re.compile(r'''(?i)(?:password|secret_key|access_key|api_key|secretkey|accesskey)\s*[:=]\s*["']([^"'\r\n]{8,})["']'''),
}
PLACEHOLDER = re.compile(r"(?i)(change[_-]?me|replace|reemplazar|unused|example|placeholder|your[_-]|<|\$|process\.env|env\.|random|config\.|\.repeat\(|test|fixture|demo|development|e2e|streaming-local|local-only|generate|readEnvironment)")


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


def findings(path, data):
    # Generated files/binaries cannot be mistaken for source credentials.
    if b"\0" in data[:8192]:
        return []
    text = data.decode("utf-8", errors="replace")
    result = []
    for kind, pattern in PATTERNS.items():
        for match in pattern.finditer(text):
            if kind in {"credentialed-database-uri", "credential-literal"}:
                candidate = match.group(2 if kind == "credentialed-database-uri" else 1)
                if kind == "credential-literal" and re.fullmatch(r"\{\{[A-Za-z_]\w*\}\}", candidate):
                    continue  # A complete Bruno template references a variable, not a credential.
                if PLACEHOLDER.search(candidate):
                    continue
                # Synthetic secrets belong only in test helpers / verification scripts.
                # Production source, ENV examples and arbitrary scripts are still scanned.
                if kind == "credential-literal" and ("/tests/" in "/" + path or Path(path).name.startswith("verify-")):
                    continue
                if kind == "credential-literal" and path == "users-service/scripts/generate-openapi.ts" and candidate in {"PasswordSegura123!", "NuevaPasswordSegura456!"}:
                    continue
            result.append({"path": path, "line": text.count("\n", 0, match.start()) + 1, "kind": kind})
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--history", action="store_true")
    options = parser.parse_args()
    current = []
    files = git("ls-files", "--cached", "--others", "--exclude-standard", "-z").decode().split("\0")
    for name in sorted(set(filter(None, files))):
        path = ROOT / name
        if path.is_file() and path.stat().st_size <= 5_000_000:
            if path.name.startswith(".env") and path.name != ".env.example":
                current.append({"path": name, "line": 1, "kind": "versioned-environment-file"})
            current.extend(findings(name, path.read_bytes()))
    historical = []
    if options.history:
        objects = dict(entry.split(" ", 1) for entry in git("rev-list", "--objects", "--all").decode().splitlines() if " " in entry)
        batch = subprocess.check_output(["git", "cat-file", "--batch"], cwd=ROOT, input=("\n".join(objects) + "\n").encode())
        offset = 0
        while offset < len(batch):
            end = batch.index(b"\n", offset)
            oid, kind, size = batch[offset:end].decode().split()
            length = int(size); offset = end + 1
            if kind == "blob" and length <= 5_000_000:
                historical.extend({**item, "blob": oid} for item in findings(objects[oid], batch[offset:offset + length]))
            offset += length + 1
    print(json.dumps({"current": current, "historical": historical, "filesScanned": len(set(filter(None, files)))}, indent=2))
    return int(bool(current))


if __name__ == "__main__":
    raise SystemExit(main())
