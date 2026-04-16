import { GoogleGenerativeAI } from '@google/generative-ai';

export interface RephraseResult {
  originalTitle: string;
  rephrasedTitle: string;
  originalContent: string;
  rephrasedContent: string;
  originalExcerpt?: string;
  rephrasedExcerpt?: string;
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Comprehensive list of models to try, from newest to most stable
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-1.5-flash-8b',
  'gemini-pro'
];

/**
 * Rephrase news article using Gemini API
 */
export async function rephraseArticle(
  title: string,
  content: string,
  excerpt?: string
): Promise<RephraseResult> {
  for (const modelName of GEMINI_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });

      // Rephrase title
      const titlePrompt = `Rephrase this news headline to be unique while keeping the same meaning and tone. Keep it concise (under 100 characters):
      "${title}"
      Return only the rephrased headline, nothing else.`;

      const titleResult = await model.generateContent(titlePrompt);
      const rephrasedTitle = titleResult.response.text().trim().replace(/['"]/g, '');

      // Rephrase content
      const contentPrompt = `Rephrase this news article to be unique while preserving all facts, information, and tone. Make it engaging and well-written. Keep similar length:
      ${content}
      Return only the rephrased article, nothing else.`;

      const contentResult = await model.generateContent(contentPrompt);
      const rephrasedContent = contentResult.response.text().trim();

      // Rephrase excerpt if provided
      let rephrasedExcerpt = excerpt;
      if (excerpt) {
        const excerptPrompt = `Rephrase this news summary to be unique while keeping the same meaning (under 200 characters):
        "${excerpt}"
        Return only the rephrased summary, nothing else.`;

        const excerptResult = await model.generateContent(excerptPrompt);
        rephrasedExcerpt = excerptResult.response.text().trim().replace(/['"]/g, '');
      }

      return {
        originalTitle: title,
        rephrasedTitle,
        originalContent: content,
        rephrasedContent,
        originalExcerpt: excerpt,
        rephrasedExcerpt,
      };
    } catch (error: any) {
      console.warn(`Rephrase failed for model ${modelName}:`, error.message);
      if (error.message?.includes('404')) continue; // Try next if model not found
    }
  }

  throw new Error('All Gemini models failed to rephrase article');
}

/**
 * Batch rephrase multiple articles
 */
export async function rephraseArticles(
  articles: Array<{ title: string; content: string; excerpt?: string }>
): Promise<RephraseResult[]> {
  const results: RephraseResult[] = [];

  for (const article of articles) {
    try {
      const rephrased = await rephraseArticle(
        article.title,
        article.content,
        article.excerpt
      );
      results.push(rephrased);
      await new Promise(resolve => setTimeout(resolve, 4000));
    } catch (error) {
      console.error(`Failed to rephrase article: ${article.title}`, error);
    }
  }

  return results;
}

export async function expandNewsSnippet(
  title: string,
  snippet: string,
  category?: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return snippet ? `<p>${snippet}</p>` : '';

  const snippetLen = snippet?.length || 0;
  let lastBestExpansion = '';

  for (const modelName of GEMINI_MODELS) {
    try {
      console.log(`Attempting AI expansion for "${title}" using model: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const prompt = `
        You are a senior investigative journalist writing for a premier news organization. 
        I need you to transform this short news brief into a COMPREHENSIVE, DEEP-DIVE news article of AT LEAST 800-1000 words.
        
        Headline: ${title}
        Original Brief: ${snippet}
        Category: ${category || 'General News'}
        
        Detailed Instructions:
        1. **Expansion**: Expand the brief into a long-form report with 8-10 detailed paragraphs.
        2. **Context**: Add extensive background context, global implications, and historical relevance.
        3. **Technical Detail**: Elaborate on every name, place, and event mentioned. 
        4. **Structure**: Lede, detailed body with subheadings, and a comprehensive conclusion.
        5. **Formatting**: Return ONLY clean HTML. Use <p> for paragraphs and <h3> for subheadings.
        6. **ABSOLUTE MINIMUM LENGTH**: This MUST exceed 1500 characters. DO NOT return a short summary. 
        
        Return ONLY the HTML article.
      `;

      const result = await model.generateContent(prompt);
      const content = result.response.text().trim();
      const cleaned = content.replace(/```html|```/g, '').trim();

      // Track the longest expansion found so far
      if (cleaned.length > lastBestExpansion.length) {
        lastBestExpansion = cleaned;
      }

      // If we got a TRULY long expansion (>1500 chars), return it immediately
      if (cleaned.length > 1500) {
        console.log(`✅ AI Expansion successful with ${modelName} (${cleaned.length} characters)`);
        return cleaned;
      }
    } catch (error: any) {
      console.warn(`Model ${modelName} expansion failed:`, error.message);
      if (error.message?.includes('404')) continue;
    }
  }

  // Final fallback: Use the best expansion we got, otherwise return snippet
  if (lastBestExpansion && lastBestExpansion.length > snippetLen * 1.2) {
    return lastBestExpansion;
  }

  return snippet ? `<p>${snippet}</p>` : '';
}
