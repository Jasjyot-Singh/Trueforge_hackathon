import * as vscode from 'vscode';
import { McpEditorTools } from './mcpEditorTools';
import { TrueForgeBridge } from './trueforgeBridge';

export function activate(context: vscode.ExtensionContext) {
  const editorTools = new McpEditorTools();
  const config = vscode.workspace.getConfiguration('trueforge');
  const serverUrl = config.get<string>('serverUrl') || 'http://localhost:8790';
  const bridge = new TrueForgeBridge(serverUrl, editorTools);

  // 1. Task A: Inline Edit Command
  const inlineEditCmd = vscode.commands.registerCommand('trueforge.inlineEdit', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('Open a file to use TrueForge Inline Edit.');
      return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection.isEmpty ? undefined : selection);

    const instruction = await vscode.window.showInputBox({
      prompt: 'TrueForge Inline Edit: What changes should be made to this code?',
      placeHolder: "e.g., Treat 'off' and 'n' as false as well, case-insensitively..."
    });

    if (!instruction) return;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'TrueForge: Generating inline edit...',
        cancellable: true
      },
      async (progress, token) => {
        token.onCancellationRequested(() => {
          bridge.cancelActiveRun();
        });

        const result = await bridge.runInlineEdit(selectedText, instruction, (tokenChunk) => {
          progress.report({ message: tokenChunk });
        });

        if (result) {
          // Open diff preview for user review
          const proposedHunk = await editorTools.proposeDiff(
            vscode.workspace.asRelativePath(editor.document.uri),
            result.fullProposal
          );

          const choice = await vscode.window.showInformationMessage(
            `TrueForge Proposed Diff for ${proposedHunk.filePath}. Accept or Reject?`,
            'Accept Diff',
            'Reject Diff'
          );

          if (choice === 'Accept Diff') {
            await editorTools.applyHunk(proposedHunk.id);
            vscode.window.showInformationMessage(`Applied diff to ${proposedHunk.filePath}`);
          } else {
            await editorTools.rejectHunk(proposedHunk.id);
            vscode.window.showInformationMessage(`Rejected diff. No changes made.`);
          }
        }
      }
    );
  });

  // 2. Cancellation Command
  const cancelCmd = vscode.commands.registerCommand('trueforge.cancelGeneration', () => {
    bridge.cancelActiveRun();
  });

  // 3. Task B: Agent Panel View Provider
  const agentViewProvider: vscode.WebviewViewProvider = {
    resolveWebviewView(webviewView: vscode.WebviewView) {
      webviewView.webview.options = { enableScripts: true };
      webviewView.webview.html = getAgentWebviewHtml();

      webviewView.webview.onDidReceiveMessage(async (message) => {
        if (message.command === 'startAgent') {
          await bridge.runAgentMode(message.prompt, (event) => {
            webviewView.webview.postMessage({ type: 'log', text: event.content });
          });
        }
      });
    }
  };

  const openPanelCmd = vscode.commands.registerCommand('trueforge.openAgentPanel', () => {
    vscode.commands.executeCommand('workbench.view.extension.trueforge-sidebar');
  });

  context.subscriptions.push(
    inlineEditCmd,
    cancelCmd,
    openPanelCmd,
    vscode.window.registerWebviewViewProvider('trueforge.agentView', agentViewProvider),
    vscode.window.registerWebviewViewProvider('trueforge.agentViewExplorer', agentViewProvider)
  );
}

function getAgentWebviewHtml(): string {
  return `<!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: sans-serif; padding: 12px; color: var(--vscode-editor-foreground); background: var(--vscode-editor-background); }
      button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 14px; cursor: pointer; width: 100%; border-radius: 4px; font-weight: bold; }
      button:hover { background: var(--vscode-button-hoverBackground); }
      textarea { width: 100%; box-sizing: border-box; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 8px; border-radius: 4px; font-size: 13px; }
      #logs { margin-top: 14px; font-family: monospace; font-size: 12px; white-space: pre-wrap; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px; max-height: 250px; overflow-y: auto; }
      .badge { display: inline-block; padding: 2px 6px; font-size: 10px; background: #007acc; color: white; border-radius: 3px; margin-bottom: 8px; }
    </style>
  </head>
  <body>
    <span class="badge">TrueForge v0.185.1 Active</span>
    <h3>TrueForge Agent Panel</h3>
    <textarea id="prompt" rows="5" placeholder="Enter high-level instructions (e.g. Add a new built-in CLI command flask config...)" style="resize:vertical;"></textarea>
    <br><br>
    <button onclick="run()">Run Agent Loop</button>
    <div id="logs">Waiting for task...</div>

    <script>
      const vscode = acquireVsCodeApi();
      function run() {
        const prompt = document.getElementById('prompt').value;
        document.getElementById('logs').innerText = '[Agent Started] Initializing TrueForge session...\\n';
        vscode.postMessage({ command: 'startAgent', prompt: prompt });
      }
      window.addEventListener('message', event => {
        const msg = event.data;
        if (msg.type === 'log') {
          document.getElementById('logs').innerText += msg.text + '\\n';
        }
      });
    </script>
  </body>
  </html>`;
}

export function deactivate() {}

