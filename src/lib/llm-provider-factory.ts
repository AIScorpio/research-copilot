import { LLMProvider, LLMConfig, LLMProviderInterface } from './llm-types';
import { GroqProvider } from './llm-providers/groq';
import { OpenAIProvider } from './llm-providers/openai';
import { AnthropicProvider } from './llm-providers/anthropic';
import { OllamaProvider } from './llm-providers/ollama';
import { LMStudioProvider } from './llm-providers/lmstudio';
import { ZhipuAIProvider } from './llm-providers/zhipuai';
import { KimiProvider } from './llm-providers/kimi';
import { BaiduProvider } from './llm-providers/baidu';
import { AlibabaProvider } from './llm-providers/alibaba';
import { GeminiProvider } from './llm-providers/gemini';

export class LLMProviderFactory {
    static create(config: LLMConfig): LLMProviderInterface {
        switch (config.provider) {
            case 'groq':
                return new GroqProvider(config);
            case 'openai':
                return new OpenAIProvider(config);
            case 'anthropic':
                return new AnthropicProvider(config);
            case 'ollama':
                return new OllamaProvider(config);
            case 'lmstudio':
                return new LMStudioProvider(config);
            case 'zhipuai':
                return new ZhipuAIProvider(config);
            case 'kimi':
                return new KimiProvider(config);
            case 'baidu':
                return new BaiduProvider(config);
            case 'alibaba':
                return new AlibabaProvider(config);
            case 'gemini':
                return new GeminiProvider(config);
            default:
                throw new Error(`Unknown provider: ${config.provider}`);
        }
    }
}
