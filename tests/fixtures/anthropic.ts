/**
 * Anthropic API format fixtures.
 * Aligned with devdocs/api-docs/anthropic-ref.md
 */

// ── Request Fixtures ──

export const anthropicBasicRequest = {
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  system: 'You are a helpful assistant.',
  messages: [
    { role: 'user' as const, content: 'Hello!' },
  ],
  temperature: 0.7,
  stream: false,
}

export const anthropicSystemArrayRequest = {
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  system: [
    { type: 'text' as const, text: 'You are a helpful assistant.' },
    { type: 'text' as const, text: 'Be concise.' },
  ],
  messages: [
    { role: 'user' as const, content: 'Hello!' },
  ],
  stream: false,
}

export const anthropicWithImageRequest = {
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [
    {
      role: 'user' as const,
      content: [
        { type: 'text' as const, text: 'What is in this image?' },
        {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: 'image/png',
            data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          },
        },
      ],
    },
  ],
  stream: false,
}

export const anthropicWithToolsRequest = {
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [
    { role: 'user' as const, content: 'What is the weather in San Francisco?' },
  ],
  tools: [
    {
      name: 'get_weather',
      description: 'Get current weather for a city',
      input_schema: {
        type: 'object' as const,
        properties: {
          location: { type: 'string' as const, description: 'City name' },
          unit: { type: 'string' as const, enum: ['celsius', 'fahrenheit'] },
        },
        required: ['location'],
      },
    },
  ],
  tool_choice: { type: 'auto' as const },
  stream: false,
}

export const anthropicWithToolChoiceAny = {
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [
    { role: 'user' as const, content: 'What is the weather in San Francisco?' },
  ],
  tools: [
    {
      name: 'get_weather',
      description: 'Get current weather for a city',
      input_schema: {
        type: 'object' as const,
        properties: {
          location: { type: 'string' as const },
        },
        required: ['location'],
      },
    },
  ],
  tool_choice: { type: 'any' as const, disable_parallel_tool_use: true },
  stream: false,
}

export const anthropicWithToolChoiceNamed = {
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [
    { role: 'user' as const, content: 'What is the weather in San Francisco?' },
  ],
  tools: [
    {
      name: 'get_weather',
      description: 'Get current weather for a city',
      input_schema: {
        type: 'object' as const,
        properties: {
          location: { type: 'string' as const },
        },
        required: ['location'],
      },
    },
  ],
  tool_choice: { type: 'tool' as const, name: 'get_weather' },
  stream: false,
}

export const anthropicWithToolUse = {
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [
    { role: 'user' as const, content: 'What is the weather in San Francisco?' },
    {
      role: 'assistant' as const,
      content: [
        {
          type: 'tool_use' as const,
          id: 'toolu_01T1x1fJ34qAmk2tNTrN7Up6',
          name: 'get_weather',
          input: { location: 'San Francisco, CA', unit: 'fahrenheit' },
        },
      ],
    },
  ],
  stream: false,
}

export const anthropicWithToolResult = {
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [
    { role: 'user' as const, content: 'What is the weather in San Francisco?' },
    {
      role: 'assistant' as const,
      content: [
        {
          type: 'tool_use' as const,
          id: 'toolu_01T1x1fJ34qAmk2tNTrN7Up6',
          name: 'get_weather',
          input: { location: 'San Francisco, CA' },
        },
      ],
    },
    {
      role: 'user' as const,
      content: [
        {
          type: 'tool_result' as const,
          tool_use_id: 'toolu_01T1x1fJ34qAmk2tNTrN7Up6',
          content: '{"temperature": 72, "condition": "sunny"}',
        },
      ],
    },
  ],
  stream: false,
}

export const anthropicWithToolResultError = {
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [
    { role: 'user' as const, content: 'What is the weather in San Francisco?' },
    {
      role: 'assistant' as const,
      content: [
        {
          type: 'tool_use' as const,
          id: 'toolu_01T1x1fJ34qAmk2tNTrN7Up6',
          name: 'get_weather',
          input: { location: 'San Francisco, CA' },
        },
      ],
    },
    {
      role: 'user' as const,
      content: [
        {
          type: 'tool_result' as const,
          tool_use_id: 'toolu_01T1x1fJ34qAmk2tNTrN7Up6',
          content: 'Failed to fetch weather data',
          is_error: true,
        },
      ],
    },
  ],
  stream: false,
}

export const anthropicWithThinking = {
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [
    { role: 'user' as const, content: 'What is the GCD of 48 and 180?' },
    {
      role: 'assistant' as const,
      content: [
        {
          type: 'thinking' as const,
          thinking: 'I need to find the greatest common divisor of 48 and 180.',
          signature: 'EqQBCgIYAhIMRg4VknXW9W7jZ1bNEiC9sBQYj3wKL6z8rOq4JML1sBQYj3wKL6z8rOq4JMIpKqZIznI6Qm5bLg42Y8eOvywS3H8cZ0aCBwYBBiB9ZW50cnlfaWQSBggDEgIYAiIwaUdxM2V2aDVkM25tWWR0R0Zna1JCaDJjcTJKdW1YRWkxY3RRMlhPRVh3RT0wmQHqDgwB6gwBAAHqDAEAAeoMAQAB6gwBAAHqDAEAAeoxaUdxM2V2aDVkM25tWWR0R0Zna1JCaDJjcTJKdW1YRWkxY3RRMlhPRVh3RT0=',
        },
        { type: 'text' as const, text: 'The GCD of 48 and 180 is 12.' },
      ],
    },
  ],
  stream: false,
}

