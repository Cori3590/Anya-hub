import { WaifuProfile, Message, ChronicleEntry, Attachment } from '../types';

// --- HELPERS ---

/**
 * Converts a file to Base64, with auto-compression for images.
 */
export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
             const reader = new FileReader();
             reader.readAsDataURL(file);
             reader.onload = () => {
                 const result = reader.result as string;
                 resolve(result.split(',')[1]);
             };
             reader.onerror = error => reject(error);
             return;
        }

        const img = new Image();
        const url = URL.createObjectURL(file);
        img.src = url;
        
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const maxDim = 1024;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxDim) {
                    height *= maxDim / width;
                    width = maxDim;
                }
            } else {
                if (height > maxDim) {
                    width *= maxDim / height;
                    height = maxDim;
                }
            }

            canvas.width = width;
            canvas.height = height;
            
            if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.8);
                resolve(dataUrl.split(',')[1]);
            } else {
                reject(new Error("Canvas context failed"));
            }
            URL.revokeObjectURL(url);
        };
        
        img.onerror = (err) => {
            URL.revokeObjectURL(url);
            reject(err);
        };
    });
};

export const decodeBase64Audio = (base64: string): Uint8Array => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
};

export const createAudioBuffer = async (
    bytes: Uint8Array,
    ctx: AudioContext
): Promise<AudioBuffer> => {
    const sampleRate = 24000; // Default for Gemini TTS
    const numChannels = 1;
    const dataInt16 = new Int16Array(bytes.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
};

// --- API FETCH HELPER ---

const callHybridChat = async (payload: any, signal?: AbortSignal) => {
    // Default 60s timeout if no signal provided
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const body = JSON.stringify(payload);
    if (body.length > 5 * 1024 * 1024) {
        console.warn(`>> LARGE PAYLOAD DETECTED: ${(body.length / 1024 / 1024).toFixed(2)} MB. STRIPPING OLDER IMAGES...`);
    }

    const customGeminiKey = localStorage.getItem('custom_gemini_api_key');
    const customOpenRouterKey = localStorage.getItem('custom_openrouter_api_key');

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "x-gemini-key": customGeminiKey || "",
                "x-openrouter-key": customOpenRouterKey || ""
            },
            body,
            signal: signal || controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
            let errData;
            try {
                errData = await response.json();
            } catch(e) {
                errData = { error: response.statusText };
            }
            throw new Error(errData.error || `Server Error (${response.status})`);
        }
        
        return await response.json();
    } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error("Request timed out or was aborted. Please check your connection.");
        }
        if (err instanceof TypeError && err.message === 'Failed to fetch') {
            const sizeMB = (body.length / 1024 / 1024).toFixed(2);
            throw new Error(`UPLINK FAILURE: Failed to fetch. Possible causes: 1) Payload too large (${sizeMB}MB), 2) Server rebooting, 3) Network disconnect.`);
        }
        throw err;
    }
};

// --- EXPORTED SERVICE FUNCTIONS ---

export const generateWaifuAvatar = async (profile: WaifuProfile, referenceImage?: string): Promise<string | null> => {
    const model = localStorage.getItem('waifu_model_image') || 'gemini-3-pro-image-preview';
    const customGeminiKey = localStorage.getItem('custom_gemini_api_key');
    const prompt = `Atmospheric portrait of ${profile.name}. Appearance: ${profile.appearance}. Style: Cyberpunk.`;
    const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "x-gemini-key": customGeminiKey || "" 
        },
        body: JSON.stringify({ prompt, referenceImage, model })
    });
    const data = await res.json();
    return data.url || null;
};

export const generateSceneImage = async (description: string, isCombat: boolean): Promise<string | null> => {
    const model = localStorage.getItem('waifu_model_image') || 'gemini-3-pro-image-preview';
    const customGeminiKey = localStorage.getItem('custom_gemini_api_key');
    const prompt = `Cyberpunk wasteland scene: ${description}. ${isCombat ? "Intense combat." : "Atmospheric exploration."}`;
    const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "x-gemini-key": customGeminiKey || "" 
        },
        body: JSON.stringify({ prompt, model })
    });
    const data = await res.json();
    return data.url || null;
};

