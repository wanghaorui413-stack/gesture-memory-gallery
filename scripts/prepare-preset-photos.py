"""Make small, metadata-free copies of the photos selected for the birthday gift."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageOps


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source",
        type=Path,
        default=Path.home() / "Desktop" / "相册",
        help="Folder containing the photos to include by default.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "preset-photos",
    )
    args = parser.parse_args()
    source = args.source.expanduser().resolve()
    output = args.output.expanduser().resolve()
    if not source.is_dir():
        raise SystemExit(f"Photo folder does not exist: {source}")

    files = sorted(
        file for file in source.iterdir()
        if file.is_file() and file.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
    )
    if not files:
        raise SystemExit(f"No supported photos found in {source}")

    output.mkdir(parents=True, exist_ok=True)
    manifest: list[str] = []
    for index, file in enumerate(files, 1):
        target = output / f"{index:02d}.jpg"
        with Image.open(file) as original:
            image = ImageOps.exif_transpose(original).convert("RGB")
            image.thumbnail((1400, 1400), Image.Resampling.LANCZOS)
            image.save(target, "JPEG", quality=81, optimize=True, progressive=True)
        manifest.append(target.name)
        print(f"{file.name} -> {target.name} ({target.stat().st_size // 1024} KB)")
    (output / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Prepared {len(manifest)} photos in {output}")


if __name__ == "__main__":
    main()
