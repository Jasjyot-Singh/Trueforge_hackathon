import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ProposedHunk {
  id: string;
  filePath: string;
  originalContent: string;
  proposedContent: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export class McpEditorTools {
  private proposedHunks: Map<string, ProposedHunk> = new Map();

  async readFile(relativeFilePath: string): Promise<string> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error("No workspace folder open.");
    }
    const fullPath = path.resolve(workspaceFolders[0].uri.fsPath, relativeFilePath);
    return await fs.readFile(fullPath, 'utf-8');
  }

  async searchWorkspace(query: string): Promise<string[]> {
    const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**,**/.git/**,**/__pycache__/**');
    const matchedFiles: string[] = [];

    for (const file of files) {
      try {
        const content = await fs.readFile(file.fsPath, 'utf-8');
        if (content.toLowerCase().includes(query.toLowerCase()) || file.fsPath.toLowerCase().includes(query.toLowerCase())) {
          matchedFiles.push(vscode.workspace.asRelativePath(file));
          if (matchedFiles.length >= 15) break;
        }
      } catch (err) {
        // Ignore unreadable or binary files
      }
    }
    return matchedFiles;
  }

  async proposeDiff(relativeFilePath: string, proposedContent: string): Promise<ProposedHunk> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error("No workspace folder open.");
    }
    const fullPath = path.resolve(workspaceFolders[0].uri.fsPath, relativeFilePath);
    let originalContent = '';
    try {
      originalContent = await fs.readFile(fullPath, 'utf-8');
    } catch {
      originalContent = ''; // New file
    }

    const hunkId = `hunk-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const hunk: ProposedHunk = {
      id: hunkId,
      filePath: relativeFilePath,
      originalContent,
      proposedContent,
      status: 'pending'
    };

    this.proposedHunks.set(hunkId, hunk);
    return hunk;
  }

  async applyHunk(hunkId: string): Promise<boolean> {
    const hunk = this.proposedHunks.get(hunkId);
    if (!hunk) return false;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return false;
    const fullPath = path.resolve(workspaceFolders[0].uri.fsPath, hunk.filePath);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, hunk.proposedContent, 'utf-8');
    hunk.status = 'accepted';
    return true;
  }

  async rejectHunk(hunkId: string): Promise<boolean> {
    const hunk = this.proposedHunks.get(hunkId);
    if (!hunk) return false;
    hunk.status = 'rejected';
    return true;
  }

  async undoHunk(hunkId: string): Promise<boolean> {
    const hunk = this.proposedHunks.get(hunkId);
    if (!hunk || hunk.status !== 'accepted') return false;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return false;
    const fullPath = path.resolve(workspaceFolders[0].uri.fsPath, hunk.filePath);

    await fs.writeFile(fullPath, hunk.originalContent, 'utf-8');
    hunk.status = 'rejected';
    return true;
  }
}

