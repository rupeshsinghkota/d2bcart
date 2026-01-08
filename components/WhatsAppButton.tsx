'use client'

import Image from 'next/image'

export default function WhatsAppButton() {
    return (
        <a
            href="https://wa.me/919117474683"
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-lg transition-transform hover:scale-110 hover:shadow-xl"
            aria-label="Chat on WhatsApp"
        >
            <div className="relative h-8 w-8">
                <Image
                    src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
                    alt="WhatsApp"
                    fill
                    className="object-contain invert" // Inverting to make it white if using the official green logo background
                    style={{ filter: 'brightness(0) invert(1)' }}
                />
            </div>
        </a>
    )
}
