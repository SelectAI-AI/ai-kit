"""
security_utils
==============

Shared, importable security infrastructure for the InternalAssist labs.

This package is intentionally split into two kinds of modules:

1. Pre-built infrastructure (ships as-is -- you do not write this):
   - config.py          environment/settings loading
   - corpus.py          the red-team attack corpus + benign control set + scoring oracle
   - logging_utils.py   structured audit logging

2. Generated modules (you build these LIVE in the notebook; they do not exist
   until you run the relevant notebook cells):
   - detectors.py       pattern-detection functions (Notebook 1, Sections 7 & 9)
   - prompts.py         instruction-hierarchy prompt builders (Notebook 1, Section 8)
   - callbacks.py       the LangChain guardrail callback (Notebook 1, Section 9)

Notebooks write the generated modules to disk with `%%writefile` so the exact
code you tested interactively gets reused by later notebooks and by the
pytest suite -- this mirrors how production teams "graduate" code from a
notebook prototype into a real module.
"""

__version__ = "0.1.0"
