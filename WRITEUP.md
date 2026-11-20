# TrueFoundry Forge-a-thon Round 1 Submission Write-up

## 1. Team
* **Team Name:** error_404
* **Team ID:** TM-D48805F70BF
* **Competition ID:** TFF-B691E0E59AD0
* **Team Leader:** Jasjyot Singh (GitHub: @Jasjyot-Singh, Email: jasjyotsingh11@gmail.com)

---

## 2. Starting Point
* **Upstream Starting Point:** Referenced open-source editor-side architecture from **Cline** (commit `a9b46f1e8`) and VS Code Model Context Protocol (MCP) TypeScript client patterns.
* **Modifications:** Replaced the entire internal agent loop and hardcoded model connectors with **TrueForge** (`@truefoundry/trueforge` v0.185.1). No proprietary upstream agent state machine was retained. All editor actions are delegated as MCP tools.

---

## 3. Architecture on TrueForge
The architecture cleanly separates the editor interface from the autonomous agent runtime:
* **TrueForge Runtime (`localhost:8790`):** Runs the local standalone agent daemon utilizing SQLite for persistent session memory and turns orchestration.
* **VS Code Extension (Client):** Implemented in TypeScript. It communicates with TrueForge via the HTTP API and SSE (Server-Sent Events) turn streams (`/api/v1/sessions/turns/stream`).
* **MCP Capabilities Exposed:**
  1. `read_file(path)`: Fetches file content for context assembly.
  2. `search_workspace(query)`: High-speed heuristic search for symbol, path, and keyword matches.
  3. `propose_diff(path, content)`: Creates virtual hunk previews in editor memory before touching disk.
  4. `run_terminal_command(cmd)`: Sandboxed execution for testing (`pytest`) and CLI verification.
* **Harness Features Used:** TrueForge's turn-based tool loop, streaming event dispatcher, approval-driven tool gates (preventing silent disk writes), and session lifecycle manager.

---

## 4. How Context is Selected
* **Token Budget:** Strict window cap of 16,384 tokens allocated for assembled context per turn to prevent attention degradation and minimize latency.
* **Retrieval Strategy:**
  1. *Explicit Mentions:* Direct extraction of `@file` and `@symbol` tags with top priority.
  2. *Heuristic Symbol & Keyword Indexing:* When no files are mentioned (as in Task B), the agent performs regex queries across workspace symbols (`cli`, `command`, `options`), ranking candidate files by relevance score.
  3. *Size Budgeting & Truncation:* Only relevant AST nodes and target functions are injected, preserving headroom for multi-turn reasoning and avoiding full-repo concatenation.

---

## 5. Model Setup
* **Primary Models:**
  * OpenAI `gpt-4o` / Anthropic `claude-3-5-sonnet` configured via TrueForge AI Gateway.
  * Local alternative: `qwen2.5-coder:7b` served via Ollama (OpenAI-compatible local endpoint `http://localhost:11434/v1`).
* **Cost & Compute:** Sub-cent execution per task (~$0.02 total for Flask test iterations).
* **Model Switching:** Easily configurable via `config.json` or extension settings without modifying code. Supports instant fallback to secondary model on connection timeouts.

---

## 6. Scorecard

| Criterion | Video Timestamp | One-Line Claim |
| :--- | :---: | :--- |
| **A1. Inline edit** | `00:15 - 00:55` | Inline diff rendered directly in editor for `get_debug_flag`, reviewed, and accepted hunk-by-hunk. |
| **A2. Agent mode** | `00:56 - 02:40` | Autonomously discovers and modifies 3 unprompted files (`src/flask/cli.py`, `tests/test_cli.py`, `docs/cli.rst`). |
| **A3. Streaming & cancellation** | `02:41 - 03:05` | Immediate cancellation response without UI freeze; workspace remains consistent and clean. |
| **B1. Context assembly** | `01:10 - 01:30` | Heuristic multi-file retrieval within 16k token budget; agent explicitly logs selected files and reasoning. |
| **B2. Diff safety** | `01:45 - 02:15` | Virtual hunks reviewed before disk writes; working undo operation demonstrated cleanly. |
| **B3. Resilience (Task C)** | `03:06 - 03:50` | Unreachable endpoint triggers non-blocking UI alert; `git status` verifies zero files corrupted. |
| **B4. TrueForge depth** | `01:20 - 02:30` | Native MCP tool exposure with approval gates and turn streaming visible in live TrueForge session. |
| **C1. Video** | `00:00 - 03:58` | All 3 tasks executed in strict order (A, B, C) with terminal verification under 4 minutes. |
| **C2. Write-up** | Full Document | All 8 required sections provided with precise architecture, scorecard, and limitations. |

---

## 7. Tools Used
* Antigravity / Gemini 3.8 Coding Agent
* VS Code Extension Development SDK
* Node.js & TypeScript Compiler
* Python 3.10 & Pytest test runner
* TrueForge Local Agent Harness (`@truefoundry/trueforge`)

---

## 8. Known Limitations and What You Would Do with Another Month
1. **LSP/AST Context Parsing:** Currently relies on fast workspace regex and keyword search; with another month, we would integrate Language Server Protocol (LSP) indexing for deeper semantic cross-references and symbol call graphs.
2. **Interactive Multi-Hunk Split View:** Enhance the UI with side-by-side gutter diff controls for individual line/hunk cherry-picking.
3. **Automated Test-Driven Repair Loop:** Implement an autonomous self-healing loop in TrueForge where failed test assertions (`pytest` stderr) are fed back automatically into subsequent turns for automatic debugging before user review.

