import * as vscode from 'vscode';
import { SubagentPromptOptimizerTool } from './tool';

export function activate(context: vscode.ExtensionContext) {
    console.log('Subagent Prompt Optimizer extension is now active');

    // Register the language model tool
    context.subscriptions.push(
        vscode.lm.registerTool(
            'optimize_prompt_with_subagents',
            new SubagentPromptOptimizerTool()
        )
    );
}

export function deactivate() {}
