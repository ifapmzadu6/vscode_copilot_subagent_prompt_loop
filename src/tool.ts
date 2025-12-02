import * as vscode from 'vscode';

/**
 * Interface for the tool's input parameters
 */
export interface IPromptOptimizerParameters {
    task: string;
    iterations?: number;
    context?: string;
}

/**
 * Interface for a subagent's result
 */
interface SubagentResult {
    promptVariation: string;
    actualPrompt: string;
    result: string;
    success: boolean;
}

/**
 * Interface for analysis result
 */
interface AnalysisResult {
    bestResultIndex: number;
    reasoning: string;
    wasPromptBetter: boolean;
    promptImprovements: string[];
    nextPromptSuggestions: string[];
}

/**
 * Prompt variations for the 5 subagents
 * These represent different approaches to framing the same task
 */
const PROMPT_VARIATION_TEMPLATES = [
    {
        name: "Direct",
        template: (task: string, context?: string) => 
            `${context ? `Context: ${context}\n\n` : ''}Task: ${task}\n\nPlease complete this task directly and concisely.`
    },
    {
        name: "Step-by-Step",
        template: (task: string, context?: string) =>
            `${context ? `Context: ${context}\n\n` : ''}Task: ${task}\n\nPlease approach this task step-by-step:\n1. First, understand what is being asked\n2. Break down the problem\n3. Execute each step\n4. Verify your solution`
    },
    {
        name: "Expert Role",
        template: (task: string, context?: string) =>
            `${context ? `Context: ${context}\n\n` : ''}You are an expert in this domain. Your task: ${task}\n\nAs an expert, provide a thorough and professional response.`
    },
    {
        name: "Structured Output",
        template: (task: string, context?: string) =>
            `${context ? `Context: ${context}\n\n` : ''}Task: ${task}\n\nPlease structure your response as follows:\n- Summary\n- Details\n- Recommendations (if applicable)\n- Conclusion`
    },
    {
        name: "Critical Thinking",
        template: (task: string, context?: string) =>
            `${context ? `Context: ${context}\n\n` : ''}Task: ${task}\n\nBefore responding:\n1. Consider multiple approaches\n2. Evaluate potential issues\n3. Choose the best approach\n4. Explain your reasoning`
    }
];

/**
 * SubagentPromptOptimizerTool - A Language Model Tool that:
 * 1. Runs multiple subagents in parallel with different prompt variations
 * 2. Analyzes which approach produced the best result
 * 3. Learns from the analysis and improves prompts for the next iteration
 * 4. Repeats the optimization loop
 */
export class SubagentPromptOptimizerTool implements vscode.LanguageModelTool<IPromptOptimizerParameters> {
    
    private log(message: string, data?: unknown): void {
        const timestamp = new Date().toISOString();
        if (data !== undefined) {
            console.log(`[SubagentOptimizer ${timestamp}] ${message}`, data);
        } else {
            console.log(`[SubagentOptimizer ${timestamp}] ${message}`);
        }
    }

    /**
     * Prepare the tool invocation with a confirmation message
     */
    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IPromptOptimizerParameters>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        const iterations = options.input.iterations ?? 3;
        
