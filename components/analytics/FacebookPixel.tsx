'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { useEffect, useState } from 'react';
import * as fpixel from '@/lib/fpixel';

export default function FacebookPixel() {
    const [loaded, setLoaded] = useState(false);
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (!loaded) return;
        fpixel.pageview();
    }, [pathname, searchParams, loaded]);

    return (
        <>
            <Script
                id="fb-pixel"
                src="https://connect.facebook.net/en_US/fbevents.js"
                strategy="afterInteractive"
                onLoad={() => {
                    setLoaded(true);
                    if (!window.fbq) {
                        window.fbq = function () {
                            // eslint-disable-next-line prefer-rest-params
                            window.fbq.callMethod ? window.fbq.callMethod.apply(window.fbq, arguments) : window.fbq.queue.push(arguments);
                        } as any;
                        if (!window._fbq) window._fbq = window.fbq;
                        window.fbq.push = window.fbq;
                        window.fbq.loaded = true;
                        window.fbq.version = '2.0';
                        window.fbq.queue = [];
                    }
                    if (fpixel.FB_PIXEL_ID) {
                        window.fbq('init', fpixel.FB_PIXEL_ID);
                        window.fbq('track', 'PageView');
                    }
                }}
            />
        </>
    );
}
