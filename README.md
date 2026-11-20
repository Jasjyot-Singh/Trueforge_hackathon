# TrueForge Coding Agent (Techfest IIT Bombay Forge-a-thon)

An editor-native VS Code coding agent built on **TrueForge** (`@truefoundry/trueforge`), TrueFoundry's open-source agent harness.

This agent autonomously explores codebases, manages context assembly within strict token budgets, performs hunk-by-hunk diff reviews, and ensures robust error handling and model fallback without ever blocking the editor.

---

## 1. Upstream Fork & Starting Point Declaration

* **Fork Origin:** Open-source editor integration architecture referenced from [Cline](https://github.com/cline/cline) (commit `a9b46f1`) and VS Code MCP Architecture.
* **Core Agent Harness:** **TrueForge** (`@truefoundry/trueforge` v0.185.1).
* **Changes Made & Rationale:** Replaced all internal proprietary agent loops with TrueForge session turns and tool orchestration. Exposed VS Code workspace capabilities (`read_file`, `search_workspace`, `propose_diff`, `run_terminal_command`) as MCP tools registered to TrueForge.

---

## 2. Quickstart & Clean Clone Setup

### Prerequisites
* **Node.js** >= 22.14.0
* **Python** >= 3.10
* **VS Code** >= 1.85.0

### Step 1: Start TrueForge Locally
In a separate terminal, launch the TrueForge local agent harness:
```bash
npx --yes @truefoundry/trueforge@latest
```
By default, the server runs in standalone mode on `http://localhost:8790`.

### Step 2: Configure Models
Copy the example configuration file:
```bash
cp extension/config.example.json extension/config.json
```
Edit `extension/config.json` with your preferred model provider (OpenAI, Anthropic, Ollama, OpenRouter, or TrueForge AI Gateway).

### Step 3: Build & Launch the VS Code Extension
```bash
cd extension
npm install
npm run compile
```
Press `F5` in VS Code to launch the extension in a new Extension Development Host window.

---

## 3. The 3 Fixed Benchmark Demonstrations (pallets/flask v3.1.3)

All benchmark tests are demonstrated on `pallets/flask` (commit `22d92470`):

### Task A: Inline Edit
1. Open `src/flask/helpers.py`, highlight `get_debug_flag()`, press `Ctrl+K`.
2. Prompt: `"Treat the values 'off' and 'n' as false as well, case-insensitively, and update the docstring to list every value that is treated as false."`
3. Accept diff and verify in terminal:
   ```bash
   FLASK_DEBUG=off python -c "from flask.helpers import get_debug_flag; print(get_debug_flag())"
   ```
   *Expected output:* `False`

### Task B: Agent Mode (Multi-File Autonomous)
1. Open the TrueForge Agent Panel in the VS Code sidebar.
2. Prompt: `"Add a new built-in CLI command flask config that prints the loaded application's configuration as JSON, masking the values of any key containing SECRET, PASSWORD, TOKEN or KEY as "***". It must appear in flask --help, be covered by a test, and be documented alongside the other built-in commands."`
3. TrueForge discovers and edits 3 files: `src/flask/cli.py`, `tests/test_cli.py`, and `docs/cli.rst`.
4. Verify in terminal:
   ```bash
   pytest tests/test_cli.py -q
   flask --app demo_app.py config
   ```

### Task C: Resilience & Failure Handling
1. In `config.json`, set an invalid API key or unreachable host endpoint.
2. Re-trigger Task A.
3. Extension stays completely responsive, displays a non-blocking error notification, and `git status` verifies no files are touched.

---

## 4. License
MIT License. Upstream licenses and attributions preserved.

