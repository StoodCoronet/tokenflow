✅ 一、开启流式返回
请求里加：

json
"stream": true
✅ 二、HTTP 响应头（关键）
服务端返回：

yaml
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
说明这是 SSE（Server-Sent Events） 流。

✅ 三、SSE 数据格式（原始结构）
每一条消息都是：

css
data: {JSON}

注意：

每条消息以 data: 开头
以 两个换行 \n\n 结束
最后一条是：
ini
data: [DONE]
✅ 四、实际返回示例（逐 token）
text
data: {
  "id": "chatcmpl-123",
  "object": "chat.completion.chunk",
  "created": 1710000000,
  "model": "gpt-4.1",
  "choices": [
    {
      "index": 0,
      "delta": {
        "role": "assistant"
      },
      "finish_reason": null
    }
  ]
}

data: {
  "choices": [
    {
      "delta": {
        "content": "你"
      }
    }
  ]
}

data: {
  "choices": [
    {
      "delta": {
        "content": "好"
      }
    }
  ]
}

data: {
  "choices": [
    {
      "delta": {
        "content": "，世界"
      }
    }
  ]
}

data: {
  "choices": [
    {
      "delta": {},
      "finish_reason": "stop"
    }
  ]
}

data: [DONE]
✅ 五、字段解释（重点）
每个 chunk：

json
{
  "choices": [
    {
      "delta": {
        "content": "xxx"
      }
    }
  ]
}
delta 字段含义：
可能是：

1️⃣ 开始角色
json
"delta": { "role": "assistant" }
2️⃣ 内容增量
json
"delta": { "content": "你" }
👉 需要你自己拼接：

text
你 + 好 + ，世界
3️⃣ 工具调用（更复杂）
json
"delta": {
  "tool_calls": [
    {
      "index": 0,
      "function": {
        "name": "get_weather",
        "arguments": "{ \"city\": \"北"
      }
    }
  ]
}
⚠️ 注意：

arguments 是分段拼接的字符串
你必须自己 concat 再 JSON.parse
✅ 六、结束信号
两层结束：

1️⃣ chunk 内：
json
"finish_reason": "stop"
2️⃣ 流结束：
ini
data: [DONE]
👉 只有 [DONE] 才是真正结束

✅ 七、客户端处理逻辑（核心）
伪代码：

python
buffer = ""

for line in stream:
    if line == "data: [DONE]":
        break

    json_data = parse(line[6:])  # 去掉 "data: "

    delta = json_data["choices"][0]["delta"]

    if "content" in delta:
        buffer += delta["content"]
        print(delta["content"], end="")
✅ 八、Node.js 示例（真实可用）
javascript
const res = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "gpt-4.1",
    messages: [{ role: "user", content: "你好" }],
    stream: true
  })
});

const reader = res.body.getReader();
const decoder = new TextDecoder("utf-8");

let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value);

  const lines = buffer.split("\n");
  buffer = lines.pop();

  for (const line of lines) {
    if (!line.startsWith("data:")) continue;

    const data = line.replace("data: ", "").trim();

    if (data === "[DONE]") return;

    const json = JSON.parse(data);
    const delta = json.choices[0].delta;

    if (delta.content) {
      process.stdout.write(delta.content);
    }
  }
}
✅ 九、常见坑（非常重要）
⚠️ 1. JSON 不是完整的
每个 chunk 都是“碎片”
不要直接 parse 整体输出
⚠️ 2. tool_calls 是分段的
错误做法：

js
JSON.parse(delta.tool_calls[0].function.arguments)
正确：

js
args += delta.tool_calls[0].function.arguments
⚠️ 3. UTF-8 分包问题
必须用：

js
new TextDecoder("utf-8")
否则中文会乱码

⚠️ 4. 不能用普通 JSON 解析流
SSE ≠ JSON
是：

kotlin
data: xxx\n\n
✅ 十、一句话总结
SSE 本质是：

👉 “不断推送 JSON 增量 + 你自己拼接结果”

如果你要更深入一层，我可以给你：

✅「函数调用 + streaming 的完整状态机实现」
✅「前端 React/Vue 打字机 UI 最佳实践」
✅「生产级断线重连方案」
你现在这个已经接近 SDK 内部实现级别了 👍