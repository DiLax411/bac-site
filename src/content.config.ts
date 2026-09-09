import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Metadata dùng chung: linh hoạt, không ép category cứng.
const baseSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  date: z.coerce.date(),
  updated: z.coerce.date().optional(),
  cover: z.string().optional(),
  tags: z.array(z.string()).default([]),
  series: z.string().optional(),
  status: z.enum(['draft', 'published']).default('published'),
  changedMindFrom: z.string().optional(), // slug của bài cũ mà bài này phản hồi/cập nhật quan điểm
});

const viet = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/viet' }),
  schema: baseSchema,
});

const nghiencuu = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/nghiencuu' }),
  schema: baseSchema,
});

const ytuong = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/ytuong' }),
  schema: baseSchema,
});

const truyen = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/truyen' }),
  schema: baseSchema,
});

export const collections = { viet, nghiencuu, ytuong, truyen };
