import { Injectable } from "@nestjs/common"
import { IIaService } from "./ia.service"
const fs = require('fs')

interface OllamaResponse {
    model: string;
    created_at: string;
    response: string;
    done: boolean;
    // Adicione outras propriedades se o seu modelo retornar mais dados
}

interface OllamaModel {
    name: string;
    modified_at: string;
    size: number;
    digest: string;
    details?: {
        format?: string;
        family?: string;
        families?: string[];
        parameter_size?: string;
        quantization_level?: string;
    };
}

interface OllamaModelsResponse {
    models: OllamaModel[];
}

@Injectable()
export class OllamaService implements IIaService {

    getIaServiceName(): string {
        return "ollama"
    }

    async run(prompt: string, model: string): Promise<string> {
        const requestBody = {
            model: model,
            prompt: prompt,
            stream: false,
            options: {
                num_ctx: 4096                
            }
        }

        try {
            console.log('Enviando requisição para o servidor Ollama com fetch...')
            const response = await fetch(process.env.OLLAMA_API_URL!, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody), // Converte o objeto JS para uma string JSON
            })

            // Verifica se a resposta da rede foi bem-sucedida
            if (!response.ok) {
                // Se não foi, tenta ler o corpo do erro para dar mais detalhes
                const errorBody = await response.text()
                throw new Error(`Erro na API do Ollama: ${response.status} ${response.statusText} - ${errorBody}`)
            }

            // Converte a resposta de JSON para um objeto JavaScript
            const data = (await response.json()) as OllamaResponse

            // Exibe a resposta do modelo
            console.log('\nResposta do Ollama:');
            console.log(data.response)
            return data.response

        } catch (error) {
            // Captura erros de rede (ex: servidor offline) ou o erro que lançamos acima
            console.error('Ocorreu um erro ao tentar se comunicar com o Ollama:', error)
            return 'Erro ao se comunicar com o servidor Ollama. ' + error.message
        }
    }

    async getAvailableModels(): Promise<string[]> {
        if (!process.env.OLLAMA_API_URL) {
            console.error('OLLAMA_API_URL não configurada')
            return []
        }

        try {
            const baseUrl = process.env.OLLAMA_API_URL.replace('/api/generate', '')
            const url = `${baseUrl}/api/tags`
            
            console.log('Buscando modelos disponíveis do Ollama...')
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            })

            if (!response.ok) {
                const errorBody = await response.text()
                throw new Error(`Erro ao buscar modelos: ${response.status} ${response.statusText} - ${errorBody}`)
            }

            const data = (await response.json()) as OllamaModelsResponse
            
            if (!data.models || data.models.length === 0) {
                console.log('Nenhum modelo disponível no servidor Ollama')
                return []
            }

            // Extrai apenas os nomes dos modelos
            const modelNames = data.models.map(model => model.name)
            console.log(`Modelos disponíveis: ${modelNames.join(', ')}`)
            
            return modelNames

        } catch (error) {
            console.error('Erro ao buscar modelos do Ollama:', error)
            return []
        }
    }

}