"""
Standalone market-data ingestion for the WOWS Portal.

Three commands, run by hand, never as a service:

    python -m wows_ingest fetch    network; writes data/raw/<source>/<date>/
    python -m wows_ingest build    offline; raw -> data/snapshots/v<N>/
    python -m wows_ingest check    offline; validates a snapshot, exit 1 on failure

`build` never touches the network. Anyone in three years must be able to
rebuild a byte-identical snapshot from the committed raw files alone.
"""

__all__ = ["__version__"]
__version__ = "1.0.0"
