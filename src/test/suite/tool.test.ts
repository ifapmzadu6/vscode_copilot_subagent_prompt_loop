import * as assert from 'assert';
import { SubagentPromptOptimizerTool, IPromptOptimizerParameters } from '../../tool';
import * as vscode from 'vscode';

// We can't easily mock vscode module in this environment without proper setup.
// So we will just test the class logic that doesn't depend on vscode.lm directly during instantiation.

suite('Tool Test Suite', () => {
	test('Tool exists', () => {
		const tool = new SubagentPromptOptimizerTool();
		assert.ok(tool);
	});

    test('Prepare Invocation', async () => {
        const tool = new SubagentPromptOptimizerTool();
        const input: IPromptOptimizerParameters = { task: "Test Task", iterations: 1 };

        // Mock token
        const tokenSource = new vscode.CancellationTokenSource();

        const result = await tool.prepareInvocation({ input, toolInvocationToken: undefined } as unknown as vscode.LanguageModelToolInvocationPrepareOptions<IPromptOptimizerParameters>, tokenSource.token);

        assert.ok(result.invocationMessage);
        assert.ok(result.confirmationMessages);
    });
});
