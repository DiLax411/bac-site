import { getCollection, type CollectionEntry } from 'astro:content';

export type Kind = 'Viết' | 'Nghiên cứu' | 'Ý tưởng' | 'Truyện';

const COLLECTION_INFO: Record<'viet' | 'nghiencuu' | 'ytuong' | 'truyen', { kind: Kind; base: string }> = {
  viet: { kind: 'Viết', base: '/viet' },
  nghiencuu: { kind: 'Nghiên cứu', base: '/nghien-cuu' },
  ytuong: { kind: 'Ý tưởng', base: '/y-tuong' },
  truyen: { kind: 'Truyện', base: '/truyen' },
};

export type UnifiedEntry = {
  id: string;
  collection: 'viet' | 'nghiencuu' | 'ytuong' | 'truyen';
  kind: Kind;
  href: string;
  title: string;
  subtitle?: string;
  date: Date;
  updated?: Date;
  tags: string[];
  series?: string;
  changedMindFrom?: string;
  status: 'draft' | 'published';
};

function toUnified(
  collection: 'viet' | 'nghiencuu' | 'ytuong' | 'truyen',
  entry: CollectionEntry<'viet'> | CollectionEntry<'nghiencuu'> | CollectionEntry<'ytuong'> | CollectionEntry<'truyen'>
): UnifiedEntry {
  const info = COLLECTION_INFO[collection];
  return {
    id: entry.id,
    collection,
    kind: info.kind,
    href: `${info.base}/${entry.id}/`,
    title: entry.data.title,
    subtitle: entry.data.subtitle,
    date: entry.data.date,
    updated: entry.data.updated,
    tags: entry.data.tags ?? [],
    series: entry.data.series,
    changedMindFrom: entry.data.changedMindFrom,
    status: entry.data.status,
  };
}

let cache: UnifiedEntry[] | null = null;

/** Gộp toàn bộ bài đã published từ cả 3 collection, sắp xếp mới nhất trước. */
export async function getAllPublishedEntries(): Promise<UnifiedEntry[]> {
  if (cache) return cache;

  const [viet, nghiencuu, ytuong, truyen] = await Promise.all([
    getCollection('viet', ({ data }) => data.status === 'published'),
    getCollection('nghiencuu', ({ data }) => data.status === 'published'),
    getCollection('ytuong', ({ data }) => data.status === 'published'),
    getCollection('truyen', ({ data }) => data.status === 'published'),
  ]);

  const all = [
    ...viet.map(e => toUnified('viet', e)),
    ...nghiencuu.map(e => toUnified('nghiencuu', e)),
    ...ytuong.map(e => toUnified('ytuong', e)),
    ...truyen.map(e => toUnified('truyen', e)),
  ].sort((a, b) => b.date.valueOf() - a.date.valueOf());

  cache = all;
  return all;
}

/** Tìm một bài theo id, không quan tâm nó thuộc collection nào. */
export async function findEntryById(id: string): Promise<UnifiedEntry | undefined> {
  const all = await getAllPublishedEntries();
  return all.find(e => e.id === id);
}

/** Những bài đã "cập nhật quan điểm" từ bài có id này (liên kết ngược). */
export async function findEntriesReferencing(id: string): Promise<UnifiedEntry[]> {
  const all = await getAllPublishedEntries();
  return all.filter(e => e.changedMindFrom === id);
}

/** Đếm số bài theo từng tag, sắp xếp theo số lượng giảm dần rồi theo tên. */
export async function getTagCounts(): Promise<{ tag: string; count: number }[]> {
  const all = await getAllPublishedEntries();
  const counts = new Map<string, number>();
  for (const entry of all) {
    for (const tag of entry.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'vi'));
}

/** Toàn bộ bài có chứa một tag cụ thể, mới nhất trước. */
export async function getEntriesByTag(tag: string): Promise<UnifiedEntry[]> {
  const all = await getAllPublishedEntries();
  return all.filter(e => e.tags.includes(tag));
}

/** URL-slug hoá tag để dùng trong đường dẫn (giữ nguyên nếu đã là slug hợp lệ). */
export function slugifyTag(tag: string): string {
  return tag
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // bỏ dấu
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
