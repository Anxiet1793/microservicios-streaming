"""Redact disposable test credentials in Playwright ZIPs before CI upload.

Uses Python's standard library (available on ubuntu-24.04); never extracts paths.
An unreadable/corrupt trace fails the step, preventing unreviewed trace upload.
"""
import argparse
from pathlib import Path
import re
import zipfile


def sanitize(directory: Path) -> int:
    count = 0
    for path in directory.rglob("*.zip"):
        temporary = path.with_suffix(".sanitized.tmp")
        try:
            with zipfile.ZipFile(path) as source, zipfile.ZipFile(temporary, "w") as target:
                for entry in source.infolist():
                    data = source.read(entry)
                    # Text events/resources can contain fill arguments or request bodies.
                    # JPEG/PNG buffers are copied byte-for-byte; snapshots/sources are off.
                    try:
                        text = data.decode("utf-8")
                    except UnicodeDecodeError:
                        target.writestr(entry, data)
                        continue
                    text = re.sub(r"QA-[a-f0-9]{48}(?:-new)?", "[REDACTED TEST PASSWORD]", text)
                    text = re.sub(r"\b[a-f0-9]{64}\b", "[REDACTED TEST SESSION]", text)
                    text = re.sub(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", "[REDACTED JWT]", text)
                    target.writestr(entry, text.encode("utf-8"))
            temporary.replace(path)
            count += 1
        finally:
            temporary.unlink(missing_ok=True)
    return count


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    print(f"Sanitized {sanitize(args.directory)} Playwright trace archive(s).")
