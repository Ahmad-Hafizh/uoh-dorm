import { demoHandler } from '@/lib/demo/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export { demoHandler as GET, demoHandler as POST, demoHandler as PATCH, demoHandler as DELETE };
