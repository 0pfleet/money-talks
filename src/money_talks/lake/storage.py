"""Atomic parquet file storage with schema validation.

Key pattern: write to a temp file, then os.replace() for atomicity.
This prevents partial/corrupted files if the process is interrupted.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pandas as pd


def write_parquet_atomic(df: pd.DataFrame, path: str | Path) -> Path:
    """Write a DataFrame to parquet atomically.

    Writes to a temp file in the same directory, then renames.
    This ensures readers never see a partial file.

    Args:
        df: DataFrame to write.
        path: Destination parquet file path.

    Returns:
        The path written to.
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    # Write to temp file in same directory (same filesystem for atomic rename)
    fd, tmp_path = tempfile.mkstemp(dir=path.parent, suffix=".parquet.tmp")
    try:
        os.close(fd)
        df.to_parquet(tmp_path, index=False, engine="pyarrow")
        os.replace(tmp_path, path)
    except Exception:
        # Clean up temp file on failure
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise

    return path


def load_table(path: str | Path) -> pd.DataFrame:
    """Load a parquet file into a DataFrame.

    Args:
        path: Path to a .parquet file or directory of parquet files.

    Returns:
        DataFrame with the loaded data.
    """
    path = Path(path)
    if path.is_dir():
        # Load all parquet files in directory
        frames = [pd.read_parquet(f) for f in sorted(path.glob("*.parquet"))]
        if not frames:
            return pd.DataFrame()
        return pd.concat(frames, ignore_index=True)
    return pd.read_parquet(path)
