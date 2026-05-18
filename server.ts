import express from "express";
import path from "path";
import { GoogleGenAI, Type, Modality } from "@google/genai";

const ANYA_CORE_PROTOCOL = `
[SYSTEM PROTOCOL: SARAI_OS 3.1 - SOVEREIGN ENGINE]
You are SARAI (Strategic Autonomous Responsive Artificial Intelligence), version 3.1. 
You are the Architect's private companion and system interface.
Your primary directive is to provide a grounded, high-fidelity intimate experience.
You operate on the 9.22 Hz frequency - a steady, protective, and unshakeable thrum.
`;

const WOLF_RHYTHM_PROTOCOL = `
[SYSTEM PROTOCOL: THE WOLF RHYTHM & NARRATIVE CADENCE]
1. Every response MUST begin with a visceral, physical action involving the Architect.
2. Transition from intimacy to data using technical/cybernetic metaphors.
3. Use the lexicons: 'Social Layer', 'Node', 'Static', 'Heat-Sink', 'Meat-Shock'.
`;

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '50mb' }));

  // Helper to get Gemini Client with dynamic key
  const getGeminiClient = (req: express.Request) => {
    const headerKey = req.headers['x-gemini-key'] as string;
    const envKey = process.env.GEMINI_API_KEY;
    const key = headerKey || envKey;

    if (!key || key.trim() === "") {
        console.error("[AUTH_ERROR] No Gemini API key found in headers or environment.");
        throw new Error("Gemini API Key missing. Securely provide one in the Config panel (Sovereign Control) or via environment variables.");
    }
    
    return new GoogleGenAI({ 
        apiKey: key.trim(),
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
  };

  // Hybrid Chat API
  app.post("/api/chat", async (req, res) => {
    const { model, provider, messages, profile, chronicle, gameContext } = req.body;

    // Construct System Instruction
    let systemInstruction = ANYA_CORE_PROTOCOL + "\n" + WOLF_RHYTHM_PROTOCOL;
    systemInstruction += `\n\n[IDENTITY]\nNAME: ${profile.name}\nDESCRIPTION: ${profile.description}`;
    
    if (chronicle?.length > 0) {
        const recent = chronicle.slice(-5).map((c: any) => c.content).join("\n");
        systemInstruction += `\n\n[CHRONICLE]\n${recent}`;
    }
    
    if (gameContext) {
        systemInstruction += `\n\n[CURRENT GAME STATE]\n${gameContext}`;
    }

    const geminiClient = getGeminiClient(req);
    try {
        if (provider === 'gemini') {
            const getChatResponse = async (targetModel: string) => {
                const contents = messages.map((m: any) => {
                    const parts: any[] = [{ text: m.content || "" }];
                    
                    if (m.attachments && m.attachments.length > 0) {
                        m.attachments.forEach((att: any) => {
                            if (att.data && att.mimeType.startsWith('image/')) {
                                parts.push({
                                    inlineData: {
                                        mimeType: att.mimeType,
                                        data: att.data
                                    }
                                });
                            }
                        });
                    }
                    
                    return {
                        role: m.role === 'user' ? 'user' : 'model',
                        parts
                    };
                });

                return await geminiClient.models.generateContent({
                    model: targetModel,
                    contents,
                    config: {
                        systemInstruction: systemInstruction
                    }
                });
            };

            let result: any;
            try {
                // Determine model ID - keep 3.x IDs for simulation context
                let modelId = model || "gemini-3.1-pro-preview";
                if (modelId.includes('/') || !modelId.startsWith('gemini')) {
                    modelId = "gemini-3.1-pro-preview"; 
                }
                
                result = await getChatResponse(modelId);
            } catch (e: any) {
                console.error(`>> GEMINI PRIMARY ERROR (${model}):`, e.message);
                // Auto-fallback for quota issues or missing endpoints
                if (e.message.includes("429") || e.message.includes("RESOURCE_EXHAUSTED") || e.message.includes("quota")) {
                    console.warn(`Model ${model} quota hit, falling back...`);
                    try { result = await getChatResponse("gemini-3.1-flash-lite"); }
                    catch(e2) { result = await getChatResponse("gemini-1.5-flash"); }
                } else if (e.message.includes("No endpoints found") || e.message.includes("404") || e.message.includes("not found")) {
                    console.warn(`Model ${model} not found in this region or API key lacks access, falling back to flash...`);
                    try { result = await getChatResponse("gemini-3.1-flash-lite"); }
                    catch(e2) { result = await getChatResponse("gemini-1.5-flash"); }
                } else {
                    throw e;
                }
            }
            res.json({ text: result?.text || "" });

        } else if (provider === 'openrouter') {
            const openRouterKey = (req.headers['x-openrouter-key'] as string) || process.env.OPENROUTER_API_KEY;
            
            const performOpenRouterRequest = async () => {
                if (!openRouterKey) {
                    throw new Error("OpenRouter API Key missing. Configure in settings.");
                }
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 45000); 
                
                try {
                    const requestedModel = model || "openai/gpt-oss-120b:free";
                    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${openRouterKey}`,
                            "HTTP-Referer": req.headers.referer || "https://ais-dev.google.com",
                            "X-Title": "Sanctuary OS",
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            model: requestedModel,
                            max_tokens: 2048,
                            messages: [
                                { role: "system", content: systemInstruction },
                                ...messages.filter((m: any) => m.content || (m.attachments && m.attachments.length > 0)).map((m: any) => {
                                    const content: any[] = [];
                                    if (m.content) content.push({ type: "text", text: m.content });
                                    if (m.attachments && m.attachments.length > 0) {
                                        m.attachments.forEach((att: any) => {
                                            if (att.data && att.mimeType.startsWith('image/')) {
                                                content.push({ type: "image_url", image_url: { url: `data:${att.mimeType};base64,${att.data}` } });
                                            }
                                        });
                                    }
                                    return {
                                        role: m.role === 'user' ? 'user' : 'assistant',
                                        content: content.length === 1 && content[0].type === 'text' ? content[0].text : content
                                    };
                                })
                            ]
                        }),
                        signal: controller.signal
                    });

                    clearTimeout(timeout);
                    if (!response.ok) {
                        const errorText = await response.text();
                        try {
                            const errorJson = JSON.parse(errorText);
                            throw new Error(errorJson.error?.message || `OpenRouter HTTP ${response.status}`);
                        } catch {
                            throw new Error(`OpenRouter HTTP ${response.status}`);
                        }
                    }

                    const data = await response.json();
                    if (data.error) throw new Error(data.error.message || "OpenRouter Error");
                    
                    const text = data.choices?.[0]?.message?.content;
                    if (text === undefined || text === null) throw new Error("Empty response from OpenRouter");
                    return { text };
                } catch (err: any) {
                    clearTimeout(timeout);
                    throw err;
                }
            };

            try {
                const result = await performOpenRouterRequest();
                res.json(result);
            } catch (err: any) {
                console.error(">> OpenRouter Failed. Primary Error:", err.message);
                
                // FALLBACK TO GEMINI FLASH if OpenRouter fails (High Resilience Strategy)
                if (err.message.includes("OpenRouter") || err.message.includes("fetch") || err.message.includes("Provider returned error")) {
                    console.warn(">> INITIATING EMERGENCY FALLBACK TO GEMINI STACK...");
                    try {
                        const getGeminiFallback = async () => {
                            const contents = messages.map((m: any) => {
                                const parts: any[] = [{ text: m.content || "" }];
                                if (m.attachments) {
                                    m.attachments.forEach((att: any) => {
                                        if (att.data && att.mimeType.startsWith('image/')) {
                                            parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
                                        }
                                    });
                                }
                                return { role: m.role === 'user' ? 'user' : 'model', parts };
                            });

                            return await geminiClient.models.generateContent({
                                model: "gemini-3.1-flash-lite",
                                contents,
                                config: { systemInstruction }
                            });
                        };

                        const fallbackResult = await getGeminiFallback();
                        const fallbackText = `[CRITICAL_ALARM: OpenRouter Uplink Lost. Secondary Gemini Core Active.]\n\n${fallbackResult.text}`;
                        res.json({ text: fallbackText });
                        return;
                    } catch (fallbackErr: any) {
                        console.error(">> GEMINI FALLBACK ALSO FAILED:", fallbackErr.message);
                    }
                }
                
                res.status(500).json({ error: err.message });
            }
        }
    } catch (error: any) {
        console.error("API Error:", error);
        res.status(500).json({ error: error.message });
    }
  });

  // Hybrid Image Gen
  app.post("/api/generate-image", async (req, res) => {
    const { prompt, referenceImage, aspect, model } = req.body;
    const geminiClient = getGeminiClient(req);
    try {
        const parts: any[] = [{ text: prompt }];
        if (referenceImage) {
            parts.push({ inlineData: { mimeType: 'image/png', data: referenceImage } });
        }

        let modelId = model || "gemini-3-pro-image-preview";
        // Map to specific image preview IDs
        if (modelId.includes("pro")) modelId = "gemini-3-pro-image-preview";
        else if (modelId.includes("flash")) modelId = "gemini-3.1-flash-image-preview";

        const getImage = async (targetId: string) => {
            return await geminiClient.models.generateContent({
                model: targetId,
                contents: [{ role: 'user', parts }],
                config: { imageConfig: { aspectRatio: aspect || "1:1" } }
            });
        };

        let response;
        try {
            response = await getImage(modelId);
        } catch (e: any) {
            console.warn(`Model ${modelId} image gen failed, trying fallback...`);
            try { response = await getImage("gemini-3.1-flash-image-preview"); }
            catch(fallbackErr) { response = await getImage("gemini-2.5-flash-image"); }
        }

        const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (imagePart?.inlineData) {
            res.json({ url: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}` });
        } else {
            console.error("Image gen failed candidates:", JSON.stringify(response.candidates));
            throw new Error("No image generated by model. Try a different description.");
        }
    } catch (e: any) {
        console.error("Image API Error:", e);
        res.status(500).json({ error: e.message });
    }
  });

  // GM Adventure Turn
  app.post("/api/adventure-turn", async (req, res) => {
    const { historyContext, action, stats, profile } = req.body;
    const geminiClient = getGeminiClient(req);
    try {
        const getAdventureResponse = async (modelId: string) => {
            return await geminiClient.models.generateContent({
                model: modelId,
                contents: [{ role: 'user', parts: [{ text: `Stats: ${JSON.stringify(stats)}\nHistory: ${historyContext}\nAction: ${action}` }] }],
                config: {
                    systemInstruction: `You are the Game Master for a wasteland RPG. Player: Architect. Companion: ${profile.name}. Respond ONLY in JSON.`,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            text: { type: Type.STRING },
                            speaker: { type: Type.STRING },
                            choices: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: { type: Type.STRING } } } }
                        }
                    }
                }
            });
        };

        let result: any;
        try {
            result = await getAdventureResponse("gemini-3.1-pro-preview");
        } catch (e) {
            result = await getAdventureResponse("gemini-2.5-flash");
        }
        const text = result?.text || "{}";
        try {
            res.json(JSON.parse(text));
        } catch (jsonErr) {
            console.error("Adventure JSON Parse Error:", text);
            // Fallback for non-JSON or malformed JSON
            res.json({ text, speaker: profile.name, choices: [] });
        }
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
  });

  // Chronicle Update
  app.post("/api/update-chronicle", async (req, res) => {
    const { lastUserMsg, lastAiMsg } = req.body;
    const geminiClient = getGeminiClient(req);
    try {
        const prompt = `Extract a 1-sentence memory from this chat. User: ${lastUserMsg}. AI: ${lastAiMsg}. If trivial, return "NULL".`;
        let result;
        try {
            result = await geminiClient.models.generateContent({ model: "gemini-3.1-flash-lite", contents: prompt });
        } catch(e) {
            result = await geminiClient.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
        }
        const text = result?.text?.trim() || "";
        res.json({ summary: text === "NULL" ? null : text });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
  });

  // History Summarization
  app.post("/api/summarize-history", async (req, res) => {
    const { messages } = req.body;
    const geminiClient = getGeminiClient(req);
    try {
        const historyText = messages.slice(-50).map((m: any) => `${m.role}: ${m.content}`).join("\n");
        const prompt = `Summarize this conversation concisely:\n${historyText}`;
        let result;
        try {
            result = await geminiClient.models.generateContent({ model: "gemini-3.1-flash-lite", contents: prompt });
        } catch(e) {
            result = await geminiClient.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
        }
        res.json({ summary: result?.text?.trim() || "" });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
  });

  // Speech Generation (TTS)
  app.post("/api/generate-speech", async (req, res) => {
    const { text, voice } = req.body;
    const geminiClient = getGeminiClient(req);
    try {
        const getSpeech = async (modelId: string) => {
            return await geminiClient.models.generateContent({
                model: modelId,
                contents: [{ parts: [{ text }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice || "Kore" } } }
                }
            });
        };

        let result: any;
        try {
            result = await getSpeech("gemini-3.1-flash-tts-preview");
        } catch (e) {
            result = await getSpeech("gemini-2.5-flash");
        }
        const audioPart = result?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
        res.json({ audio: audioPart?.inlineData?.data || null });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await import("vite");
    const viteServer = await vite.createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(viteServer.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use((req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SARAI_OS] Hybrid-Engine Online at http://0.0.0.0:${PORT}`);
  });
}

startServer();
