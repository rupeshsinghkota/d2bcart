'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Upload, X, Video, Loader2, Play } from 'lucide-react'
import toast from 'react-hot-toast'

interface VideoUploadProps {
    videoUrl?: string
    onVideoChange: (url: string) => void
}

export default function VideoUpload({ videoUrl, onVideoChange }: VideoUploadProps) {
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validate file type
        if (!file.type.startsWith('video/')) {
            toast.error(`${file.name} is not a video file`)
            return
        }

        // Validate file size (max 20MB)
        if (file.size > 20 * 1024 * 1024) {
            toast.error(`${file.name} is too large (max 20MB)`)
            return
        }

        setUploading(true)
        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
            const filePath = `products/videos/${fileName}`

            // Try to upload to 'videos' bucket, fallback to 'images' if it fails
            let bucket = 'videos'
            const { error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(filePath, file)

            if (uploadError) {
                console.warn('Failed to upload to videos bucket, trying images bucket...')
                bucket = 'images'
                const { error: fallbackError } = await supabase.storage
                    .from(bucket)
                    .upload(filePath, file)

                if (fallbackError) throw fallbackError
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from(bucket)
                .getPublicUrl(filePath)

            onVideoChange(publicUrl)
            toast.success('Video uploaded successfully')
        } catch (error: any) {
            console.error('Upload error:', error)
            toast.error(`Failed to upload ${file.name}: ${error.message}`)
        } finally {
            setUploading(false)
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    const removeVideo = () => {
        if (confirm('Are you sure you want to remove this video?')) {
            onVideoChange('')
        }
    }

    return (
        <div className="space-y-4">
            {videoUrl ? (
                <div className="relative aspect-video bg-gray-900 rounded-xl overflow-hidden group">
                    <video
                        src={videoUrl}
                        className="w-full h-full object-contain"
                        controls
                    />
                    <button
                        type="button"
                        onClick={removeVideo}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <Play className="w-12 h-12 text-white fill-current" />
                    </div>
                </div>
            ) : (
                <div
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${uploading
                            ? 'border-gray-200 bg-gray-50'
                            : 'border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 active:scale-[0.98]'
                        }`}
                >
                    {uploading ? (
                        <>
                            <Loader2 className="w-12 h-12 text-emerald-600 mx-auto mb-3 animate-spin" />
                            <p className="font-semibold text-gray-700">Uploading Video...</p>
                            <p className="text-sm text-gray-500 mt-1">Please wait, this may take a moment</p>
                        </>
                    ) : (
                        <>
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-emerald-100 transition-colors">
                                <Video className="w-8 h-8 text-gray-400 group-hover:text-emerald-600" />
                            </div>
                            <p className="font-semibold text-gray-700 mb-1">Upload Product Video</p>
                            <p className="text-sm text-gray-400">
                                MP4, WebM up to 20MB
                            </p>
                            <div className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full inline-flex">
                                <Upload className="w-3 h-3" />
                                Click to Browse
                            </div>
                        </>
                    )}
                </div>
            )}

            <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
                disabled={uploading}
            />
        </div>
    )
}