export const anthropicStreamingRequest = {
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [
    { role: 'user' as const, content: 'Count from 1 to 3.' },
  ],
  stream: true,
}

// ── Sync Response Fixtures ──

export const anthropicBasicResponse = {
  id: 'msg_01XFDUDYJgAACzvnptvVo4EL',
  type: 'message',
  role: 'assistant',
  model: 'claude-sonnet-4-6',
  content: [
    { type: 'text', text: 'Hello! How can I help you today?' },
  ],
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: { input_tokens: 25, output_tokens: 20 },
}

export const anthropicToolUseResponse = {
  id: 'msg_02ToolUseExample',
  type: 'message',
  role: 'assistant',
  model: 'claude-sonnet-4-6',
  content: [
    { type: 'text', text: 'Let me check the weather for you.' },
    {
      type: 'tool_use',
      id: 'toolu_01T1x1fJ34qAmk2tNTrN7Up6',
      name: 'get_weather',
      input: { location: 'San Francisco, CA', unit: 'fahrenheit' },
    },
  ],
  stop_reason: 'tool_use',
  stop_sequence: null,
  usage: { input_tokens: 472, output_tokens: 89 },
}

export const anthropicThinkingResponse = {
  id: 'msg_03ThinkingExample',
  type: 'message',
  role: 'assistant',
  model: 'claude-sonnet-4-6',
  content: [
    {
      type: 'thinking',
      thinking: 'I need to find the GCD of 48 and 180.',
      signature: 'EqQBCgIYAhIMRg4VknXW9W7jZ1bNEiC9sBQYj3wKL6z8rOq4JML1sBQYj3wKL6z8rOq4JMIpKqZIznI6Qm5bLg42Y8eOvywS3H8cZ0aCBwYBBiB9ZW50cnlfaWQSBggDEgIYAiIwaUdxM2V2aDVkM25tWWR0R0Zna1JCaDJjcTJKdW1YRWkxY3RRMlhPRVh3RT0wmQHqDgwB6gwBAAHqDAEAAeoMAQAB6gwBAAHqDAEAAeoxaUdxM2V2aDVkM25tWWR0R0Zna1JCaDJjcTJKdW1YRWkxY3RRMlhPRVh3RT0=',
    },
    { type: 'text', text: 'The GCD of 48 and 180 is 12.' },
  ],
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: { input_tokens: 35, output_tokens: 45 },
}

// ── Streaming Fixtures (raw SSE event strings) ──

export const anthropicBasicStreamEvents = [
  'event: message_start',
  'data: {"type":"message_start","message":{"id":"msg_1nZ","type":"message","role":"assistant","content":[],"model":"claude-sonnet-4-6","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":25,"output_tokens":1}}}',
  '',
  'event: content_block_start',
  'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
  '',
  'event: ping',
  'data: {"type":"ping"}',
  '',
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}',
  '',
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"!"}}',
  '',
  'event: content_block_stop',
  'data: {"type":"content_block_stop","index":0}',
  '',
  'event: message_delta',
  'data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":15}}',
  '',
  'event: message_stop',
  'data: {"type":"message_stop"}',
  '',
]

export const anthropicToolUseStreamEvents = [
  'event: message_start',
  'data: {"type":"message_start","message":{"id":"msg_014p","type":"message","role":"assistant","model":"claude-sonnet-4-6","stop_sequence":null,"usage":{"input_tokens":472,"output_tokens":2},"content":[],"stop_reason":null}}',
  '',
  'event: content_block_start',
  'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
  '',
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Okay, let me check"}}',
  '',
  'event: content_block_stop',
  'data: {"type":"content_block_stop","index":0}',
  '',
  'event: content_block_start',
  'data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_01T1x1fJ34qAmk2tNTrN7Up6","name":"get_weather","input":{}}}',
  '',
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":""}}',
  '',
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\\"location\\":"}}',
  '',
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":" \\"San Francisco, CA\\"}"}}',
  '',
  'event: content_block_stop',
  'data: {"type":"content_block_stop","index":1}',
  '',
  'event: message_delta',
  'data: {"type":"message_delta","delta":{"stop_reason":"tool_use","stop_sequence":null},"usage":{"output_tokens":89}}',
  '',
  'event: message_stop',
  'data: {"type":"message_stop"}',
  '',
]

export const anthropicThinkingStreamEvents = [
  'event: message_start',
  'data: {"type":"message_start","message":{"id":"msg_think01","type":"message","role":"assistant","content":[],"model":"claude-sonnet-4-6","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":35,"output_tokens":1}}}',
  '',
  'event: content_block_start',
  'data: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":"","signature":""}}',
  '',
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"I need to find the GCD of 48 and 180."}}',
  '',
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"signature_delta","signature":"EqQBCgIYAhIM..."}}',
  '',
  'event: content_block_stop',
  'data: {"type":"content_block_stop","index":0}',
  '',
  'event: content_block_start',
  'data: {"type":"content_block_start","index":1,"content_block":{"type":"text","text":""}}',
  '',
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"The GCD of 48 and 180 is 12."}}',
  '',
  'event: content_block_stop',
  'data: {"type":"content_block_stop","index":1}',
  '',
  'event: message_delta',
  'data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":45}}',
  '',
  'event: message_stop',
  'data: {"type":"message_stop"}',
  '',
]

export const anthropicErrorStreamEvents = [
  'event: error',
  'data: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}',
  '',
]
