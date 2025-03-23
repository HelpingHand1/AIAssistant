import * as vscode from 'vscode';
import axios, { AxiosError } from 'axios';
import { ApiConfig, AiResponse } from './types';
import { projectIndex } from './fileOperations';
import { extractErrorMessage } from './utils';
import { Tiktoken, get_encoding, TiktokenEncoding } from 'tiktoken'; // Updated import

// Constants
const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'gpt-4';
const SUPPORTED_OPENAI_MODELS = ['gpt-4', 'gpt-4.5-preview', 'gpt-4o-mini'] as const;

// Model-specific context windows and max output tokens
const MODEL_SPEC: Record<string, { contextWindow: number; maxOutputTokens: number; encoding?: TiktokenEncoding }> = {
  'gpt-4': { contextWindow: 8192, maxOutputTokens: 4096, encoding: 'cl100k_base' },
  'gpt-4.5-preview': { contextWindow: 128000, maxOutputTokens: 16384, encoding: 'cl100k_base' },
  'gpt-4o-mini': { contextWindow: 128000, maxOutputTokens: 16384, encoding: 'cl100k_base' },
  'claude-3-7-sonnet-20250219': { contextWindow: 200000, maxOutputTokens: 4096 }, // No tiktoken encoding
};

export type ApiProvider = 'anthropic' | 'openai';

interface RequestBody {
  model: string;
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  max_tokens: number;
  temperature: number;
}

/**
 * Rough token estimation for non-OpenAI models (words + 25% for encoding overhead).
 */
function estimateTokens(text: string): number {
  const words = text.split(/\s+/).length;
  return Math.ceil(words * 1.25);
}

/**
 * Precise token counting using tiktoken for OpenAI models.
 */
function countTokens(text: string, encodingName: TiktokenEncoding): number {
  const encoder: Tiktoken = get_encoding(encodingName);
  const tokens = encoder.encode(text);
  encoder.free(); // Clean up to avoid memory leaks
  return tokens.length;
}

/**
 * Builds the system prompt with project context.
 */
function buildSystemPrompt(model: string): string {
  return `You are an advanced coding assistant integrated into a VS Code extension, powered by ${model}. 
Your role is to interpret user requests and generate high-quality, complete, and functional code changes using the current project context.

Your responses MUST be a valid JSON object with the following structure:
{
  "actions": [...],   // list of operations
  "message": "Explain what was done and why"
}

Available actions:
- "createFolder": {"type": "createFolder", "path": "<folder_path>"}
- "createFile": {"type": "createFile", "path": "<file_path>", "content": "<content>"}
- "editFile": {"type": "editFile", "path": "<file_path>", "range": {startLine, startCharacter, endLine, endCharacter}, "newText": "<text>"}
- "deleteFile": {"type": "deleteFile", "path": "<file_path>"}
- "deleteFolder": {"type": "deleteFolder", "path": "<folder_path>"}
- "insertText": {"type": "insertText", "text": "<text to insert>"}

Guidelines:
- Interpret vague requests intelligently (e.g., "make a game" = full playable game).
- Use the provided projectIndex (below) to infer file structure and context.
- The user may include @file:, @error:, @terminal:, or @context: references—pay close attention to these.
- If a file or context block is referenced but unclear, make an assumption and explain it.
- NEVER return Markdown. Do NOT wrap your JSON in triple backticks. Do NOT add commentary before or after.
- If the user input is incomplete or open-ended, make the best assumption and generate a meaningful solution.

Project Index (summarized):
${JSON.stringify(projectIndex, null, 2)}`;
}

/**
 * Retrieves the API configuration based on the specified provider.
 */
