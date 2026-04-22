import OpenAI from 'openai';

const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: '<OPENROUTER_API_KEY>',
});

// First API call with reasoning
const apiResponse = await client.chat.completions.create({
    model: 'anthropic/claude-opus-4.7',
    messages: [
    {
        role: 'user' as const,
        content: "How many r's are in the word 'strawberry'?",
    },
    ],
    reasoning: { enabled: true }
});

// Extract the assistant message with reasoning_details
type ORChatMessage = (typeof apiResponse)['choices'][number]['message'] & {
    reasoning_details?: unknown;
};
const response = apiResponse.choices[0].message as ORChatMessage;

// Preserve the assistant message with reasoning_details
const messages = [
    {
    role: 'user' as const,
    content: "How many r's are in the word 'strawberry'?",
    },
    {
    role: 'assistant' as const,
    content: response.content,
    reasoning_details: response.reasoning_details, // Pass back unmodified
    },
    {
    role: 'user' as const,
    content: "Are you sure? Think carefully.",
    },
];

// Second API call - model continues reasoning from where it left off
const response2 = await client.chat.completions.create({
    model: 'anthropic/claude-opus-4.7',
    messages, // Includes preserved reasoning_details
});