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

export async function analyzeUserSessionLogs(events: any[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("AI Analysis unavailable (No API Key configured on server).");
  }

  if (!events || events.length === 0) {
    throw new Error("Insufficient data to generate a behavioral report for this session.");
  }

  // Pre-process events safely to avoid sending a massive prompt payload or throwing on invalid dates
  const simplifiedEvents = events.map(e => {
    let timeStr = 'Unknown';
    try {
      if (e.timestamp) {
        const d = new Date(e.timestamp);
        if (!isNaN(d.getTime())) {
          timeStr = d.toLocaleTimeString();
        }
      }
    } catch (err) { }
    return {
      time: timeStr,
      type: e.type,
      page: e.page,
      x: e.x,
      y: e.y,
      depth: e.scrollDepth !== null ? e.scrollDepth : undefined,
    };
  });

  const prompt = `
    You are an expert UX researcher and behavioral analyst.
    Below is a sequence of interactions (clicks, scrolls, and mouse movements) from a single user session on a news website.
    
    Session Data:
    ${JSON.stringify(simplifiedEvents, null, 2)}
    
    Task:
    Analyze these logs and write a concise, professional behavioral report (max 3-4 paragraphs) formatted in Markdown.
    
    Look for:
    - What pages did they visit?
    - Did they read deeply (scroll depth > 50%) or just skim?
    - Was there any erratic clicking or signs of hesitation?
    - What seemed to be their primary intent?
    
    Return ONLY the Markdown report. Do not include introductory text like "Here is the analysis".
  `;

  let lastError: any = null;
  for (const modelName of GEMINI_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const content = text ? text.trim() : "";
      if (content.length > 50) {
        return content;
      }
    } catch (error: any) {
      lastError = error;
      console.error(`Model ${modelName} analysis failed:`, error);
    }
  }

  throw new Error(lastError?.message || "Failed to analyze session logs. The AI agent encountered an error.");
}
