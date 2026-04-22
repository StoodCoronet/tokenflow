# OpenAI Chat Completions API — Condensed Reference

Source: `openai-chat.md` (official) + `openai-sse-api-doc.md` (official)
Endpoint: `POST /v1/chat/completions`

## Request Body

```json
{
  "model": "gpt-4.1",
  "messages": [],
  "temperature": 1.0,
  "top_p": 1.0,
  "max_completion_tokens": 500,
  "stream": false,
  "stream_options": null,
  "stop": null,
  "n": 1,
  "presence_penalty": 0,
  "frequency_penalty": 0,
  "logit_bias": {},
  "user": "user-123",
  "tools": [],
  "tool_choice": "auto",
  "logprobs": false,
  "top_logprobs": 0
}
```

- `max_tokens` is deprecated in favor of `max_completion_tokens` for newer models
- `temperature`: 0–2, default 1. Alter this or `top_p` but not both

### messages (required)

Array of message objects. Roles: `system`, `developer`, `user`, `assistant`, `tool`, `function`.

**developer** (replaces `system` for o1+ models):
```json
{ "role": "developer", "content": "You are a helpful assistant." }
```

**system** (legacy):
```json
{ "role": "system", "content": "You are a helpful assistant." }
```

**user**:
```json
{ "role": "user", "content": "Hello" }
```
`content` can be a **string** or **array of content parts**:
- `{ "type": "text", "text": "..." }`
- `{ "type": "image_url", "image_url": { "url": "...", "detail": "auto"|"low"|"high" } }`
- `{ "type": "input_audio", "input_audio": { "data": "<base64>", "format": "wav"|"mp3" } }`
- `{ "type": "file", "file": { "file_data": "...", "file_id": "...", "filename": "..." } }`

**assistant**:
```json
{
  "role": "assistant",
  "content": "Hi there!",
  "tool_calls": [
    { "id": "call_abc", "type": "function", "function": { "name": "get_weather", "arguments": "{\"city\":\"SF\"}" } }
  ]
}
```
- `content` is optional if `tool_calls` present
- `refusal?: string` — refusal message
- `function_call` is deprecated, use `tool_calls`

**tool** (result of a tool call):
```json
{ "role": "tool", "tool_call_id": "call_abc", "content": "result text" }
```

**function** (deprecated):
```json
{ "role": "function", "name": "get_weather", "content": "result" }
```

### tools (optional)

```json
[
  {
    "type": "function",
    "function": {
      "name": "get_weather",
      "description": "Get current weather for a city",
      "parameters": {
        "type": "object",
        "properties": {
          "location": { "type": "string", "description": "City name" },
          "unit": { "type": "string", "enum": ["celsius", "fahrenheit"] }
        },
        "required": ["location"]
      },
      "strict": false
    }
  }
]
```

Also supports `type: "custom"` tools (with `custom.name`, `custom.description`, `custom.format`).

### tool_choice (optional)

- `"none"` — never use tools (default when no tools present)
- `"auto"` — model decides (default when tools present)
- `"required"` — must use a tool
- `{ "type": "function", "function": { "name": "get_weather" } }` — specific function
- `{ "type": "allowed_tools", "allowed_tools": { "mode": "auto"|"required", "tools": [...] } }` — constrain to subset

---

## Response (Non-streaming)

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1699896916,
  "model": "gpt-4.1",
  "system_fingerprint": "fp_44709d6fcb",
  "service_tier": "default",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you?",
        "tool_calls": null,
        "refusal": null
      },
      "logprobs": null,
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 50,
    "completion_tokens": 20,
    "total_tokens": 70,
    "completion_tokens_details": {
      "reasoning_tokens": 0,
      "accepted_prediction_tokens": 0,
      "rejected_prediction_tokens": 0
    },
    "prompt_tokens_details": {
      "cached_tokens": 0
    }
  }
}
```

### finish_reason values

`"stop"` | `"length"` | `"tool_calls"` | `"content_filter"` | `"function_call"` (deprecated)

### Tool Calls Response

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1699896916,
  "model": "gpt-4.1",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": null,
        "tool_calls": [
          {
            "id": "call_abc123",
            "type": "function",
            "function": {
              "name": "get_current_weather",
              "arguments": "{\"location\": \"Boston, MA\"}"
            }
          }
        ]
      },
      "logprobs": null,
      "finish_reason": "tool_calls"
    }
  ],
  "usage": {
    "prompt_tokens": 82,
    "completion_tokens": 17,
    "total_tokens": 99
  }
}
```

### Tool Result Follow-up

```json
{ "role": "tool", "tool_call_id": "call_abc123", "content": "{\"temperature\": 72}" }
```

---

## Streaming (SSE)

Request: set `"stream": true`.

Optional: `"stream_options": { "include_usage": true }` to get usage stats in the last chunk.

### Event Format

Each chunk is a line: `data: {JSON}\n\n`. Stream ends with `data: [DONE]\n\n`.

**object** is always `"chat.completion.chunk"`. All chunks share the same `id` and `created`.

### Basic Text Stream

```sse
data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1694268190,"model":"gpt-4o-mini","system_fingerprint":"fp_44709d6fcb","choices":[{"index":0,"delta":{"role":"assistant","content":""},"logprobs":null,"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1694268190,"model":"gpt-4o-mini","system_fingerprint":"fp_44709d6fcb","choices":[{"index":0,"delta":{"content":"Hello"},"logprobs":null,"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1694268190,"model":"gpt-4o-mini","system_fingerprint":"fp_44709d6fcb","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"stop"}]}

data: [DONE]
```

### Stream Delta Types

| field in delta | when |
|---|---|
| `role: "assistant"` | first chunk only |
| `content: "..."` | text content increment (may be `""` on first chunk) |
| `refusal: "..."` | model refusal |
| `{}` (empty) | final chunk with finish_reason |
| `tool_calls: [...]` | function call (streaming) |

### Tool Calls Stream

```sse
data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","model":"gpt-4.1","choices":[{"index":0,"delta":{"role":"assistant","content":null,"tool_calls":[{"index":0,"id":"call_abc123","type":"function","function":{"name":"get_weather","arguments":""}}]},"finish_reason":null}]}

data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","model":"gpt-4.1","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"ci"}}]},"finish_reason":null}]}

data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","model":"gpt-4.1","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"ty\": \"S"}}]},"finish_reason":null}]}

data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","model":"gpt-4.1","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"an Fran"}}]},"finish_reason":null}]}

data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","model":"gpt-4.1","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"cisco\"}"}}]},"finish_reason":null}]}

data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","model":"gpt-4.1","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}

data: [DONE]
```

- First `tool_calls` chunk: includes `id`, `type`, `function.name`, `function.arguments` (may be `""`)
- Subsequent chunks: only `function.arguments` (incremental partial JSON string, must concatenate then parse)
- `finish_reason: "tool_calls"` on final chunk

### Usage in Streaming

Only present when `stream_options: { include_usage: true }` is set. All chunks have `usage: null` except the **last chunk** which has the full usage stats.

---

## ChatCompletionChunk Delta Structure (official schema)

```
delta: {
  content?: string,
  function_call?: { arguments?: string, name?: string },  // deprecated
  refusal?: string,
  role?: "developer"|"system"|"user"|"assistant"|"tool",
  tool_calls?: [
    {
      index: number,
      id?: string,
      function?: { arguments?: string, name?: string },
      type?: "function"
    }
  ]
}
```
