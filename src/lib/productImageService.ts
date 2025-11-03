import { supabase } from './supabase';
import { withRetry, storageFromSupabase } from './db';
import { toast } from 'sonner';

export interface UploadedImage {
  id: string;
  url: string;
  is_featured: boolean;
  media_type: 'image';
  display_order: number;
}

export interface MediaItemForUpload {
  id: string;
  url: string;
  file?: File;
  isFeatured: boolean;
  mediaType: 'image';
}

async function compressImage(file: File, maxWidth: number = 1200): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxWidth) {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Could not compress image'));
              return;
            }

            const compressedFile = new File(
              [blob],
              file.name.replace(/\.\w+$/, '.jpg'),
              { type: 'image/jpeg' }
            );
            resolve(compressedFile);
          },
          'image/jpeg',
          0.85
        );
      };
      img.onerror = () => reject(new Error('Could not load image'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export async function uploadProductImages(
  files: File[],
  userId: string,
  productId: string,
  onProgress?: (uploaded: number, total: number) => void
): Promise<UploadedImage[]> {
  if (!files.length) return [];

  const uploadedImages: UploadedImage[] = [];

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      try {
        const compressedFile = await compressImage(file);

        const fileName = `product-${productId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
        const filePath = `product/${userId}/${fileName}`;

        const { data: uploadData, error: uploadError } = await storageFromSupabase(
          () =>
            supabase.storage
              .from('public')
              .upload(filePath, compressedFile, {
                cacheControl: '3600',
                upsert: false,
              }),
          { maxRetries: 3 }
        );

        if (uploadError) {
          console.error(`Error uploading image ${i + 1}:`, uploadError);
          toast.error(`Erro ao fazer upload da imagem ${i + 1}: ${uploadError.message}`);
          continue;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from('public').getPublicUrl(filePath);

        const uploadedImage: UploadedImage = {
          id: `new-${Date.now()}-${i}`,
          url: publicUrl,
          is_featured: i === 0,
          media_type: 'image',
          display_order: i,
        };

        uploadedImages.push(uploadedImage);

        onProgress?.(i + 1, files.length);
      } catch (error) {
        console.error(`Error processing image ${i + 1}:`, error);
        toast.error(`Erro ao processar imagem ${i + 1}`);
      }
    }

    return uploadedImages;
  } catch (error) {
    console.error('Error in uploadProductImages:', error);
    throw error;
  }
}

export async function saveProductImages(
  productId: string,
  uploadedImages: UploadedImage[],
  userId: string
): Promise<void> {
  if (!uploadedImages.length) return;

  try {
    const imagesToInsert = uploadedImages.map((img) => ({
      product_id: productId,
      url: img.url,
      is_featured: img.is_featured,
      media_type: img.media_type,
      display_order: img.display_order,
    }));

    const { error } = await withRetry(() =>
      supabase
        .from('product_images')
        .insert(imagesToInsert)
        .then((result) => {
          if (result.error) throw result.error;
          return result;
        })
    );

    if (error) throw error;
  } catch (error) {
    console.error('Error saving product images:', error);
    throw error;
  }
}

export async function deleteProductImage(imageUrl: string): Promise<void> {
  try {
    const urlObj = new URL(imageUrl);
    const path = urlObj.pathname.split('/public/')[1];

    if (path) {
      await storageFromSupabase(
        () =>
          supabase.storage
            .from('public')
            .remove([path])
            .then((result) => {
              if (result.error) throw result.error;
              return result;
            }),
        { maxRetries: 2 }
      );
    }
  } catch (error) {
    console.error('Error deleting image from storage:', error);
  }
}

export async function deleteProductImageRecord(imageId: string, userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('product_images')
      .delete()
      .eq('id', imageId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting image record:', error);
  }
}

export async function updateFeaturedImage(
  productId: string,
  imageUrl: string
): Promise<void> {
  try {
    const { error } = await withRetry(() =>
      supabase
        .from('products')
        .update({ featured_image_url: imageUrl })
        .eq('id', productId)
        .then((result) => {
          if (result.error) throw result.error;
          return result;
        })
    );

    if (error) throw error;
  } catch (error) {
    console.error('Error updating featured image:', error);
  }
}

export async function updateImageOrder(
  productId: string,
  images: UploadedImage[]
): Promise<void> {
  try {
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const isFeatured = i === 0;

      if (image.id.startsWith('new-')) {
        continue;
      }

      const { error } = await supabase
        .from('product_images')
        .update({
          is_featured: isFeatured,
          display_order: i,
        })
        .eq('id', image.id);

      if (error) throw error;
    }
  } catch (error) {
    console.error('Error updating image order:', error);
  }
}

export async function fetchProductImages(productId: string): Promise<UploadedImage[]> {
  try {
    const { data, error } = await supabase
      .from('product_images')
      .select('id, url, is_featured, media_type, display_order')
      .eq('product_id', productId)
      .order('display_order', { ascending: true });

    if (error) throw error;

    return (
      data?.map((img) => ({
        id: img.id,
        url: img.url,
        is_featured: img.is_featured || false,
        media_type: img.media_type as 'image',
        display_order: img.display_order || 0,
      })) || []
    );
  } catch (error) {
    console.error('Error fetching product images:', error);
    return [];
  }
}

export async function deleteProductImages(imageIds: string[], userId: string): Promise<void> {
  try {
    const imageRecords = await supabase
      .from('product_images')
      .select('url')
      .in('id', imageIds)
      .then((result) => {
        if (result.error) throw result.error;
        return result.data || [];
      });

    const deletePromises = imageRecords.map((record) =>
      deleteProductImage(record.url).catch((err) => {
        console.error('Error deleting image from storage:', err);
      })
    );

    await Promise.all(deletePromises);

    const { error } = await supabase
      .from('product_images')
      .delete()
      .in('id', imageIds);

    if (error) throw error;
  } catch (error) {
    console.error('Error in deleteProductImages:', error);
  }
}
