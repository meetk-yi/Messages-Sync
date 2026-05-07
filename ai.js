const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateContextualMessage(scrapedData) {
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const prompt = `
    You are an AI assistant that summarizes and structures technical discussions from Microsoft Teams.
    Below is a scraped message which might include a title, description, and potentially multiple replies or thread history and the message content itself.
    
    TASK:
    Generate a concise, contextual summary of this discussion. 
    Ensure you preserve all technical details, action items, and the core problem being discussed.
    The output should be a single, well-structured paragraph or a short list of points that clearly explains the situation.
    
    SCRAPED DATA:
    ${JSON.stringify(scrapedData, null, 2)}
    
    RESPONSE FORMAT:
    Just the summary text. No preamble, no "Here is the summary", no markdown formatting (unless it helps readability within a spreadsheet cell).
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    } catch (error) {
        console.error('❌ Gemini Error:', error.message);
        return "Error generating AI summary: " + error.message;
    }
}

module.exports = { generateContextualMessage };
