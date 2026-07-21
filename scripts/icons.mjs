import sharp from 'sharp'
import { readFile } from 'node:fs/promises'

const icon = await readFile('public/icon.svg')
const maskable = await readFile('public/icon-maskable.svg')

await sharp(icon, { density: 300 }).resize(192, 192).png().toFile('public/pwa-192.png')
await sharp(icon, { density: 300 }).resize(512, 512).png().toFile('public/pwa-512.png')
await sharp(icon, { density: 300 }).resize(180, 180).png().toFile('public/apple-touch-icon.png')
await sharp(maskable, { density: 300 }).resize(512, 512).png().toFile('public/maskable-512.png')

console.log('icons generated')
