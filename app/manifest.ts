import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'sparpreis-vibe',
    short_name: 'sparpreis-vibe',
    description: 'Finde die günstigste Bahnreise mit einem Preiskalender',
        start_url: '/',
        display: 'standalone',
        background_color: '#1E283A',
        theme_color: '#1E283A',
        icons: [
            {
                "src": "android-chrome-192x192.png",
                "sizes": "192x192",
                "type": "image/png"
            },
            {
                "src": "android-chrome-512x512.png",
                "sizes": "512x512",
                "type": "image/png"
            },
            {
                "src": "favicon-16x16.png",
                "sizes": "16x16",
                "type": "image/png"
            },
            {
                "src": "favicon-32x32.png",
                "sizes": "32x32",
                "type": "image/png"
            },
        ],
    }
}