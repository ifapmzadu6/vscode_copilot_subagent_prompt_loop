import * as assert from 'assert';
import * as vscode from 'vscode';
import { SubagentPromptOptimizerTool } from '../../tool';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Tool instantiation', () => {
		const tool = new SubagentPromptOptimizerTool();
		assert.ok(tool, 'Tool should be instantiated');
	});

    test('prepareInvocation returns correct structure', async () => {
        const tool = new SubagentPromptOptimizerTool();
        const input = { task: 'Test task', iterations: 3 };
        const token = new vscode.CancellationTokenSource().token;

        // Mock the options object correctly.
        // Note: In tests we might not be able to perfectly mock all vscode types if they are strict,
        // but we pass what we can.
        // The type definition expects { input, toolInvocationToken } but strict checking might complain if we miss something
        // or if toolInvocationToken is not in the type definition in the installed @types/vscode version.
        // Let's cast it to any to bypass the strict type check for the mock object if needed,
        // or construct it to match the expected type.

        const options: any = {
            input,
            toolInvocationToken: undefined
        };

        const prepared = await tool.prepareInvocation(
            options,
            token
        );

        // Check invocationMessage
        if (typeof prepared.invocationMessage === 'string') {
            assert.ok(prepared.invocationMessage.includes('3 iteration(s)'));
        } else if (prepared.invocationMessage) {
            // It might be a MarkdownString
            assert.ok(prepared.invocationMessage.value.includes('3 iteration(s)'));
        }

        assert.ok(prepared.confirmationMessages);
        if (prepared.confirmationMessages) {
             assert.strictEqual(prepared.confirmationMessages.title, 'Optimize Prompt with Subagents');
        }
    });
});
