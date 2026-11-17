# Project Agent Guidelines: Performance & Speed Optimization

## 1. Dual-Model Delegation Strategy (Analysis vs. Build)
- **Code Analysis & Exploration**: When scanning codebases, tracing dependencies, or looking up symbols across multiple files, delegate the task to the `code-analyzer` subagent configured with `Model: "flash_lite"`.
  - Flash-Lite processes searches and file slices at ultra-low latency and minimal token cost.
  - The subagent must return only distilled findings: file paths, line numbers, and interface signatures.
- **Build, Architecture & Modification**: The primary agent (using the user-selected model) handles high-level planning, code generation, refactoring, and test execution.

## 2. High-Speed File Reading & Search Rules
- **No Full-File Dumps**: NEVER call `read_file` on any file over **100 lines** without a grep-first step. This applies to ALL files regardless of perceived size — App.tsx, index.css, any component.
- **Mandatory Grep-First Protocol**:
  1. Run ripgrep to locate exact line numbers: `& "C:\Users\YASINSHA\AppData\Local\Programs\Antigravity IDE\resources\app\node_modules\@vscode\ripgrep\bin\rg.exe" -n "<pattern>" "<file>"`
  2. ONLY then call `read_file` with explicit `StartLine` and `EndLine` (max ~50 line window).
  3. Exception: files confirmed under 100 lines (e.g. `index.html`, tiny configs).
- **Bounded Line Reads**: Read 20–50 lines at a time, never an open-ended full dump.
- **Violation Example (FORBIDDEN)**: `read_file(Path="App.tsx")` — no StartLine/EndLine.
- **Correct Example**: `rg -n "toggleTheme" App.tsx` → line 22 → `read_file(Path="App.tsx", StartLine=18, EndLine=35)`.

## 3. Component & Dependency Rules
- Always search existing components (`src/components/`, `components/`) using grep before creating new ones.
- Read only the interface and prop types before consuming a component.

## 4. Batching & Turn Conservation Rules (Speed Optimization)
- **Eliminate Turn Explosion**: Turn round-trips take ~15-20s each due to LLM thinking and API context processing. Keep turn counts minimal (target $\le 5$ turns for scoped component tasks).
- **Single-Pass File Edits**: NEVER split edits to the same file across multiple sequential turns. Apply all modifications for a file in a single contiguous `edit_file` call.
- **Batch Parallel Tool Calls**: Emit multiple related tool calls (e.g. reading 2 distinct snippets or running 2 grep commands) in a single turn instead of serializing them across multiple turns.
- **No Redundant Re-reads**: Do NOT re-read code lines you already read a few turns prior. Use the context already present in memory.

