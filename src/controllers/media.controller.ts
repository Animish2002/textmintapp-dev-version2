// src/controllers/media.controller.ts
import { Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { mediaUploads, users } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';

// File type configurations
const FILE_CONFIGS = {
  images: {
    maxSize: 16 * 1024 * 1024, // 16MB
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    folder: 'images'
  },
  videos: {
    maxSize: 16 * 1024 * 1024, // 16MB
    allowedTypes: ['video/mp4', 'video/webm', 'video/mov', 'video/avi'],
    folder: 'videos'
  },
  documents: {
    maxSize: 50 * 1024 * 1024, // 50MB
    allowedTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ],
    folder: 'documents'
  }
};

/**
 * Get file category based on MIME type
 */
const getFileCategory = (mimeType: string): string | null => {
  for (const [category, config] of Object.entries(FILE_CONFIGS)) {
    if (config.allowedTypes.includes(mimeType)) {
      return category;
    }
  }
  return null;
};

/**
 * Generate a clean filename
 */
const generateFileName = (originalName: string, userId: string): string => {
  const timestamp = Date.now();
  const extension = originalName.split('.').pop();
  const baseName = originalName.split('.').slice(0, -1).join('.');
  const cleanBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_');
  return `${cleanBaseName}_${timestamp}.${extension}`;
};

/**
 * Create user folder structure in R2 if it doesn't exist
 */
const ensureUserFolderStructure = async (r2: R2Bucket, userId: string, userName: string): Promise<void> => {
  const sanitizedUserName = userName.replace(/[^a-zA-Z0-9-_]/g, '_');
  const folders = ['images', 'videos', 'documents'];
  
  for (const folder of folders) {
    const folderPath = `${sanitizedUserName}_${userId}/${folder}/`;
    // Create a placeholder file to ensure folder exists
    await r2.put(`${folderPath}.folder`, new ArrayBuffer(0));
  }
};

/**
 * Upload media file to R2 storage
 */
export const uploadMedia = async (c: Context) => {
  const d1 = c.env.DB as D1Database;
  const r2 = c.env.R2_BUCKET as R2Bucket;
  const db = drizzle(d1, { schema });

  try {
    // Get user from auth middleware - the middleware sets 'user' with the decoded JWT payload
    const user = c.get('user');
    if (!user || !user.id) {
      return c.json({ error: 'User information not found' }, 401);
    }

    const userId = user.id;

    // Get user details from database (optional - you might already have what you need from JWT)
    const userDetails = await db.select().from(users).where(eq(users.id, userId)).get();
    if (!userDetails) {
      return c.json({ error: 'User not found in database' }, 404);
    }

    // Parse form data
    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    // Validate file type
    const fileCategory = getFileCategory(file.type);
    if (!fileCategory) {
      return c.json({ 
        error: 'Unsupported file type. Allowed types: images (JPEG, PNG, GIF, WebP), videos (MP4, WebM, MOV, AVI), documents (PDF, DOC, DOCX, TXT)' 
      }, 400);
    }

    // Validate file size
    const config = FILE_CONFIGS[fileCategory as keyof typeof FILE_CONFIGS];
    if (file.size > config.maxSize) {
      const maxSizeMB = config.maxSize / (1024 * 1024);
      return c.json({ 
        error: `File size exceeds limit. Maximum allowed: ${maxSizeMB}MB` 
      }, 400);
    }

    // Generate file path
    const sanitizedUserName = userDetails.name?.replace(/[^a-zA-Z0-9-_]/g, '_') || 'user';
    const fileName = generateFileName(file.name, userId);
    const filePath = `${sanitizedUserName}_${userId}/${config.folder}/${fileName}`;

    // Ensure user folder structure exists
    await ensureUserFolderStructure(r2, userId, sanitizedUserName);

    // Upload to R2
    const fileBuffer = await file.arrayBuffer();
    await r2.put(filePath, fileBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
    });
    
console.log(c.env.R2_URL);

    // Generate public URL (adjust based on your R2 configuration)
    const publicUrl = c.env.R2_URL+`/${filePath}`;

    // Save to database
    const mediaId = crypto.randomUUID();
    await db.insert(mediaUploads).values({
      id: mediaId,
      userId: userId,
      fileName: file.name,
      fileType: file.type,
      r2Url: publicUrl,
      uploadedAt: new Date(),
    }).run();

    return c.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        id: mediaId,
        fileName: file.name,
        fileType: file.type,
        url: publicUrl,
        category: fileCategory,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      }
    }, 201);

  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ error: 'Failed to upload file' }, 500);
  }
};

/**
 * Get user's media uploads with pagination
 */
export const getUserMedia = async (c: Context) => {
  const d1 = c.env.DB as D1Database;
  const db = drizzle(d1, { schema });

  try {
    // Get user from auth middleware
    const user = c.get('user');
    if (!user || !user.id) {
      return c.json({ error: 'User information not found' }, 401);
    }

    const userId = user.id;

    // Get query parameters
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const fileType = c.req.query('fileType'); // Optional filter

    const offset = (page - 1) * limit;

    // Build query conditions
    let whereCondition = eq(mediaUploads.userId, userId);
    if (fileType) {
      const category = getFileCategory(fileType);
      if (category) {
        // You might want to add a category column to your mediaUploads table
        // For now, we'll filter by fileType directly
        whereCondition = and(
          whereCondition,
          eq(mediaUploads.fileType, fileType)
        );
      }
    }

    // Get media uploads
    const uploads = await db
      .select()
      .from(mediaUploads)
      .where(whereCondition)
      .orderBy(desc(mediaUploads.uploadedAt))
      .limit(limit)
      .offset(offset)
      .all();

    // Get total count for pagination
    const totalResult = await db
      .select({ count: mediaUploads.id })
      .from(mediaUploads)
      .where(whereCondition)
      .all();

    const totalCount = totalResult.length;

    return c.json({
      success: true,
      data: uploads,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      }
    });

  } catch (error) {
    console.error('Get media error:', error);
    return c.json({ error: 'Failed to fetch media' }, 500);
  }
};

/**
 * Delete media file
 */
export const deleteMedia = async (c: Context) => {
  const d1 = c.env.DB as D1Database;
  const r2 = c.env.R2_BUCKET as R2Bucket;
  const db = drizzle(d1, { schema });

  try {
    // Get user from auth middleware
    const user = c.get('user');
    if (!user || !user.id) {
      return c.json({ error: 'User information not found' }, 401);
    }

    const userId = user.id;
    const mediaId = c.req.param('id');

    // Find the media record
    const media = await db
      .select()
      .from(mediaUploads)
      .where(and(
        eq(mediaUploads.id, mediaId),
        eq(mediaUploads.userId, userId)
      ))
      .get();

    if (!media) {
      return c.json({ error: 'Media not found' }, 404);
    }

    // Extract file path from URL
    const filePath = media.r2Url.split('/').slice(-3).join('/'); // Adjust based on your URL structure

    // Delete from R2
    await r2.delete(filePath);

    // Delete from database
    await db
      .delete(mediaUploads)
      .where(and(
        eq(mediaUploads.id, mediaId),
        eq(mediaUploads.userId, userId)
      ))
      .run();

    return c.json({
      success: true,
      message: 'Media deleted successfully'
    });

  } catch (error) {
    console.error('Delete media error:', error);
    return c.json({ error: 'Failed to delete media' }, 500);
  }
};