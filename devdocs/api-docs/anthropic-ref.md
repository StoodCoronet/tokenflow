# Anthropic Messages API — Condensed Reference

Source: `anthropic.md` + `anthropic_streaming.md`
Endpoint: `POST /v1/messages`

## Request Body

```json
{
  "model": "claude-sonnet-4-6",
  "max_tokens": 1024,
  "messages": [],
  "system": "",
  "temperature": 1.0,
  "top_p": 1.0,
  "top_k": 0,
  "stream": false,
  "stop_sequences": [],
  "metadata": { "user_id": "" },
  "tools": [],
  "tool_choice": { "type": "auto" },
  "thinking": { "type": "disabled" }
}
```

### messages (required)

Array of `{ role, content }`. Roles: `"user"`, `"assistant"`.

`content` can be a **string** or an **array of content blocks**:

```json
// string shorthand
{ "role": "user", "content": "Hello" }

// array of blocks
{ "role": "user", "content": [{ "type": "text", "text": "Hello" }] }
```

#### Input Content Block Types

**TextBlockParam**: `{ "type": "text", "text": "...", "cache_control"?: {...} }`

**ImageBlockParam**: `{ "type": "image", "source": { "type": "base64", "media_type": "image/png", "data": "..." } }`

**ToolResultBlockParam**: `{ "type": "tool_result", "tool_use_id": "toolu_xxx", "content": "result text" }`
- `content` can be string or array of content blocks
- `is_error?: boolean`

### system (optional)

String or array of TextBlockParam. No `"system"` role in messages.

### tools (optional)

```json
[
  {
    "name": "get_weather",
    "description": "Get current weather",
    "input_schema": {
      "type": "object",
      "properties": {
        "location": { "type": "string", "description": "City name" }
      },
      "required": ["location"]
    }
  }
]
```

### tool_choice (optional)

- `{ "type": "auto" }` — model decides
- `{ "type": "any" }` — must use a tool
- `{ "type": "tool", "name": "get_weather" }` — must use specific tool
- `{ "type": "none" }` — no tools

All variants accept `disable_parallel_tool_use?: boolean`.

### thinking (optional)

- `{ "type": "disabled" }`
- `{ "type": "enabled", "budget_tokens": 10000, "display"?: "summarized"|"omitted" }`
- `{ "type": "adaptive", "display"?: "summarized"|"omitted" }`

---

## Response (Non-streaming)

```json
{
  "id": "msg_xxx",
  "type": "message",
  "role": "assistant",
  "model": "claude-sonnet-4-6",
  "content": [],
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {
    "input_tokens": 25,
    "output_tokens": 100,
    "cache_creation_input_tokens": 0,
    "cache_read_input_tokens": 0
  }
}
```

### stop_reason values

`"end_turn"` | `"max_tokens"` | `"stop_sequence"` | `"tool_use"` | `"pause_turn"` | `"refusal"`

### Response Content Block Types

**TextBlock**: `{ "type": "text", "text": "Hello!" }`

**ThinkingBlock**: `{ "type": "thinking", "thinking": "...", "signature": "..." }`

**RedactedThinkingBlock**: `{ "type": "redacted_thinking", "data": "..." }`

**ToolUseBlock**:
```json
{
  "type": "tool_use",
  "id": "toolu_01D7FLrfh4GYq7yT1ULFeyMV",
  "name": "get_weather",
  "input": { "location": "San Francisco, CA" }
}
```

### Full Response Example

```json
{
  "id": "msg_01XFDUDYJgAACzvnptvVo4EL",
  "type": "message",
  "role": "assistant",
  "model": "claude-sonnet-4-6",
  "content": [
    { "type": "text", "text": "Hello! How can I help you today?" }
  ],
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": { "input_tokens": 25, "output_tokens": 20 }
}
```

### Tool Use Response Example

```json
{
  "id": "msg_02...",
  "type": "message",
  "role": "assistant",
  "content": [
    { "type": "text", "text": "Let me check the weather." },
    {
      "type": "tool_use",
      "id": "toolu_01T1x1fJ34qAmk2tNTrN7Up6",
      "name": "get_weather",
      "input": { "location": "San Francisco, CA", "unit": "fahrenheit" }
    }
  ],
  "stop_reason": "tool_use",
  "stop_sequence": null,
  "usage": { "input_tokens": 472, "output_tokens": 89 }
}
```

---

## Streaming (SSE)

Request: set `"stream": true`.

### Event Flow

1. `message_start` — Message object with empty `content`
2. Per content block: `content_block_start` → `content_block_delta` (×N) → `content_block_stop`
3. `message_delta` — top-level changes (stop_reason, usage)
4. `message_stop`

May include `ping` events.

### Basic Text Stream

```sse
event: message_start
data: {"type":"message_start","message":{"id":"msg_1nZ","type":"message","role":"assistant","content":[],"model":"claude-sonnet-4-6","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":25,"output_tokens":1}}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: ping
data: {"type":"ping"}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"!"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":15}}

event: message_stop
data: {"type":"message_stop"}
```

### Tool Use Stream

```sse
event: message_start
data: {"type":"message_start","message":{"id":"msg_014p","type":"message","role":"assistant","model":"claude-sonnet-4-6","stop_sequence":null,"usage":{"input_tokens":472,"output_tokens":2},"content":[],"stop_reason":null}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Okay, let me check"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: content_block_start
data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_01T1x1fJ34qAmk2tNTrN7Up6","name":"get_weather","input":{}}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\"location\":"}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":" \"San Francisco, CA\"}"}}

event: content_block_stop
data: {"type":"content_block_stop","index":1}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"tool_use","stop_sequence":null},"usage":{"output_tokens":89}}

event: message_stop
data: {"type":"message_stop"}
```

### Thinking Stream

```sse
event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":"","signature":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"I need to find the GCD..."}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"signature_delta","signature":"EqQBCgIYAhIM..."}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: content_block_start
data: {"type":"content_block_start","index":1,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"The answer is 21."}}

event: content_block_stop
data: {"type":"content_block_stop","index":1}
```

### Delta Types Summary

| delta type | content block type | field |
|---|---|---|
| `text_delta` | `text` | `delta.text` |
| `thinking_delta` | `thinking` | `delta.thinking` |
| `signature_delta` | `thinking` | `delta.signature` |
| `input_json_delta` | `tool_use` | `delta.partial_json` |

### Error Event

```sse
event: error
data: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}
```
