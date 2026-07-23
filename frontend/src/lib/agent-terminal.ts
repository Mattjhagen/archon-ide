/**
 * Agent Terminal Integration
 * Provides a bridge between the AI agent and the local terminal environment,
 * allowing the AI to run commands with user approval.
 */

export interface TerminalCommandRequest {
  command: string;
  description: string;
  isDestructive: boolean;
}

export class AgentTerminalBridge {
  private commandHistory: string[] = [];
  
  /**
   * Request to run a terminal command.
   * If destructive, requires user approval in the UI.
   */
  public async requestCommand(request: TerminalCommandRequest, requestApproval: (req: TerminalCommandRequest) => Promise<boolean>): Promise<{ success: boolean; output: string }> {
    if (request.isDestructive) {
      const approved = await requestApproval(request);
      if (!approved) {
        return { success: false, output: 'User denied command execution.' };
      }
    }
    
    // In a real environment, this would bridge to the Rust backend to execute the shell command.
    this.commandHistory.push(request.command);
    return { success: true, output: `[Simulated] Executed: ${request.command}` };
  }

  public getHistory() {
    return this.commandHistory;
  }
}

export const agentTerminal = new AgentTerminalBridge();
