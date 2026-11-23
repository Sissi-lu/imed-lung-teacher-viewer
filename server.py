"""Local entry point for the authenticated viewer service."""
from pathlib import Path
import runpy

runpy.run_path(str(Path(__file__).resolve().with_name('remote_server.py')), run_name='__main__')
