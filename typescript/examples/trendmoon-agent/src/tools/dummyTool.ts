/**
 * Dummy Tool for Framework Requirement
 * 
 * The Vibekit framework requires at least one tool in the tools array,
 * even though we use MCP tools exclusively. This is a minimal placeholder.
 */

import { z } from 'zod';
import type { VibkitToolDefinition } from 'arbitrum-vibekit-core';
import { createSuccessTask } from 'arbitrum-vibekit-core';
import type { TrendmoonContext } from '../context/types.js';

const DummyParams = z.object({
  // No parameters needed - this tool is never called
});

export const dummyTool: VibkitToolDefinition<typeof DummyParams, any, TrendmoonContext, any> = {
  name: 'dummy-tool',
  description: 'Placeholder tool to satisfy framework requirements - not used in practice',
  parameters: DummyParams,
  execute: async (_args, _context) => {
    // This tool should never be called since LLM uses MCP tools
    return createSuccessTask(
      'trendmoon-insights',
      undefined,
      'This dummy tool should not be called - MCP tools are used instead'
    );
  },
};