# Development Environment Setup

## Overview

This project uses:

* Python 3.11
* Visual Studio Code (VS Code)
* Git for Windows
* Virtual Environments (`.venv`)
* Environment Variables (`.env`)
* `python-dotenv`
* Separate Development, Test, and Production configurations

---

# Prerequisites

## 1. Install Python 3.11

Download Python 3.11:

* [Python Downloads](https://www.python.org/downloads/)
* Specific Python 3.11 releases: [Python 3.11 Releases](https://www.python.org/downloads/release/python-3119/)

During installation:

Check **"Add Python to PATH"**

Verify installation:

```bash
python --version
```

Expected:

```bash
Python 3.11.x
```

---

## 2. Install Visual Studio Code

Download:

* [Visual Studio Code](https://code.visualstudio.com/download)

Recommended VS Code Extensions:

* Python
* Pylance
* GitLens
* dotenv
* YAML
* Docker (optional)

Official Python extension:

* [VS Code Python Extension](https://marketplace.visualstudio.com/items?itemName=ms-python.python)

---

## 3. Install Git for Windows

Download:

* [Git for Windows](https://git-scm.com/download/win)

Verify:

```bash
git --version
```

Example:

```bash
git version 2.xx.x.windows.x
```

---

# Clone Repository

Fork the repository first.

Then:

```bash
git clone <your-fork-url>
cd <repository-name>
```

---

# Create Virtual Environment

Create:

```bash
python -m venv .venv
```

Activate (Windows):

```bash
.venv\Scripts\activate
```

Activate (PowerShell):

```powershell
.\.venv\Scripts\Activate.ps1
```

Verify:

```bash
where python
```

Expected:

```bash
...\project\.venv\Scripts\python.exe
```

---

# Install Dependencies

Upgrade pip:

```bash
python -m pip install --upgrade pip
```

Install project dependencies:

```bash
pip install -r requirements.txt
```

---

# Environment Variables

Install dotenv:

```bash
pip install python-dotenv
```

Create:

```text
.env
```

Example:

```env
APP_ENV=dev

API_KEY=your_api_key

DATABASE_URL=your_database_url
```

Never commit:

```text
.env
```

Add to `.gitignore`:

```gitignore
.env
```

---

# Load Environment Variables

Example:

```python
from dotenv import load_dotenv
import os

load_dotenv()

api_key = os.getenv("API_KEY")
```

---

# Environment Separation

Create:

```text
config/
├── dev.env
├── test.env
└── prod.env
```

Example:

## dev.env

```env
APP_ENV=dev
LOG_LEVEL=DEBUG
```

## test.env

```env
APP_ENV=test
LOG_LEVEL=INFO
```

## prod.env

```env
APP_ENV=prod
LOG_LEVEL=WARNING
```

Load dynamically:

```python
import os
from dotenv import load_dotenv

env = os.getenv("APP_ENV", "dev")

load_dotenv(f"config/{env}.env")
```

---

# Recommended Project Structure

```text
project/
│
├── src/
├── tests/
├── config/
│   ├── dev.env
│   ├── test.env
│   └── prod.env
│
├── .venv/
├── .env
├── requirements.txt
├── README.md
└── .gitignore
```

---

# VS Code Configuration

Open project:

```bash
code .
```

Select interpreter:

```text
Ctrl + Shift + P
Python: Select Interpreter
```

Choose:

```text
.venv/Scripts/python.exe
```

---

# Useful Commands

Install dependency:

```bash
pip install package_name
```

Freeze requirements:

```bash
pip freeze > requirements.txt
```

Run tests:

```bash
pytest
```

Deactivate virtual environment:

```bash
deactivate
```

---

# Common Issues and Fixes

## Issue 1: Python Not Found

Error:

```bash
python is not recognized
```

Fix:

* Reinstall Python
* Enable "Add Python to PATH"
* Restart terminal

---

## Issue 2: Wrong Python Interpreter in VS Code

Symptoms:

* Imports unresolved
* Packages not found

Fix:

```text
Ctrl + Shift + P
Python: Select Interpreter
```

Select:

```text
.venv
```

---

## Issue 3: ModuleNotFoundError

Error:

```python
ModuleNotFoundError
```

Fix:

```bash
pip install -r requirements.txt
```

Verify:

```bash
pip list
```

---

## Issue 4: .env Not Loading

Fix:

```python
from dotenv import load_dotenv

load_dotenv()
```

Verify:

```python
print(os.getenv("API_KEY"))
```

---

## Issue 5: Git Authentication Problems

Recommended:

* Use GitHub Personal Access Token (PAT)
* Configure Git Credential Manager

Check:

```bash
git config --global user.name
git config --global user.email
```

---

## Issue 6: Virtual Environment Activation Disabled

PowerShell error:

```powershell
running scripts is disabled
```

Fix:

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Restart PowerShell.

---

# Git Ignore

```gitignore
.venv/
.env
__pycache__/
*.pyc
.vscode/
.idea/
```

---

# References

* Python Documentation
* VS Code Documentation
* Git Documentation
* python-dotenv Documentation

---

# Development Workflow

1. Pull latest changes
2. Activate `.venv`
3. Load environment configuration
4. Develop locally
5. Run tests
6. Commit changes
7. Push to fork
8. Create Pull Request
9. Deploy through CI/CD pipeline

Following this setup from Day 1 ensures consistent Development, Test, and Production environments and minimizes deployment issues.
