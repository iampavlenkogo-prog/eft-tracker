import { v2 as cloudinary } from 'cloudinary'
import multer from 'multer'
import { Readable } from 'stream'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export const uploadBuffer = (buffer: Buffer, folder: string, mimetype?: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const resourceType = mimetype === 'application/pdf' ? 'raw' : 'image'
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (err, result) => (err ? reject(err) : resolve(result!.secure_url))
    )
    Readable.from(buffer).pipe(stream)
  })

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  if (allowed.includes(file.mimetype)) cb(null, true)
  else cb(new Error('Дозволені тільки PDF та зображення (jpg, png, webp)'))
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter,
})

export const uploadLarge = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter,
})
