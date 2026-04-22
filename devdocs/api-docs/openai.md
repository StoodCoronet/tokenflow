有的，我给你一个更完整、接近生产级的 Chat Completions API 调用示例（包含常用参数 + 流式 + 函数调用等），你可以直接对照用。

✅ 完整请求结构（详细版）
json
POST https://api.openai.com/v1/chat/completions

Headers:
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

Body:
{
  "model": "gpt-4.1",

  "messages": [
    {
      "role": "system",
      "content": "你是一个严谨的技术助手"
    },
    {
      "role": "user",
      "content": "帮我写一个Python函数，计算斐波那契数列"
    }
  ],

  "temperature": 0.7,
  "top_p": 1,
  "n": 1,
  "stream": false,
  "stop": null,
  "max_tokens": 500,
  "presence_penalty": 0,
  "frequency_penalty": 0,

  "logit_bias": {
    "50256": -100
  },

  "user": "user-123",

  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "获取某个城市的天气",
        "parameters": {
          "type": "object",
          "properties": {
            "city": {
              "type": "string",
              "description": "城市名称"
            }
          },
          "required": ["city"]
        }
      }
    }
  ],

  "tool_choice": "auto"
}
✅ 所有核心参数详解
1. messages（核心）
json
"messages": [
  {"role": "system", "content": "..."},
  {"role": "user", "content": "..."},
  {"role": "assistant", "content": "..."}
]
按顺序表示对话历史
模型是完全依赖这个数组来“记忆上下文”
2. 采样控制
temperature（随机性）

0 → 非常确定（适合代码）
1 → 默认
1 → 更发散

top_p（核采样）

一般保持 1
和 temperature 二选一调
3. 输出控制
max_tokens：最大生成长度
stop：停止符，例如：
json
"stop": ["\n\n", "END"]
4. 惩罚机制
presence_penalty（避免重复话题）
frequency_penalty（避免重复词）
范围：-2 ~ 2

5. logit_bias（高级）
控制某些 token 出现概率：

json
"logit_bias": {
  "token_id": -100
}
用途：

禁止某些词
强制某些词出现
（一般很少用）

6. n（多候选）
json
"n": 3
返回多个候选回复：

json
choices[0], choices[1], choices[2]
7. stream（流式输出）
json
"stream": true
返回 SSE（Server-Sent Events）：

text
data: { "choices": [ { "delta": { "content": "你" } } ] }
data: { "choices": [ { "delta": { "content": "好" } } ] }
适合：

打字机效果
实时 UI
8. tools（函数调用）
json
"tools": [
  {
    "type": "function",
    "function": {
      "name": "get_weather",
      "parameters": {...}
    }
  }
]
模型可能返回：

json
"tool_calls": [
  {
    "id": "call_123",
    "type": "function",
    "function": {
      "name": "get_weather",
      "arguments": "{ \"city\": \"北京\" }"
    }
  }
]
你需要：

解析参数
调用你自己的函数
把结果再喂回 messages
9. tool_choice
json
"tool_choice": "auto"
可选：

auto（默认）
none（禁止调用工具）
指定某个函数
10. user（追踪用）
json
"user": "user-id-123"
用于：

风控
日志
用户隔离
✅ 返回结构（完整版）
json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1710000000,
  "model": "gpt-4.1",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "这里是回复",
        "tool_calls": []
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 50,
    "completion_tokens": 100,
    "total_tokens": 150
  }
}
✅ Python（完整版写法）
python
from openai import OpenAI
client = OpenAI()

response = client.chat.completions.create(
    model="gpt-4.1",
    messages=[
        {"role": "system", "content": "你是一个代码助手"},
        {"role": "user", "content": "写一个快速排序"}
    ],
    temperature=0.3,
    max_tokens=300,
)

print(response.choices[0].message.content)