export const generateAdventureTurn = async (
    historyContext: string,
    action: string,
    stats: any,
    profile: WaifuProfile,
    chronicle: ChronicleEntry[],
    attachments: Attachment[],
    signal?: AbortSignal
): Promise<any> => {
    const customGeminiKey = localStorage.getItem('custom_gemini_api_key');
    const res = await fetch("/api/adventure-turn", {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "x-gemini-key": customGeminiKey || "" 
        },
        body: JSON.stringify({ historyContext, action, stats, profile, chronicle }),
        signal
    });
    return await res.json();
};

export const updateChronicle = async (lastUserMsg: string, lastAiMsg: string): Promise<string | null> => {
    const customGeminiKey = localStorage.getItem('custom_gemini_api_key');
    const res = await fetch("/api/update-chronicle", {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "x-gemini-key": customGeminiKey || "" 
        },
        body: JSON.stringify({ lastUserMsg, lastAiMsg })
    });
    const data = await res.json();
    return data.summary || null;
};

export const summarizeChatHistory = async (messages: Message[]): Promise<string | null> => {
    const customGeminiKey = localStorage.getItem('custom_gemini_api_key');
    const res = await fetch("/api/summarize-history", {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "x-gemini-key": customGeminiKey || "" 
        },
        body: JSON.stringify({ messages })
    });
    const data = await res.json();
    return data.summary || null;
};

export const generateSpeech = async (text: string): Promise<string | null> => {
    const voice = localStorage.getItem('waifu_voice') || 'Kore';
    const customGeminiKey = localStorage.getItem('custom_gemini_api_key');
    const res = await fetch("/api/generate-speech", {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "x-gemini-key": customGeminiKey || "" 
        },
        body: JSON.stringify({ text, voice })
    });
    const data = await res.json();
    return data.audio || null;
};

export const chatWithWaifu = async (
    profile: WaifuProfile,
    history: Message[],
    input: string,
    attachments: Attachment[],
    chronicle: ChronicleEntry[],
    gameContext: string,
    signal?: AbortSignal
): Promise<string> => {
    const model = localStorage.getItem('waifu_model_chat') || 'gemini-3.1-pro-preview';
    const provider = localStorage.getItem('waifu_provider_chat') || 'gemini';

    // 1. Truncate history to last 40 messages to maintain better conversational flow
    // 2. Strip heavy base64 data from old messages in history (keep only the last 3 turn's attachments)
    const sanitizedHistory = history.slice(-40).map((m, index, arr) => {
        // If it's not one of the last 3 messages in our slice, strip attachments to save massive overhead
        if (index < arr.length - 3 && m.attachments) {
            return { ...m, attachments: [] }; 
        }
        return m;
    });

    // Determine if the last message in history is already the 'input' (it usually is from ChatInterface)
    const lastMsg = sanitizedHistory[sanitizedHistory.length - 1];
    let currentMessages = sanitizedHistory;
    
    if (!lastMsg || lastMsg.content !== input) {
        currentMessages = [
            ...sanitizedHistory,
            { role: 'user', content: input, timestamp: Date.now(), id: 'temp', attachments }
        ];
    } else if (lastMsg && attachments.length > 0 && (!lastMsg.attachments || lastMsg.attachments.length === 0)) {
        // If last message matches text but missing attachments, add them
        lastMsg.attachments = attachments;
    }

    const result = await callHybridChat({
        model,
        provider,
        messages: currentMessages,
        profile,
        chronicle,
        gameContext
    }, signal);

    return result.text;
};

export const probeModelSpeed = async (model: string, provider: string): Promise<number> => {
    const start = Date.now();
    await callHybridChat({
        model,
        provider,
        messages: [{ role: 'user', content: 'Ping.' }],
        profile: { name: 'Probe' },
        chronicle: [],
        gameContext: ''
    });
    return Date.now() - start;
};

// --- END OF SERVICE ---
