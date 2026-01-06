import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://d2bcart.com'

    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/admin/', '/wholesaler/', '/api/'],
        },
        sitemap: `${baseUrl}/sitemap.xml`,
    }
}