        return {
            invocationMessage: `Running prompt optimization with ${iterations} iteration(s), each with 5 parallel subagents...`,
            confirmationMessages: {
                title: 'Optimize Prompt with Subagents',
                message: new vscode.MarkdownString(
                    `This will run **${iterations}** optimization loop(s), each executing **5 subagents** in parallel.\n\n` +
                    `**Task:** ${options.input.task.substring(0, 100)}${options.input.task.length > 100 ? '...' : ''}\n\n` +
                    `The tool will:\n` +
                    `1. Run 5 subagents with different prompt strategies\n` +
                    `2. Analyze which produces the best result\n` +
                    `3. Learn and improve prompts for the next iteration\n` +
                    `4. Report the optimal prompt approach found`
                )
            }
        };
    }

    /**
     * Main invoke method - orchestrates the entire optimization process
     */
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IPromptOptimizerParameters>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const { task, iterations = 20, context } = options.input;
        
        this.log('=== Starting Prompt Optimization ===');
        this.log('Task:', task);
        this.log('Iterations:', iterations);
        this.log('Context:', context || '(none)');
        
        let currentPromptVariations = [...PROMPT_VARIATION_TEMPLATES];
        const allIterationResults: {
            iteration: number;
            results: SubagentResult[];
            analysis: AnalysisResult;
            bestResult: SubagentResult;
        }[] = [];

        // Main optimization loop
        for (let i = 0; i < iterations; i++) {
            if (token.isCancellationRequested) {
                this.log('Optimization cancelled by user');
                break;
            }

            this.log(`\n--- Iteration ${i + 1}/${iterations} ---`);

            // Step 1: Run 5 subagents in parallel
            this.log('Running 5 subagents in parallel...');
            const results = await this.runSubagentsInParallel(
                task,
                context,
                currentPromptVariations,
                options.toolInvocationToken,
                token
            );
            
            this.log('Subagent results:', results.map(r => ({
                variation: r.promptVariation,
                success: r.success,
                resultLength: r.result.length
            })));

            // Step 2: Analyze results with another subagent
            this.log('Analyzing results with analysis subagent...');
            const analysis = await this.analyzeResults(
                task,
                results,
                options.toolInvocationToken,
                token
            );
            
            this.log('Analysis result:', analysis);

            // Store iteration results
            const bestResult = results[analysis.bestResultIndex] || results[0];
            allIterationResults.push({
                iteration: i + 1,
                results,
                analysis,
                bestResult
            });
            
            this.log(`Best approach for iteration ${i + 1}: ${bestResult.promptVariation}`);
            this.log(`Reasoning: ${analysis.reasoning}`);
            this.log(`Was prompt the key factor: ${analysis.wasPromptBetter}`);

            // Step 3: Update prompt variations based on analysis
            if (i < iterations - 1 && analysis.wasPromptBetter) {
                this.log('Updating prompt variations based on analysis...');
                currentPromptVariations = this.updatePromptVariations(
                    currentPromptVariations,
                    analysis
                );
                this.log('Prompt variations updated');
            }
        }

        this.log('\n=== Optimization Complete ===');
        this.log(`Total iterations completed: ${allIterationResults.length}`);

        // Generate final report
        return this.generateFinalReport(task, allIterationResults);
    }

    /**
     * Run 5 subagents in parallel using vscode.lm.invokeTool('runSubagent')
     */
    private async runSubagentsInParallel(
        task: string,
        context: string | undefined,
        promptVariations: typeof PROMPT_VARIATION_TEMPLATES,
        toolInvocationToken: vscode.ChatParticipantToolToken | undefined,
        token: vscode.CancellationToken
    ): Promise<SubagentResult[]> {
        
        // Create 5 parallel subagent invocations
        const subagentPromises = promptVariations.map(async (variation, index) => {
            const basePrompt = variation.template(task, context);
            const fullPrompt = `${basePrompt}\n\n---\nIMPORTANT: This is subagent #${index + 1} using the "${variation.name}" approach. Complete the task and return your result.`;
            
            this.log(`Starting subagent ${index + 1} (${variation.name})...`);
            const startTime = Date.now();
            
            try {
                // Use lm.invokeTool to call the runSubagent tool
                // Pass toolInvocationToken to show progress in chat UI
                const result = await vscode.lm.invokeTool(
                    'runSubagent',
                    {
                        input: {
                            prompt: fullPrompt,
                            description: `Subagent ${index + 1}: ${variation.name} approach`
                        },
                        toolInvocationToken
                    },
                    token
                );

                // Extract text from the result
                const resultText = this.extractTextFromResult(result);
                const duration = Date.now() - startTime;
                
                this.log(`Subagent ${index + 1} (${variation.name}) completed in ${duration}ms`);
                this.log(`Subagent ${index + 1} result preview: ${resultText.substring(0, 200)}...`);
                
                return {
                    promptVariation: variation.name,
                    actualPrompt: fullPrompt,
                    result: resultText,
                    success: true
                };
            } catch (error) {
                const duration = Date.now() - startTime;
                this.log(`Subagent ${index + 1} (${variation.name}) FAILED after ${duration}ms:`, error);
                
                return {
                    promptVariation: variation.name,
                    actualPrompt: fullPrompt,
                    result: `Error: ${error instanceof Error ? error.message : String(error)}`,
                    success: false
                };
            }
        });

        // Wait for all subagents to complete
        this.log('Waiting for all subagents to complete...');
        const results = await Promise.all(subagentPromises);
        this.log(`All ${results.length} subagents completed`);
        return results;
    }

    /**
     * Analyze the results from all subagents using another subagent
     */
    private async analyzeResults(
        originalTask: string,
        results: SubagentResult[],
        toolInvocationToken: vscode.ChatParticipantToolToken | undefined,
        token: vscode.CancellationToken
    ): Promise<AnalysisResult> {
        
        this.log('Preparing analysis prompt...');
        
        // Format results for analysis
        const resultsText = results.map((r, i) => 
            `=== Result ${i + 1} (${r.promptVariation} approach) ===\n${r.success ? r.result : `[FAILED: ${r.result}]`}\n`
        ).join('\n');

        const analysisPrompt = `You are analyzing the results of 5 different AI approaches to the same task.

ORIGINAL TASK: ${originalTask}

RESULTS FROM DIFFERENT APPROACHES:
${resultsText}

Please analyze these results and respond with a JSON object (and nothing else) in this exact format:
{
    "bestResultIndex": <number 0-4 indicating which result was best>,
    "reasoning": "<explanation of why this result was best>",
    "wasPromptBetter": <true if the best result succeeded due to the prompt approach, false if it was just random/lucky>,
    "promptImprovements": ["<specific improvement 1>", "<specific improvement 2>"],
    "nextPromptSuggestions": ["<suggestion for better prompt 1>", "<suggestion for better prompt 2>"]
}

Consider:
1. Which result most completely and accurately addresses the task?
2. Was the success due to the prompt strategy (step-by-step, expert role, etc.) or was it random?
3. What specific aspects of the winning prompt made it effective?
4. How can we improve the prompts for the next iteration?`;

        this.log('Invoking analysis subagent...');
        const startTime = Date.now();

        try {
            // Pass toolInvocationToken to show progress in chat UI
            const analysisResult = await vscode.lm.invokeTool(
                'runSubagent',
                {
                    input: {
                        prompt: analysisPrompt,
                        description: 'Analysis subagent: Evaluating results'
                    },
                    toolInvocationToken
                },
                token
            );

            const analysisText = this.extractTextFromResult(analysisResult);
            const duration = Date.now() - startTime;
            
            this.log(`Analysis subagent completed in ${duration}ms`);
            this.log('Raw analysis response:', analysisText.substring(0, 500));
            
            // Try to parse the JSON response
            try {
                // Extract JSON from the response (handle cases where there's extra text)
                const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]) as AnalysisResult;
                    this.log('Successfully parsed analysis JSON:', parsed);
                    return parsed;
                }
                this.log('No JSON found in analysis response');
            } catch (parseError) {
                this.log('Failed to parse analysis JSON:', parseError);
            }
        } catch (error) {
            const duration = Date.now() - startTime;
            this.log(`Analysis subagent FAILED after ${duration}ms:`, error);
        }

        // Default analysis if parsing fails
        this.log('Returning default analysis due to parsing failure');
        return {
            bestResultIndex: 0,
            reasoning: 'Unable to analyze results properly, defaulting to first result',
            wasPromptBetter: false,
            promptImprovements: [],
            nextPromptSuggestions: []
        };
    }

    /**
     * Update prompt variations based on analysis feedback
     */
    private updatePromptVariations(
        currentVariations: typeof PROMPT_VARIATION_TEMPLATES,
        analysis: AnalysisResult
    ): typeof PROMPT_VARIATION_TEMPLATES {
        const bestVariation = currentVariations[analysis.bestResultIndex];
        
        this.log(`Updating variations based on best approach: ${bestVariation.name}`);
        this.log('Improvements to incorporate:', analysis.promptImprovements);
        this.log('Suggestions to incorporate:', analysis.nextPromptSuggestions);
        
        // Create new variations influenced by the successful approach
        const newVariations = currentVariations.map((variation, index) => {
            if (index === analysis.bestResultIndex) {
                // Keep the best one as is
                return variation;
            }

            // Incorporate learnings from analysis
            const improvements = analysis.promptImprovements.join(' ');
            const suggestions = analysis.nextPromptSuggestions.join(' ');
            
            return {
                name: `${variation.name} (Optimized)`,
                template: (task: string, context?: string) => {
                    const basePrompt = variation.template(task, context);
                    return `${basePrompt}\n\nAdditional guidance based on previous analysis:\n- ${improvements}\n- ${suggestions}\n\nInspired by successful approach: ${bestVariation.name}`;
                }
            };
        });

        this.log('New variation names:', newVariations.map(v => v.name));
        return newVariations;
    }

    /**
     * Extract text content from a LanguageModelToolResult
     */
    private extractTextFromResult(result: vscode.LanguageModelToolResult): string {
        const textParts: string[] = [];
        
        for (const part of result.content) {
            if (part instanceof vscode.LanguageModelTextPart) {
                textParts.push(part.value);
            }
        }
        
        return textParts.join('\n');
    }

    /**
     * Generate the final report summarizing all iterations
     */
    private generateFinalReport(
        task: string,
        iterations: {
            iteration: number;
            results: SubagentResult[];
            analysis: AnalysisResult;
            bestResult: SubagentResult;
        }[]
    ): vscode.LanguageModelToolResult {
        
        this.log('Generating final report...');
        
        const reportParts: string[] = [];
        
        reportParts.push('# Prompt Optimization Report\n');
        reportParts.push(`**Original Task:** ${task}\n`);
        reportParts.push(`**Total Iterations:** ${iterations.length}\n`);
        reportParts.push('---\n');

        // Summary of each iteration
        for (const iter of iterations) {
            reportParts.push(`## Iteration ${iter.iteration}\n`);
            reportParts.push(`**Best Approach:** ${iter.bestResult.promptVariation}\n`);
            reportParts.push(`**Reasoning:** ${iter.analysis.reasoning}\n`);
            reportParts.push(`**Prompt was the key factor:** ${iter.analysis.wasPromptBetter ? 'Yes' : 'No (likely random/luck)'}\n`);
            
            if (iter.analysis.promptImprovements.length > 0) {
                reportParts.push(`**Improvements identified:**\n`);
                iter.analysis.promptImprovements.forEach(imp => reportParts.push(`- ${imp}\n`));
            }
            
            reportParts.push('\n**Best Result Preview:**\n');
            reportParts.push('```\n');
            reportParts.push(iter.bestResult.result.substring(0, 500));
            if (iter.bestResult.result.length > 500) {
                reportParts.push('...[truncated]');
            }
            reportParts.push('\n```\n\n');
        }

        // Final conclusions
        reportParts.push('## Final Conclusions\n');
        
        // Find the overall best approach
        const successfulApproaches: Record<string, number> = {};
        for (const iter of iterations) {
            if (iter.analysis.wasPromptBetter) {
                const approach = iter.bestResult.promptVariation;
                successfulApproaches[approach] = (successfulApproaches[approach] || 0) + 1;
            }
        }

        if (Object.keys(successfulApproaches).length > 0) {
            const sortedApproaches = Object.entries(successfulApproaches)
                .sort((a, b) => b[1] - a[1]);
            
            reportParts.push(`**Most effective prompt approach:** ${sortedApproaches[0][0]} (won ${sortedApproaches[0][1]} time(s))\n`);
            reportParts.push('\n**Key learnings:**\n');
            
            // Collect all unique improvements
            const allImprovements = new Set<string>();
            iterations.forEach(iter => {
                iter.analysis.promptImprovements.forEach(imp => allImprovements.add(imp));
            });
            
            allImprovements.forEach(imp => reportParts.push(`- ${imp}\n`));
        } else {
            reportParts.push('No clear winning prompt strategy was identified. Results may have been largely dependent on random factors rather than prompt engineering.\n');
        }

        // Return the last best result as the final answer
        const lastBestResult = iterations[iterations.length - 1]?.bestResult;
        if (lastBestResult) {
            reportParts.push('\n## Best Prompt (Final Delegation Instruction)\n');
            reportParts.push('The most effective prompt found through optimization:\n');
            reportParts.push('```\n');
            reportParts.push(lastBestResult.actualPrompt);
            reportParts.push('\n```\n');
            
            reportParts.push('\n## Final Best Result\n');
            reportParts.push('```\n');
            reportParts.push(lastBestResult.result);
            reportParts.push('\n```\n');
        }

        this.log('Final report generated, length:', reportParts.join('').length);
        
        // Log summary statistics
        const successfulApproachesLog: Record<string, number> = {};
        for (const iter of iterations) {
            const approach = iter.bestResult.promptVariation;
            successfulApproachesLog[approach] = (successfulApproachesLog[approach] || 0) + 1;
        }
        this.log('Final statistics - approaches that won:', successfulApproachesLog);

        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(reportParts.join(''))
        ]);
    }
}
