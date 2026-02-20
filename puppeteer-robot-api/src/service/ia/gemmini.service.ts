    import { Injectable } from "@nestjs/common"
import { IIaService } from "./ia.service";
const fs = require('fs')

// Interfaces para requisição e resposta da API Gemini
interface GeminiPart { text: string }
interface GeminiContent { parts: GeminiPart[] }
interface GeminiRequestBody { contents: GeminiContent[] }
interface GeminiCandidate { content: { parts: GeminiPart[] }; finishReason?: string }
interface GeminiResponseBody { candidates?: GeminiCandidate[] }

@Injectable()
export class GeminiService implements IIaService {

    getIaServiceName(): string {
        return "gemini"
    }
    
    async getAvailableModels(): Promise<string[]> {
        return ['gemini-2.5-flash', 'gemini-3-pro-preview', 'gemini-3-flash-preview', 'gemini-2.5-pro', 'gemini-2.5-flash-lite']       
    }

    async run(prompt: string, model: string): Promise<string> {
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
            return 'Erro: variável de ambiente GEMINI_API_KEY não configurada.'
        }

        // Corpo conforme especificação generateContent
        const requestBody: GeminiRequestBody = {
            contents: [
                {
                    parts: [ { text: prompt } ]
                }
            ]
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

        try {
            console.log(`Enviando requisição para Gemini (${model})...`)

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            })

            if (!response.ok) {
                const errorBody = await response.text()
                throw new Error(`Erro na API do Gemini: ${response.status} ${response.statusText} - ${errorBody}`)
            }

            const data = (await response.json()) as GeminiResponseBody
            if (!data.candidates || data.candidates.length === 0) {
                throw new Error('Nenhum candidato retornado pelo Gemini.')
            }

            const text = data.candidates[0].content.parts.map(p => p.text).join('\n')
            console.log('\nResposta do Gemini:')
            console.log(text)
            return text
        } catch (error) {
            console.error('Erro ao comunicar com Gemini:', error)
            return 'Erro ao se comunicar com o servidor Gemini. ' + (error as any).message
        }
    }
}