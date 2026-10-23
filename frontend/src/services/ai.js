import { api, AI_TIMEOUT } from './api.js';

const opt = (o) => ({ timeout: AI_TIMEOUT, ...o });

/**
 * AI endpoints (rate limited). Every response includes `is_sample` and `model`.
 * Common request fields: topic, language (en|hi|mr), platform (slug), category (name or slug),
 * audience, tone, duration_seconds, content_type, instructions.
 */
export const aiService = {
  /** One call for everything -> { title, hooks[], script{}, caption{}, hashtags{broad,medium,niche}, cta, ideas[], is_sample, model } */
  generateAll: (payload, o) => api.post('/ai/generate', payload, opt(o)),
  /** -> { hooks:[{type,text}] } (question, curiosity, problem, benefit, story) */
  hooks: (payload, o) => api.post('/ai/hooks', payload, opt(o)),
  /** -> { script:{hook,introduction,main_points[],examples[],cta,ending,full_script} } */
  script: (payload, o) => api.post('/ai/script', payload, opt(o)),
  /** -> { caption:{instagram_caption,youtube_description,short_description,cta,keywords[]} } */
  caption: (payload, o) => api.post('/ai/caption', payload, opt(o)),
  /** -> { hashtags:{broad[],medium[],niche[]} } */
  hashtags: (payload, o) => api.post('/ai/hashtags', payload, opt(o)),
  /** -> { ideas:[{title,topic,format,reason,suggested_hook}] } (uses current trends + profile) */
  ideas: (payload, o) => api.post('/ai/ideas', payload ?? {}, opt(o)),
  /**
   * Regenerate one section.
   * @param {{section:'hooks'|'hook'|'script'|'caption'|'hashtags'|'title'|'cta'|'ideas', hook_type?:string, params:object, current?:any}} payload
   * -> { section, value, is_sample }
   */
  regenerate: (payload, o) => api.post('/ai/regenerate', payload, opt(o)),
  /**
   * Stateless assistant. Send the whole history each time; the page stores it in localStorage (ch_chat_<userId>).
   * @param {{messages:{role:'user'|'assistant',content:string}[], language?:string}} payload
   * -> { message:{role:'assistant',content}, is_sample }
   */
  assistant: (payload, o) => api.post('/ai/assistant', payload, opt(o)),
  /**
   * @param {{source_text:string (min 80 chars), target_platform?:string, language:string, target_duration_seconds?:number}} payload
   * -> { shorts:[{short_idea,hook,suggested_duration_seconds,key_section,short_script,cta}] (3), is_sample }
   */
  longToShort: (payload, o) => api.post('/ai/long-to-short', payload, opt(o)),
  /** @param {{text:string, language:string}} payload -> { summary } */
  summarize: (payload, o) => api.post('/ai/summarize', payload, opt(o)),
  /** @param {{text:string}} payload -> { category, confidence_label } */
  classifyTopic: (payload, o) => api.post('/ai/classify-topic', payload, opt(o)),
};

/** Alias for people who prefer the endpoint's name. */
aiService.generate = aiService.generateAll;

export default aiService;
