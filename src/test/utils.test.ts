
import * as assert from 'assert';
import { extractJson } from '../utils';

describe('Utils Test Suite', () => {
    it('extractJson parses simple JSON', () => {
        const input = '{"key": "value"}';
        const result = extractJson<{key: string}>(input);
        assert.deepStrictEqual(result, {key: "value"});
    });

    it('extractJson parses JSON within markdown block', () => {
        const input = 'Here is the result:\n```json\n{"key": "value"}\n```';
        const result = extractJson<{key: string}>(input);
        assert.deepStrictEqual(result, {key: "value"});
    });

    it('extractJson parses JSON within plain code block', () => {
        const input = 'Here is the result:\n```\n{"key": "value"}\n```';
        const result = extractJson<{key: string}>(input);
        assert.deepStrictEqual(result, {key: "value"});
    });

    it('extractJson finds JSON without blocks', () => {
        const input = 'Some text {"key": "value"} some other text';
        const result = extractJson<{key: string}>(input);
        assert.deepStrictEqual(result, {key: "value"});
    });

    it('extractJson returns null for invalid JSON', () => {
        const input = 'No JSON here';
        const result = extractJson<{key: string}>(input);
        assert.strictEqual(result, null);
    });
});
