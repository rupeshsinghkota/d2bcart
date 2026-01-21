import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'D2BCart - Direct to Business Marketplace',
        short_name: 'D2BCart',
        description: 'Connect directly with manufacturers. Wholesale marketplace.',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#059669',
        icons: [
            {
                src: '/icon',
                sizes: '32x32',
                type: 'image/png',
            },
            {
                src: '/apple-icon',
                sizes: '180x180',
                type: 'image/png',
            },
            {
                src: '/logo.svg',
                sizes: 'any',
                type: 'image/svg+xml'
            }
        ],
    }
}
