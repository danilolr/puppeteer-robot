import { Injectable } from "@nestjs/common"
import { OllamaService } from "./ollama.service"
import { GeminiService } from "./gemmini.service"
import { GroqService } from "./groq.service"

export interface IIaService {
    getIaServiceName(): string
    run(prompt: string, model: string): Promise<string>
    getAvailableModels(): Promise<string[]>
}

@Injectable()
export class IaService {

    iaServices: IIaService[] = []

    constructor(ollamaService: OllamaService, geminiService: GeminiService, groqService: GroqService) {
        console.log('Inicializando serviços de IA disponíveis...')
        console.log('Variáveis de ambiente detectadas:')
        console.log(`  GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '***' : 'não configurada'}`)
        console.log(`  GROQ_API_KEY: ${process.env.GROQ_API_KEY ? '***' : 'não configurada'}`)
        console.log(`  OLLAMA_API_URL: ${process.env.OLLAMA_API_URL ? '***' : 'não configurada'}`)
        if (process.env.GEMINI_API_KEY) {
            console.log('  Serviço Gemini habilitado.')
            this.iaServices.push(geminiService)
        }
        if (process.env.GROQ_API_KEY) {
            console.log('  Serviço Groq habilitado.')
            this.iaServices.push(groqService)
        }
        if (process.env.OLLAMA_API_URL) {
            console.log('  Serviço Ollama habilitado.')
            this.iaServices.push(ollamaService)
        }
    }

    async run(prompt: string, model: string): Promise<string> {
        const modelProvider = model.substring(0, model.indexOf('/'))
        const modelName = model.substring(model.indexOf('/') + 1)
        for (const iaService of this.iaServices) {
            if (modelProvider===iaService.getIaServiceName()) {
                return iaService.run(prompt, modelName)
            }
        }
        return `Erro: modelo IA '${model}' não encontrado ou serviço não configurado.`
    }

    async getAvailableModels(): Promise<string[]> {
        var models: string[] = []
        for (const iaService of this.iaServices) {
            const serviceModels = await iaService.getAvailableModels()
            serviceModels.forEach((m, i) => { models.push(iaService.getIaServiceName() + '/' + m) })
        }
        return models
    }

}