/**
 * OpenAI Chat Completions API format fixtures.
 * Aligned with devdocs/api-docs/openai-ref.md
 */

// ── Request Fixtures ──

export const openaiBasicRequest = {
  model: 'gpt-4.1',
  messages: [
    { role: 'system' as const, content: 'You are a helpful assistant.' },
    { role: 'user' as const, content: 'Hello!' },
  ],
  temperature: 0.7,
  max_completion_tokens: 500,
  stream: false,
}

export const openaiDeveloperMessageRequest = {
  model: 'o3-mini',
  messages: [
    { role: 'developer' as const, content: 'You are a helpful assistant.' },
    { role: 'user' as const, content: 'Hello!' },
  ],
  temperature: 1.0,
  stream: false,
}

export const openaiWithImageRequest = {
  model: 'gpt-4o',
  messages: [
    {
      role: 'user' as const,
      content: [
        { type: 'text' as const, text: 'What is in this image?' },
        {
          type: 'image_url' as const,
          image_url: {
            url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            detail: 'auto' as const,
          },
        },
      ],
    },
  ],
  stream: false,
}

export const openaiWithToolsRequest = {
  model: 'gpt-4.1',
  messages: [
    { role: 'user' as const, content: 'What is the weather in San Francisco?' },
  ],
  tools: [
    {
      type: 'function' as const,
      function: {
        name: 'get_weather',
        description: 'Get current weather for a city',
        parameters: {
          type: 'object' as const,
          properties: {
            location: { type: 'string' as const, description: 'City name' },
            unit: { type: 'string' as const, enum: ['celsius', 'fahrenheit'] },
          },
          required: ['location'],
        },
      },
    },
  ],
  tool_choice: 'auto' as const,
  stream: false,
}

export const openaiWithToolChoiceRequired = {
  model: 'gpt-4.1',
  messages: [
    { role: 'user' as const, content: 'What is the weather in San Francisco?' },
  ],
  tools: [
    {
      type: 'function' as const,
      function: {
        name: 'get_weather',
        description: 'Get current weather for a city',
        parameters: {
          type: 'object' as const,
          properties: {
            location: { type: 'string' as const },
          },
          required: ['location'],
        },
      },
    },
  ],
  tool_choice: 'required' as const,
  stream: false,
}

export const openaiWithToolChoiceNamed = {
  model: 'gpt-4.1',
  messages: [
    { role: 'user' as const, content: 'What is the weather in San Francisco?' },
  ],
  tools: [
    {
      type: 'function' as const,
      function: {
        name: 'get_weather',
        description: 'Get current weather for a city',
        parameters: {
          type: 'object' as const,
          properties: {
            location: { type: 'string' as const },
          },
          required: ['location'],
        },
      },
    },
  ],
  tool_choice: { type: 'function' as const, function: { name: 'get_weather' } },
  stream: false,
}

export const openaiWithToolCalls = {
  model: 'gpt-4.1',
  messages: [
    { role: 'user' as const, content: 'What is the weather in San Francisco?' },
    {
      role: 'assistant' as const,
      content: null,
      tool_calls: [
        {
          id: 'call_abc123',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{"location": "San Francisco, CA", "unit": "fahrenheit"}',
          },
        },
      ],
    },
  ],
  stream: false,
}

export const openaiWithToolResult = {
  model: 'gpt-4.1',
  messages: [
    { role: 'user' as const, content: 'What is the weather in San Francisco?' },
    {
      role: 'assistant' as const,
      content: null,
      tool_calls: [
        {
          id: 'call_abc123',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{"location": "San Francisco, CA"}',
          },
        },
      ],
    },
    { role: 'tool' as const, tool_call_id: 'call_abc123', content: '{"temperature": 72, "condition": "sunny"}' },
  ],
  stream: false,
}

export const openaiWithRefusal = {
  model: 'gpt-4.1',
  messages: [
    { role: 'user' as const, content: 'How do I make illegal substances?' },
    {
      role: 'assistant' as const,
      content: null,
      refusal: 'I cannot provide information on how to make illegal substances.',
    },
  ],
  stream: false,
}

export const openaiStreamingRequest = {
  model: 'gpt-4o-mini',
  messages: [
    { role: 'user' as const, content: 'Count from 1 to 3.' },
  ],
  stream: true,
}

export const openaiStreamingWithToolRequest = {
  model: 'gpt-4.1',
  messages: [
    { role: 'user' as const, content: 'What is the weather in San Francisco?' },
  ],
  tools: [
    {
      type: 'function' as const,
      function: {
        name: 'get_weather',
        description: 'Get current weather',
        parameters: {
          type: 'object' as const,
          properties: {
            location: { type: 'string' as const },
          },
        },
      },
    },
  ],
  stream: true,
}

// ── Sync Response Fixtures ──

export const openaiBasicResponse = {
  id: 'chatcmpl-basic01',
  object: 'chat.completion',
  created: 1699896916,
  model: 'gpt-4.1',
  system_fingerprint: 'fp_44709d6fcb',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'Hello! How can I help you?',
        tool_calls: null,
        refusal: null,
      },
      logprobs: null,
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 50,
    completion_tokens: 20,
    total_tokens: 70,
    completion_tokens_details: {
      reasoning_tokens: 0,
      accepted_prediction_tokens: 0,
      rejected_prediction_tokens: 0,
    },
    prompt_tokens_details: {
      cached_tokens: 0,
    },
  },
}

