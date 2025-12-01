import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

type Entry = {
  id: number;
  src: string;
};

export async function GET() {
  const dir = path.join(process.cwd(), 'public', 'peiwanRecommend');
  try {
    const files = await fs.readdir(dir);
    const data: Entry[] = files
      .map((name) => {
        const match = name.match(/^(\d+)\.(png|jpg|jpeg|gif)$/i);
        if (!match) return null;
        const id = Number(match[1]);
        if (Number.isNaN(id)) return null;
        return { id, src: `/peiwanRecommend/${name}` };
      })
      .filter((entry): entry is Entry => Boolean(entry))
      .sort((a, b) => a.id - b.id);

    return NextResponse.json({ data });
  } catch (err) {
    console.error('Failed to read peiwanRecommend folder', err);
    return NextResponse.json({ data: [], error: 'failed_to_read_folder' }, { status: 500 });
  }
}
