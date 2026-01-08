import { ImageResponse } from 'next/og'

// Image metadata
export const size = {
    width: 180,
    height: 180,
}
export const contentType = 'image/png'

// Image generation
export default function Icon() {
    return new ImageResponse(
        (
            // ImageResponse JSX element
            <div
                style={{
                    fontSize: 100,
                    background: 'linear-gradient(to bottom right, #10b981, #059669)', // emerald-500 to 600
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    borderRadius: '36px',
                    fontWeight: 900,
                }}
            >
                D2B
            </div>
        ),
        // ImageResponse options
        {
            ...size,
        }
    )
}