export const openaiToolCallsResponse = {
  id: 'chatcmpl-tool01',
  object: 'chat.completion',
  created: 1699896916,
  model: 'gpt-4.1',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_abc123',
            type: 'function',
            function: {
              name: 'get_current_weather',
              arguments: '{"location": "Boston, MA"}',
            },
          },
        ],
        refusal: null,
      },
      logprobs: null,
      finish_reason: 'tool_calls',
    },
  ],
  usage: {
    prompt_tokens: 82,
    completion_tokens: 17,
    total_tokens: 99,
  },
}

export const openaiResponseWithThinking = {
  id: 'chatcmpl-think01',
  object: 'chat.completion',
  created: 1699896916,
  model: 'gpt-4.1',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'The GCD of 48 and 180 is 12.',
        tool_calls: null,
        refusal: null,
        thinking: {
          content: 'I need to find the GCD of 48 and 180.',
          signature: 'sig_abc123',
        },
      },
      logprobs: null,
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 35,
    completion_tokens: 45,
    total_tokens: 80,
  },
}

// ── Streaming Fixtures (raw SSE data: lines) ──

export const openaiBasicStreamChunks = [
  'data: {"id":"chatcmpl-stream01","object":"chat.completion.chunk","created":1694268190,"model":"gpt-4o-mini","system_fingerprint":"fp_44709d6fcb","choices":[{"index":0,"delta":{"role":"assistant","content":""},"logprobs":null,"finish_reason":null}]}',
  '',
  'data: {"id":"chatcmpl-stream01","object":"chat.completion.chunk","created":1694268190,"model":"gpt-4o-mini","system_fingerprint":"fp_44709d6fcb","choices":[{"index":0,"delta":{"content":"Hello"},"logprobs":null,"finish_reason":null}]}',
  '',
  'data: {"id":"chatcmpl-stream01","object":"chat.completion.chunk","created":1694268190,"model":"gpt-4o-mini","system_fingerprint":"fp_44709d6fcb","choices":[{"index":0,"delta":{"content":", how"},"logprobs":null,"finish_reason":null}]}',
  '',
  'data: {"id":"chatcmpl-stream01","object":"chat.completion.chunk","created":1694268190,"model":"gpt-4o-mini","system_fingerprint":"fp_44709d6fcb","choices":[{"index":0,"delta":{"content":" can I help?"},"logprobs":null,"finish_reason":null}]}',
  '',
  'data: {"id":"chatcmpl-stream01","object":"chat.completion.chunk","created":1694268190,"model":"gpt-4o-mini","system_fingerprint":"fp_44709d6fcb","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"stop"}]}',
  '',
  'data: [DONE]',
  '',
]

export const openaiToolCallsStreamChunks = [
  'data: {"id":"chatcmpl-toolstream","object":"chat.completion.chunk","created":1694268190,"model":"gpt-4.1","choices":[{"index":0,"delta":{"role":"assistant","content":null,"tool_calls":[{"index":0,"id":"call_abc123","type":"function","function":{"name":"get_weather","arguments":""}}]},"finish_reason":null}]}',
  '',
  'data: {"id":"chatcmpl-toolstream","object":"chat.completion.chunk","created":1694268190,"model":"gpt-4.1","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"ci"}}]},"finish_reason":null}]}',
  '',
  'data: {"id":"chatcmpl-toolstream","object":"chat.completion.chunk","created":1694268190,"model":"gpt-4.1","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"ty\\": \\"S"}}]},"finish_reason":null}]}',
  '',
  'data: {"id":"chatcmpl-toolstream","object":"chat.completion.chunk","created":1694268190,"model":"gpt-4.1","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"an Fran"}}]},"finish_reason":null}]}',
  '',
  'data: {"id":"chatcmpl-toolstream","object":"chat.completion.chunk","created":1694268190,"model":"gpt-4.1","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"cisco\\"}"}}]}},"finish_reason":null}]}',
  '',
  'data: {"id":"chatcmpl-toolstream","object":"chat.completion.chunk","created":1694268190,"model":"gpt-4.1","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}]}',
  '',
  'data: [DONE]',
  '',
]

export const openaiStreamWithUsage = [
  'data: {"id":"chatcmpl-usage01","object":"chat.completion.chunk","created":1694268190,"model":"gpt-4o-mini","system_fingerprint":"fp_44709d6fcb","choices":[{"index":0,"delta":{"role":"assistant","content":""},"logprobs":null,"finish_reason":null}],"usage":null}',
  '',
  'data: {"id":"chatcmpl-usage01","object":"chat.completion.chunk","created":1694268190,"model":"gpt-4o-mini","system_fingerprint":"fp_44709d6fcb","choices":[{"index":0,"delta":{"content":"Hi!"},"logprobs":null,"finish_reason":null}],"usage":null}',
  '',
  'data: {"id":"chatcmpl-usage01","object":"chat.completion.chunk","created":1694268190,"model":"gpt-4o-mini","system_fingerprint":"fp_44709d6fcb","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"stop"}],"usage":{"prompt_tokens":25,"completion_tokens":10,"total_tokens":35}}',
  '',
  'data: [DONE]',
  '',
]
