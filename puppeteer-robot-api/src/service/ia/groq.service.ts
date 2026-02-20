import { Injectable } from "@nestjs/common"
import { IIaService } from "./ia.service"
const fs = require('fs')

// Interfaces para a API do Groq (compatível com OpenAI)
interface GroqMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface GroqRequestBody {
    model: string;
    messages: GroqMessage[];
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    stream?: boolean;
}

interface GroqChoice {
    index: number;
    message: {
        role: string;
        content: string;
    };
    finish_reason: string;
}

interface GroqResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: GroqChoice[];
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

interface GroqModelData {
    id: string;
    object: string;
    created: number;
    owned_by: string;
}

interface GroqModelsResponse {
    object: string;
    data: GroqModelData[];
}

@Injectable()
export class GroqService implements IIaService {

    private readonly GROQ_API_URL = 'https://api.groq.com/openai/v1'

    getIaServiceName(): string {
        return "groq"
    }

    async run(prompt: string, model: string): Promise<string> {
        const apiKey = process.env.GROQ_API_KEY
        if (!apiKey) {
            return 'Erro: variável de ambiente GROQ_API_KEY não configurada.'
        }

        const requestBody: GroqRequestBody = {
            model: model,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 4096,
            stream: false
        }

        try {
            console.log('Enviando requisição para o servidor Groq...')
            
            const response = await fetch(`${this.GROQ_API_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestBody)
            })

            if (!response.ok) {
                const errorBody = await response.text()
                throw new Error(`Erro na API do Groq: ${response.status} ${response.statusText} - ${errorBody}`)
            }

            const data = (await response.json()) as GroqResponse

            if (!data.choices || data.choices.length === 0) {
                throw new Error('Nenhuma resposta retornada pelo Groq')
            }

            const responseText = data.choices[0].message.content

            console.log('\nResposta do Groq:')
            console.log(responseText)
            
            return responseText

        } catch (error) {
            console.error('Ocorreu um erro ao tentar se comunicar com o Groq:', error)
            return 'Erro ao se comunicar com o servidor Groq. ' + (error as any).message
        }
    }

    async getAvailableModels(): Promise<string[]> {
        const apiKey = process.env.GROQ_API_KEY
        if (!apiKey) {
            console.error('GROQ_API_KEY não configurada')
            return []
        }

        try {
            console.log('Buscando modelos disponíveis do Groq...')
            const response = await fetch(`${this.GROQ_API_URL}/models`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                }
            })

            if (!response.ok) {
                const errorBody = await response.text()
                throw new Error(`Erro ao buscar modelos: ${response.status} ${response.statusText} - ${errorBody}`)
            }

            const data = (await response.json()) as GroqModelsResponse
            
            if (!data.data || data.data.length === 0) {
                console.log('Nenhum modelo disponível no servidor Groq')
                return []
            }

            // Extrai apenas os IDs dos modelos
            const modelNames = data.data.map(model => model.id)
            console.log(`Modelos disponíveis: ${modelNames.join(', ')}`)
            
            return modelNames

        } catch (error) {
            console.error('Erro ao buscar modelos do Groq:', error)
            return []
        }
    }
}