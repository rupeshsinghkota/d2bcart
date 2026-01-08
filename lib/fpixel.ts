export const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID || '881326567810044'

export const pageview = () => {
    if (typeof window.fbq !== 'undefined') {
        window.fbq('track', 'PageView')
    }
}

// https://developers.facebook.com/docs/facebook-pixel/advanced/
export const event = (name: string, options = {}) => {
    if (typeof window.fbq !== 'undefined') {
        window.fbq('track', name, options)
    }
}
