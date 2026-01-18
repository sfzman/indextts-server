
import { GoogleGenAI, Modality } from "@google/genai";
import { VoiceProject, EmotionType } from "../types";
import { decodeBase64ToUint8Array, decodeAudioData, createAudioUrlFromBuffer } from "./audioUtils";

const API_KEY = process.env.API_KEY || '';

export class GeminiVoiceService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: API_KEY });
  }

  async generateClonedVoice(project: VoiceProject): Promise<string> {
    if (!project.voiceReference) throw new Error("需要上传声音参考音频。");
    if (!project.script) throw new Error("请输入需要朗读的台词脚本。");

    let characterProfile = "一个普通人的声音";
    let emotionalInstruction = "";

    try {
      // 步骤 1: 分析声音参考
      const analysisParts: any[] = [
        {
          inlineData: {
            mimeType: 'audio/mpeg',
            data: project.voiceReference
          }
        },
        {
          text: "分析这段音频中的音色。用中文简要描述其音高、音质、语速以及独有的特征，不超过30字。"
        }
      ];

      const analysisResponse = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: analysisParts }
      });

      characterProfile = analysisResponse.text || "独特的音色";

      // 处理情感逻辑
      if (project.emotionType === EmotionType.VECTORS) {
        const v = project.emotionVectors;
        const activeEmotions = [];
        if (v.happy > 0.1) activeEmotions.push(`喜悦(强度:${v.happy})`);
        if (v.angry > 0.1) activeEmotions.push(`愤怒(强度:${v.angry})`);
        if (v.sad > 0.1) activeEmotions.push(`哀伤(强度:${v.sad})`);
        if (v.fear > 0.1) activeEmotions.push(`恐惧(强度:${v.fear})`);
        if (v.disgust > 0.1) activeEmotions.push(`厌恶(强度:${v.disgust})`);
        if (v.depressed > 0.1) activeEmotions.push(`低落(强度:${v.depressed})`);
        if (v.surprised > 0.1) activeEmotions.push(`惊喜(强度:${v.surprised})`);
        if (v.calm > 0.1) activeEmotions.push(`平静(强度:${v.calm})`);
        
        emotionalInstruction = activeEmotions.length > 0 
          ? `按照以下情感向量的强度进行配音演播：${activeEmotions.join('，')}。`
          : "语气平直，不带明显情感。";
      } else if (project.emotionType === EmotionType.REFERENCE_AUDIO && project.emotionReference) {
        const emotionAnalysisParts: any[] = [
          {
            inlineData: {
              mimeType: 'audio/mpeg',
              data: project.emotionReference
            }
          },
          {
            text: "识别这段音频中说话者的情感和表达风格。用中文简要描述其情感特征，不超过20字。"
          }
        ];
        const emotionResponse = await this.ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: { parts: emotionAnalysisParts }
        });
        emotionalInstruction = `模仿这种情感风格：${emotionResponse.text}。`;
      } else {
        emotionalInstruction = "保持与原始声音参考音频中一致的情感。";
      }
    } catch (e) {
      console.error("分析失败，使用默认配置", e);
    }

    // 步骤 2: 使用 TTS 模型生成
    const ttsPrompt = `你现在是一个专业的配音演员。
音色特征：${characterProfile}。
情感指令：${emotionalInstruction}
请以此音色和情感朗读以下文本：
"${project.script}"`;

    const response = await this.ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: ttsPrompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("模型未生成任何音频数据。");

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const audioBytes = decodeBase64ToUint8Array(base64Audio);
    const audioBuffer = await decodeAudioData(audioBytes, audioContext);
    
    return await createAudioUrlFromBuffer(audioBuffer);
  }
}