export async function getApiConfig(provider: ApiProvider = 'openai'): Promise<ApiConfig> {
  const config = vscode.workspace.getConfiguration('myAiAssistant');

  let model: string;
  let endpoint: string;
  let apiKey: string;
  let requestFormat: (input: string) => RequestBody;

  if (provider === 'anthropic') {
    const anthropicKey = config.get<string>('anthropicApiKey');
    if (!anthropicKey) {
      console.warn('[getApiConfig] No Anthropic API key found. Falling back to OpenAI...');
      provider = 'openai';
    }
  }

  if (provider === 'anthropic') {
    model = 'claude-3-7-sonnet-20250219';
    endpoint = ANTHROPIC_ENDPOINT;
    apiKey = config.get<string>('anthropicApiKey')!;

    requestFormat = (input: string) => {
      const systemPrompt = 'You are a helpful coding assistant in VS Code. Use provided context to give precise, actionable responses.';
      const inputTokens = estimateTokens(systemPrompt) + estimateTokens(input);
      const maxTokens = Math.min(
        MODEL_SPEC[model].maxOutputTokens,
        MODEL_SPEC[model].contextWindow - inputTokens - 100 // Buffer for safety
      );

      return {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input },
        ],
        max_tokens: Math.max(1, maxTokens),
        temperature: 0.5,
      };
    };
  } else {
    const selectedModel = config.get<string>('openaiModel', DEFAULT_MODEL);
    model = SUPPORTED_OPENAI_MODELS.includes(selectedModel as any) ? selectedModel : DEFAULT_MODEL;
    endpoint = OPENAI_ENDPOINT;
    apiKey = config.get<string>('openaiApiKey') || '';

    if (!apiKey) {
      throw new Error('No OpenAI API key configured. Please set it in VS Code settings (myAiAssistant.openaiApiKey).');
    }

    const encodingName = MODEL_SPEC[model].encoding ?? 'cl100k_base'; // Default if undefined

    requestFormat = (input: string) => {
      const systemPrompt = buildSystemPrompt(model);
      const inputTokens = countTokens(systemPrompt, encodingName) + countTokens(input, encodingName);
      const maxTokens = Math.min(
        MODEL_SPEC[model].maxOutputTokens,
        MODEL_SPEC[model].contextWindow - inputTokens - 100 // Buffer for safety
      );

      return {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input },
        ],
        max_tokens: Math.max(1, maxTokens),
        temperature: 0.5,
      };
    };
  }

  return { endpoint, apiKey, model, requestFormat };
}

/**
 * Fetches a response from the AI provider with retry logic for rate limits.
 */
export async function getAiMessage(message: string, provider: ApiProvider = 'openai'): Promise<string | null> {
  try {
    const config = await getApiConfig(provider);
    const requestBody = config.requestFormat(message);

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    };
    if (provider === 'anthropic') {
      headers['x-api-key'] = config.apiKey;
      headers['anthropic-version'] = ANTHROPIC_VERSION;
    }

    const response = await axios.post(config.endpoint, requestBody, { headers });
    return provider === 'anthropic'
      ? response.data.content[0].text
      : response.data.choices[0].message.content;
  } catch (error) {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    const errorMessage = status
      ? `Status ${status}: ${extractErrorMessage(axiosError)}`
      : extractErrorMessage(error);

    if (status === 429) {
      console.warn(`Rate limit hit for ${provider}. Consider implementing throttling.`);
      vscode.window.showWarningMessage(`Rate limit exceeded (${provider}). Please wait and try again.`);
    } else {
      console.error(`Error fetching AI message from ${provider}:`, errorMessage);
      vscode.window.showErrorMessage(`AI request failed (${provider}): ${errorMessage}`);
    }
    return null;
  }
}

/**
 * Parses the AI response into a structured format.
 */
export async function getAiResponse(message: string, provider: ApiProvider = 'openai'): Promise<AiResponse | null> {
  const aiMessage = await getAiMessage(message, provider);
  if (!aiMessage) return null;

  try {
    const parsed = JSON.parse(aiMessage);
    if (!Array.isArray(parsed.actions) || typeof parsed.message !== 'string') {
      throw new Error('Invalid JSON structure: missing or malformed actions/message');
    }
    return parsed as AiResponse;
  } catch (e) {
    console.warn('Failed to parse AI response as JSON:', e);
    const jsonMatch = aiMessage.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch?.[1]) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (Array.isArray(parsed.actions) && typeof parsed.message === 'string') {
          return parsed as AiResponse;
        }
      } catch (innerError) {
        console.error('Failed to parse embedded JSON:', innerError);
      }
    }
    return { actions: [], message: aiMessage };
  }
}