// 如果你是 Node 18 以下，需要先：npm install node-fetch
// 然后取消下面这行注释
// import fetch from "node-fetch";

const API_KEY = "your_api_key_here";
const BASE_URL = "https://api.moonshot.cn/anthropic";

async function main() {
    const response = await fetch(`${BASE_URL}/v1/messages`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": API_KEY,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
            model: "kimi-k2.5",
            max_tokens: 100,
            messages: [
            {
                role: "user",
                content: "Say hello world",
            },
            ],
        }),
    });

    const text = await response.text();

    console.log("Status:", response.status);
    console.log("Response:", text);
}

main().catch(console.error);