import * as assert from 'assert';
import * as vscode from 'vscode';
import { IPromptOptimizerParameters, SubagentPromptOptimizerTool } from '../../tool';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Tool Registration', async () => {
		// Just verify that the tool class can be instantiated
        const tool = new SubagentPromptOptimizerTool();
        assert.ok(tool);
	});

    test('Prepare Invocation', async () => {
        const tool = new SubagentPromptOptimizerTool();
        const input: IPromptOptimizerParameters = {
            task: 'Test task',
            iterations: 2
        };

        // Mock the options object
        const mockOptions = {
            input,
            toolInvocationToken: undefined
        } as unknown as vscode.LanguageModelToolInvocationPrepareOptions<IPromptOptimizerParameters>;

        // Mock the token
        const mockToken = {
            isCancellationRequested: false,
            onCancellationRequested: () => ({ dispose: () => {} })
        } as vscode.CancellationToken;

        const prepared = await tool.prepareInvocation(
            mockOptions,
            mockToken
        );

        assert.ok(prepared.invocationMessage);
        assert.ok(prepared.confirmationMessages);
        assert.ok(typeof prepared.invocationMessage === 'string');
        assert.match(prepared.invocationMessage, /2 iteration/);
    });
});
