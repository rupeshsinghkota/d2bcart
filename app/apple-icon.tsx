import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
    width: 180,
    height: 180,
}
export const contentType = 'image/png'

export default function Icon() {
    return new ImageResponse(
        (
            <div
                style={{
                    fontSize: 120,
                    background: '#059669', // Emerald 600
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    borderRadius: 24, // Apple style rounded corners (though OS does it too, this looks good on other platforms)
                    fontWeight: 800,
                }}
            >
                D
            </div>
        ),
        {
            ...size,
        }
    )
}
