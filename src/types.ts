/**
 * Raw image entry from VSCO data export `images.json`.
 */
export interface VscoExportImage {
  id: string;
  site_id: number;
  user_id: number;
  capture_date: number;
  upload_date: number;
  height: number;
  width: number;
  file_name: string;
  is_video: boolean;
  perma_subdomain: string;
  responsive_url: string;
  share_link: string;
  description?: string;
  image_meta?: {
    aperture?: number;
    iso?: number;
    make?: string;
    model?: string;
    shutter_speed?: string;
    [key: string]: unknown;
  };
  location?: {
    lat: number;
    lng: number;
  };
}

/**
 * Processed image ready for download.
 */
export interface ImageEntry {
  id: string;
  url: string;
  fileName: string;
  width: number;
  height: number;
  username: string;
  captureDate: number;
  description: string;
}

/**
 * Manifest entry for a downloaded image.
 */
export interface ManifestImage {
  image_author: string;
  vsco_username: string;
  vsco_url: string;
  vsco_image_id: string;
  width: number;
  height: number;
  description: string;
  direct_image_url: string;
  local_path: string;
  capture_date: string;
}

/**
 * Full manifest structure.
 */
export interface Manifest {
  generated_at: string;
  version: string;
  source: string;
  image_count: number;
  images: Record<string, ManifestImage>;
}

/**
 * Download result for a single image.
 */
export interface DownloadResult {
  id: string;
  success: boolean;
  skipped: boolean;
  error?: string;
}
