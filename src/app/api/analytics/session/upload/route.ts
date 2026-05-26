import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import cloudinary from '@/lib/cloudinary';
import { Readable } from 'stream';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ?? null;

    const data = await req.json();
    const durationSeconds = data.durationSeconds || 0;

    // Convert the data to string
    const jsonString = JSON.stringify(data);
    const buffer = Buffer.from(jsonString, 'utf-8');

    // Create a readable stream from the buffer
    const stream = Readable.from(buffer);

    // Upload to Cloudinary using upload_stream
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: 'raw', folder: 'newsweb_sessions/', format: 'json' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.pipe(uploadStream);
    });

    const secureUrl = (uploadResult as any).secure_url;

    // Save to database
    const recording = await prisma.sessionRecording.create({
      data: {
        userId,
        cloudinaryUrl: secureUrl,
        durationSeconds,
      },
    });

    return NextResponse.json({ success: true, recording });
  } catch (error) {
    console.error('SESSION_UPLOAD_ERROR:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
