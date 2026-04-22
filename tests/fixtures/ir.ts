/**
 * Intermediate Representation (IR) fixtures.
 * Aligned with packages/server/src/transformers/base.ts UnifiedChatRequest / UnifiedMessage.
 */

import type { UnifiedChatRequest, UnifiedTool } from '../../packages/server/src/transformers/base.js'

// ── Tool definitions reused across fixtures ──

export const irWeatherTool: UnifiedTool = {
  type: 'function',
  function: {
    name: 'get_weather',
    description: 'Get current weather for a city',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'City name' },
        unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
      },
      required: ['location'],
    },
  },
}

// ── Request Fixtures ──

export const irBasic: UnifiedChatRequest = {
  model: 'claude-sonnet-4-6',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' },
  ],
  temperature: 0.7,
  max_tokens: 1024,
  stream: false,
}

export const irWithSystemArray: UnifiedChatRequest = {
  model: 'claude-sonnet-4-6',
  messages: [
    {
      role: 'system',
      content: [
        { type: 'text', text: 'You are a helpful assistant.' },
        { type: 'text', text: 'Be concise.' },
      ],
    },
    { role: 'user', content: 'Hello!' },
  ],
  max_tokens: 1024,
  stream: false,
}

export const irWithImage: UnifiedChatRequest = {
  model: 'claude-sonnet-4-6',
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'What is in this image?' },
        {
          type: 'image_url',
          image_url: {
            url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          },
          media_type: 'image/png',
        },
      ],
    },
  ],
  max_tokens: 1024,
  stream: false,
}

export const irWithTools: UnifiedChatRequest = {
  model: 'claude-sonnet-4-6',
  messages: [
    { role: 'user', content: 'What is the weather in San Francisco?' },
  ],
  tools: [irWeatherTool],
  tool_choice: 'auto',
  max_tokens: 1024,
  stream: false,
}

export const irWithToolChoiceRequired: UnifiedChatRequest = {
  model: 'claude-sonnet-4-6',
  messages: [
    { role: 'user', content: 'What is the weather in San Francisco?' },
  ],
  tools: [irWeatherTool],
  tool_choice: 'required',
  max_tokens: 1024,
  stream: false,
}

export const irWithToolChoiceNamed: UnifiedChatRequest = {
  model: 'claude-sonnet-4-6',
  messages: [
    { role: 'user', content: 'What is the weather in San Francisco?' },
  ],
  tools: [irWeatherTool],
  tool_choice: { type: 'function', function: { name: 'get_weather' } },
  max_tokens: 1024,
  stream: false,
}

export const irWithToolCalls: UnifiedChatRequest = {
  model: 'claude-sonnet-4-6',
  messages: [
    { role: 'user', content: 'What is the weather in San Francisco?' },
    {
      role: 'assistant',
      content: '',
      tool_calls: [
        {
          id: 'toolu_01T1x1fJ34qAmk2tNTrN7Up6',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{"location": "San Francisco, CA", "unit": "fahrenheit"}',
          },
        },
      ],
    },
  ],
  max_tokens: 1024,
  stream: false,
}

export const irWithToolResult: UnifiedChatRequest = {
  model: 'claude-sonnet-4-6',
  messages: [
    { role: 'user', content: 'What is the weather in San Francisco?' },
    {
      role: 'assistant',
      content: '',
      tool_calls: [
        {
          id: 'toolu_01T1x1fJ34qAmk2tNTrN7Up6',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{"location": "San Francisco, CA"}',
          },
        },
      ],
    },
    {
      role: 'tool',
      content: '{"temperature": 72, "condition": "sunny"}',
      tool_call_id: 'toolu_01T1x1fJ34qAmk2tNTrN7Up6',
    },
  ],
  max_tokens: 1024,
  stream: false,
}

export const irWithToolResultError: UnifiedChatRequest = {
  model: 'claude-sonnet-4-6',
  messages: [
    { role: 'user', content: 'What is the weather in San Francisco?' },
    {
      role: 'assistant',
      content: '',
      tool_calls: [
        {
          id: 'toolu_01T1x1fJ34qAmk2tNTrN7Up6',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{"location": "San Francisco, CA"}',
          },
        },
      ],
    },
    {
      role: 'tool',
      content: 'Failed to fetch weather data',
      tool_call_id: 'toolu_01T1x1fJ34qAmk2tNTrN7Up6',
    },
  ],
  max_tokens: 1024,
  stream: false,
}

export const irWithThinking: UnifiedChatRequest = {
  model: 'claude-sonnet-4-6',
  messages: [
    { role: 'user', content: 'What is the GCD of 48 and 180?' },
    {
      role: 'assistant',
      content: 'The GCD of 48 and 180 is 12.',
      thinking: {
        content: 'I need to find the greatest common divisor of 48 and 180.',
        signature: 'EqQBCgIYAhIMRg4VknXW9W7jZ1bNEiC9sBQYj3wKL6z8rOq4JML1sBQYj3wKL6z8rOq4JMIpKqZIznI6Qm5bLg42Y8eOvywS3H8cZ0aCBwYBBiB9ZW50cnlfaWQSBggDEgIYAiIwaUdxM2V2aDVkM25tWWR0R0Zna1JCaDJjcTJKdW1YRWkxY3RRMlhPRVh3RT0wmQHqDgwB6gwBAAHqDAEAAeoMAQAB6gwBAAHqDAEAAeoxaUdxM2V2aDVkM25tWWR0R0Zna1JCaDJjcTJKdW1YRWkxY3RRMlhPRVh3RT0=',
      },
    },
  ],
  max_tokens: 1024,
  stream: false,
}

export const irStreaming: UnifiedChatRequest = {
  model: 'claude-sonnet-4-6',
  messages: [
    { role: 'user', content: 'Count from 1 to 3.' },
  ],
  max_tokens: 1024,
  stream: true,
}

// ── OpenAI-native IR fixtures (OpenAIMainTransformer passthrough) ──

export const irOpenAiBasic: UnifiedChatRequest = {
  model: 'gpt-4.1',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' },
  ],
  temperature: 0.7,
  max_completion_tokens: 500,
  stream: false,
}

export const irOpenAiWithTools: UnifiedChatRequest = {
  model: 'gpt-4.1',
  messages: [
    { role: 'user', content: 'What is the weather in San Francisco?' },
  ],
  tools: [
    {
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get current weather for a city',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string', description: 'City name' },
            unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
          },
          required: ['location'],
        },
      },
    },
  ],
  tool_choice: 'auto',
  stream: false,
}

export const irOpenAiStreaming: UnifiedChatRequest = {
  model: 'gpt-4o-mini',
  messages: [
    { role: 'user', content: 'Count from 1 to 3.' },
  ],
  stream: true,
}
