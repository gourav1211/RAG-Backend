import dotenv from 'dotenv';

// Load environment variables as early as possible
dotenv.config();

console.log('🔧 Environment loaded');
console.log('🔑 OpenAI Key present:', !!process.env.OPENAI_API_KEY);
