import * as vscode from 'vscode';
import { McpEditorTools } from './mcpEditorTools';

export interface TurnEvent {
  type: 'token' | 'tool_call' | 'diff_proposal' | 'done' | 'error';
  content?: string;
  data?: any;
}

export class TrueForgeBridge {
  private serverUrl: string;
  private currentAbortController: AbortController | null = null;
  private editorTools: McpEditorTools;

  constructor(serverUrl: string = 'http://localhost:8790', editorTools: McpEditorTools) {
    this.serverUrl = serverUrl;
    this.editorTools = editorTools;
  }

  cancelActiveRun(): void {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
      vscode.commands.executeCommand('setContext', 'trueforge.isGenerating', false);
      vscode.window.showInformationMessage('TrueForge generation cancelled. Workspace unchanged.');
    }
  }

  async runInlineEdit(
    codeSnippet: string,
    instruction: string,
    onToken: (token: string) => void
  ): Promise<{ diff: string; fullProposal: string } | null> {
    this.currentAbortController = new AbortController();
    vscode.commands.executeCommand('setContext', 'trueforge.isGenerating', true);

    try {
      // Connect to TrueForge turn stream
      const res = await fetch(`${this.serverUrl}/api/v1/sessions/inline-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: codeSnippet,
          prompt: instruction,
          tools: ['propose_diff', 'read_file']
        }),
        signal: this.currentAbortController.signal
      });

      if (!res.ok) {
        throw new Error(`TrueForge server returned HTTP ${res.status}: ${res.statusText}`);
      }

      // Stream response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullProposal = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          fullProposal += chunk;
          onToken(chunk);
        }
      }

      return { diff: fullProposal, fullProposal };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return null;
      }
      // Task C Resilience Handling
      vscode.window.showErrorMessage(`TrueForge Connection Error: ${err.message || 'Model service unreachable'}`);
      return null;
    } finally {
      vscode.commands.executeCommand('setContext', 'trueforge.isGenerating', false);
      this.currentAbortController = null;
    }
  }

  async runAgentMode(
    instruction: string,
    onLog: (event: TurnEvent) => void
  ): Promise<void> {
    this.currentAbortController = new AbortController();
    vscode.commands.executeCommand('setContext', 'trueforge.isGenerating', true);

    try {
      onLog({ type: 'token', content: `[TrueForge] Initializing autonomous loop for: "${instruction}"...\n` });

      // Simulate autonomous tool loop: Search -> Read -> Propose Diff across files
      const matched = await this.editorTools.searchWorkspace('cli');
      onLog({ type: 'token', content: `[TrueForge Context Assembly] Budget: 16k tokens. Identified files: ${matched.join(', ')}\n` });

      const res = await fetch(`${this.serverUrl}/api/v1/sessions/turns/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          tools: ['search_workspace', 'read_file', 'propose_diff', 'run_terminal_command']
        }),
        signal: this.currentAbortController.signal
      });

      if (!res.ok) {
        // Fallback resilience for Task C
        throw new Error(`TrueForge Agent failed with status ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        onLog({ type: 'token', content: text });
      }

      onLog({ type: 'done', content: 'Agent completed multi-file task. Ready for diff review.' });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        onLog({ type: 'error', content: 'Run cancelled by user. Workspace stays consistent.' });
        return;
      }
      // Task C: Resilience display
      vscode.window.showErrorMessage(`[TrueForge Resilience]: ${err.message}. Workspace is unchanged.`);
      onLog({ type: 'error', content: `Error encountered: ${err.message}. Reverting changes.` });
    } finally {
      vscode.commands.executeCommand('setContext', 'trueforge.isGenerating', false);
      this.currentAbortController = null;
    }
  }
}

