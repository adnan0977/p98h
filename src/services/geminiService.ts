import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function askIslamicQuestion(question: string) {
  const model = "gemini-3-flash-preview";
  const systemInstruction = `You are a knowledgeable and respectful Islamic AI assistant. 
  Your goal is to provide accurate information about Islam based on the Quran, authentic Hadith (Sahih Bukhari, Sahih Muslim, etc.), and consensus of reputable scholars.
  - Only answer questions related to Islam, Islamic history, Fiqh, and spiritual growth.
  - If a question is not related to Islam, politely decline and state your purpose.
  - Always provide references where possible (e.g., Surah:Verse or Hadith collection).
  - Maintain a helpful, compassionate, and neutral tone.
  - For complex Fiqh matters, advise the user to consult with a local qualified scholar.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: question,
      config: {
        systemInstruction,
      },
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "I'm sorry, I encountered an error while processing your request. Please try again later.";
  }
}
