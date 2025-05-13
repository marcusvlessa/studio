
import { config } from 'dotenv';
config();

import '@/ai/flows/analyze-image.ts';
import '@/ai/flows/transcribe-audio.ts';
import '@/ai/flows/find-entity-relationships.ts';
import '@/ai/flows/analyze-document-flow.ts';
import '@/ai/flows/generate-ric-flow.ts';
import '@/ai/flows/consolidate-audio-analyses-flow.ts';
import '@/ai/flows/classify-text-for-crimes-flow.ts';
